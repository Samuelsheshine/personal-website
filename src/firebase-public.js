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

const latestContainer = document.querySelector("[data-latest-posts]");
const blogList = document.querySelector("[data-firestore-post-list]");
const publicStatus = document.querySelector("[data-firestore-status]");
const article = document.querySelector("[data-firestore-article]");
const regularNotFound = document.querySelector("[data-regular-not-found]");

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

loadPublishedPosts();
loadArticle();
