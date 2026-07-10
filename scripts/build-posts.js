const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const rootDir = path.resolve(__dirname, "..");
const contentDir = path.join(rootDir, "content", "posts");
const distDir = path.join(rootDir, "dist");
const postsOutputDir = path.join(distDir, "posts");
const blogOutputDir = path.join(distDir, "blog");
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

  function flushBlockquote() {
    if (!blockquote.length) return;
    html.push(`<blockquote><p>${inlineMarkdown(blockquote.join(" "))}</p></blockquote>`);
    blockquote = [];
  }

  lines.forEach((line) => {
    if (line.trim().startsWith("```")) {
      if (inCode) {
        html.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
        codeLines = [];
        inCode = false;
      } else {
        flushParagraph();
        flushList();
        flushBlockquote();
        inCode = true;
      }
      return;
    }

    if (inCode) {
      codeLines.push(line);
      return;
    }

    if (!line.trim()) {
      flushParagraph();
      flushList();
      flushBlockquote();
      return;
    }

    const heading = line.match(/^(#{2,3})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      flushList();
      flushBlockquote();
      const level = heading[1].length;
      html.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
      return;
    }

    const bullet = line.match(/^\s*[-*]\s+(.+)$/);
    if (bullet) {
      flushParagraph();
      flushBlockquote();
      list.push(bullet[1]);
      return;
    }

    const quote = line.match(/^>\s+(.+)$/);
    if (quote) {
      flushParagraph();
      flushList();
      blockquote.push(quote[1]);
      return;
    }

    paragraph.push(line.trim());
  });

  flushParagraph();
  flushList();
  flushBlockquote();

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

      return {
        title,
        date,
        dateText,
        displayDate: formatDate(date),
        slug,
        excerpt,
        body,
        isDraft,
        sourceFile: file,
        url: `./posts/${slug}/`,
      };
    })
    .filter((post) => !post.isDraft)
    .sort((a, b) => b.date - a.date);
}

function pageShell({ title, description, content, relativeRoot = "." }) {
  return `<!doctype html>
<html lang="zh-Hant">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <link rel="icon" href="${relativeRoot}/favicon.svg" type="image/svg+xml" />
    <link rel="stylesheet" href="${relativeRoot}/styles.css" />
  </head>
  <body>
    <a class="skip-link" href="#main">跳到主要內容</a>

    <header class="site-header">
      <nav class="nav" aria-label="主要導覽">
        <a class="brand" href="${relativeRoot}/" aria-label="Sam Hsiao 首頁">
          <span class="brand-mark">SH</span>
          <span>Sam Hsiao</span>
        </a>

        <div class="nav-menu" id="nav-menu">
          <a href="${relativeRoot}/#about">關於</a>
          <a href="${relativeRoot}/#work">作品</a>
          <a href="${relativeRoot}/#skills">能力</a>
          <a href="${relativeRoot}/blog/">貼文</a>
          <a href="${relativeRoot}/#contact">聯絡</a>
        </div>
      </nav>
    </header>

    <main id="main">
      ${content}
    </main>

    <footer class="site-footer">
      <div class="section-inner footer-inner">
        <p>© <span id="year"></span> Sam Hsiao</p>
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
            <time datetime="${escapeHtml(post.dateText)}">${escapeHtml(post.displayDate)}</time>
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
    title: "貼文 | Sam Hsiao",
    description: "Sam Hsiao 的最新貼文與專案紀錄。",
    relativeRoot: "..",
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

function renderPost(post) {
  return pageShell({
    title: `${post.title} | Sam Hsiao`,
    description: post.excerpt,
    relativeRoot: "../..",
    content: `<article>
        <header class="article-header">
          <div class="section-inner">
            <p class="post-meta">${escapeHtml(post.displayDate)}</p>
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

function build() {
  emptyDir(distDir);
  staticEntries.forEach(copyEntry);
  ensureDir(postsOutputDir);
  ensureDir(blogOutputDir);

  const posts = readPosts();

  fs.writeFileSync(path.join(blogOutputDir, "index.html"), renderBlogIndex(posts));

  posts.forEach((post) => {
    const postDir = path.join(postsOutputDir, post.slug);
    ensureDir(postDir);
    fs.writeFileSync(path.join(postDir, "index.html"), renderPost(post));
  });

  const manifest = posts.map((post) => ({
    title: post.title,
    date: post.dateText,
    displayDate: post.displayDate,
    excerpt: post.excerpt,
    slug: post.slug,
    url: `./posts/${post.slug}/`,
  }));

  fs.writeFileSync(path.join(distDir, "posts.json"), JSON.stringify(manifest, null, 2));
  console.log(`Built ${posts.length} post(s) into ${distDir}`);
}

build();
