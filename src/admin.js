import {
  GoogleAuthProvider,
  browserLocalPersistence,
  getAuth,
  onAuthStateChanged,
  setPersistence,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import {
  collection,
  doc,
  getDocs,
  getFirestore,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import {
  deleteObject,
  getDownloadURL,
  getStorage,
  listAll,
  ref,
  uploadBytesResumable,
} from "firebase/storage";
import { getClientConfig, getFirebaseApp, hasFirebaseConfig } from "./firebase-core";
import { renderMarkdown } from "./markdown";
import { slugify } from "./slug";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const config = getClientConfig();
const elements = {
  authLoading: document.querySelector("[data-auth-loading]"),
  configError: document.querySelector("[data-config-error]"),
  signedOut: document.querySelector("[data-signed-out]"),
  unauthorized: document.querySelector("[data-unauthorized]"),
  unauthorizedEmail: document.querySelector("[data-unauthorized-email]"),
  dashboard: document.querySelector("[data-dashboard]"),
  listView: document.querySelector("[data-list-view]"),
  editorView: document.querySelector("[data-editor-view]"),
  postList: document.querySelector("[data-admin-post-list]"),
  emptyPosts: document.querySelector("[data-empty-posts]"),
  listLoading: document.querySelector("[data-list-loading]"),
  notice: document.querySelector("[data-admin-notice]"),
  userName: document.querySelector("[data-user-name]"),
  form: document.querySelector("[data-post-form]"),
  editorTitle: document.querySelector("[data-editor-title]"),
  title: document.querySelector("#post-title"),
  slug: document.querySelector("#post-slug"),
  excerpt: document.querySelector("#post-excerpt"),
  content: document.querySelector("#post-content"),
  tags: document.querySelector("#post-tags"),
  status: document.querySelector("#post-status"),
  coverInput: document.querySelector("#post-cover"),
  coverPreview: document.querySelector("[data-cover-preview]"),
  removeCover: document.querySelector("[data-remove-cover]"),
  uploadStatus: document.querySelector("[data-upload-status]"),
  uploadProgress: document.querySelector("[data-upload-progress]"),
  preview: document.querySelector("[data-markdown-preview]"),
  saveButton: document.querySelector("[data-save-post]"),
};

let auth;
let db;
let storage;
let posts = [];
let currentPost = null;
let currentPostId = "";
let draftCoverImage = null;
let draftCoverImagePath = null;
let pendingUploadPath = null;
let slugWasEdited = false;
let isSaving = false;
let isUploading = false;
let isSigningIn = false;

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setVisible(element, visible) {
  if (element) element.hidden = !visible;
}

function setNotice(message = "", type = "info") {
  if (!elements.notice) return;
  elements.notice.textContent = message;
  elements.notice.dataset.type = type;
  elements.notice.hidden = !message;
  if (message) elements.notice.focus({ preventScroll: true });
}

function humanizeError(error) {
  const messages = {
    "app/config-missing": "Firebase 尚未設定完成，請檢查 .env.local 後重新建置。",
    "auth/network-request-failed": "登入時網路連線失敗，請檢查連線後重試。",
    "auth/cancelled-popup-request": "前一次登入尚未結束，請重新整理頁面後只點一次登入按鈕。",
    "auth/popup-blocked": "瀏覽器封鎖了登入視窗，請允許彈出式視窗後重試。",
    "auth/popup-closed-by-user": "登入視窗已關閉，尚未完成登入。",
    "auth/unauthorized-domain": "目前網域尚未加入 Firebase Authentication 的授權網域。",
    "duplicate-slug": "這個 slug 已被其他文章使用，請改用另一個網址名稱。",
    "permission-denied": "Firebase 拒絕此操作。請確認登入 UID 與安全規則中的管理員 UID 相同。",
    "storage/unauthorized": "沒有圖片操作權限，請確認 Storage Rules 已部署。",
    "storage/retry-limit-exceeded": "圖片上傳多次重試仍失敗，請稍後再試。",
    unavailable: "Firebase 目前無法連線，請稍後再試。",
  };
  return messages[error?.code] || error?.message || "操作失敗，請稍後再試。";
}

function timestampToDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateTime(value) {
  const date = timestampToDate(value);
  if (!date) return "—";
  return new Intl.DateTimeFormat("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Taipei",
  }).format(date);
}

function statusLabel(status) {
  return status === "published" ? "已發布" : "草稿";
}

function parseTags(value) {
  return [...new Set(String(value)
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean))]
    .slice(0, 20);
}

function renderPostList() {
  if (!elements.postList) return;
  elements.postList.innerHTML = posts.map((post) => `<article class="admin-post-row" data-post-id="${escapeHtml(post.id)}">
    <div class="admin-post-main">
      <span class="status-label status-${escapeHtml(post.status)}">${statusLabel(post.status)}</span>
      <h3>${escapeHtml(post.title)}</h3>
      <p class="admin-post-slug">/blog/${escapeHtml(post.slug)}/</p>
    </div>
    <dl class="admin-post-dates">
      <div><dt>建立</dt><dd>${escapeHtml(formatDateTime(post.createdAt))}</dd></div>
      <div><dt>更新</dt><dd>${escapeHtml(formatDateTime(post.updatedAt))}</dd></div>
    </dl>
    <div class="admin-row-actions">
      <button class="button button-secondary button-small" type="button" data-edit-post>編輯</button>
      <button class="button button-danger button-small" type="button" data-delete-post>刪除</button>
    </div>
  </article>`).join("");
  setVisible(elements.emptyPosts, posts.length === 0);
}

async function loadPosts() {
  setVisible(elements.listLoading, true);
  setVisible(elements.emptyPosts, false);
  setNotice();

  try {
    const snapshot = await getDocs(query(collection(db, "posts"), orderBy("updatedAt", "desc")));
    posts = snapshot.docs.map((postDocument) => ({ id: postDocument.id, ...postDocument.data() }));
    renderPostList();
  } catch (error) {
    posts = [];
    renderPostList();
    setNotice(`貼文列表載入失敗：${humanizeError(error)}`, "error");
  } finally {
    setVisible(elements.listLoading, false);
  }
}

function setCoverPreview() {
  if (!elements.coverPreview) return;
  if (!draftCoverImage) {
    elements.coverPreview.innerHTML = "<p>尚未設定封面圖片。</p>";
    setVisible(elements.removeCover, false);
    return;
  }

  elements.coverPreview.innerHTML = `<img src="${escapeHtml(draftCoverImage)}" alt="目前的封面圖片預覽" />`;
  setVisible(elements.removeCover, true);
}

function updateMarkdownPreview() {
  if (!elements.preview) return;
  const content = elements.content.value.trim();
  elements.preview.innerHTML = content
    ? renderMarkdown(content)
    : "<p class=\"admin-preview-empty\">Markdown 預覽會顯示在這裡。</p>";
}

async function discardPendingUpload() {
  if (!pendingUploadPath || pendingUploadPath === currentPost?.coverImagePath) return;
  const pathToDelete = pendingUploadPath;
  pendingUploadPath = null;
  try {
    await deleteObject(ref(storage, pathToDelete));
  } catch {
    // The post is still safe; an orphaned admin-only file can be removed later.
  }
}

async function showListView({ discardUpload = true } = {}) {
  if (discardUpload) await discardPendingUpload();
  setVisible(elements.editorView, false);
  setVisible(elements.listView, true);
  elements.form.reset();
  currentPost = null;
  currentPostId = "";
  draftCoverImage = null;
  draftCoverImagePath = null;
  pendingUploadPath = null;
  slugWasEdited = false;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function openEditor(post = null) {
  currentPost = post;
  currentPostId = post?.id || crypto.randomUUID();
  draftCoverImage = post?.coverImage || null;
  draftCoverImagePath = post?.coverImagePath || null;
  pendingUploadPath = null;
  slugWasEdited = Boolean(post);

  elements.form.reset();
  elements.editorTitle.textContent = post ? "編輯貼文" : "新增貼文";
  elements.title.value = post?.title || "";
  elements.slug.value = post?.slug || "";
  elements.excerpt.value = post?.excerpt || "";
  elements.content.value = post?.content || "";
  elements.tags.value = Array.isArray(post?.tags) ? post.tags.join(", ") : "";
  elements.status.value = post?.status || "draft";
  elements.uploadStatus.textContent = "";
  elements.uploadProgress.value = 0;
  setVisible(elements.uploadProgress, false);
  setCoverPreview();
  updateMarkdownPreview();
  setNotice();
  setVisible(elements.listView, false);
  setVisible(elements.editorView, true);
  elements.title.focus();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function validateImage(file) {
  if (!file.type.startsWith("image/")) {
    throw new Error("只能上傳圖片格式的檔案。");
  }
  if (file.size > MAX_IMAGE_SIZE) {
    throw new Error("圖片大小不可超過 5 MB。");
  }
}

function fileExtension(file) {
  const nameExtension = file.name.match(/\.([a-zA-Z0-9]{1,8})$/)?.[1]?.toLowerCase();
  if (nameExtension) return nameExtension;
  return file.type.split("/")[1]?.replace(/[^a-zA-Z0-9]/g, "") || "img";
}

async function uploadCover(file) {
  validateImage(file);
  if (isUploading) throw new Error("目前已有圖片正在上傳。");

  isUploading = true;
  elements.coverInput.disabled = true;
  elements.uploadStatus.textContent = "準備上傳圖片…";
  elements.uploadProgress.value = 0;
  setVisible(elements.uploadProgress, true);

  try {
    await discardPendingUpload();
    const objectPath = `posts/${currentPostId}/${crypto.randomUUID()}.${fileExtension(file)}`;
    const objectReference = ref(storage, objectPath);
    const uploadTask = uploadBytesResumable(objectReference, file, { contentType: file.type });

    await new Promise((resolve, reject) => {
      uploadTask.on(
        "state_changed",
        (snapshot) => {
          const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          elements.uploadProgress.value = progress;
          elements.uploadStatus.textContent = `圖片上傳中：${progress}%`;
        },
        reject,
        resolve,
      );
    });

    draftCoverImage = await getDownloadURL(objectReference);
    draftCoverImagePath = objectPath;
    pendingUploadPath = objectPath;
    elements.uploadStatus.textContent = "圖片上傳完成，儲存貼文後才會正式套用。";
    setCoverPreview();
  } finally {
    isUploading = false;
    elements.coverInput.disabled = false;
  }
}

function postFormData() {
  const title = elements.title.value.trim();
  const slug = slugify(elements.slug.value);
  const excerpt = elements.excerpt.value.trim();
  const content = elements.content.value.trim();
  const tags = parseTags(elements.tags.value);
  const status = elements.status.value;

  if (!title) throw new Error("請輸入文章標題。");
  if (title.length > 160) throw new Error("文章標題不可超過 160 個字元。");
  if (!slug) throw new Error("請輸入有效的 slug。");
  if (excerpt.length > 500) throw new Error("文章摘要不可超過 500 個字元。");
  if (!content) throw new Error("請輸入文章內容。");
  if (content.length > 300000) throw new Error("文章內容過長，請控制在 300,000 個字元內。");
  if (!["draft", "published"].includes(status)) throw new Error("文章狀態不正確。");

  elements.slug.value = slug;
  return {
    title,
    slug,
    excerpt,
    content,
    coverImage: draftCoverImage,
    coverImagePath: draftCoverImagePath,
    tags,
    status,
  };
}

async function savePost(data) {
  const postReference = doc(db, "posts", currentPostId);
  const newSlugReference = doc(db, "postSlugs", data.slug);

  await runTransaction(db, async (transaction) => {
    const existingPostSnapshot = await transaction.get(postReference);
    const slugSnapshot = await transaction.get(newSlugReference);
    const existingPost = existingPostSnapshot.exists() ? existingPostSnapshot.data() : null;

    if (slugSnapshot.exists() && slugSnapshot.data().postId !== currentPostId) {
      const error = new Error("Duplicate slug");
      error.code = "duplicate-slug";
      throw error;
    }

    const publishedAt = data.status === "published"
      ? (existingPost?.status === "published" && existingPost.publishedAt
          ? existingPost.publishedAt
          : serverTimestamp())
      : null;
    const createdAt = existingPost?.createdAt || serverTimestamp();
    const reservationCreatedAt = slugSnapshot.data()?.createdAt || serverTimestamp();

    transaction.set(postReference, {
      ...data,
      createdAt,
      updatedAt: serverTimestamp(),
      publishedAt,
    });
    transaction.set(newSlugReference, {
      postId: currentPostId,
      createdAt: reservationCreatedAt,
      updatedAt: serverTimestamp(),
    });

    if (existingPost?.slug && existingPost.slug !== data.slug) {
      transaction.delete(doc(db, "postSlugs", existingPost.slug));
    }
  });
}

async function removeStoredObject(objectPath) {
  if (!objectPath) return true;
  try {
    await deleteObject(ref(storage, objectPath));
    return true;
  } catch (error) {
    if (error?.code === "storage/object-not-found") return true;
    return false;
  }
}

async function handleSave(event) {
  event.preventDefault();
  if (isSaving || isUploading) return;

  let data;
  try {
    data = postFormData();
  } catch (error) {
    setNotice(error.message, "error");
    return;
  }

  isSaving = true;
  elements.saveButton.disabled = true;
  elements.saveButton.textContent = "儲存中…";
  setNotice("正在儲存貼文…", "info");
  const previousCoverPath = currentPost?.coverImagePath || null;
  const uploadedPathBeforeSave = pendingUploadPath;

  try {
    await savePost(data);
    const pathsToClean = [...new Set([previousCoverPath, uploadedPathBeforeSave]
      .filter((objectPath) => objectPath && objectPath !== data.coverImagePath))];
    const cleanupResults = await Promise.all(pathsToClean.map(removeStoredObject));
    const oldCoverRemoved = cleanupResults.every(Boolean);
    pendingUploadPath = null;
    await loadPosts();
    await showListView({ discardUpload: false });
    setNotice(
      oldCoverRemoved ? "貼文已成功儲存。" : "貼文已儲存，但舊封面清理失敗，可稍後再試。",
      oldCoverRemoved ? "success" : "warning",
    );
  } catch (error) {
    setNotice(`貼文儲存失敗：${humanizeError(error)}`, "error");
  } finally {
    isSaving = false;
    elements.saveButton.disabled = false;
    elements.saveButton.textContent = "儲存貼文";
  }
}

async function deletePostImages(postId) {
  const folder = ref(storage, `posts/${postId}`);
  const result = await listAll(folder);
  const outcomes = await Promise.allSettled(result.items.map((item) => deleteObject(item)));
  return outcomes.every((outcome) => outcome.status === "fulfilled");
}

async function deletePost(post) {
  const confirmed = window.confirm(`確定要刪除「${post.title}」嗎？\n\n這會同時刪除文章與上傳的圖片，且無法復原。`);
  if (!confirmed) return;

  setNotice(`正在刪除「${post.title}」…`, "info");
  try {
    await runTransaction(db, async (transaction) => {
      const postReference = doc(db, "posts", post.id);
      const snapshot = await transaction.get(postReference);
      if (!snapshot.exists()) return;
      transaction.delete(postReference);
      transaction.delete(doc(db, "postSlugs", snapshot.data().slug));
    });

    let imagesRemoved = true;
    try {
      imagesRemoved = await deletePostImages(post.id);
    } catch {
      imagesRemoved = false;
    }
    await loadPosts();
    setNotice(
      imagesRemoved ? "貼文已刪除。" : "貼文已刪除，但部分圖片未能清理。",
      imagesRemoved ? "success" : "warning",
    );
  } catch (error) {
    setNotice(`刪除失敗：${humanizeError(error)}`, "error");
  }
}

async function handleSignIn() {
  if (isSigningIn) return;
  isSigningIn = true;
  document.querySelectorAll("[data-sign-in]").forEach((button) => {
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
  });
  setNotice("正在開啟 Google 登入視窗…", "info");
  try {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    await signInWithPopup(auth, provider);
    setNotice();
  } catch (error) {
    setNotice(`登入失敗：${humanizeError(error)}`, "error");
    isSigningIn = false;
    document.querySelectorAll("[data-sign-in]").forEach((button) => {
      button.disabled = false;
      button.removeAttribute("aria-busy");
    });
  }
}

async function handleSignOut() {
  try {
    await discardPendingUpload();
    await signOut(auth);
    setNotice("已登出。", "success");
  } catch (error) {
    setNotice(`登出失敗：${humanizeError(error)}`, "error");
  }
}

function showAuthState(user) {
  setVisible(elements.authLoading, false);
  setVisible(elements.signedOut, !user);
  setVisible(elements.unauthorized, false);
  setVisible(elements.dashboard, false);

  if (!user) return;
  const isAdmin = Boolean(config.adminUid) && user.uid === config.adminUid;
  if (!isAdmin) {
    elements.unauthorizedEmail.textContent = user.email || "未提供 Email";
    setVisible(elements.unauthorized, true);
    return;
  }

  elements.userName.textContent = user.displayName || user.email || "管理員";
  setVisible(elements.dashboard, true);
  showListView({ discardUpload: false });
  loadPosts();
}

function registerEvents() {
  document.querySelectorAll("[data-sign-in]").forEach((button) => button.addEventListener("click", handleSignIn));
  document.querySelectorAll("[data-sign-out]").forEach((button) => button.addEventListener("click", handleSignOut));
  document.querySelector("[data-new-post]")?.addEventListener("click", () => openEditor());
  document.querySelector("[data-cancel-editor]")?.addEventListener("click", () => showListView());
  elements.form?.addEventListener("submit", handleSave);

  elements.postList?.addEventListener("click", (event) => {
    const row = event.target.closest("[data-post-id]");
    if (!row) return;
    const post = posts.find((item) => item.id === row.dataset.postId);
    if (!post) return;
    if (event.target.closest("[data-edit-post]")) openEditor(post);
    if (event.target.closest("[data-delete-post]")) deletePost(post);
  });

  elements.title?.addEventListener("input", () => {
    if (!slugWasEdited) elements.slug.value = slugify(elements.title.value);
  });
  elements.slug?.addEventListener("input", () => {
    slugWasEdited = true;
  });
  elements.slug?.addEventListener("blur", () => {
    elements.slug.value = slugify(elements.slug.value);
  });
  elements.content?.addEventListener("input", updateMarkdownPreview);
  elements.coverInput?.addEventListener("change", async () => {
    const file = elements.coverInput.files?.[0];
    if (!file) return;
    try {
      await uploadCover(file);
      setNotice("封面圖片上傳完成。", "success");
    } catch (error) {
      elements.uploadStatus.textContent = "";
      setNotice(`圖片上傳失敗：${humanizeError(error)}`, "error");
    } finally {
      elements.coverInput.value = "";
    }
  });
  elements.removeCover?.addEventListener("click", () => {
    draftCoverImage = null;
    draftCoverImagePath = null;
    setCoverPreview();
    elements.uploadStatus.textContent = "封面將在儲存貼文後移除。";
  });
}

async function initializeAdmin() {
  registerEvents();

  if (!hasFirebaseConfig()) {
    setVisible(elements.authLoading, false);
    setVisible(elements.configError, true);
    return;
  }

  try {
    const app = getFirebaseApp();
    auth = getAuth(app);
    db = getFirestore(app);
    storage = getStorage(app);
    await setPersistence(auth, browserLocalPersistence);
    onAuthStateChanged(auth, showAuthState, (error) => {
      setVisible(elements.authLoading, false);
      setNotice(`驗證狀態載入失敗：${humanizeError(error)}`, "error");
    });
  } catch (error) {
    setVisible(elements.authLoading, false);
    setVisible(elements.configError, true);
    setNotice(humanizeError(error), "error");
  }
}

initializeAdmin();
