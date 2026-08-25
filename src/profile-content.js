export function collectProfileFields(root) {
  if (!root) return {};
  return Object.fromEntries([...root.querySelectorAll("[data-profile-field]")].map((element) => [
    element.dataset.profileField,
    element.textContent.trim(),
  ]));
}

export function applyProfileFields(root, fields) {
  if (!root || !fields || typeof fields !== "object") return;
  root.querySelectorAll("[data-profile-field]").forEach((element) => {
    const value = fields[element.dataset.profileField];
    if (typeof value === "string") element.textContent = value;
  });
}

export function validateProfileFields(fields) {
  const entries = Object.entries(fields);
  if (entries.length > 100) throw new Error("個人檔案欄位數量超過限制。");
  if (entries.some(([key, value]) => !/^[a-zA-Z][a-zA-Z0-9]*$/.test(key)
    || typeof value !== "string"
    || value.length > 2000)) {
    throw new Error("個人檔案文字格式不正確或超過長度限制。");
  }
}
