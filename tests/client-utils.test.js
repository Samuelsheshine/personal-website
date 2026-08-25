const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { transform } = require("esbuild");

const rootDir = path.resolve(__dirname, "..");

async function loadBrowserModule(relativePath) {
  const source = fs.readFileSync(path.join(rootDir, relativePath), "utf8");
  const result = await transform(source, {
    format: "cjs",
    loader: "js",
    target: "node22",
  });
  const module = { exports: {} };
  const evaluate = new Function("module", "exports", result.code);
  evaluate(module, module.exports);
  return module.exports;
}

test("slugify creates stable Unicode-friendly slugs", async () => {
  const { slugify } = await loadBrowserModule("src/slug.js");
  assert.equal(slugify("名古屋交換 Day 1"), "名古屋交換-day-1");
  assert.equal(slugify("  Hello / Firebase___Blog  "), "hello-firebase-blog");
  assert.equal(slugify("---"), "");
  assert.ok(slugify("a".repeat(150)).length <= 120);
});

test("Markdown renderer escapes HTML and renders the supported syntax", async () => {
  const { renderMarkdown } = await loadBrowserModule("src/markdown.js");
  const html = renderMarkdown(`# 標題\n\n<script>alert(1)</script>\n\n- one\n- two\n\n[網站](https://example.com)`);
  assert.match(html, /<h2>標題<\/h2>/);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(html, /<ul><li>one<\/li><li>two<\/li><\/ul>/);
  assert.match(html, /target="_blank" rel="noreferrer"/);
});

test("Markdown reading time is never lower than one minute", async () => {
  const { estimateReadingTime } = await loadBrowserModule("src/markdown.js");
  assert.equal(estimateReadingTime(""), 1);
  assert.equal(estimateReadingTime("字".repeat(501)), 2);
});
