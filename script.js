const body = document.body;
const navToggle = document.querySelector(".nav-toggle");
const navLinks = document.querySelectorAll(".nav-menu a");
const toast = document.querySelector(".toast");
const copyEmailButton = document.querySelector("[data-copy-email]");
const year = document.querySelector("#year");
const latestPosts = document.querySelector("[data-latest-posts]");
const languageLinks = document.querySelectorAll("[data-language]");

languageLinks.forEach((link) => {
  link.addEventListener("click", () => {
    window.localStorage.setItem("preferred-language", link.dataset.language);
  });
});

try {
  const preferredLanguage = window.localStorage.getItem("preferred-language");
  const currentLanguage = document.documentElement.lang === "zh-Hant"
    ? "zh"
    : document.documentElement.lang;

  if (preferredLanguage && preferredLanguage !== currentLanguage) {
    const preferredLink = document.querySelector(`[data-language="${preferredLanguage}"]`);
    if (preferredLink) window.location.replace(preferredLink.href);
  }
} catch {
  // Language switching still works when storage is unavailable.
}

if (year) {
  year.textContent = new Date().getFullYear();
}

if (navToggle) {
  navToggle.addEventListener("click", () => {
    const isOpen = body.classList.toggle("nav-open");
    navToggle.setAttribute("aria-expanded", String(isOpen));
    navToggle.setAttribute("aria-label", isOpen ? "關閉選單" : "開啟選單");
  });
}

navLinks.forEach((link) => {
  link.addEventListener("click", () => {
    body.classList.remove("nav-open");
    navToggle?.setAttribute("aria-expanded", "false");
    navToggle?.setAttribute("aria-label", "開啟選單");
  });
});

function showToast(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("is-visible");
  window.clearTimeout(showToast.timeoutId);
  showToast.timeoutId = window.setTimeout(() => {
    toast.classList.remove("is-visible");
  }, 2200);
}

if (copyEmailButton) {
  copyEmailButton.addEventListener("click", async () => {
    const email = copyEmailButton.dataset.copyEmail;

    try {
      await navigator.clipboard.writeText(email);
      showToast("Email 已複製");
    } catch {
      showToast(email);
    }
  });
}

const revealItems = document.querySelectorAll(".reveal");

if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.18 },
  );

  revealItems.forEach((item) => observer.observe(item));
} else {
  revealItems.forEach((item) => item.classList.add("is-visible"));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function loadLatestPosts() {
  if (!latestPosts) return;

  try {
    const response = await fetch("./posts.json", { cache: "no-store" });
    if (!response.ok) throw new Error("Unable to load posts");

    const posts = await response.json();
    if (!Array.isArray(posts) || posts.length === 0) {
      latestPosts.innerHTML = '<p class="post-loading">目前還沒有貼文。</p>';
      return;
    }

    latestPosts.innerHTML = posts
      .slice(0, 3)
      .map(
        (post) => `
          <article class="post-card">
            <p class="post-meta">${escapeHtml(post.category || "Learning")} · ${escapeHtml(post.displayDate)} · ${escapeHtml(post.readingTime || 1)} min read</p>
            <h3>${escapeHtml(post.title)}</h3>
            <p>${escapeHtml(post.excerpt)}</p>
            <a href="${escapeHtml(post.url)}">閱讀文章</a>
          </article>
        `,
      )
      .join("");
  } catch {
    latestPosts.innerHTML =
      '<p class="post-loading">貼文需要透過本機伺服器或 GitHub Pages 預覽。</p>';
  }
}

loadLatestPosts();
