import {
  browserLocalPersistence,
  getAuth,
  onAuthStateChanged,
  setPersistence,
} from "firebase/auth";
import {
  doc,
  getDoc,
  getFirestore,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { getClientConfig, getFirebaseApp, hasFirebaseConfig } from "./firebase-core";
import { createProfileCollectionDialog } from "./profile-collection-dialog";
import {
  applyProfileFields,
  collectProfileFields,
  normalizeProfileLists,
  renderProfileDetails,
  renderProfileInterestPreview,
  validateProfileFields,
  validateProfileLists,
} from "./profile-content";

const SITE_LOCALES = ["zh", "en", "ja"];
const TRANSLATOR_LANGUAGE_CODES = { zh: "zh-Hant", en: "en", ja: "ja" };
const LANGUAGE_LABELS = { zh: "中文", en: "英文", ja: "日文" };
const siteHome = document.querySelector("[data-site-home]");
const isEditMode = new URLSearchParams(window.location.search).get("edit") === "home";

let db;
let currentLocale;
let initialContent;
let initialProfileFields;
let initialProfileLists;
let currentProfileLists;
let isDirty = false;
let isTextDirty = false;
let areListsDirty = false;
let isSaving = false;
let toolbarElements;

function adminUrl() {
  const url = new URL(currentLocale === "zh" ? "./admin/" : "../admin/", window.location.href);
  url.searchParams.set("manage", "content");
  return url;
}

function publicHomeUrl() {
  const url = new URL(window.location.href);
  url.searchParams.delete("edit");
  url.hash = "";
  return url;
}

function createToolbar() {
  const toolbar = document.createElement("aside");
  toolbar.className = "home-editor-toolbar";
  toolbar.setAttribute("aria-label", "首頁文字編輯工具列");
  toolbar.innerHTML = `
    <div class="home-editor-toolbar-copy">
      <strong>首頁編輯模式</strong>
      <span data-home-editor-locale></span>
    </div>
    <p class="home-editor-status" data-home-editor-status role="status">正在確認管理員權限…</p>
    <div class="home-editor-actions">
      <a class="button button-secondary" data-home-editor-admin>管理 Blog／Projects</a>
      <button class="button button-secondary" type="button" data-home-editor-reset disabled>還原</button>
      <button class="button button-primary" type="button" data-home-editor-save disabled>儲存並同步三種語言</button>
      <a class="button button-ghost" data-home-editor-exit>離開編輯</a>
    </div>`;
  document.body.append(toolbar);
  toolbarElements = {
    toolbar,
    locale: toolbar.querySelector("[data-home-editor-locale]"),
    status: toolbar.querySelector("[data-home-editor-status]"),
    admin: toolbar.querySelector("[data-home-editor-admin]"),
    reset: toolbar.querySelector("[data-home-editor-reset]"),
    save: toolbar.querySelector("[data-home-editor-save]"),
    exit: toolbar.querySelector("[data-home-editor-exit]"),
  };
  toolbarElements.locale.textContent = `${LANGUAGE_LABELS[currentLocale]}原文`;
  toolbarElements.admin.href = adminUrl();
  toolbarElements.exit.href = publicHomeUrl();
}

function setStatus(message, type = "info") {
  toolbarElements.status.textContent = message;
  toolbarElements.status.dataset.state = type;
}

function editableBindings() {
  return [
    ["[data-home-hero-kicker]", "首頁小標題"],
    ["[data-home-hero-name]", "姓名／主標題"],
    ["[data-home-hero-intro]", "首頁介紹"],
    ["[data-home-about-title]", "About 標題"],
    ["[data-home-contact-title]", "聯絡區標題"],
    ["[data-home-contact-note]", "聯絡區說明"],
    ["[data-home-contact-email]", "聯絡 Email"],
  ];
}

function markEditable(element, label) {
  if (!element) return;
  element.contentEditable = "plaintext-only";
  element.spellcheck = true;
  element.dataset.homeEditable = "";
  element.dataset.editorPlaceholder = `點一下輸入${label}`;
  element.setAttribute("aria-label", `${label}（可編輯）`);
}

function activateEditableFields() {
  editableBindings().forEach(([selector, label]) => markEditable(siteHome.querySelector(selector), label));
  siteHome.querySelectorAll("[data-home-about-paragraphs] > p").forEach((paragraph, index) => {
    markEditable(paragraph, `About 段落 ${index + 1}`);
  });
  siteHome.querySelectorAll("[data-profile-field]").forEach((element) => {
    if (element.matches("[data-interest-page-link]")
      || element.closest("[data-profile-details], [data-profile-interests]")) return;
    markEditable(element, "個人檔案文字");
  });
}

function renderManagedProfileLists() {
  renderProfileDetails(siteHome.querySelector("[data-profile-details]"), currentProfileLists.details);
  renderProfileInterestPreview(siteHome.querySelector("[data-profile-interests]"), currentProfileLists.interests);
}

function createProfileListActions() {
  const detailsDialog = createProfileCollectionDialog("details", (details) => {
    currentProfileLists.details = details;
    renderManagedProfileLists();
    setDirty(true, "lists");
  });
  const interestsDialog = createProfileCollectionDialog("interests", (interests) => {
    currentProfileLists.interests = interests;
    renderManagedProfileLists();
    setDirty(true, "lists");
  });
  const actions = [
    ["[data-profile-details-card] .social-card-header", "編輯詳細資料", () => detailsDialog.open(currentProfileLists.details)],
    ["[data-profile-interests-card] .social-card-header", "管理興趣", () => interestsDialog.open(currentProfileLists.interests)],
  ];
  actions.forEach(([selector, label, open]) => {
    const header = siteHome.querySelector(selector);
    if (!header) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "profile-card-admin-action";
    button.textContent = label;
    button.addEventListener("click", open);
    header.append(button);
  });
  const interestLink = siteHome.querySelector("[data-interest-page-link]");
  if (interestLink) {
    const url = new URL(interestLink.href, window.location.href);
    url.searchParams.set("edit", "interests");
    interestLink.href = url;
    interestLink.title = "開啟完整興趣編輯頁";
  }
}

function ensureAboutEditorParagraph() {
  const about = siteHome.querySelector("[data-home-about-paragraphs]");
  if (!about || about.querySelector(":scope > p")) return;
  const paragraph = document.createElement("p");
  about.insertBefore(paragraph, about.firstElementChild);
}

function applyContent(content) {
  const bindings = {
    "[data-home-hero-kicker]": content.heroKicker,
    "[data-home-hero-name]": content.heroName,
    "[data-home-hero-intro]": content.heroIntro,
    "[data-home-about-title]": content.aboutTitle,
    "[data-home-contact-title]": content.contactTitle,
    "[data-home-contact-note]": content.contactNote,
  };
  Object.entries(bindings).forEach(([selector, value]) => {
    if (typeof value !== "string") return;
    siteHome.querySelectorAll(selector).forEach((element) => {
      element.textContent = value;
    });
  });

  const about = siteHome.querySelector("[data-home-about-paragraphs]");
  if (about && Array.isArray(content.aboutParagraphs)) {
    about.querySelectorAll(":scope > p").forEach((paragraph) => paragraph.remove());
    const firstNonParagraph = about.firstElementChild;
    content.aboutParagraphs
      .filter((paragraph) => typeof paragraph === "string" && paragraph.trim())
      .forEach((text) => {
        const paragraph = document.createElement("p");
        paragraph.textContent = text;
        about.insertBefore(paragraph, firstNonParagraph);
      });
  }

  const email = siteHome.querySelector("[data-home-contact-email]");
  if (email && typeof content.contactEmail === "string") {
    email.textContent = content.contactEmail;
    if (content.contactEmail.trim()) email.href = `mailto:${content.contactEmail}`;
    else email.removeAttribute("href");
  }
  ensureAboutEditorParagraph();
  activateEditableFields();
}

function fieldText(selector) {
  return siteHome.querySelector(selector)?.textContent.trim() || "";
}

function collectContent() {
  return {
    locale: currentLocale,
    heroKicker: fieldText("[data-home-hero-kicker]"),
    heroName: fieldText("[data-home-hero-name]"),
    heroIntro: fieldText("[data-home-hero-intro]"),
    aboutTitle: fieldText("[data-home-about-title]"),
    aboutParagraphs: [...siteHome.querySelectorAll("[data-home-about-paragraphs] > p")]
      .map((paragraph) => paragraph.textContent.trim())
      .filter(Boolean),
    contactTitle: fieldText("[data-home-contact-title]"),
    contactNote: fieldText("[data-home-contact-note]"),
    contactEmail: fieldText("[data-home-contact-email]"),
  };
}

function validateContent(content) {
  const tooLong = content.heroKicker.length > 160
    || content.heroName.length > 160
    || content.heroIntro.length > 2000
    || content.aboutTitle.length > 300
    || content.contactTitle.length > 300
    || content.contactNote.length > 1000
    || content.contactEmail.length > 320
    || content.aboutParagraphs.length > 10;
  if (tooLong) throw new Error("有文字超過長度限制，請稍微縮短後再儲存。");
  if (content.contactEmail) {
    const emailInput = document.createElement("input");
    emailInput.type = "email";
    emailInput.value = content.contactEmail;
    if (!emailInput.checkValidity()) throw new Error("Email 格式不正確；也可以直接留白。");
  }
}

function hasTranslatableText(content, profileFields, profileLists, options) {
  const values = [];
  if (options.text) values.push(
    content.heroKicker,
    content.heroName,
    content.heroIntro,
    content.aboutTitle,
    ...content.aboutParagraphs,
    content.contactTitle,
    content.contactNote,
    ...Object.values(profileFields),
  );
  if (options.lists) values.push(
    ...profileLists.details.flatMap((item) => [item.label, item.value]),
    ...profileLists.interests.flatMap((item) => [item.title, item.summary, item.content]),
  );
  return values.some(Boolean);
}

function emptyTranslatedContent(sourceContent, targetLocale) {
  return {
    locale: targetLocale,
    heroKicker: "",
    heroName: "",
    heroIntro: "",
    aboutTitle: "",
    aboutParagraphs: [],
    contactTitle: "",
    contactNote: "",
    contactEmail: sourceContent.contactEmail,
  };
}

async function translateText(translator, value) {
  if (!value) return "";
  return (await translator.translate(value)).trim();
}

async function translateContent(sourceContent, targetLocale, translator) {
  const sourceValues = [
    sourceContent.heroKicker,
    sourceContent.heroName,
    sourceContent.heroIntro,
    sourceContent.aboutTitle,
    ...sourceContent.aboutParagraphs,
    sourceContent.contactTitle,
    sourceContent.contactNote,
  ];
  const translatedValues = await Promise.all(sourceValues.map((value) => translateText(translator, value)));
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
  validateContent(translated);
  return translated;
}

function emptyTranslatedProfileFields(sourceFields) {
  return Object.fromEntries(Object.keys(sourceFields).map((key) => [key, ""]));
}

async function translateProfileFields(sourceFields, translator) {
  const entries = Object.entries(sourceFields);
  const translatedValues = await Promise.all(entries.map(([, value]) => translateText(translator, value)));
  const translated = Object.fromEntries(entries.map(([key], index) => [key, translatedValues[index]]));
  validateProfileFields(translated);
  return translated;
}

function emptyTranslatedProfileLists(sourceLists) {
  return {
    details: sourceLists.details.map((item) => ({ id: item.id, label: "", value: "" })),
    interests: sourceLists.interests.map((item) => ({ id: item.id, title: "", summary: "", content: "" })),
  };
}

async function translateProfileLists(sourceLists, translator) {
  const details = await Promise.all(sourceLists.details.map(async (item) => {
    const [label, value] = await Promise.all([
      translateText(translator, item.label),
      translateText(translator, item.value),
    ]);
    return { id: item.id, label, value };
  }));
  const interests = await Promise.all(sourceLists.interests.map(async (item) => {
    const [title, summary, content] = await Promise.all([
      translateText(translator, item.title),
      translateText(translator, item.summary),
      translateText(translator, item.content),
    ]);
    return { id: item.id, title, summary, content };
  }));
  return validateProfileLists({ details, interests });
}

async function translateAllContent(sourceContent, sourceProfileFields, sourceProfileLists, options) {
  const targetLocales = SITE_LOCALES.filter((locale) => locale !== sourceContent.locale);
  if (!hasTranslatableText(sourceContent, sourceProfileFields, sourceProfileLists, options)) {
    return [
      {
        locale: sourceContent.locale,
        siteContent: options.text ? sourceContent : null,
        profileFields: options.text ? sourceProfileFields : null,
        profileLists: options.lists ? sourceProfileLists : null,
      },
      ...targetLocales.map((locale) => ({
        locale,
        siteContent: options.text ? emptyTranslatedContent(sourceContent, locale) : null,
        profileFields: options.text ? emptyTranslatedProfileFields(sourceProfileFields) : null,
        profileLists: options.lists ? emptyTranslatedProfileLists(sourceProfileLists) : null,
      })),
    ];
  }

  const TranslatorApi = globalThis.Translator;
  if (!TranslatorApi?.create) {
    throw new Error("自動翻譯需要桌面版 Chrome 138 以上，請更新或改用 Chrome。");
  }
  const jobs = targetLocales.map((targetLocale) => ({
    targetLocale,
    promise: TranslatorApi.create({
      sourceLanguage: TRANSLATOR_LANGUAGE_CODES[sourceContent.locale],
      targetLanguage: TRANSLATOR_LANGUAGE_CODES[targetLocale],
      monitor(monitor) {
        monitor.addEventListener("downloadprogress", (event) => {
          setStatus(
            `正在準備 ${LANGUAGE_LABELS[sourceContent.locale]} → ${LANGUAGE_LABELS[targetLocale]} 翻譯模型：${Math.round(event.loaded * 100)}%`,
          );
        });
      },
    }),
  }));
  const results = await Promise.allSettled(jobs.map(({ promise }) => promise));
  const translators = results
    .filter((result) => result.status === "fulfilled")
    .map((result) => result.value);
  try {
    const failure = results.find((result) => result.status === "rejected");
    if (failure) throw failure.reason;
    const translated = await Promise.all(jobs.map(async ({ targetLocale }, index) => {
      const [siteContent, profileFields, profileLists] = await Promise.all([
        options.text ? translateContent(sourceContent, targetLocale, translators[index]) : null,
        options.text ? translateProfileFields(sourceProfileFields, translators[index]) : null,
        options.lists ? translateProfileLists(sourceProfileLists, translators[index]) : null,
      ]);
      return { locale: targetLocale, siteContent, profileFields, profileLists };
    }));
    return [
      {
        locale: sourceContent.locale,
        siteContent: options.text ? sourceContent : null,
        profileFields: options.text ? sourceProfileFields : null,
        profileLists: options.lists ? sourceProfileLists : null,
      },
      ...translated,
    ];
  } finally {
    translators.forEach((translator) => translator.destroy?.());
  }
}

function setDirty(dirty, scope = "text") {
  if (!dirty) {
    isTextDirty = false;
    areListsDirty = false;
  } else if (scope === "lists") {
    areListsDirty = true;
  } else {
    isTextDirty = true;
  }
  isDirty = isTextDirty || areListsDirty;
  toolbarElements.reset.disabled = !dirty || isSaving;
  toolbarElements.save.disabled = !dirty || isSaving;
  if (dirty) setStatus("有尚未儲存的修改。", "pending");
}

async function saveContent() {
  if (!isDirty || isSaving) return;
  let sourceContent;
  let sourceProfileFields;
  let sourceProfileLists;
  let translationPromise;
  const saveOptions = { text: isTextDirty, lists: areListsDirty };
  try {
    sourceContent = collectContent();
    sourceProfileFields = collectProfileFields(siteHome);
    sourceProfileLists = saveOptions.lists ? validateProfileLists(currentProfileLists) : currentProfileLists;
    if (saveOptions.text) {
      validateContent(sourceContent);
      validateProfileFields(sourceProfileFields);
    }
    // Translator.create() must start directly from the user's click to retain browser user activation.
    translationPromise = translateAllContent(sourceContent, sourceProfileFields, sourceProfileLists, saveOptions);
  } catch (error) {
    setStatus(error.message || "內容格式不正確。", "error");
    return;
  }

  isSaving = true;
  toolbarElements.reset.disabled = true;
  toolbarElements.save.disabled = true;
  toolbarElements.save.textContent = "翻譯中…";
  setStatus(`正在將${LANGUAGE_LABELS[currentLocale]}同步成三種語言…`);
  try {
    const localizedContents = await translationPromise;
    const batch = writeBatch(db);
    localizedContents.forEach(({ locale, siteContent, profileFields, profileLists }) => {
      if (siteContent && profileFields) {
        batch.set(doc(db, "siteContent", locale), {
          ...siteContent,
          updatedAt: serverTimestamp(),
        });
        batch.set(doc(db, "profileContent", locale), {
          locale,
          fields: profileFields,
          updatedAt: serverTimestamp(),
        });
      }
      if (profileLists) {
        batch.set(doc(db, "profileLists", locale), {
          locale,
          ...profileLists,
          updatedAt: serverTimestamp(),
        });
      }
    });
    toolbarElements.save.textContent = "儲存中…";
    await batch.commit();
    if (saveOptions.text) {
      initialContent = structuredClone(sourceContent);
      initialProfileFields = structuredClone(sourceProfileFields);
    }
    if (saveOptions.lists) {
      initialProfileLists = structuredClone(sourceProfileLists);
      currentProfileLists = structuredClone(sourceProfileLists);
    }
    setDirty(false);
    setStatus("三種語言已同步完成；訪客重新整理後就會看到。", "success");
  } catch (error) {
    if (saveOptions.text) setDirty(true, "text");
    if (saveOptions.lists) setDirty(true, "lists");
    setStatus(`儲存失敗，這次沒有寫入任何語言：${error.message || "請稍後再試。"}`, "error");
  } finally {
    isSaving = false;
    toolbarElements.save.textContent = "儲存並同步三種語言";
    toolbarElements.save.disabled = !isDirty;
    toolbarElements.reset.disabled = !isDirty;
  }
}

function resetContent() {
  if (!isDirty || isSaving) return;
  applyContent(initialContent);
  applyProfileFields(siteHome, initialProfileFields);
  currentProfileLists = structuredClone(initialProfileLists);
  renderManagedProfileLists();
  activateEditableFields();
  setDirty(false);
  setStatus("已還原成上次儲存的內容。", "info");
}

function registerEditorEvents() {
  siteHome.addEventListener("input", (event) => {
    const editable = event.target.closest("[data-home-editable]");
    if (!editable) return;
    if (!editable.textContent.trim()) editable.replaceChildren();
    setDirty(true);
  });
  siteHome.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && event.target.closest("[data-home-editable]")) event.preventDefault();
  });
  siteHome.addEventListener("click", (event) => {
    if (event.target.closest("a[data-home-editable]")) event.preventDefault();
  });
  toolbarElements.save.addEventListener("click", saveContent);
  toolbarElements.reset.addEventListener("click", resetContent);
  [toolbarElements.admin, toolbarElements.exit].forEach((link) => {
    link.addEventListener("click", (event) => {
      if (isDirty && !window.confirm("還有尚未儲存的首頁文字，確定要離開嗎？")) {
        event.preventDefault();
      } else {
        isDirty = false;
      }
    });
  });
  window.addEventListener("beforeunload", (event) => {
    if (!isDirty || isSaving) return;
    event.preventDefault();
    event.returnValue = "";
  });
}

function waitForAuth(auth) {
  return new Promise((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    }, reject);
  });
}

async function initializeEditor() {
  currentLocale = SITE_LOCALES.includes(siteHome.dataset.locale) ? siteHome.dataset.locale : "zh";
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

  document.body.classList.add("is-home-editing");
  let isUsingFallback = false;
  await window.__PROFILE_CONTENT_LOAD_PROMISE__;
  currentProfileLists = normalizeProfileLists(await window.__PROFILE_LISTS_LOAD_PROMISE__);
  try {
    const snapshot = await getDoc(doc(db, "siteContent", currentLocale));
    if (snapshot.exists()) applyContent(snapshot.data());
  } catch {
    isUsingFallback = true;
    setStatus("Firestore 暫時無法載入，現在顯示的是靜態備援文字。", "error");
  }
  ensureAboutEditorParagraph();
  activateEditableFields();
  initialContent = structuredClone(collectContent());
  initialProfileFields = structuredClone(collectProfileFields(siteHome));
  initialProfileLists = structuredClone(currentProfileLists);
  createProfileListActions();
  toolbarElements.save.disabled = true;
  toolbarElements.reset.disabled = true;
  registerEditorEvents();
  if (!isUsingFallback) {
    setStatus("直接點擊文字即可修改；版面與元件位置不會被編輯。", "success");
  }
}

if (siteHome && isEditMode) {
  initializeEditor().catch((error) => {
    if (toolbarElements) setStatus(`無法啟動首頁編輯器：${error.message || "請稍後再試。"}`, "error");
  });
}
