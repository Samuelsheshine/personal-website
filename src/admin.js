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
  getDoc,
  getDocs,
  getFirestore,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  writeBatch,
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
const SITE_LOCALES = ["zh", "en", "ja"];
const TRANSLATOR_LANGUAGE_CODES = { zh: "zh-Hant", en: "en", ja: "ja" };
const LANGUAGE_LABELS = { zh: "中文", en: "英文", ja: "日文" };
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
  sitePanel: document.querySelector("[data-site-panel]"),
  siteForm: document.querySelector("[data-site-content-form]"),
  siteLocale: document.querySelector("#site-locale"),
  siteSaveButton: document.querySelector("[data-save-site-content]"),
  translatorStatus: document.querySelector("[data-translator-status]"),
  projectsPanel: document.querySelector("[data-projects-panel]"),
  projectEditorPanel: document.querySelector("[data-project-editor-panel]"),
  projectList: document.querySelector("[data-admin-project-list]"),
  projectListLocale: document.querySelector("[data-project-list-locale]"),
  emptyProjects: document.querySelector("[data-empty-projects]"),
  projectListLoading: document.querySelector("[data-project-list-loading]"),
  projectForm: document.querySelector("[data-project-form]"),
  projectEditorTitle: document.querySelector("[data-project-editor-title]"),
  projectLocale: document.querySelector("#project-locale"),
  projectTitle: document.querySelector("#project-title"),
  projectSlug: document.querySelector("#project-slug"),
  projectExcerpt: document.querySelector("#project-excerpt"),
  projectCategory: document.querySelector("#project-category"),
  projectStatus: document.querySelector("#project-status"),
  projectYear: document.querySelector("#project-year"),
  projectRole: document.querySelector("#project-role"),
  projectOrder: document.querySelector("#project-order"),
  projectStack: document.querySelector("#project-stack"),
  projectPublished: document.querySelector("#project-published"),
  projectContent: document.querySelector("#project-content"),
  projectPreview: document.querySelector("[data-project-markdown-preview]"),
  projectSaveButton: document.querySelector("[data-save-project]"),
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
let activeSection = "posts";
let projects = [];
let currentProject = null;
let projectSlugWasEdited = false;
let isProjectSaving = false;
let isSiteSaving = false;
let siteDefaults = null;
let projectDefaults = null;

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
    "duplicate-project-slug": "這個語言已經有相同的 Project slug，請改用另一個網址名稱。",
    "translation-unsupported": "自動翻譯需要桌面版 Chrome 138 以上。請改用最新版 Chrome 開啟管理頁。",
    "translation-too-long": "翻譯後的文字超過欄位長度限制，請縮短原文後再試。",
    NotAllowedError: "瀏覽器未允許建立翻譯器，請直接點擊儲存按鈕後再試一次。",
    NotSupportedError: "Chrome 目前不支援這組語言翻譯，請更新瀏覽器後再試。",
    NetworkError: "翻譯語言模型下載失敗，請確認網路連線後再試。",
    "permission-denied": "Firebase 拒絕此操作。請確認登入 UID 與安全規則中的管理員 UID 相同。",
    "storage/unauthorized": "沒有圖片操作權限，請確認 Storage Rules 已部署。",
    "storage/retry-limit-exceeded": "圖片上傳多次重試仍失敗，請稍後再試。",
    unavailable: "Firebase 目前無法連線，請稍後再試。",
  };
  return messages[error?.code] || messages[error?.name] || error?.message || "操作失敗，請稍後再試。";
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

async function loadDefaultContent() {
  if (siteDefaults && projectDefaults) return;
  const [siteResponse, projectResponse] = await Promise.all([
    fetch("../site-content-defaults.json"),
    fetch("../project-defaults.json"),
  ]);
  if (!siteResponse.ok || !projectResponse.ok) {
    throw new Error("無法載入目前網站的靜態預設內容，請重新建置網站後再試。");
  }
  [siteDefaults, projectDefaults] = await Promise.all([
    siteResponse.json(),
    projectResponse.json(),
  ]);
}

function setActiveTab(section) {
  activeSection = section;
  document.querySelectorAll("[data-admin-tab]").forEach((button) => {
    const active = button.dataset.adminTab === section;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-current", active ? "page" : "false");
  });
}

async function switchAdminSection(section) {
  setActiveTab(section);
  document.querySelectorAll("[data-post-panel]").forEach((panel) => setVisible(panel, false));
  setVisible(elements.sitePanel, section === "site");
  setVisible(elements.projectsPanel, section === "projects");
  setVisible(elements.projectEditorPanel, false);
  setNotice();

  if (section === "posts") {
    await showListView({ discardUpload: true });
    await loadPosts();
  } else if (section === "site") {
    await loadSiteContentForm(elements.siteLocale.value);
  } else if (section === "projects") {
    await loadProjects();
  }
}

function populateSiteContentForm(content) {
  const fields = elements.siteForm.elements;
  fields.heroKicker.value = content?.heroKicker || "";
  fields.heroName.value = content?.heroName || "";
  fields.heroIntro.value = content?.heroIntro || "";
  fields.aboutTitle.value = content?.aboutTitle || "";
  fields.aboutParagraphs.value = Array.isArray(content?.aboutParagraphs)
    ? content.aboutParagraphs
      .filter((paragraph) => typeof paragraph === "string")
      .join("\n\n")
    : "";
  fields.contactTitle.value = content?.contactTitle || "";
  fields.contactNote.value = content?.contactNote || "";
  fields.contactEmail.value = content?.contactEmail || "";
}

async function loadSiteContentForm(locale) {
  setNotice("正在載入首頁文字…", "info");
  try {
    await loadDefaultContent();
    const snapshot = await getDoc(doc(db, "siteContent", locale));
    populateSiteContentForm(snapshot.exists() ? snapshot.data() : siteDefaults[locale]);
    setNotice(snapshot.exists() ? "" : "目前顯示靜態預設文字；儲存後才會寫入 Firestore。", "info");
  } catch (error) {
    populateSiteContentForm(siteDefaults?.[locale] || null);
    setNotice(`首頁文字載入失敗：${humanizeError(error)}`, "error");
  }
}

function siteContentFormData() {
  const fields = elements.siteForm.elements;
  const content = {
    locale: fields.locale.value,
    heroKicker: fields.heroKicker.value.trim(),
    heroName: fields.heroName.value.trim(),
    heroIntro: fields.heroIntro.value.trim(),
    aboutTitle: fields.aboutTitle.value.trim(),
    aboutParagraphs: fields.aboutParagraphs.value
      .split(/\n\s*\n/u)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean),
    contactTitle: fields.contactTitle.value.trim(),
    contactNote: fields.contactNote.value.trim(),
    contactEmail: fields.contactEmail.value.trim(),
  };
  if (!content.heroKicker || !content.heroName || !content.heroIntro || !content.aboutTitle) {
    throw new Error("首頁標題、姓名、介紹與 About 標題都不可留白。");
  }
  if (!content.aboutParagraphs.length || content.aboutParagraphs.length > 10) {
    throw new Error("About 內文需有 1 到 10 個段落。");
  }
  if (!content.contactTitle || !content.contactEmail || !fields.contactEmail.checkValidity()) {
    throw new Error("請填入聯絡區標題與有效的 Email。");
  }
  return content;
}

function startSiteTranslators(sourceLocale) {
  const TranslatorApi = globalThis.Translator;
  if (!TranslatorApi?.create) {
    const error = new Error("Translator API unavailable");
    error.code = "translation-unsupported";
    throw error;
  }

  const targetLocales = SITE_LOCALES.filter((locale) => locale !== sourceLocale);
  return targetLocales.map((targetLocale) => ({
    targetLocale,
    promise: TranslatorApi.create({
      sourceLanguage: TRANSLATOR_LANGUAGE_CODES[sourceLocale],
      targetLanguage: TRANSLATOR_LANGUAGE_CODES[targetLocale],
      monitor(monitor) {
        monitor.addEventListener("downloadprogress", (progressEvent) => {
          const percent = Math.round(progressEvent.loaded * 100);
          setNotice(
            `首次準備 ${LANGUAGE_LABELS[sourceLocale]} → ${LANGUAGE_LABELS[targetLocale]} 翻譯模型：${percent}%`,
            "info",
          );
        });
      },
    }),
  }));
}

async function updateTranslatorSupportStatus() {
  if (!elements.translatorStatus) return;
  const TranslatorApi = globalThis.Translator;
  if (!TranslatorApi?.create || !TranslatorApi?.availability) {
    elements.translatorStatus.textContent = "目前瀏覽器不支援；請改用桌面版 Chrome 138 以上開啟管理頁。";
    elements.siteSaveButton.disabled = true;
    return;
  }

  try {
    const languagePairs = SITE_LOCALES.flatMap((sourceLocale) =>
      SITE_LOCALES
        .filter((targetLocale) => targetLocale !== sourceLocale)
        .map((targetLocale) => ({ sourceLocale, targetLocale })),
    );
    const states = await Promise.all(languagePairs.map(({ sourceLocale, targetLocale }) =>
      TranslatorApi.availability({
        sourceLanguage: TRANSLATOR_LANGUAGE_CODES[sourceLocale],
        targetLanguage: TRANSLATOR_LANGUAGE_CODES[targetLocale],
      }),
    ));
    if (states.includes("unavailable")) {
      elements.translatorStatus.textContent = "目前 Chrome 缺少部分中／英／日翻譯支援，請先更新 Chrome。";
      elements.siteSaveButton.disabled = true;
      return;
    }
    const requiresDownload = states.some((state) => state !== "available");
    elements.translatorStatus.textContent = requiresDownload
      ? "目前瀏覽器已支援；第一次儲存時會先下載需要的語言模型。"
      : "目前瀏覽器與中／英／日翻譯模型皆已準備完成。";
  } catch {
    elements.translatorStatus.textContent = "無法確認翻譯模型狀態；仍可按下儲存，由 Chrome 再次檢查。";
  }
}

async function translateText(translator, text) {
  if (!text) return "";
  return (await translator.translate(text)).trim();
}

async function translateSiteContent(sourceContent, targetLocale, translator) {
  const sourceValues = [
    sourceContent.heroKicker,
    sourceContent.heroName,
    sourceContent.heroIntro,
    sourceContent.aboutTitle,
    ...sourceContent.aboutParagraphs,
    sourceContent.contactTitle,
    sourceContent.contactNote,
  ];
  const translatedValues = await Promise.all(
    sourceValues.map((value) => translateText(translator, value)),
  );
  let cursor = 0;
  const translated = {
    locale: targetLocale,
    heroKicker: translatedValues[cursor++],
    heroName: translatedValues[cursor++],
    heroIntro: translatedValues[cursor++],
    aboutTitle: translatedValues[cursor++],
    aboutParagraphs: sourceContent.aboutParagraphs.map(() => translatedValues[cursor++]),
    contactTitle: translatedValues[cursor++],
    contactNote: translatedValues[cursor++],
    contactEmail: sourceContent.contactEmail,
  };
  validateSiteContentLimits(translated);
  return translated;
}

function validateSiteContentLimits(content) {
  const tooLong = content.heroKicker.length > 160
    || content.heroName.length > 160
    || content.heroIntro.length > 2000
    || content.aboutTitle.length > 300
    || content.contactTitle.length > 300
    || content.contactNote.length > 1000
    || content.contactEmail.length > 320
    || content.aboutParagraphs.length > 10;
  if (tooLong) {
    const error = new Error("Translated content exceeds limits");
    error.code = "translation-too-long";
    throw error;
  }
}

async function saveSiteContent(event) {
  event.preventDefault();
  if (isSiteSaving) return;
  let content;
  let translatorJobs;
  try {
    content = siteContentFormData();
    validateSiteContentLimits(content);
    // Start both Translator.create() calls while the submit click still provides user activation.
    translatorJobs = startSiteTranslators(content.locale);
  } catch (error) {
    setNotice(humanizeError(error), "error");
    return;
  }

  isSiteSaving = true;
  elements.siteSaveButton.disabled = true;
  elements.siteSaveButton.textContent = "翻譯中…";
  setNotice(`正在把${LANGUAGE_LABELS[content.locale]}翻譯成另外兩種語言…`, "info");
  let translators = [];
  try {
    const translatorResults = await Promise.allSettled(
      translatorJobs.map(({ promise }) => promise),
    );
    translators = translatorResults
      .filter((result) => result.status === "fulfilled")
      .map((result) => result.value);
    const failedTranslator = translatorResults.find((result) => result.status === "rejected");
    if (failedTranslator) throw failedTranslator.reason;

    const translatedContents = await Promise.all(
      translatorJobs.map(({ targetLocale }, index) =>
        translateSiteContent(content, targetLocale, translators[index]),
      ),
    );
    const batch = writeBatch(db);
    [content, ...translatedContents].forEach((localizedContent) => {
      batch.set(doc(db, "siteContent", localizedContent.locale), {
        ...localizedContent,
        updatedAt: serverTimestamp(),
      });
    });
    elements.siteSaveButton.textContent = "同步儲存中…";
    await batch.commit();
    setNotice("三種語言的首頁文字已翻譯並同步更新。請快速檢查姓名與專有名詞。", "success");
  } catch (error) {
    setNotice(`三語同步失敗，這次沒有寫入任何語言：${humanizeError(error)}`, "error");
  } finally {
    translators.forEach((translator) => translator.destroy?.());
    isSiteSaving = false;
    elements.siteSaveButton.disabled = false;
    elements.siteSaveButton.textContent = "翻譯並同步三種語言";
  }
}

async function importDefaultContent() {
  const confirmed = window.confirm("確定要匯入目前網站的三語首頁與 Projects 嗎？\n\n只會建立 Firestore 中尚不存在的內容，不會覆寫你已經編輯過的資料。");
  if (!confirmed) return;
  setNotice("正在檢查並匯入靜態內容…", "info");
  try {
    await loadDefaultContent();
    const siteItems = Object.values(siteDefaults);
    const allItems = [
      ...siteItems.map((content) => ({ type: "site", id: content.locale, content })),
      ...projectDefaults.map((project) => ({ type: "project", id: project.id, content: project })),
    ];
    const snapshots = await Promise.all(allItems.map((item) =>
      getDoc(doc(db, item.type === "site" ? "siteContent" : "projects", item.id)),
    ));
    const batch = writeBatch(db);
    let created = 0;
    allItems.forEach((item, index) => {
      if (snapshots[index].exists()) return;
      if (item.type === "site") {
        const { locale, ...content } = item.content;
        batch.set(doc(db, "siteContent", item.id), { locale, ...content, updatedAt: serverTimestamp() });
      } else {
        const project = { ...item.content };
        delete project.id;
        batch.set(doc(db, "projects", item.id), {
          ...project,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      created += 1;
    });
    if (created) await batch.commit();
    await loadSiteContentForm(elements.siteLocale.value);
    setNotice(created ? `已匯入 ${created} 筆原本的網站內容。` : "所有靜態內容都已經存在，不需要重複匯入。", "success");
  } catch (error) {
    setNotice(`靜態內容匯入失敗：${humanizeError(error)}`, "error");
  }
}

function renderProjectList() {
  const locale = elements.projectListLocale.value;
  const visibleProjects = projects
    .filter((project) => project.locale === locale)
    .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
  elements.projectList.innerHTML = visibleProjects.map((project) => `<article class="admin-post-row" data-project-id="${escapeHtml(project.id)}">
    <div class="admin-post-main">
      <span class="status-label status-${project.published ? "published" : "draft"}">${project.published ? "已發布" : "草稿"}</span>
      <h3>${escapeHtml(project.title)}</h3>
      <p class="admin-post-slug">/${locale === "zh" ? "" : `${locale}/`}projects/${escapeHtml(project.slug)}/</p>
    </div>
    <dl class="admin-post-dates">
      <div><dt>排序</dt><dd>${escapeHtml(project.order)}</dd></div>
      <div><dt>更新</dt><dd>${escapeHtml(formatDateTime(project.updatedAt))}</dd></div>
    </dl>
    <div class="admin-row-actions">
      <button class="button button-secondary button-small" type="button" data-edit-project>編輯</button>
      <button class="button button-danger button-small" type="button" data-delete-project>刪除</button>
    </div>
  </article>`).join("");
  setVisible(elements.emptyProjects, visibleProjects.length === 0);
}

async function loadProjects() {
  setVisible(elements.projectListLoading, true);
  setVisible(elements.emptyProjects, false);
  try {
    const snapshot = await getDocs(collection(db, "projects"));
    projects = snapshot.docs.map((projectDocument) => ({ id: projectDocument.id, ...projectDocument.data() }));
    renderProjectList();
  } catch (error) {
    projects = [];
    renderProjectList();
    setNotice(`Projects 載入失敗：${humanizeError(error)}`, "error");
  } finally {
    setVisible(elements.projectListLoading, false);
  }
}

function updateProjectPreview() {
  const content = elements.projectContent.value.trim();
  elements.projectPreview.innerHTML = content
    ? renderMarkdown(content)
    : '<p class="admin-preview-empty">Markdown 預覽會顯示在這裡。</p>';
}

function openProjectEditor(project = null) {
  currentProject = project;
  projectSlugWasEdited = Boolean(project);
  elements.projectForm.reset();
  elements.projectEditorTitle.textContent = project ? "編輯 Project" : "新增 Project";
  elements.projectLocale.value = project?.locale || elements.projectListLocale.value;
  elements.projectTitle.value = project?.title || "";
  elements.projectSlug.value = project?.slug || "";
  elements.projectExcerpt.value = project?.excerpt || "";
  elements.projectCategory.value = project?.category || "";
  elements.projectStatus.value = project?.status || "";
  elements.projectYear.value = project?.year || "";
  elements.projectRole.value = project?.role || "";
  elements.projectOrder.value = project?.order ?? 999;
  elements.projectStack.value = Array.isArray(project?.stack) ? project.stack.join(", ") : "";
  elements.projectPublished.checked = Boolean(project?.published);
  elements.projectContent.value = project?.content || "";
  updateProjectPreview();
  setVisible(elements.projectsPanel, false);
  setVisible(elements.projectEditorPanel, true);
  setNotice();
  elements.projectTitle.focus();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function closeProjectEditor() {
  currentProject = null;
  projectSlugWasEdited = false;
  elements.projectForm.reset();
  setVisible(elements.projectEditorPanel, false);
  setVisible(elements.projectsPanel, true);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function projectFormData() {
  const locale = elements.projectLocale.value;
  const title = elements.projectTitle.value.trim();
  const slug = slugify(elements.projectSlug.value);
  const order = Number.parseInt(elements.projectOrder.value || "999", 10);
  if (!title) throw new Error("請輸入 Project 標題。");
  if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(slug)) throw new Error("請輸入有效的英文／數字 slug。");
  if (!Number.isInteger(order) || order < 0 || order > 10000) throw new Error("排序必須是 0 到 10000 的整數。");
  elements.projectSlug.value = slug;
  return {
    locale,
    title,
    slug,
    excerpt: elements.projectExcerpt.value.trim(),
    content: elements.projectContent.value.trim(),
    order,
    category: elements.projectCategory.value.trim(),
    status: elements.projectStatus.value.trim(),
    year: elements.projectYear.value.trim(),
    role: elements.projectRole.value.trim(),
    stack: parseTags(elements.projectStack.value),
    published: elements.projectPublished.checked,
  };
}

async function saveProject(event) {
  event.preventDefault();
  if (isProjectSaving) return;
  let data;
  try {
    data = projectFormData();
  } catch (error) {
    setNotice(error.message, "error");
    return;
  }
  isProjectSaving = true;
  elements.projectSaveButton.disabled = true;
  elements.projectSaveButton.textContent = "儲存中…";
  setNotice("正在儲存 Project…", "info");

  try {
    const newId = `${data.locale}--${data.slug}`;
    await runTransaction(db, async (transaction) => {
      const oldReference = currentProject ? doc(db, "projects", currentProject.id) : null;
      const newReference = doc(db, "projects", newId);
      const oldSnapshot = oldReference ? await transaction.get(oldReference) : null;
      const targetSnapshot = oldReference?.path === newReference.path
        ? oldSnapshot
        : await transaction.get(newReference);
      if (targetSnapshot?.exists()) {
        const targetIsCurrent = currentProject && targetSnapshot.id === currentProject.id;
        if (!targetIsCurrent) {
          const error = new Error("Duplicate project slug");
          error.code = "duplicate-project-slug";
          throw error;
        }
      }
      transaction.set(newReference, {
        ...data,
        createdAt: oldReference?.path === newReference.path && oldSnapshot?.exists()
          ? oldSnapshot.data().createdAt
          : serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      if (oldReference && oldReference.path !== newReference.path) transaction.delete(oldReference);
    });
    elements.projectListLocale.value = data.locale;
    closeProjectEditor();
    await loadProjects();
    setNotice("Project 已儲存，公開頁重新整理後就會顯示。", "success");
  } catch (error) {
    setNotice(`Project 儲存失敗：${humanizeError(error)}`, "error");
  } finally {
    isProjectSaving = false;
    elements.projectSaveButton.disabled = false;
    elements.projectSaveButton.textContent = "儲存 Project";
  }
}

async function deleteProject(project) {
  const confirmed = window.confirm(`確定要刪除「${project.title}」嗎？\n\n這會刪除 ${project.locale.toUpperCase()} 版本，且無法復原。`);
  if (!confirmed) return;
  setNotice(`正在刪除「${project.title}」…`, "info");
  try {
    await runTransaction(db, async (transaction) => {
      transaction.delete(doc(db, "projects", project.id));
    });
    await loadProjects();
    setNotice("Project 已刪除。", "success");
  } catch (error) {
    setNotice(`Project 刪除失敗：${humanizeError(error)}`, "error");
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
  isSigningIn = false;
  document.querySelectorAll("[data-sign-in]").forEach((button) => {
    button.disabled = false;
    button.removeAttribute("aria-busy");
  });
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
  switchAdminSection(activeSection);
}

function registerEvents() {
  document.querySelectorAll("[data-sign-in]").forEach((button) => button.addEventListener("click", handleSignIn));
  document.querySelectorAll("[data-sign-out]").forEach((button) => button.addEventListener("click", handleSignOut));
  document.querySelector("[data-new-post]")?.addEventListener("click", () => openEditor());
  document.querySelectorAll("[data-cancel-editor]").forEach((button) => button.addEventListener("click", () => showListView()));
  elements.form?.addEventListener("submit", handleSave);

  document.querySelectorAll("[data-admin-tab]").forEach((button) => {
    button.addEventListener("click", () => switchAdminSection(button.dataset.adminTab));
  });
  elements.siteLocale?.addEventListener("change", () => loadSiteContentForm(elements.siteLocale.value));
  elements.siteForm?.addEventListener("submit", saveSiteContent);
  document.querySelector("[data-import-defaults]")?.addEventListener("click", importDefaultContent);
  document.querySelector("[data-new-project]")?.addEventListener("click", () => openProjectEditor());
  document.querySelectorAll("[data-cancel-project]").forEach((button) => button.addEventListener("click", closeProjectEditor));
  elements.projectListLocale?.addEventListener("change", renderProjectList);
  elements.projectForm?.addEventListener("submit", saveProject);
  elements.projectList?.addEventListener("click", (event) => {
    const row = event.target.closest("[data-project-id]");
    if (!row) return;
    const project = projects.find((item) => item.id === row.dataset.projectId);
    if (!project) return;
    if (event.target.closest("[data-edit-project]")) openProjectEditor(project);
    if (event.target.closest("[data-delete-project]")) deleteProject(project);
  });
  elements.projectTitle?.addEventListener("input", () => {
    if (!projectSlugWasEdited) elements.projectSlug.value = slugify(elements.projectTitle.value);
  });
  elements.projectSlug?.addEventListener("input", () => {
    projectSlugWasEdited = true;
  });
  elements.projectSlug?.addEventListener("blur", () => {
    elements.projectSlug.value = slugify(elements.projectSlug.value);
  });
  elements.projectContent?.addEventListener("input", updateProjectPreview);

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
  updateTranslatorSupportStatus();

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
