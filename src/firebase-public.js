import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { getFirebaseApp, hasFirebaseConfig } from "./firebase-core";
import { estimateReadingTime, renderMarkdown } from "./markdown";
import {
  applyProfileFields,
  normalizeProfileLists,
  readProfileListDefaults,
  renderInterestDetails,
  renderProfileDetails,
  renderProfileInterestPreview,
} from "./profile-content";
import { slugify } from "./slug";

const latestContainer = document.querySelector("[data-latest-posts]");
const blogList = document.querySelector("[data-firestore-post-list]");
const publicStatus = document.querySelector("[data-firestore-status]");
const article = document.querySelector("[data-firestore-article]");
const regularNotFound = document.querySelector("[data-regular-not-found]");
const siteHome = document.querySelector("[data-site-home]");
const interestPage = document.querySelector("[data-interest-page]");
const projectList = document.querySelector("[data-firestore-project-list]");
const featuredProjects = document.querySelector("[data-firestore-project-featured]");
const projectArticle = document.querySelector("[data-firestore-project-article]");

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function timestampToDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDate(value) {
  const date = timestampToDate(value);
  if (!date) return "日期未設定";
  return new Intl.DateTimeFormat("zh-TW", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Taipei",
  }).format(date);
}

function errorMessage(error) {
  const messages = {
    "app/config-missing": "Firebase 尚未設定，無法載入這篇文章。",
    "failed-precondition": "文章索引尚未建立，請部署 firestore.indexes.json。",
    "not-found": "這篇文章不存在，或已經被移除。",
    "permission-denied": "這篇文章不存在、尚未發布，或目前無法讀取。",
    unavailable: "目前無法連線到文章服務，請稍後再試。",
  };
  return messages[error?.code] || "文章載入失敗，請重新整理後再試。";
}

function currentLocale(element = null) {
  return element?.dataset.locale || siteHome?.dataset.locale || document.documentElement.lang.split("-")[0] || "zh";
}

function localizedCopy(locale) {
  return {
    zh: {
      noProjects: "目前還沒有已發布的專案。",
      projectMissing: "這個專案不存在、尚未發布，或已經被移除。",
      backProjects: "回專案列表",
      backHome: "回首頁",
      year: "年份",
      role: "角色",
      tools: "工具／主題",
      updating: "持續更新",
    },
    en: {
      noProjects: "There are no published projects yet.",
      projectMissing: "This project does not exist, is not published, or has been removed.",
      backProjects: "Back to projects",
      backHome: "Back to home",
      year: "Year",
      role: "Role",
      tools: "Tools / Topics",
      updating: "Continuously updated",
    },
    ja: {
      noProjects: "公開済みのプロジェクトはまだありません。",
      projectMissing: "このプロジェクトは存在しないか、未公開、または削除されています。",
      backProjects: "プロジェクト一覧へ",
      backHome: "ホームへ戻る",
      year: "年度",
      role: "役割",
      tools: "ツール / テーマ",
      updating: "継続更新",
    },
  }[locale] || null;
}

function tagMarkup(tags) {
  if (!Array.isArray(tags) || !tags.length) return "";
  return `<div class="tag-list post-tags" aria-label="標籤">${tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</div>`;
}

function postCardMarkup(post, href) {
  const cover = post.coverImage
    ? `<a class="post-card-cover" href="${escapeHtml(href)}" tabindex="-1" aria-hidden="true"><img src="${escapeHtml(post.coverImage)}" alt="" loading="lazy" /></a>`
    : "";
  const readingTime = estimateReadingTime(post.content);
  return `<article class="post-card firestore-post-card${post.coverImage ? " has-cover" : ""}">
    ${cover}
    <div class="post-card-content">
      <p class="post-meta">${escapeHtml(formatDate(post.publishedAt))} · ${readingTime} min read</p>
      <h3>${escapeHtml(post.title)}</h3>
      <p>${escapeHtml(post.excerpt)}</p>
      ${tagMarkup(post.tags)}
      <a href="${escapeHtml(href)}">閱讀文章</a>
    </div>
  </article>`;
}

async function loadPublishedPosts() {
  if (!latestContainer && !blogList) return;
  if (siteHome && currentLocale(siteHome) !== "zh") return;
  if (!hasFirebaseConfig()) return;

  try {
    const db = getFirestore(getFirebaseApp());
    const maxPosts = blogList ? 50 : 3;
    const postsQuery = query(
      collection(db, "posts"),
      where("status", "==", "published"),
      orderBy("publishedAt", "desc"),
      limit(maxPosts),
    );
    const snapshot = await getDocs(postsQuery);
    const posts = snapshot.docs.map((postDocument) => ({ id: postDocument.id, ...postDocument.data() }));

    if (!posts.length) {
      if (publicStatus) {
        publicStatus.hidden = false;
        publicStatus.textContent = "目前還沒有透過管理後台發布的文章。";
      }
      return;
    }

    if (latestContainer) {
      latestContainer.innerHTML = posts
        .slice(0, 3)
        .map((post) => postCardMarkup(post, `./blog/${encodeURIComponent(post.slug)}/`))
        .join("");
    }

    if (blogList) {
      const firebaseMarkup = posts
        .map((post) => postCardMarkup(post, `./${encodeURIComponent(post.slug)}/`))
        .join("");
      blogList.insertAdjacentHTML("afterbegin", firebaseMarkup);
      if (publicStatus) publicStatus.hidden = true;
    }
  } catch (error) {
    if (publicStatus) {
      publicStatus.hidden = false;
      publicStatus.classList.add("notice-error");
      publicStatus.textContent = errorMessage(error);
    }
  }
}

function resolveArticleSlug() {
  const querySlug = new URLSearchParams(window.location.search).get("slug");
  if (querySlug) return querySlug;

  const segments = window.location.pathname.split("/").filter(Boolean);
  const blogIndex = segments.lastIndexOf("blog");
  const pathSlug = blogIndex >= 0 ? segments[blogIndex + 1] : "";
  return pathSlug && pathSlug !== "post" ? decodeURIComponent(pathSlug) : "";
}

function replaceFallbackUrl(slug) {
  const hasFallbackQuery = new URLSearchParams(window.location.search).has("slug");
  if (!hasFallbackQuery || !/\/blog\/post\/?$/u.test(window.location.pathname)) return;
  const cleanUrl = new URL(`../${encodeURIComponent(slug)}/`, window.location.href);
  window.history.replaceState(null, "", `${cleanUrl.pathname}${cleanUrl.hash}`);
}

function setMeta(post) {
  document.title = `${post.title} | 蕭士翔`;
  const description = document.querySelector('meta[name="description"]');
  if (description) description.setAttribute("content", post.excerpt || "蕭士翔的文章");
  const canonical = document.querySelector('link[rel="canonical"]');
  if (canonical) canonical.setAttribute("href", window.location.href.split("?")[0]);
}

function renderArticle(post) {
  setMeta(post);
  const cover = post.coverImage
    ? `<figure class="post-cover"><img src="${escapeHtml(post.coverImage)}" alt="${escapeHtml(post.title)}的封面圖片" /></figure>`
    : "";

  article.innerHTML = `<article>
    <header class="article-header">
      <div class="section-inner">
        <p class="post-meta">${escapeHtml(formatDate(post.publishedAt))} · ${estimateReadingTime(post.content)} min read</p>
        <h1>${escapeHtml(post.title)}</h1>
        <p>${escapeHtml(post.excerpt)}</p>
        ${tagMarkup(post.tags)}
      </div>
    </header>
    ${cover}
    <div class="article-body">
      <div class="section-inner prose">${renderMarkdown(post.content)}</div>
    </div>
  </article>`;
}

function showArticleError(message) {
  article.innerHTML = `<section class="not-found"><div class="section-inner"><p class="kicker">文章</p><h1>找不到這篇文章。</h1><p>${escapeHtml(message)}</p><div class="hero-actions"><a class="button button-primary" href="../">回文章列表</a><a class="button button-secondary" href="../../">回首頁</a></div></div></section>`;
}

async function loadArticle() {
  if (!article) return;
  const slug = resolveArticleSlug();

  if (!slug) {
    if (regularNotFound) return;
    article.hidden = false;
    showArticleError("文章網址缺少 slug。");
    return;
  }

  if (regularNotFound) regularNotFound.hidden = true;
  article.hidden = false;
  replaceFallbackUrl(slug);

  try {
    const db = getFirestore(getFirebaseApp());
    const slugSnapshot = await getDoc(doc(db, "postSlugs", slug));
    if (!slugSnapshot.exists()) throw Object.assign(new Error("Post not found"), { code: "not-found" });

    const postSnapshot = await getDoc(doc(db, "posts", slugSnapshot.data().postId));
    if (!postSnapshot.exists() || postSnapshot.data().status !== "published") {
      throw Object.assign(new Error("Post not found"), { code: "not-found" });
    }

    renderArticle({ id: postSnapshot.id, ...postSnapshot.data() });
  } catch (error) {
    showArticleError(errorMessage(error));
  }
}

function applySiteContent(content) {
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
  const aboutParagraphs = Array.isArray(content.aboutParagraphs)
    ? content.aboutParagraphs.filter((text) => typeof text === "string" && text.trim())
    : [];
  if (about && Array.isArray(content.aboutParagraphs)) {
    about.querySelectorAll(":scope > p").forEach((paragraph) => paragraph.remove());
    const firstNonParagraph = about.firstElementChild;
    aboutParagraphs.forEach((text) => {
      const paragraph = document.createElement("p");
      paragraph.textContent = text;
      about.insertBefore(paragraph, firstNonParagraph);
    });
  }

  const email = siteHome.querySelector("[data-home-contact-email]");
  if (email && typeof content.contactEmail === "string") {
    email.textContent = content.contactEmail;
    if (content.contactEmail.trim()) {
      email.href = `mailto:${content.contactEmail}`;
    } else {
      email.removeAttribute("href");
    }
  }
}

async function loadSiteContent() {
  if (!siteHome || !hasFirebaseConfig()) return;
  try {
    const db = getFirestore(getFirebaseApp());
    const snapshot = await getDoc(doc(db, "siteContent", currentLocale(siteHome)));
    if (snapshot.exists()) applySiteContent(snapshot.data());
  } catch {
    // The static HTML remains a complete, readable fallback when Firestore is unavailable.
  }
}

async function loadProfileContent() {
  if (!siteHome || !hasFirebaseConfig()) return;
  try {
    const db = getFirestore(getFirebaseApp());
    const locale = currentLocale(siteHome);
    const snapshot = await getDoc(doc(db, "profileContent", locale));
    if (snapshot.exists()) applyProfileFields(siteHome, snapshot.data().fields);
  } catch {
    // The checked-in profile cards remain visible when Firestore is unavailable.
  }
}

function applyProfileLists(root, lists) {
  if (siteHome) {
    renderProfileDetails(root.querySelector("[data-profile-details]"), lists.details);
    renderProfileInterestPreview(root.querySelector("[data-profile-interests]"), lists.interests);
  }
  if (interestPage) renderInterestDetails(root, lists.interests, renderMarkdown);
}

async function loadProfileLists() {
  const root = siteHome || interestPage;
  if (!root) return { details: [], interests: [] };
  const defaults = readProfileListDefaults(root);
  if (!hasFirebaseConfig()) {
    applyProfileLists(root, defaults);
    return defaults;
  }
  try {
    const db = getFirestore(getFirebaseApp());
    const locale = currentLocale(root);
    const snapshot = await getDoc(doc(db, "profileLists", locale));
    const lists = snapshot.exists() ? normalizeProfileLists(snapshot.data()) : defaults;
    applyProfileLists(root, lists);
    return lists;
  } catch {
    applyProfileLists(root, defaults);
    return defaults;
  }
}

function projectStatusClass(status) {
  return `status-${slugify(status || "ongoing")}`;
}

function projectMetaMarkup(project) {
  const stack = Array.isArray(project.stack) && project.stack.length
    ? `<div class="tag-list">${project.stack.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>`
    : "";
  return `<div class="card-meta"><span class="status-label ${projectStatusClass(project.status)}">${escapeHtml(project.status)}</span>${stack}</div>`;
}

function projectCardMarkup(project, href, index) {
  const mediaClasses = ["project-media-teal", "project-media-coral", "project-media-sage", "project-media-graphite"];
  return `<a class="project-card project-card-link reveal is-visible" href="${escapeHtml(href)}">
    <div class="project-media ${mediaClasses[index % mediaClasses.length]}" aria-hidden="true">
      <span>${String(index + 1).padStart(2, "0")}</span>
    </div>
    <div class="project-content">
      <p class="project-type">${escapeHtml(project.category)}</p>
      <h3>${escapeHtml(project.title)}</h3>
      <p>${escapeHtml(project.excerpt)}</p>
      ${projectMetaMarkup(project)}
    </div>
  </a>`;
}

async function loadPublishedProjects() {
  const container = projectList || featuredProjects;
  if (!container || !hasFirebaseConfig()) return;
  const locale = currentLocale(container);

  try {
    const db = getFirestore(getFirebaseApp());
    const projectsQuery = query(
      collection(db, "projects"),
      where("locale", "==", locale),
      where("published", "==", true),
      orderBy("order", "asc"),
      limit(projectList ? 100 : 4),
    );
    const [snapshot, contentMarker] = await Promise.all([
      getDocs(projectsQuery),
      getDoc(doc(db, "siteContent", locale)),
    ]);
    if (!contentMarker.exists()) return;

    const projects = snapshot.docs.map((projectDocument) => ({
      id: projectDocument.id,
      ...projectDocument.data(),
    }));
    const copy = localizedCopy(locale);
    if (!projects.length) {
      container.innerHTML = `<p class="post-loading">${escapeHtml(copy.noProjects)}</p>`;
      return;
    }

    container.innerHTML = projects.map((project, index) => {
      const href = projectList
        ? `./${encodeURIComponent(project.slug)}/`
        : `./projects/${encodeURIComponent(project.slug)}/`;
      return projectCardMarkup(project, href, index);
    }).join("");
  } catch (error) {
    if (error?.code === "failed-precondition" && projectList) {
      projectList.insertAdjacentHTML("afterbegin", '<p class="post-loading notice-error">專案索引尚未建立，請稍後再試。</p>');
    }
  }
}

function resolveProjectSlug() {
  const querySlug = new URLSearchParams(window.location.search).get("slug");
  if (querySlug) return querySlug;
  if (projectArticle?.dataset.projectSlug) return projectArticle.dataset.projectSlug;
  const segments = window.location.pathname.split("/").filter(Boolean);
  const projectsIndex = segments.lastIndexOf("projects");
  const pathSlug = projectsIndex >= 0 ? segments[projectsIndex + 1] : "";
  return pathSlug && pathSlug !== "project" ? decodeURIComponent(pathSlug) : "";
}

function replaceProjectFallbackUrl(slug) {
  const hasFallbackQuery = new URLSearchParams(window.location.search).has("slug");
  if (!hasFallbackQuery || !/\/projects\/project\/?$/u.test(window.location.pathname)) return;
  const cleanUrl = new URL(`../${encodeURIComponent(slug)}/`, window.location.href);
  window.history.replaceState(null, "", `${cleanUrl.pathname}${cleanUrl.hash}`);
}

function renderProjectArticle(project, locale) {
  const copy = localizedCopy(locale);
  const stackText = Array.isArray(project.stack) && project.stack.length
    ? project.stack.join(", ")
    : copy.updating;
  document.title = `${project.title} | 蕭士翔`;
  const description = document.querySelector('meta[name="description"]');
  if (description) description.setAttribute("content", project.excerpt || project.title);

  projectArticle.innerHTML = `<header class="article-header">
      <div class="section-inner">
        <p class="post-meta">${escapeHtml(project.category)}</p>
        <span class="status-label ${projectStatusClass(project.status)}">${escapeHtml(project.status)}</span>
        <h1>${escapeHtml(project.title)}</h1>
        <p>${escapeHtml(project.excerpt)}</p>
        <div class="project-facts">
          <div class="project-fact"><strong>${copy.year}</strong><span>${escapeHtml(project.year || copy.updating)}</span></div>
          <div class="project-fact"><strong>${copy.role}</strong><span>${escapeHtml(project.role || copy.updating)}</span></div>
          <div class="project-fact"><strong>${copy.tools}</strong><span>${escapeHtml(stackText)}</span></div>
        </div>
      </div>
    </header>
    <div class="article-body"><div class="section-inner prose">${renderMarkdown(project.content || "")}</div></div>`;
}

function showProjectError(locale) {
  const copy = localizedCopy(locale);
  projectArticle.innerHTML = `<section class="not-found"><div class="section-inner"><p class="kicker">Project</p><h1>${escapeHtml(copy.projectMissing)}</h1><div class="hero-actions"><a class="button button-primary" href="../">${escapeHtml(copy.backProjects)}</a><a class="button button-secondary" href="../../">${escapeHtml(copy.backHome)}</a></div></div></section>`;
}

async function loadProjectArticle() {
  if (!projectArticle || !hasFirebaseConfig()) return;
  const locale = currentLocale(projectArticle);
  const slug = resolveProjectSlug();
  const isStaticFallback = Boolean(projectArticle.dataset.projectSlug);
  if (!slug) {
    if (!isStaticFallback) showProjectError(locale);
    return;
  }
  replaceProjectFallbackUrl(slug);

  try {
    const db = getFirestore(getFirebaseApp());
    const snapshot = await getDoc(doc(db, "projects", `${locale}--${slug}`));
    if (!snapshot.exists()) {
      if (!isStaticFallback) showProjectError(locale);
      return;
    }
    renderProjectArticle({ id: snapshot.id, ...snapshot.data() }, locale);
  } catch (error) {
    if (!isStaticFallback || error?.code === "permission-denied") showProjectError(locale);
  }
}

loadPublishedPosts();
loadArticle();
window.__SITE_CONTENT_LOAD_PROMISE__ = loadSiteContent();
window.__PROFILE_CONTENT_LOAD_PROMISE__ = window.__SITE_CONTENT_LOAD_PROMISE__.then(loadProfileContent);
window.__PROFILE_LISTS_LOAD_PROMISE__ = window.__PROFILE_CONTENT_LOAD_PROMISE__.then(loadProfileLists);
loadPublishedProjects();
loadProjectArticle();
