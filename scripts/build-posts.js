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

function formatDate(date) {
  return new Intl.DateTimeFormat("zh-TW", {
    dateStyle: "medium",
    timeZone: "Asia/Taipei",
  }).format(date);
}

function readPosts() {
  if (!fs.existsSync(postsContentDir)) return [];

  return fs
    .readdirSync(postsContentDir)
    .filter((file) => file.endsWith(".md"))
    .map((file) => {
      const fullPath = path.join(postsContentDir, file);
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
        displayDate: formatDate(date),
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

function readPages() {
  if (!fs.existsSync(pagesContentDir)) return [];

  return fs
    .readdirSync(pagesContentDir)
    .filter((file) => file.endsWith(".md"))
    .map((file) => {
      const source = fs.readFileSync(path.join(pagesContentDir, file), "utf8");
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

function readProjects() {
  if (!fs.existsSync(projectsContentDir)) return [];

  return fs
    .readdirSync(projectsContentDir)
    .filter((file) => file.endsWith(".md"))
    .map((file) => {
      const fullPath = path.join(projectsContentDir, file);
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

function pageShell({ title, description, content, relativeRoot = ".", canonicalPath = "/" }) {
  const canonicalUrl = `${siteUrl}${canonicalPath}`;
  return `<!doctype html>
<html lang="zh-Hant">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />
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
    <a class="skip-link" href="#main">跳到主要內容</a>

    <header class="site-header">
      <nav class="nav" aria-label="主要導覽">
        <a class="brand" href="${relativeRoot}/" aria-label="蕭士翔首頁">
          <span class="brand-mark">SH</span>
          <span>蕭士翔</span>
        </a>

        <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="nav-menu" aria-label="開啟選單">
          <span></span><span></span><span></span>
        </button>

        <div class="nav-menu" id="nav-menu">
          <a href="${relativeRoot}/">首頁</a>
          <a href="${relativeRoot}/#about">關於</a>
          <a href="${relativeRoot}/now/">Now</a>
          <a href="${relativeRoot}/projects/">專題</a>
          <a href="${relativeRoot}/academic-journey/">學習歷程</a>
          <a href="${relativeRoot}/blog/">Writing</a>
          <a href="${relativeRoot}/resume/">履歷</a>
          <a href="${relativeRoot}/#contact">聯絡</a>
        </div>
      </nav>
    </header>

    <main id="main">
      ${content}
    </main>

    <footer class="site-footer">
      <div class="section-inner footer-inner">
        <p>© <span id="year"></span> 蕭士翔</p>
        <a href="${relativeRoot}/">回首頁</a>
      </div>
    </footer>

    <script src="${relativeRoot}/script.js"></script>
  </body>
</html>`;
}

function renderBlogIndex(posts) {
  const list = posts.length
    ? posts
        .map(
          (post) => `<article class="post-card">
            <p class="post-meta">${escapeHtml(post.category)} · ${post.readingTime} min read</p>
            <div>
              <h3>${escapeHtml(post.title)}</h3>
              <p>${escapeHtml(post.excerpt)}</p>
            </div>
            <a href="../posts/${post.slug}/">閱讀文章</a>
          </article>`,
        )
        .join("\n")
    : '<p class="post-loading">目前還沒有貼文。</p>';

  return pageShell({
    title: "貼文 | 蕭士翔",
    description: "蕭士翔的最新貼文與學習紀錄。",
    relativeRoot: "..",
    canonicalPath: "/blog/",
    content: `<section class="blog-hero">
        <div class="section-inner">
          <p class="kicker">Writing</p>
          <h1>貼文</h1>
          <p>我會把作品紀錄、學習筆記與想法整理在這裡。</p>
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

function renderProjectMeta(project) {
  const stack = project.stack.length
    ? `<div class="tag-list" aria-label="使用技術">${project.stack.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>`
    : "";

  return `<div class="card-meta"><span class="status-label ${statusClass(project.status)}">${escapeHtml(project.status)}</span>${stack}</div>`;
}

function renderProjectsIndex(projects) {
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
              ${renderProjectMeta(project)}
            </div>
          </a>`,
        )
        .join("\n")
    : '<p class="post-loading">目前還沒有專案。</p>';

  return pageShell({
    title: "Projects & Directions | 蕭士翔",
    description: "蕭士翔的專題、交換準備與學習系統紀錄。",
    relativeRoot: "..",
    canonicalPath: "/projects/",
    content: `<section class="blog-hero">
        <div class="section-inner">
          <p class="kicker">Projects & Directions</p>
          <h1>專題與方向</h1>
          <p>這裡整理和貼文不同的 project pages：每個專案都有自己的背景、目標、進度、工具與下一步。</p>
        </div>
      </section>

      <section class="section">
        <div class="section-inner project-list">
          ${list}
        </div>
      </section>`,
  });
}

function renderProject(project) {
  const stackText = project.stack.length ? project.stack.join(", ") : "持續整理中";

  return pageShell({
    title: `${project.title} | 蕭士翔`,
    description: project.excerpt,
    relativeRoot: "../..",
    canonicalPath: `/projects/${project.slug}/`,
    content: `<article>
        <header class="article-header">
          <div class="section-inner">
            <p class="post-meta">${escapeHtml(project.category)}</p>
            <span class="status-label ${statusClass(project.status)}">${escapeHtml(project.status)}</span>
            <h1>${escapeHtml(project.title)}</h1>
            <p>${escapeHtml(project.excerpt)}</p>
            <div class="project-facts" aria-label="專案資訊">
              <div class="project-fact">
                <strong>年份</strong>
                <span>${escapeHtml(project.year || "持續更新")}</span>
              </div>
              <div class="project-fact">
                <strong>角色</strong>
                <span>${escapeHtml(project.role || "Owner")}</span>
              </div>
              <div class="project-fact">
                <strong>工具 / 主題</strong>
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

function renderPost(post) {
  return pageShell({
    title: `${post.title} | 蕭士翔`,
    description: post.excerpt,
    relativeRoot: "../..",
    canonicalPath: `/posts/${post.slug}/`,
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

function renderContentPage(page) {
  return pageShell({
    title: `${page.title} | 蕭士翔`,
    description: page.description,
    relativeRoot: "..",
    canonicalPath: `/${page.slug}/`,
    content: `<article>
        <header class="article-header">
          <div class="section-inner">
            <p class="kicker">${escapeHtml(page.kicker)}</p>
            <h1>${escapeHtml(page.title)}</h1>
            <p>${escapeHtml(page.description)}</p>
            ${page.updated ? `<p class="updated-date">Last updated: ${escapeHtml(page.updated)}</p>` : ""}
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

  const sitemapPaths = [
    "/",
    "/blog/",
    "/projects/",
    ...pages.map((page) => `/${page.slug}/`),
    ...posts.map((post) => `/posts/${post.slug}/`),
    ...projects.map((project) => `/projects/${project.slug}/`),
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
