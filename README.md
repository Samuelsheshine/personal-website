# Sam Hsiao Personal Website

這是一個可直接部署到 GitHub Pages 的靜態個人網站，包含可新增文章的部落格。內容使用 HTML、CSS 與 JavaScript，不需要後端服務。

## 誰可以新增貼文

貼文來源是 repository 裡的 `content/posts/*.md`。只有擁有這個 repository 寫入權限的人可以新增、修改或刪除貼文；一般訪客只能閱讀網站上已發布的內容。

## 修改內容

- `index.html`：改姓名、標語、作品、能力、Email。
- `styles.css`：調整顏色、版面與響應式樣式。
- `assets/hero-workspace.png`：首頁主視覺圖。
- `content/posts/`：新增或修改貼文。
- `scripts/build-posts.js`：把 Markdown 貼文轉成網站頁面。
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

## 發布到 GitHub Pages

1. 在 GitHub 建立一個新的 repository，例如 `personal-website`。
2. 把這個資料夾裡的檔案推到 repository 的 `main` branch。
3. 到 repository 的 `Settings` > `Pages`。
4. 在 `Build and deployment` 的 `Source` 選擇 `GitHub Actions`。
5. 等待 `Actions` 跑完後，網站會出現在 GitHub Pages 提供的網址。

## 本機預覽

先產生貼文頁：

```bash
node scripts/build-posts.js
```

再用任一個靜態伺服器預覽：

```bash
cd dist
python -m http.server 4173
```

然後開啟 `http://localhost:4173`。
