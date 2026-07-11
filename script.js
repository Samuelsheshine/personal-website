const body = document.body;
const navToggle = document.querySelector(".nav-toggle");
const navLinks = document.querySelectorAll(".nav-menu a");
const toast = document.querySelector(".toast");
const copyEmailButton = document.querySelector("[data-copy-email]");
const year = document.querySelector("#year");
const latestPosts = document.querySelector("[data-latest-posts]");
const languageSelect = document.querySelector(".language-select");
const pageLanguage = document.documentElement.lang === "zh-Hant"
  ? "zh"
  : document.documentElement.lang;
const localizedText = {
  zh: { noPosts: "目前還沒有文章。", read: "閱讀文章", preview: "文章需要透過本機伺服器或 GitHub Pages 預覽。" },
  en: { noPosts: "No articles yet.", read: "Read article", preview: "Articles require a local server or GitHub Pages preview." },
  ja: { noPosts: "記事はまだありません。", read: "記事を読む", preview: "記事の表示にはローカルサーバーまたはGitHub Pagesが必要です。" },
}[pageLanguage] || {};

languageSelect?.addEventListener("change", () => {
  const option = languageSelect.selectedOptions[0];
  window.localStorage.setItem("preferred-language", option.dataset.language);
  window.location.assign(option.value);
});

try {
  const preferredLanguage = window.localStorage.getItem("preferred-language");
  const currentLanguage = document.documentElement.lang === "zh-Hant"
    ? "zh"
    : document.documentElement.lang;

  if (preferredLanguage && preferredLanguage !== currentLanguage) {
    const preferredOption = document.querySelector(`[data-language="${preferredLanguage}"]`);
    if (preferredOption) window.location.replace(preferredOption.value);
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
    navToggle.setAttribute("aria-label", isOpen ? navToggle.dataset.labelClose : navToggle.dataset.labelOpen);
  });
}

navLinks.forEach((link) => {
  link.addEventListener("click", () => {
    body.classList.remove("nav-open");
    navToggle?.setAttribute("aria-expanded", "false");
    navToggle?.setAttribute("aria-label", navToggle.dataset.labelOpen);
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
      latestPosts.innerHTML = `<p class="post-loading">${localizedText.noPosts}</p>`;
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
            <a href="${escapeHtml(post.url)}">${localizedText.read}</a>
          </article>
        `,
      )
      .join("");
  } catch {
    latestPosts.innerHTML = `<p class="post-loading">${localizedText.preview}</p>`;
  }
}

loadLatestPosts();
