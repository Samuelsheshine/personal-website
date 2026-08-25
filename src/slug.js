export function slugify(value) {
  return String(value || "")
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase("zh-Hant")
    .replace(/[\s_/\\]+/gu, "-")
    .replace(/[^\p{Letter}\p{Number}-]+/gu, "")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120)
    .replace(/-+$/g, "");
}
