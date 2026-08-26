import { normalizeProfileLists, validateProfileLists } from "./profile-content";

const COPY = {
  details: {
    title: "編輯基本資料",
    description: "像 Facebook 的 About 一樣逐項新增資料；空白項目不會顯示在公開頁面。",
    add: "新增基本資料",
    label: "欄位名稱",
    value: "內容",
    labelPlaceholder: "例如：居住地、語言、研究方向",
    valuePlaceholder: "輸入要公開顯示的資料",
  },
  interests: {
    title: "管理興趣",
    description: "首頁顯示前四項摘要；完整內容會出現在「查看完整興趣」頁面。",
    add: "新增興趣分類",
    label: "興趣名稱",
    value: "首頁摘要",
    content: "完整內容（支援 Markdown）",
    labelPlaceholder: "例如：攝影、旅行、棒球",
    valuePlaceholder: "用一兩句話說明這個興趣",
    contentPlaceholder: "詳細記錄、清單或相關連結…",
  },
};

function itemId(kind) {
  const suffix = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${kind === "details" ? "detail" : "interest"}-${suffix}`;
}

function button(label, action, className = "button button-secondary") {
  const element = document.createElement("button");
  element.type = "button";
  element.className = className;
  element.dataset.collectionAction = action;
  element.textContent = label;
  return element;
}

function field(label, value, name, placeholder, multiline = false) {
  const wrapper = document.createElement("label");
  wrapper.className = "profile-collection-field";
  const title = document.createElement("span");
  title.textContent = label;
  const input = document.createElement(multiline ? "textarea" : "input");
  input.name = name;
  input.value = value;
  input.placeholder = placeholder;
  if (multiline) input.rows = name === "content" ? 9 : 3;
  wrapper.append(title, input);
  return wrapper;
}

export function createProfileCollectionDialog(kind, onApply) {
  const copy = COPY[kind];
  if (!copy) throw new Error("Unsupported profile collection");
  let items = [];
  const dialog = document.createElement("dialog");
  dialog.className = "profile-collection-dialog";
  dialog.innerHTML = `<div class="profile-collection-shell">
    <header class="profile-collection-header">
      <div><p>PROFILE EDITOR</p><h2>${copy.title}</h2><span>${copy.description}</span></div>
      <button type="button" class="profile-dialog-close" data-collection-action="cancel" aria-label="關閉">×</button>
    </header>
    <div class="profile-collection-list" data-collection-list></div>
    <footer class="profile-collection-footer">
      <button type="button" class="button button-secondary" data-collection-action="add">＋ ${copy.add}</button>
      <div><button type="button" class="button button-secondary" data-collection-action="cancel">取消</button><button type="button" class="button button-primary" data-collection-action="apply">套用到頁面</button></div>
    </footer>
  </div>`;
  document.body.append(dialog);
  const list = dialog.querySelector("[data-collection-list]");

  function syncFromInputs() {
    items = [...list.querySelectorAll("[data-collection-item]")].map((row) => ({
      id: row.dataset.itemId,
      ...(kind === "details"
        ? { label: row.elements.label.value.trim(), value: row.elements.value.value.trim() }
        : {
            title: row.elements.title.value.trim(),
            summary: row.elements.summary.value.trim(),
            content: row.elements.content.value.trim(),
          }),
    }));
  }

  function render() {
    list.replaceChildren();
    items.forEach((item, index) => {
      const row = document.createElement("form");
      row.className = "profile-collection-item";
      row.dataset.collectionItem = "";
      row.dataset.itemId = item.id;
      const itemHeader = document.createElement("header");
      const number = document.createElement("strong");
      number.textContent = `${kind === "details" ? "資料" : "興趣"} ${index + 1}`;
      const actions = document.createElement("div");
      actions.append(
        button("上移", "up", "profile-item-action"),
        button("下移", "down", "profile-item-action"),
        button("移除", "remove", "profile-item-action profile-item-remove"),
      );
      itemHeader.append(number, actions);
      row.append(itemHeader);
      if (kind === "details") {
        row.append(
          field(copy.label, item.label, "label", copy.labelPlaceholder),
          field(copy.value, item.value, "value", copy.valuePlaceholder, true),
        );
      } else {
        row.append(
          field(copy.label, item.title, "title", copy.labelPlaceholder),
          field(copy.value, item.summary, "summary", copy.valuePlaceholder, true),
          field(copy.content, item.content, "content", copy.contentPlaceholder, true),
        );
      }
      list.append(row);
    });
    if (!items.length) {
      const empty = document.createElement("p");
      empty.className = "profile-collection-empty";
      empty.textContent = `目前沒有項目，按「${copy.add}」開始建立。`;
      list.append(empty);
    }
  }

  dialog.addEventListener("click", (event) => {
    const actionButton = event.target.closest("[data-collection-action]");
    if (!actionButton) return;
    const action = actionButton.dataset.collectionAction;
    if (action === "cancel") {
      dialog.close();
      return;
    }
    if (action === "add") {
      syncFromInputs();
      items.push(kind === "details"
        ? { id: itemId(kind), label: "", value: "" }
        : { id: itemId(kind), title: "", summary: "", content: "" });
      render();
      list.querySelector("[data-collection-item]:last-of-type input")?.focus();
      return;
    }
    if (action === "apply") {
      syncFromInputs();
      try {
        const normalized = validateProfileLists({ [kind]: items })[kind]
          .filter((item) => kind === "details" ? item.label || item.value : item.title || item.summary || item.content);
        onApply(normalized);
        dialog.close();
      } catch (error) {
        window.alert(error.message || "資料格式不正確。");
      }
      return;
    }
    const row = actionButton.closest("[data-collection-item]");
    if (!row) return;
    syncFromInputs();
    const index = items.findIndex((item) => item.id === row.dataset.itemId);
    if (index < 0) return;
    if (action === "remove") items.splice(index, 1);
    if (action === "up" && index > 0) [items[index - 1], items[index]] = [items[index], items[index - 1]];
    if (action === "down" && index < items.length - 1) [items[index + 1], items[index]] = [items[index], items[index + 1]];
    render();
  });

  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });

  return {
    open(nextItems, focusId = "") {
      items = structuredClone(normalizeProfileLists({ [kind]: nextItems })[kind]);
      render();
      dialog.showModal();
      if (focusId) {
        const target = [...list.querySelectorAll("[data-collection-item]")]
          .find((row) => row.dataset.itemId === focusId);
        target?.scrollIntoView({ block: "center" });
        target?.querySelector("input")?.focus();
      }
    },
  };
}
