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

function cleanId(value, fallback) {
  const id = String(value || "").trim();
  return /^[a-zA-Z0-9_-]{1,80}$/.test(id) ? id : fallback;
}

export function normalizeProfileLists(value = {}) {
  const details = Array.isArray(value.details) ? value.details : [];
  const interests = Array.isArray(value.interests) ? value.interests : [];
  return {
    details: details.map((item, index) => ({
      id: cleanId(item?.id, `detail-${index + 1}`),
      label: String(item?.label ?? "").trim(),
      value: String(item?.value ?? "").trim(),
    })),
    interests: interests.map((item, index) => ({
      id: cleanId(item?.id, `interest-${index + 1}`),
      title: String(item?.title ?? "").trim(),
      summary: String(item?.summary ?? "").trim(),
      content: String(item?.content ?? "").trim(),
    })),
  };
}

export function validateProfileLists(value) {
  const lists = normalizeProfileLists(value);
  if (lists.details.length > 20) throw new Error("基本資料最多可以有 20 個欄位。");
  if (lists.interests.length > 20) throw new Error("興趣最多可以有 20 個分類。");
  if (lists.details.some((item) => item.label.length > 120 || item.value.length > 1000)) {
    throw new Error("基本資料的標題或內容超過長度限制。");
  }
  if (lists.interests.some((item) => item.title.length > 160
    || item.summary.length > 1000
    || item.content.length > 50000)) {
    throw new Error("興趣內容超過長度限制。");
  }
  const ids = [...lists.details, ...lists.interests].map((item) => item.id);
  if (new Set(ids).size !== ids.length) throw new Error("資料項目 ID 重複，請重新新增該項目。");
  return lists;
}

export function readProfileListDefaults(root) {
  const script = root?.querySelector("[data-profile-list-defaults]");
  if (!script) return { details: [], interests: [] };
  try {
    return validateProfileLists(JSON.parse(script.textContent));
  } catch {
    return { details: [], interests: [] };
  }
}

function appendTextElement(parent, tagName, text, className = "") {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  element.textContent = text;
  parent.append(element);
  return element;
}

export function renderProfileDetails(container, details) {
  if (!container) return;
  const normalized = normalizeProfileLists({ details }).details;
  container.replaceChildren();
  normalized.forEach((item, index) => {
    const row = document.createElement("div");
    row.className = "social-detail-row";
    row.dataset.profileItemId = item.id;
    const icon = appendTextElement(row, "span", ["▣", "✈", "◎", "◆", "●", "＋"][index % 6], "social-detail-icon");
    icon.setAttribute("aria-hidden", "true");
    const copy = document.createElement("div");
    appendTextElement(copy, "small", item.label);
    appendTextElement(copy, "strong", item.value);
    row.append(copy);
    container.append(row);
  });
  if (!normalized.length) appendTextElement(container, "p", "尚未新增基本資料。", "profile-list-empty");
}

export function renderProfileInterestPreview(container, interests) {
  if (!container) return;
  const normalized = normalizeProfileLists({ interests }).interests;
  container.replaceChildren();
  normalized.slice(0, 4).forEach((item) => {
    const card = document.createElement("div");
    card.className = "social-interest-item";
    card.dataset.profileItemId = item.id;
    appendTextElement(card, "strong", item.title);
    appendTextElement(card, "span", item.summary || item.content.slice(0, 120));
    container.append(card);
  });
  if (!normalized.length) appendTextElement(container, "p", "尚未新增興趣。", "profile-list-empty");
}

export function renderInterestDetails(root, interests, markdownRenderer) {
  const list = root?.querySelector("[data-interest-detail-list]");
  const navigation = root?.querySelector("[data-interest-category-nav]");
  if (!list || !navigation) return;
  const normalized = normalizeProfileLists({ interests }).interests;
  list.replaceChildren();
  navigation.replaceChildren();
  normalized.forEach((item, index) => {
    const anchor = `interest-${item.id}`;
    const navLink = document.createElement("a");
    navLink.href = `#${anchor}`;
    navLink.textContent = item.title || `興趣 ${index + 1}`;
    navigation.append(navLink);

    const card = document.createElement("article");
    card.className = "interest-detail-card";
    card.id = anchor;
    card.dataset.profileItemId = item.id;
    const header = document.createElement("header");
    appendTextElement(header, "span", String(index + 1).padStart(2, "0"), "interest-detail-number");
    const copy = document.createElement("div");
    appendTextElement(copy, "h2", item.title);
    if (item.summary) appendTextElement(copy, "p", item.summary);
    header.append(copy);
    card.append(header);
    if (item.content) {
      const details = document.createElement("details");
      details.className = "interest-detail-expand";
      const summary = document.createElement("summary");
      summary.textContent = root.dataset.expandLabel || "展開完整內容";
      const content = document.createElement("div");
      content.className = "prose interest-detail-content";
      content.innerHTML = markdownRenderer(item.content);
      details.append(summary, content);
      card.append(details);
    }
    list.append(card);
  });
  if (!normalized.length) appendTextElement(list, "p", "尚未新增興趣。", "profile-list-empty interest-list-empty");
}
