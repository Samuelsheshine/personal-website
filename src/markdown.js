function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function inlineMarkdown(value) {
  let html = escapeHtml(value);

  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  html = html.replace(
    /!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/g,
    '<img src="$2" alt="$1" loading="lazy" />',
  );
  html = html.replace(
    /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
    '<a href="$2" target="_blank" rel="noreferrer">$1</a>',
  );
  html = html.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>');

  return html;
}

export function renderMarkdown(markdown) {
  const lines = String(markdown || "").replace(/\r\n/g, "\n").split("\n");
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
    const details = line.match(/^:::details\s+(.+)$/);
    if (details) {
      flushAll();
      const detailLines = [];
      index += 1;
      while (index < lines.length && lines[index].trim() !== ":::") {
        detailLines.push(lines[index]);
        index += 1;
      }
      html.push(`<details class="prose-details"><summary>${inlineMarkdown(details[1])}</summary><div>${renderMarkdown(detailLines.join("\n"))}</div></details>`);
      continue;
    }

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

    const heading = line.match(/^(#{1,5})\s+(.+)$/);
    if (heading) {
      flushAll();
      const level = Math.min(6, heading[1].length + 1);
      html.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }

    if (/^\s*---+\s*$/.test(line)) {
      flushAll();
      html.push("<hr />");
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

export function estimateReadingTime(markdown) {
  const plainText = String(markdown || "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/[#>*_`[\]()]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return Math.max(1, Math.ceil(plainText.length / 500));
}
