import {
  browserLocalPersistence,
  getAuth,
  onAuthStateChanged,
  setPersistence,
} from "firebase/auth";
import { doc, getFirestore, serverTimestamp, writeBatch } from "firebase/firestore";
import { getClientConfig, getFirebaseApp, hasFirebaseConfig } from "./firebase-core";
import { renderMarkdown } from "./markdown";
import { createProfileCollectionDialog } from "./profile-collection-dialog";
import { normalizeProfileLists, renderInterestDetails, validateProfileLists } from "./profile-content";

const SITE_LOCALES = ["zh", "en", "ja"];
const TRANSLATOR_LANGUAGE_CODES = { zh: "zh-Hant", en: "en", ja: "ja" };
const LANGUAGE_LABELS = { zh: "中文", en: "英文", ja: "日文" };
const interestPage = document.querySelector("[data-interest-page]");
const isEditMode = new URLSearchParams(window.location.search).get("edit") === "interests";

let currentLocale;
let currentLists;
let initialLists;
let db;
let isDirty = false;
let isSaving = false;
let toolbar;
let collectionDialog;

function adminUrl() {
  const url = new URL(currentLocale === "zh" ? "../admin/" : "../../admin/", window.location.href);
  url.searchParams.set("manage", "content");
  return url;
}

function profileEditUrl() {
  const url = new URL("../", window.location.href);
  url.searchParams.set("edit", "home");
  return url;
}

function publicUrl() {
  const url = new URL(window.location.href);
  url.searchParams.delete("edit");
  url.hash = "";
  return url;
}

function createToolbar() {
  const element = document.createElement("aside");
  element.className = "home-editor-toolbar interest-editor-toolbar";
  element.innerHTML = `<div class="home-editor-toolbar-copy"><strong>完整興趣編輯模式</strong><span>${LANGUAGE_LABELS[currentLocale]}原文</span></div>
    <p class="home-editor-status" data-interest-editor-status role="status">正在確認管理員權限…</p>
    <div class="home-editor-actions">
      <button class="button button-secondary" type="button" data-interest-manage disabled>新增／管理興趣</button>
      <button class="button button-secondary" type="button" data-interest-reset disabled>還原</button>
      <button class="button button-primary" type="button" data-interest-save disabled>儲存並同步三種語言</button>
      <a class="button button-ghost" data-interest-profile>回首頁編輯</a>
      <a class="button button-ghost" data-interest-exit>離開編輯</a>
    </div>`;
  document.body.append(element);
  toolbar = {
    element,
    status: element.querySelector("[data-interest-editor-status]"),
    manage: element.querySelector("[data-interest-manage]"),
    reset: element.querySelector("[data-interest-reset]"),
    save: element.querySelector("[data-interest-save]"),
    profile: element.querySelector("[data-interest-profile]"),
    exit: element.querySelector("[data-interest-exit]"),
  };
  toolbar.profile.href = profileEditUrl();
  toolbar.exit.href = publicUrl();
}

function setStatus(message, state = "info") {
  toolbar.status.textContent = message;
  toolbar.status.dataset.state = state;
}

function setDirty(nextDirty) {
  isDirty = nextDirty;
  toolbar.save.disabled = !isDirty || isSaving;
  toolbar.reset.disabled = !isDirty || isSaving;
  if (isDirty) setStatus("有尚未儲存的興趣修改。", "pending");
}

function renderPage() {
  renderInterestDetails(interestPage, currentLists.interests, renderMarkdown);
  interestPage.querySelectorAll(".interest-detail-card").forEach((card) => {
    const edit = document.createElement("button");
    edit.type = "button";
    edit.className = "profile-card-admin-action interest-card-edit";
    edit.textContent = "編輯";
    edit.addEventListener("click", () => collectionDialog.open(currentLists.interests, card.dataset.profileItemId));
    card.querySelector("header")?.append(edit);
  });
}

async function translateText(translator, value) {
  if (!value) return "";
  return (await translator.translate(value)).trim();
}

async function translateInterests(interests, translator) {
  return Promise.all(interests.map(async (item) => {
    const [title, summary, content] = await Promise.all([
      translateText(translator, item.title),
      translateText(translator, item.summary),
      translateText(translator, item.content),
    ]);
    return { id: item.id, title, summary, content };
  }));
}

async function translateDetails(details, translator) {
  return Promise.all(details.map(async (item) => {
    const [label, value] = await Promise.all([
      translateText(translator, item.label),
      translateText(translator, item.value),
    ]);
    return { id: item.id, label, value };
  }));
}

async function translateAllLists(sourceLists) {
  const targets = SITE_LOCALES.filter((locale) => locale !== currentLocale);
  const hasText = sourceLists.details.some((item) => item.label || item.value)
    || sourceLists.interests.some((item) => item.title || item.summary || item.content);
  if (!hasText) {
    return [{ locale: currentLocale, lists: sourceLists }, ...targets.map((locale) => ({
      locale,
      lists: { details: sourceLists.details, interests: sourceLists.interests.map((item) => ({ id: item.id, title: "", summary: "", content: "" })) },
    }))];
  }
  const TranslatorApi = globalThis.Translator;
  if (!TranslatorApi?.create) throw new Error("自動翻譯需要桌面版 Chrome 138 以上，請更新或改用 Chrome。");
  const jobs = targets.map((targetLocale) => ({
    targetLocale,
    promise: TranslatorApi.create({
      sourceLanguage: TRANSLATOR_LANGUAGE_CODES[currentLocale],
      targetLanguage: TRANSLATOR_LANGUAGE_CODES[targetLocale],
      monitor(monitor) {
        monitor.addEventListener("downloadprogress", (event) => {
          setStatus(`正在準備 ${LANGUAGE_LABELS[targetLocale]}翻譯模型：${Math.round(event.loaded * 100)}%`);
        });
      },
    }),
  }));
  const results = await Promise.allSettled(jobs.map((job) => job.promise));
  const translators = results.filter((result) => result.status === "fulfilled").map((result) => result.value);
  try {
    const failure = results.find((result) => result.status === "rejected");
    if (failure) throw failure.reason;
    const translated = await Promise.all(jobs.map(async (job, index) => ({
      locale: job.targetLocale,
      lists: {
        details: await translateDetails(sourceLists.details, translators[index]),
        interests: await translateInterests(sourceLists.interests, translators[index]),
      },
    })));
    return [{ locale: currentLocale, lists: sourceLists }, ...translated];
  } finally {
    translators.forEach((translator) => translator.destroy?.());
  }
}

async function save() {
  if (!isDirty || isSaving) return;
  let sourceLists;
  let translationPromise;
  try {
    sourceLists = validateProfileLists(currentLists);
    translationPromise = translateAllLists(sourceLists);
  } catch (error) {
    setStatus(error.message || "興趣資料格式不正確。", "error");
    return;
  }
  isSaving = true;
  toolbar.manage.disabled = true;
  toolbar.save.disabled = true;
  toolbar.reset.disabled = true;
  toolbar.save.textContent = "翻譯中…";
  setStatus("正在同步三種語言的興趣內容…");
  try {
    const localized = await translationPromise;
    const batch = writeBatch(db);
    localized.forEach(({ locale, lists }) => {
      batch.set(doc(db, "profileLists", locale), {
        locale,
        ...lists,
        updatedAt: serverTimestamp(),
      });
    });
    toolbar.save.textContent = "儲存中…";
    await batch.commit();
    initialLists = structuredClone(sourceLists);
    currentLists = structuredClone(sourceLists);
    setDirty(false);
    setStatus("三種語言的興趣已同步完成。", "success");
  } catch (error) {
    setDirty(true);
    setStatus(`儲存失敗，這次沒有寫入任何語言：${error.message || "請稍後再試。"}`, "error");
  } finally {
    isSaving = false;
    toolbar.manage.disabled = false;
    toolbar.save.textContent = "儲存並同步三種語言";
    toolbar.save.disabled = !isDirty;
    toolbar.reset.disabled = !isDirty;
  }
}

function waitForAuth(auth) {
  return new Promise((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    }, reject);
  });
}

function registerEvents() {
  toolbar.manage.addEventListener("click", () => collectionDialog.open(currentLists.interests));
  toolbar.save.addEventListener("click", save);
  toolbar.reset.addEventListener("click", () => {
    currentLists = structuredClone(initialLists);
    renderPage();
    setDirty(false);
    setStatus("已還原成上次儲存的興趣內容。");
  });
  [toolbar.profile, toolbar.exit].forEach((link) => link.addEventListener("click", (event) => {
    if (isDirty && !window.confirm("還有尚未儲存的興趣修改，確定要離開嗎？")) event.preventDefault();
  }));
  window.addEventListener("beforeunload", (event) => {
    if (!isDirty || isSaving) return;
    event.preventDefault();
    event.returnValue = "";
  });
}

async function initialize() {
  currentLocale = SITE_LOCALES.includes(interestPage.dataset.locale) ? interestPage.dataset.locale : "zh";
  createToolbar();
  if (!hasFirebaseConfig()) {
    setStatus("Firebase 尚未設定，無法進入編輯模式。", "error");
    return;
  }
  const config = getClientConfig();
  const app = getFirebaseApp();
  const auth = getAuth(app);
  db = getFirestore(app);
  await setPersistence(auth, browserLocalPersistence);
  const user = await waitForAuth(auth);
  if (!user || !config.adminUid || user.uid !== config.adminUid) {
    window.location.replace(adminUrl());
    return;
  }
  document.body.classList.add("is-interest-editing");
  currentLists = normalizeProfileLists(await window.__PROFILE_LISTS_LOAD_PROMISE__);
  initialLists = structuredClone(currentLists);
  collectionDialog = createProfileCollectionDialog("interests", (interests) => {
    currentLists.interests = interests;
    renderPage();
    setDirty(true);
  });
  renderPage();
  registerEvents();
  toolbar.manage.disabled = false;
  setStatus("使用每張卡片的「編輯」，或新增一個興趣分類。", "success");
}

if (interestPage && isEditMode) {
  initialize().catch((error) => {
    if (toolbar) setStatus(`無法啟動興趣編輯器：${error.message || "請稍後再試。"}`, "error");
  });
}
