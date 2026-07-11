const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const rootDir = path.resolve(__dirname, "..");
const siteUrl = "https://samuelsheshine.github.io/personal-website";
const postsContentDir = path.join(rootDir, "content", "posts");
const projectsContentDir = path.join(rootDir, "content", "projects");
const pagesContentDir = path.join(rootDir, "content", "pages");
const distDir = path.join(rootDir, "dist");
const postsOutputDir = path.join(distDir, "posts");
const blogOutputDir = path.join(distDir, "blog");
const projectsOutputDir = path.join(distDir, "projects");
const staticEntries = ["index.html", "styles.css", "script.js", "favicon.svg", ".nojekyll", "assets"];
const localePrefixes = { zh: "", en: "/en", ja: "/ja" };
const localeUi = {
  zh: {
    htmlLang: "zh-Hant", skip: "跳到主要內容", home: "首頁", about: "關於", now: "Now",
    projects: "專題", journey: "學習歷程", writing: "Writing", resume: "履歷", contact: "聯絡",
    menuOpen: "開啟選單", brand: "蕭士翔首頁", backHome: "回首頁", read: "閱讀文章",
    noPosts: "目前還沒有貼文。", noProjects: "目前還沒有專案。", year: "年份", role: "角色",
    tools: "工具 / 主題", updating: "持續更新", techLabel: "使用技術", lastUpdated: "Last updated",
  },
  en: {
    htmlLang: "en", skip: "Skip to main content", home: "Home", about: "About", now: "Now",
    projects: "Projects", journey: "Academic Journey", writing: "Writing", resume: "Resume", contact: "Contact",
    menuOpen: "Open menu", brand: "Shih-Hsiang Hsiao home", backHome: "Back to home", read: "Read article",
    noPosts: "No articles yet.", noProjects: "No projects yet.", year: "Year", role: "Role",
    tools: "Tools / Topics", updating: "Continuously updated", techLabel: "Technologies", lastUpdated: "Last updated",
  },
  ja: {
    htmlLang: "ja", skip: "メインコンテンツへ", home: "ホーム", about: "プロフィール", now: "Now",
    projects: "プロジェクト", journey: "学習の歩み", writing: "記事", resume: "履歴", contact: "連絡先",
    menuOpen: "メニューを開く", brand: "蕭士翔ホーム", backHome: "ホームへ戻る", read: "記事を読む",
    noPosts: "記事はまだありません。", noProjects: "プロジェクトはまだありません。", year: "年度", role: "役割",
    tools: "ツール / テーマ", updating: "継続更新", techLabel: "使用技術", lastUpdated: "最終更新",
  },
};

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function emptyDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  ensureDir(dir);
}

function copyEntry(entry) {
  const from = path.join(rootDir, entry);
  const to = path.join(distDir, entry);

  if (!fs.existsSync(from)) return;

  const stats = fs.statSync(from);
  if (stats.isDirectory()) {
    fs.cpSync(from, to, { recursive: true });
  } else {
    ensureDir(path.dirname(to));
    fs.copyFileSync(from, to);
  }
}

function parseFrontMatter(source) {
  if (!source.startsWith("---")) {
    return { data: {}, body: source.trim() };
  }

  const end = source.indexOf("\n---", 3);
  if (end === -1) {
    return { data: {}, body: source.trim() };
  }

  const frontMatter = source.slice(3, end).trim();
  const body = source.slice(end + 4).trim();
  const data = {};

  frontMatter.split(/\r?\n/).forEach((line) => {
    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!match) return;

    const key = match[1].trim();
    const value = match[2].trim().replace(/^['"]|['"]$/g, "");
    data[key] = value;
  });

  return { data, body };
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function slugify(input) {
  const slug = String(input || "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "");

  if (slug) return slug;

  return crypto.createHash("sha1").update(String(input)).digest("hex").slice(0, 10);
}

function inlineMarkdown(value) {
  let html = escapeHtml(value);

  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" rel="noreferrer">$1</a>');
  html = html.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>');

  return html;
}

function renderMarkdown(markdown) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const html = [];
  let paragraph = [];
  let list = [];
  let orderedList = [];
  let blockquote = [];
  let inCode = false;
  let codeLines = [];

  function flushParagraph() {
    if (!paragraph.length) return;
    html.push(`<p>${inlineMarkdown(paragraph.join(" "))}</p>`);
    paragraph = [];
  }

  function flushList() {
    if (!list.length) return;
    html.push(`<ul>${list.map((item) => `<li>${inlineMarkdown(item)}</li>`).join("")}</ul>`);
    list = [];
  }

  function flushOrderedList() {
    if (!orderedList.length) return;
    html.push(`<ol>${orderedList.map((item) => `<li>${inlineMarkdown(item)}</li>`).join("")}</ol>`);
    orderedList = [];
  }

  function flushBlockquote() {
    if (!blockquote.length) return;
    html.push(`<blockquote><p>${inlineMarkdown(blockquote.join(" "))}</p></blockquote>`);
    blockquote = [];
  }

  function flushAll() {
    flushParagraph();
    flushList();
    flushOrderedList();
    flushBlockquote();
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.trim().startsWith("```")) {
      if (inCode) {
        html.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
        codeLines = [];
        inCode = false;
      } else {
        flushAll();
        inCode = true;
      }
      continue;
    }

    if (inCode) {
      codeLines.push(line);
      continue;
    }

    if (!line.trim()) {
      flushAll();
      continue;
    }

    const nextLine = lines[index + 1] || "";
    if (line.trim().startsWith("|") && /^\s*\|?\s*:?-{3,}/.test(nextLine)) {
      flushAll();
      const headers = line.split("|").slice(1, -1).map((cell) => cell.trim());
      const rows = [];
      index += 2;
      while (index < lines.length && lines[index].trim().startsWith("|")) {
        rows.push(lines[index].split("|").slice(1, -1).map((cell) => cell.trim()));
        index += 1;
      }
      index -= 1;
      html.push(`<div class="table-wrap"><table><thead><tr>${headers.map((cell) => `<th>${inlineMarkdown(cell)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${inlineMarkdown(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`);
      continue;
    }

    const heading = line.match(/^(#{2,3})\s+(.+)$/);
    if (heading) {
      flushAll();
      const level = heading[1].length;
      html.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }

    const bullet = line.match(/^\s*[-*]\s+(.+)$/);
    if (bullet) {
      flushParagraph();
      flushOrderedList();
      flushBlockquote();
      list.push(bullet[1]);
      continue;
    }

    const numbered = line.match(/^\s*\d+\.\s+(.+)$/);
    if (numbered) {
      flushParagraph();
      flushList();
      flushBlockquote();
      orderedList.push(numbered[1]);
      continue;
    }

    const quote = line.match(/^>\s+(.+)$/);
    if (quote) {
      flushParagraph();
      flushList();
      flushOrderedList();
      blockquote.push(quote[1]);
      continue;
    }

    paragraph.push(line.trim());
  }

  flushAll();

  if (inCode) {
    html.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
  }

  return html.join("\n");
}

function stripMarkdown(markdown) {
  return markdown
    .replace(/```[\s\S]*?```/g, "")
    .replace(/[#>*_`[\]()]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function formatDate(date, locale = "zh") {
  const dateLocale = { zh: "zh-TW", en: "en-US", ja: "ja-JP" }[locale];
  return new Intl.DateTimeFormat(dateLocale, {
    dateStyle: "medium",
    timeZone: "Asia/Taipei",
  }).format(date);
}

function readPosts(contentDir = postsContentDir, locale = "zh") {
  if (!fs.existsSync(contentDir)) return [];

  return fs
    .readdirSync(contentDir)
    .filter((file) => file.endsWith(".md"))
    .map((file) => {
      const fullPath = path.join(contentDir, file);
      const source = fs.readFileSync(fullPath, "utf8");
      const { data, body } = parseFrontMatter(source);
      const title = data.title || file.replace(/\.md$/, "");
      const dateText = data.date || file.slice(0, 10);
      const date = new Date(`${dateText}T00:00:00+08:00`);
      const slug = slugify(data.slug || file.replace(/^\d{4}-\d{2}-\d{2}-/, "").replace(/\.md$/, ""));
      const excerpt = data.excerpt || `${stripMarkdown(body).slice(0, 120)}...`;
      const isDraft = data.draft === "true" || data.published === "false";
      const updatedText = data.updated || dateText;
      const category = data.category || "Learning";
      const tags = data.tags ? data.tags.split(",").map((item) => item.trim()).filter(Boolean) : [];
      const readingTime = Math.max(1, Math.ceil(stripMarkdown(body).length / 500));

      return {
        title,
        date,
        dateText,
        updatedText,
        displayDate: formatDate(date, locale),
        slug,
        excerpt,
        body,
        category,
        tags,
        readingTime,
        isDraft,
        sourceFile: file,
        url: `./posts/${slug}/`,
      };
    })
    .filter((post) => !post.isDraft)
    .sort((a, b) => b.date - a.date);
}

function readPages(contentDir = pagesContentDir) {
  if (!fs.existsSync(contentDir)) return [];

  return fs
    .readdirSync(contentDir)
    .filter((file) => file.endsWith(".md"))
    .map((file) => {
      const source = fs.readFileSync(path.join(contentDir, file), "utf8");
      const { data, body } = parseFrontMatter(source);
      const slug = slugify(data.slug || file.replace(/\.md$/, ""));

      return {
        title: data.title || slug,
        slug,
        kicker: data.kicker || "Profile",
        description: data.description || stripMarkdown(body).slice(0, 155),
        updated: data.updated || "",
        body,
      };
    });
}

function readProjects(contentDir = projectsContentDir) {
  if (!fs.existsSync(contentDir)) return [];

  return fs
    .readdirSync(contentDir)
    .filter((file) => file.endsWith(".md"))
    .map((file) => {
      const fullPath = path.join(contentDir, file);
      const source = fs.readFileSync(fullPath, "utf8");
      const { data, body } = parseFrontMatter(source);
      const title = data.title || file.replace(/\.md$/, "");
      const slug = slugify(data.slug || file.replace(/^\d{2}-/, "").replace(/\.md$/, ""));
      const excerpt = data.excerpt || `${stripMarkdown(body).slice(0, 120)}...`;
      const stack = data.stack
        ? data.stack.split(",").map((item) => item.trim()).filter(Boolean)
        : [];
      const order = Number.parseInt(data.order || "999", 10);
      const isDraft = data.draft === "true" || data.published === "false";

      return {
        title,
        slug,
        excerpt,
        body,
        order: Number.isNaN(order) ? 999 : order,
        category: data.category || "Project",
        status: data.status || "In progress",
        year: data.year || "",
        role: data.role || "",
        stack,
        isDraft,
        sourceFile: file,
        url: `./projects/${slug}/`,
      };
    })
    .filter((project) => !project.isDraft)
    .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title, "zh-Hant"));
}

function languageLinks(relativeRoot, route, locale) {
  return `<div class="language-switcher" aria-label="Language">
            ${[["zh", "中"], ["en", "EN"], ["ja", "日"]].map(([code, label]) => `<a href="${relativeRoot}${localePrefixes[code]}${route}" lang="${localeUi[code].htmlLang}" data-language="${code}"${code === locale ? ' class="is-active" aria-current="page"' : ""}>${label}</a>`).join("")}
          </div>`;
}

function alternateLinks(route) {
  return [["zh-Hant", "zh"], ["en", "en"], ["ja", "ja"]]
    .map(([hreflang, locale]) => `<link rel="alternate" hreflang="${hreflang}" href="${siteUrl}${localePrefixes[locale]}${route}" />`)
    .join("\n    ");
}

function pageShell({ title, description, content, relativeRoot = ".", canonicalPath = "/", locale = "zh", route = canonicalPath }) {
  const ui = localeUi[locale];
  const canonicalUrl = `${siteUrl}${canonicalPath}`;
  return `<!doctype html>
<html lang="${ui.htmlLang}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />
    ${alternateLinks(route)}
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
    <meta property="og:image" content="${siteUrl}/assets/hero-workspace.png" />
    <meta name="twitter:card" content="summary_large_image" />
    <link rel="icon" href="${relativeRoot}/favicon.svg" type="image/svg+xml" />
    <link rel="stylesheet" href="${relativeRoot}/styles.css" />
  </head>
  <body>
    <a class="skip-link" href="#main">${ui.skip}</a>

    <header class="site-header">
      <nav class="nav" aria-label="Navigation">
        <a class="brand" href="${relativeRoot}${localePrefixes[locale]}/" aria-label="${ui.brand}">
          <span class="brand-mark">SH</span>
          <span>蕭士翔</span>
        </a>

        <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="nav-menu" aria-label="${ui.menuOpen}">
          <span></span><span></span><span></span>
        </button>

        <div class="nav-menu" id="nav-menu">
          <a href="${relativeRoot}${localePrefixes[locale]}/">${ui.home}</a>
          <a href="${relativeRoot}${localePrefixes[locale]}/#about">${ui.about}</a>
          <a href="${relativeRoot}${localePrefixes[locale]}/now/">${ui.now}</a>
          <a href="${relativeRoot}${localePrefixes[locale]}/projects/">${ui.projects}</a>
          <a href="${relativeRoot}${localePrefixes[locale]}/academic-journey/">${ui.journey}</a>
          <a href="${relativeRoot}${localePrefixes[locale]}/blog/">${ui.writing}</a>
          <a href="${relativeRoot}${localePrefixes[locale]}/resume/">${ui.resume}</a>
          <a href="${relativeRoot}${localePrefixes[locale]}/#contact">${ui.contact}</a>
          ${languageLinks(relativeRoot, route, locale)}
        </div>
      </nav>
    </header>

    <main id="main">
      ${content}
    </main>

    <footer class="site-footer">
      <div class="section-inner footer-inner">
        <p>© <span id="year"></span> 蕭士翔</p>
        <a href="${relativeRoot}${localePrefixes[locale]}/">${ui.backHome}</a>
      </div>
    </footer>

    <script src="${relativeRoot}/script.js"></script>
  </body>
</html>`;
}

function renderBlogIndex(posts, locale = "zh", relativeRoot = "..") {
  const ui = localeUi[locale];
  const prefix = localePrefixes[locale];
  const copy = {
    zh: ["貼文 | 蕭士翔", "蕭士翔的最新貼文與學習紀錄。", "貼文", "我會把作品紀錄、學習筆記與想法整理在這裡。"],
    en: ["Writing | Shih-Hsiang Hsiao", "Engineering notes and reflections by Shih-Hsiang Hsiao.", "Writing", "Project logs, learning notes, and reflections on engineering and exchange."],
    ja: ["記事 | 蕭士翔", "蕭士翔のプロジェクト記録、学習ノート、振り返り。", "記事", "プロジェクト、学習、工学、留学についての記録です。"],
  }[locale];
  const list = posts.length
    ? posts
        .map(
          (post) => `<article class="post-card">
            <p class="post-meta">${escapeHtml(post.category)} · ${post.readingTime} min read</p>
            <div>
              <h3>${escapeHtml(post.title)}</h3>
              <p>${escapeHtml(post.excerpt)}</p>
            </div>
            <a href="../posts/${post.slug}/">${ui.read}</a>
          </article>`,
        )
        .join("\n")
    : `<p class="post-loading">${ui.noPosts}</p>`;

  return pageShell({
    title: copy[0],
    description: copy[1],
    relativeRoot,
    canonicalPath: `${prefix}/blog/`,
    route: "/blog/",
    locale,
    content: `<section class="blog-hero">
        <div class="section-inner">
          <p class="kicker">Writing</p>
          <h1>${copy[2]}</h1>
          <p>${copy[3]}</p>
        </div>
      </section>

      <section class="section">
        <div class="section-inner post-list">
          ${list}
        </div>
      </section>`,
  });
}

function projectMediaClass(index) {
  return ["project-media-teal", "project-media-coral", "project-media-sage"][index % 3];
}

function statusClass(status) {
  return `status-${slugify(status)}`;
}

function renderProjectMeta(project, locale = "zh") {
  const ui = localeUi[locale];
  const stack = project.stack.length
    ? `<div class="tag-list" aria-label="${ui.techLabel}">${project.stack.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>`
    : "";

  return `<div class="card-meta"><span class="status-label ${statusClass(project.status)}">${escapeHtml(project.status)}</span>${stack}</div>`;
}

function renderProjectsIndex(projects, locale = "zh", relativeRoot = "..") {
  const ui = localeUi[locale];
  const prefix = localePrefixes[locale];
  const copy = {
    zh: ["Projects & Directions | 蕭士翔", "蕭士翔的專題、交換準備與學習系統紀錄。", "專題與方向", "每個專案都有自己的背景、目標、進度、工具與下一步。"],
    en: ["Projects & Directions | Shih-Hsiang Hsiao", "Robotics, control, exchange, and learning-system projects by Shih-Hsiang Hsiao.", "Projects & Directions", "Each case study records its context, goals, current evidence, tools, and next step."],
    ja: ["プロジェクト | 蕭士翔", "蕭士翔のロボティクス、制御、留学、学習システムの記録。", "プロジェクト", "各ページに背景、目標、現在の進捗、ツール、次のステップを記録します。"],
  }[locale];
  const list = projects.length
    ? projects
        .map(
          (project, index) => `<a class="project-card project-card-link" href="./${project.slug}/">
            <div class="project-media ${projectMediaClass(index)}" aria-hidden="true">
              <span>${String(index + 1).padStart(2, "0")}</span>
            </div>
            <div class="project-content">
              <p class="project-type">${escapeHtml(project.category)}</p>
              <h3>${escapeHtml(project.title)}</h3>
              <p>${escapeHtml(project.excerpt)}</p>
              ${renderProjectMeta(project, locale)}
            </div>
          </a>`,
        )
        .join("\n")
    : `<p class="post-loading">${ui.noProjects}</p>`;

  return pageShell({
    title: copy[0],
    description: copy[1],
    relativeRoot,
    canonicalPath: `${prefix}/projects/`,
    route: "/projects/",
    locale,
    content: `<section class="blog-hero">
        <div class="section-inner">
          <p class="kicker">Projects & Directions</p>
          <h1>${copy[2]}</h1>
          <p>${copy[3]}</p>
        </div>
      </section>

      <section class="section">
        <div class="section-inner project-list">
          ${list}
        </div>
      </section>`,
  });
}

function renderProject(project, locale = "zh", relativeRoot = "../..") {
  const ui = localeUi[locale];
  const prefix = localePrefixes[locale];
  const stackText = project.stack.length ? project.stack.join(", ") : ui.updating;

  return pageShell({
    title: `${project.title} | 蕭士翔`,
    description: project.excerpt,
    relativeRoot,
    canonicalPath: `${prefix}/projects/${project.slug}/`,
    route: `/projects/${project.slug}/`,
    locale,
    content: `<article>
        <header class="article-header">
          <div class="section-inner">
            <p class="post-meta">${escapeHtml(project.category)}</p>
            <span class="status-label ${statusClass(project.status)}">${escapeHtml(project.status)}</span>
            <h1>${escapeHtml(project.title)}</h1>
            <p>${escapeHtml(project.excerpt)}</p>
            <div class="project-facts" aria-label="專案資訊">
              <div class="project-fact">
                <strong>${ui.year}</strong>
                <span>${escapeHtml(project.year || ui.updating)}</span>
              </div>
              <div class="project-fact">
                <strong>${ui.role}</strong>
                <span>${escapeHtml(project.role || "Owner")}</span>
              </div>
              <div class="project-fact">
                <strong>${ui.tools}</strong>
                <span>${escapeHtml(stackText)}</span>
              </div>
            </div>
          </div>
        </header>

        <div class="article-body">
          <div class="section-inner prose">
            ${renderMarkdown(project.body)}
          </div>
        </div>
      </article>`,
  });
}

function renderPost(post, locale = "zh", relativeRoot = "../..") {
  const prefix = localePrefixes[locale];
  return pageShell({
    title: `${post.title} | 蕭士翔`,
    description: post.excerpt,
    relativeRoot,
    canonicalPath: `${prefix}/posts/${post.slug}/`,
    route: `/posts/${post.slug}/`,
    locale,
    content: `<article>
        <header class="article-header">
          <div class="section-inner">
            <p class="post-meta">${escapeHtml(post.category)} · ${escapeHtml(post.displayDate)} · ${post.readingTime} min read</p>
            <h1>${escapeHtml(post.title)}</h1>
            <p>${escapeHtml(post.excerpt)}</p>
          </div>
        </header>

        <div class="article-body">
          <div class="section-inner prose">
            ${renderMarkdown(post.body)}
          </div>
        </div>
      </article>`,
  });
}

function renderContentPage(page, locale = "zh", relativeRoot = "..") {
  const ui = localeUi[locale];
  const prefix = localePrefixes[locale];
  return pageShell({
    title: `${page.title} | 蕭士翔`,
    description: page.description,
    relativeRoot,
    canonicalPath: `${prefix}/${page.slug}/`,
    route: `/${page.slug}/`,
    locale,
    content: `<article>
        <header class="article-header">
          <div class="section-inner">
            <p class="kicker">${escapeHtml(page.kicker)}</p>
            <h1>${escapeHtml(page.title)}</h1>
            <p>${escapeHtml(page.description)}</p>
            ${page.updated ? `<p class="updated-date">${ui.lastUpdated}: ${escapeHtml(page.updated)}</p>` : ""}
          </div>
        </header>
        <div class="article-body">
          <div class="section-inner prose">
            ${renderMarkdown(page.body)}
          </div>
        </div>
      </article>`,
  });
}

const localizedHome = {
  en: {
    title: "Shih-Hsiang Hsiao | Mechanical Engineering, Robotics, and Control",
    description: "Engineering portfolio of Shih-Hsiang Hsiao, featuring robotics, control, system modeling, AI-assisted learning, and the Nagoya University NUPACE exchange.",
    kicker: "Mechanical Engineering · Robotics · Control",
    lede: "Mechanical engineering and control student at National Taiwan University of Science and Technology, focusing on control engineering, robotics, system modeling, and AI-assisted learning. Joining Nagoya University’s NUPACE program from September 2026 to February 2027.",
    viewProjects: "View Projects", viewResume: "View Resume", contact: "Contact Me",
    focusTitle: "What I am working on now", updated: "Last updated: 2026-07-11",
    focus: [["Exchange", "Preparing for Nagoya University NUPACE"], ["Robotics", "Cooperative agricultural robot system"], ["Control", "2-DOF singularity analysis and DLS"], ["Workflow", "Public engineering knowledge base"]],
    nowLink: "View the complete Now page",
    aboutKicker: "About", aboutTitle: "I connect equations, experiments, and engineering decisions.",
    about: ["I am Shih-Hsiang Hsiao, an engineering student at Taiwan Tech. My interests center on robotics, control, system design, and practical AI-assisted workflows.", "This site documents both outcomes and process: how I model problems, test alternatives, correct mistakes, and decide what evidence is still missing."],
    projectsKicker: "Featured Projects", projectsTitle: "Current engineering and academic work", projectsNote: "Each page records the problem, method, current evidence, open questions, and next step.", allProjects: "View all projects",
    skillsKicker: "Skills with Evidence", skillsTitle: "Skills are connected to work that can be inspected.",
    skills: [["MATLAB & Modeling", "2R kinematics, Jacobian metrics, workspace and trajectory visualization."], ["Python, ROS & Systems", "Node architecture, perception and control modules, and multi-robot planning."], ["Control & Robotics", "Forward and inverse kinematics, mathematical modeling, and engineering trade-offs."], ["Development Workflow", "Git, GitHub, Linux, Markdown, static-site publishing, and manual AI verification."]],
    journeyKicker: "Academic & Exchange", journeyTitle: "Coursework, projects, and exchange on one learning path.", journeyLinks: [["Academic Journey", "How engineering mathematics, mechanisms, electronics, and control connect to practice."], ["NUPACE Exchange", "Course planning, preparation, and reflections from the 2026–2027 exchange."], ["Resume", "A concise view of education, projects, technical tools, and languages."]],
    writingKicker: "Writing", writingTitle: "Notes for clearer engineering thinking.", writingNote: "Robotics, control, exchange, learning, and AI-assisted workflows.", allWriting: "View all writing",
    contactKicker: "Contact", contactTitle: "Let’s talk about engineering and learning.", contactNote: "Open to conversations about robotics, control engineering, exchange experiences, academic projects, and engineering collaboration.",
  },
  ja: {
    title: "蕭士翔 | 機械工学・ロボティクス・制御",
    description: "蕭士翔のエンジニアリング・ポートフォリオ。ロボティクス、制御工学、システムモデリング、AI支援学習、名古屋大学NUPACE留学を記録します。",
    kicker: "機械工学 · ロボティクス · 制御",
    lede: "国立台湾科技大学で機械・制御分野を学び、制御工学、ロボティクス、システムモデリング、AI支援学習に取り組んでいます。2026年9月から2027年2月まで名古屋大学NUPACEに参加予定です。",
    viewProjects: "プロジェクトを見る", viewResume: "履歴を見る", contact: "連絡する",
    focusTitle: "現在取り組んでいること", updated: "最終更新: 2026-07-11",
    focus: [["留学", "名古屋大学NUPACEの渡航準備"], ["ロボティクス", "農業収穫ロボットの協調システム"], ["制御", "2自由度特異点解析とDLS"], ["ワークフロー", "公開エンジニアリング知識ベース"]],
    nowLink: "Nowページを詳しく見る",
    aboutKicker: "プロフィール", aboutTitle: "数式、実験、設計判断をつなげる。",
    about: ["蕭士翔です。台湾科技大学で工学を学び、ロボティクス、制御、システム設計、AIを活用した学習プロセスに関心があります。", "このサイトでは成果だけでなく、問題のモデル化、比較検証、修正、そして不足している証拠まで記録します。"],
    projectsKicker: "主なプロジェクト", projectsTitle: "現在進行中の工学・学術プロジェクト", projectsNote: "各ページに課題、方法、現在の証拠、未解決点、次のステップを記録します。", allProjects: "すべてのプロジェクトを見る",
    skillsKicker: "根拠のあるスキル", skillsTitle: "スキルを確認できる実作業と結び付ける。",
    skills: [["MATLAB・モデリング", "2R運動学、Jacobian指標、作業空間と軌道の可視化。"], ["Python・ROS・システム", "ノード構成、知覚・制御モジュール、複数ロボット計画。"], ["制御・ロボティクス", "順運動学・逆運動学、数理モデル、工学的トレードオフ。"], ["開発ワークフロー", "Git、GitHub、Linux、Markdown、静的サイト公開、AI出力の手動検証。"]],
    journeyKicker: "学業・留学", journeyTitle: "授業、プロジェクト、留学を一つの学習経路に。", journeyLinks: [["Academic Journey", "工学数学、機構、電子、制御を実践につなげる過程。"], ["NUPACE留学", "2026–2027年の履修計画、渡航準備、振り返り。"], ["履歴", "学歴、プロジェクト、技術ツール、語学力の要約。"]],
    writingKicker: "記事", writingTitle: "工学的思考を明確にするためのノート。", writingNote: "ロボティクス、制御、留学、学習、AI支援ワークフロー。", allWriting: "すべての記事を見る",
    contactKicker: "連絡先", contactTitle: "工学と学びについて話しましょう。", contactNote: "ロボティクス、制御工学、留学経験、学術プロジェクト、共同開発についての交流を歓迎します。",
  },
};

function renderLocalizedHome(locale, projects) {
  const copy = localizedHome[locale];
  const prefix = localePrefixes[locale];
  const projectCards = projects.slice(0, 4).map((project, index) => `<a class="project-card project-card-link reveal" href="./projects/${project.slug}/">
            <div class="project-media ${projectMediaClass(index)}" aria-hidden="true"><span>${String(index + 1).padStart(2, "0")}</span></div>
            <div class="project-content"><p class="project-type">${escapeHtml(project.category)}</p><h3>${escapeHtml(project.title)}</h3><p>${escapeHtml(project.excerpt)}</p>${renderProjectMeta(project, locale)}</div>
          </a>`).join("\n");
  const focus = copy.focus.map(([label, text]) => `<div><strong>${label}</strong><span>${text}</span></div>`).join("");
  const skills = copy.skills.map(([title, text]) => `<div class="skill-group"><h3>${title}</h3><p>${text}</p></div>`).join("");
  const journeyRoutes = ["academic-journey", "projects/nupace-exchange-prep", "resume"];
  const journey = copy.journeyLinks.map(([title, text], index) => `<a href="./${journeyRoutes[index]}/"><strong>${title}</strong><span>${text}</span></a>`).join("");

  return pageShell({
    title: copy.title, description: copy.description, relativeRoot: "..", canonicalPath: `${prefix}/`, route: "/", locale,
    content: `<section class="hero" id="top" aria-labelledby="hero-title"><img class="hero-image" src="../assets/hero-workspace.png" alt="Workspace overlooking Taipei" /><div class="hero-overlay" aria-hidden="true"></div><div class="hero-content reveal"><p class="kicker">${copy.kicker}</p><h1 id="hero-title">蕭士翔<br />Shih-Hsiang Hsiao</h1><p class="hero-lede">${copy.lede}</p><div class="hero-actions"><a class="button button-primary" href="#work">${copy.viewProjects}</a><a class="button button-ghost" href="./resume/">${copy.viewResume}</a><a class="button button-ghost" href="#contact">${copy.contact}</a></div><dl class="hero-meta"><div><dt>School</dt><dd>NTUST / Taiwan Tech</dd></div><div><dt>Exchange</dt><dd>Nagoya NUPACE</dd></div><div><dt>Focus</dt><dd>Control, Robotics, Modeling</dd></div></dl></div></section>
      <section class="current-focus"><div class="section-inner reveal"><div class="focus-heading"><div><p class="kicker">Current Focus</p><h2>${copy.focusTitle}</h2></div><p class="updated-date">${copy.updated}</p></div><div class="focus-grid">${focus}</div><a class="text-link" href="./now/">${copy.nowLink}</a></div></section>
      <section class="section" id="about"><div class="section-inner split-layout"><div class="section-heading reveal"><p class="kicker">${copy.aboutKicker}</p><h2>${copy.aboutTitle}</h2></div><div class="body-copy reveal">${copy.about.map((text) => `<p>${text}</p>`).join("")}</div></div></section>
      <section class="section section-muted" id="work"><div class="section-inner"><div class="section-heading narrow reveal"><p class="kicker">${copy.projectsKicker}</p><h2>${copy.projectsTitle}</h2><p class="section-note">${copy.projectsNote}</p></div><div class="project-grid project-grid-featured">${projectCards}</div><a class="text-link dark-link" href="./projects/">${copy.allProjects}</a></div></section>
      <section class="section"><div class="section-inner split-layout"><div class="section-heading reveal"><p class="kicker">${copy.skillsKicker}</p><h2>${copy.skillsTitle}</h2></div><div class="skills-panel reveal">${skills}</div></div></section>
      <section class="section journey-preview"><div class="section-inner split-layout"><div class="section-heading reveal"><p class="kicker">${copy.journeyKicker}</p><h2>${copy.journeyTitle}</h2></div><div class="preview-links reveal">${journey}</div></div></section>
      <section class="section section-muted"><div class="section-inner"><div class="section-heading narrow reveal"><p class="kicker">${copy.writingKicker}</p><h2>${copy.writingTitle}</h2><p class="section-note">${copy.writingNote}</p></div><div class="post-preview-grid" data-latest-posts><p class="post-loading">Loading…</p></div><a class="text-link dark-link" href="./blog/">${copy.allWriting}</a></div></section>
      <section class="contact-section" id="contact"><div class="section-inner contact-layout reveal"><div><p class="kicker">${copy.contactKicker}</p><h2>${copy.contactTitle}</h2><p class="contact-note">${copy.contactNote}</p></div><div class="contact-actions"><a class="button button-primary" href="mailto:samhsiao0926@gmail.com">Email</a><a class="button button-secondary" href="https://github.com/Samuelsheshine" target="_blank" rel="noreferrer">GitHub</a><a class="button button-secondary" href="https://www.linkedin.com/in/shih-hsiang-hsiao-652182324/" target="_blank" rel="noreferrer">LinkedIn</a></div></div></section>`,
  });
}

function buildLocalizedLocale(locale) {
  const contentRoot = path.join(rootDir, "content", locale);
  const outputRoot = path.join(distDir, locale);
  const posts = readPosts(path.join(contentRoot, "posts"), locale);
  const projects = readProjects(path.join(contentRoot, "projects"));
  const pages = readPages(path.join(contentRoot, "pages"));

  ensureDir(outputRoot);
  fs.writeFileSync(path.join(outputRoot, "index.html"), renderLocalizedHome(locale, projects));

  const blogDir = path.join(outputRoot, "blog");
  const projectsDir = path.join(outputRoot, "projects");
  ensureDir(blogDir);
  ensureDir(projectsDir);
  fs.writeFileSync(path.join(blogDir, "index.html"), renderBlogIndex(posts, locale, "../.."));
  fs.writeFileSync(path.join(projectsDir, "index.html"), renderProjectsIndex(projects, locale, "../.."));

  posts.forEach((post) => {
    const postDir = path.join(outputRoot, "posts", post.slug);
    ensureDir(postDir);
    fs.writeFileSync(path.join(postDir, "index.html"), renderPost(post, locale, "../../.."));
  });

  projects.forEach((project) => {
    const projectDir = path.join(projectsDir, project.slug);
    ensureDir(projectDir);
    fs.writeFileSync(path.join(projectDir, "index.html"), renderProject(project, locale, "../../.."));
  });

  pages.forEach((page) => {
    const pageDir = path.join(outputRoot, page.slug);
    ensureDir(pageDir);
    fs.writeFileSync(path.join(pageDir, "index.html"), renderContentPage(page, locale, "../.."));
  });

  const manifest = posts.map((post) => ({
    title: post.title, date: post.dateText, displayDate: post.displayDate, category: post.category,
    readingTime: post.readingTime, excerpt: post.excerpt, slug: post.slug, url: `./posts/${post.slug}/`,
  }));
  fs.writeFileSync(path.join(outputRoot, "posts.json"), JSON.stringify(manifest, null, 2));

  return [
    `${localePrefixes[locale]}/`, `${localePrefixes[locale]}/blog/`, `${localePrefixes[locale]}/projects/`,
    ...pages.map((page) => `${localePrefixes[locale]}/${page.slug}/`),
    ...posts.map((post) => `${localePrefixes[locale]}/posts/${post.slug}/`),
    ...projects.map((project) => `${localePrefixes[locale]}/projects/${project.slug}/`),
  ];
}

function build() {
  emptyDir(distDir);
  staticEntries.forEach(copyEntry);
  ensureDir(postsOutputDir);
  ensureDir(blogOutputDir);
  ensureDir(projectsOutputDir);

  const posts = readPosts();
  const projects = readProjects();
  const pages = readPages();

  fs.writeFileSync(path.join(blogOutputDir, "index.html"), renderBlogIndex(posts));
  fs.writeFileSync(path.join(projectsOutputDir, "index.html"), renderProjectsIndex(projects));

  posts.forEach((post) => {
    const postDir = path.join(postsOutputDir, post.slug);
    ensureDir(postDir);
    fs.writeFileSync(path.join(postDir, "index.html"), renderPost(post));
  });

  projects.forEach((project) => {
    const projectDir = path.join(projectsOutputDir, project.slug);
    ensureDir(projectDir);
    fs.writeFileSync(path.join(projectDir, "index.html"), renderProject(project));
  });

  pages.forEach((page) => {
    const pageDir = path.join(distDir, page.slug);
    ensureDir(pageDir);
    fs.writeFileSync(path.join(pageDir, "index.html"), renderContentPage(page));
  });

  const manifest = posts.map((post) => ({
    title: post.title,
    date: post.dateText,
    displayDate: post.displayDate,
    category: post.category,
    readingTime: post.readingTime,
    excerpt: post.excerpt,
    slug: post.slug,
    url: `./posts/${post.slug}/`,
  }));

  fs.writeFileSync(path.join(distDir, "posts.json"), JSON.stringify(manifest, null, 2));

  const projectsManifest = projects.map((project) => ({
    title: project.title,
    category: project.category,
    status: project.status,
    year: project.year,
    excerpt: project.excerpt,
    slug: project.slug,
    url: `./projects/${project.slug}/`,
  }));

  fs.writeFileSync(path.join(distDir, "projects.json"), JSON.stringify(projectsManifest, null, 2));

  const localizedPaths = ["en", "ja"].flatMap(buildLocalizedLocale);

  const sitemapPaths = [
    "/",
    "/blog/",
    "/projects/",
    ...pages.map((page) => `/${page.slug}/`),
    ...posts.map((post) => `/posts/${post.slug}/`),
    ...projects.map((project) => `/projects/${project.slug}/`),
    ...localizedPaths,
  ];
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapPaths.map((urlPath) => `  <url><loc>${siteUrl}${urlPath}</loc></url>`).join("\n")}\n</urlset>\n`;
  fs.writeFileSync(path.join(distDir, "sitemap.xml"), sitemap);
  fs.writeFileSync(path.join(distDir, "robots.txt"), `User-agent: *\nAllow: /\nSitemap: ${siteUrl}/sitemap.xml\n`);
  fs.writeFileSync(path.join(distDir, "404.html"), pageShell({
    title: "找不到頁面 | 蕭士翔",
    description: "你要找的頁面不存在或已經移動。",
    relativeRoot: siteUrl,
    canonicalPath: "/404.html",
    content: `<section class="not-found"><div class="section-inner"><p class="kicker">404</p><h1>這一頁找不到。</h1><p>網址可能已經變更，請回到首頁或查看專題列表。</p><div class="hero-actions"><a class="button button-primary" href="./">回首頁</a><a class="button button-secondary" href="./projects/">查看專題</a></div></div></section>`,
  }));

  console.log(`Built ${posts.length} post(s), ${projects.length} project(s), and ${pages.length} page(s) into ${distDir}`);
}

build();
