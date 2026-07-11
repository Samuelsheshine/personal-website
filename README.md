# Sam Hsiao Personal Website

這是一個可直接部署到 GitHub Pages 的靜態工程作品集，包含 Markdown 貼文、專案 case studies、Now、Academic Journey 與 Resume。內容使用 HTML、CSS 與 JavaScript，不需要後端服務。

## 誰可以新增貼文

貼文來源是 repository 裡的 `content/posts/*.md`。只有擁有這個 repository 寫入權限的人可以新增、修改或刪除貼文；一般訪客只能閱讀網站上已發布的內容。

## 修改內容

- `index.html`：改姓名、標語、作品、能力、Email。
- `styles.css`：調整顏色、版面與響應式樣式。
- `assets/hero-workspace.png`：首頁主視覺圖。
- `content/posts/`：新增或修改貼文。
- `content/projects/`：新增或修改專案頁。
- `content/pages/`：修改 Now、Academic Journey 與 Resume 等固定內容頁。
- `scripts/build-posts.js`：把 Markdown 貼文與專案轉成網站頁面。
- `.github/workflows/pages.yml`：推到 GitHub 後自動部署到 GitHub Pages。

## 新增貼文

1. 到 GitHub repository 的 `content/posts` 資料夾。
2. 點 `Add file` > `Create new file`。
3. 檔名使用 `YYYY-MM-DD-post-slug.md`，例如 `2026-07-10-my-first-post.md`。
4. 貼上以下格式並修改內容：

```md
---
title: 我的第一篇貼文
date: 2026-07-10
excerpt: 這是一段會出現在貼文列表的摘要。
slug: my-first-post
---

這裡開始寫文章內容。
```

5. 按 `Commit changes`。GitHub Actions 會自動重新部署網站。

## 新增 Project

1. 到 GitHub repository 的 `content/projects` 資料夾。
2. 點 `Add file` > `Create new file`。
3. 檔名可以使用 `04-project-slug.md`，例如 `04-my-new-project.md`。
4. 貼上以下格式並修改內容：

```md
---
title: 我的新專案
slug: my-new-project
category: Robotics
status: In Development
year: 2026
role: Project owner
stack: Tool A, Tool B, Topic C
order: 4
excerpt: 這是一段會出現在專案卡片上的摘要。
---

## 專案背景

這裡開始寫專案內容。

## 目前進度

- 已完成的事情
- 正在處理的事情

## 下一步

下一個要驗證或補上的內容。
```

5. 按 `Commit changes`。首頁專案卡、`/projects/` 專案列表和專案內頁會在 GitHub Actions 部署後更新。

`status` 建議統一使用：`Planning`、`In Development`、`Testing`、`Completed`、`Ongoing` 或 `Archived`。尚未公開的程式碼、報告、影片或履歷 PDF 不要先放空連結。

## 固定內容頁

`content/pages/*.md` 會自動產生同名路徑，例如 `content/pages/now.md` 會建立 `/now/`。Front matter 格式如下：

```md
---
title: Page title
slug: page-slug
kicker: Section label
updated: 2026-07-11
description: 這個頁面的搜尋摘要。
---

## 第一個段落

頁面內容。
```

建置時也會自動產生 `sitemap.xml`、`robots.txt`、`404.html`、貼文與專案 JSON manifest。

## 發布到 GitHub Pages

1. 在 GitHub 建立一個新的 repository，例如 `personal-website`。
2. 把這個資料夾裡的檔案推到 repository 的 `main` branch。
3. 到 repository 的 `Settings` > `Pages`。
4. 在 `Build and deployment` 的 `Source` 選擇 `GitHub Actions`。
5. 等待 `Actions` 跑完後，網站會出現在 GitHub Pages 提供的網址。

## 本機預覽

先產生貼文與專案頁：

```bash
node scripts/build-posts.js
```

再用任一個靜態伺服器預覽：

```bash
cd dist
python -m http.server 4173
```

然後開啟 `http://localhost:4173`。
