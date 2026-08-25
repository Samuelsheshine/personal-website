# Sam Hsiao Personal Website

這是一個可部署到 GitHub Pages 或 Firebase Hosting 的工程作品集，包含 Markdown 貼文、專案 case studies、Now、Academic Journey 與 Resume。網站維持原生 HTML、CSS、JavaScript 與自製靜態建置器，另外使用 Firebase Authentication、Cloud Firestore 與 Firebase Storage 提供登入後的貼文管理功能。

## 誰可以新增貼文

`/admin/` 使用 Google Sign-In。只有 `FIREBASE_ADMIN_UID` 指定的 Firebase Authentication UID 會顯示管理介面，而且 Firestore／Storage Security Rules 會再次驗證同一個 UID；前端隱藏按鈕不是權限邊界。一般訪客只能讀取 `status == "published"` 的 Firestore 貼文。

原有 `content/posts/*.md` 仍會照原流程建置，既有文章不會消失。新管理後台建立的動態文章儲存在 Firestore，封面圖片儲存在 Storage。

## 技術與資料架構

- 原生 HTML／CSS／JavaScript，沒有 React、Vue、Next.js 或 CSS framework。
- `scripts/build-posts.js` 繼續產生三語靜態頁、manifest、sitemap 與 404 頁。
- esbuild 只負責打包 Firebase Web SDK 與管理／公開貼文 JavaScript，不改變既有 UI 架構。
- Firebase Authentication：Google 登入與 Auth User 狀態。
- Cloud Firestore：`posts/{postId}` 儲存貼文；`postSlugs/{slug}` 在 transaction 中保證 slug 唯一。
- Firebase Storage：`posts/{postId}/{uuid}.{ext}` 儲存封面圖片，單檔上限 5 MB。
- GitHub Pages：目前既有部署方式；`404.html` 會處理 `/blog/{slug}/` 動態文章網址。
- Firebase Hosting：可選部署方式，`firebase.json` 已提供乾淨網址 rewrite。

## 修改內容

- `index.html`：改姓名、標語、作品、能力、Email。
- `styles.css`：調整顏色、版面與響應式樣式。
- `assets/hero-workspace.png`：首頁主視覺圖。
- `content/posts/`：新增或修改貼文。
- `content/projects/`：新增或修改專案頁。
- `content/pages/`：修改 Now、Academic Journey 與 Resume 等固定內容頁。
- `content/en/`：英文版的 pages、projects 與 posts。
- `content/ja/`：日文版的 pages、projects 與 posts。
- `scripts/build-posts.js`：把 Markdown 貼文與專案轉成網站頁面。
- `.github/workflows/pages.yml`：推到 GitHub 後自動部署到 GitHub Pages。
- `admin/`：Google 登入、貼文列表、Markdown editor 與圖片上傳 UI。
- `src/`：Firebase 管理端／公開端程式、slug 與安全 Markdown renderer。
- `firestore.rules`：公開文章讀取與管理員寫入規則。
- `storage.rules`：已發布文章圖片讀取與管理員圖片操作規則。
- `firestore.indexes.json`：發布文章列表需要的複合索引。
- `firebase.json`：Rules、indexes、emulators 與 Firebase Hosting 設定。

## Firebase 首次設定

### 1. Firebase Console

1. 建立或選擇 Firebase project，新增一個 Web App。
2. 在 **Authentication > Sign-in method** 啟用 Google provider。
3. 在 **Authentication > Settings > Authorized domains** 加入實際網站網域；本機測試時也加入 `localhost`。
4. 建立預設的 Cloud Firestore database。
5. 啟用 Firebase Storage。

### 2. 本機環境變數

安裝套件並建立本機設定：

```powershell
npm install
Copy-Item .env.example .env.local
```

在 `.env.local` 填入 Firebase Console 顯示的 Web App 設定：

```dotenv
FIREBASE_API_KEY=
FIREBASE_AUTH_DOMAIN=
FIREBASE_PROJECT_ID=
FIREBASE_STORAGE_BUCKET=
FIREBASE_MESSAGING_SENDER_ID=
FIREBASE_APP_ID=
FIREBASE_ADMIN_UID=
```

這些是 Firebase Web App 的公開 client config，不是 service-account secret；仍然不要在前端或 Git 中加入 service-account JSON、private key 或 Admin SDK credential。

### 3. 取得並同步管理員 UID

如果還不知道 UID，可以先在網站使用 Google 登入，再到 Firebase Console 的
**Authentication → Users** 複製該帳號的 User UID。未授權帳號的前端畫面不會顯示 UID。

將 UID 填入 `.env.local`，再執行：

```powershell
npm run firebase:set-admin
npm run build
```

`firebase:set-admin` 會把同一個 UID 同步到 `firestore.rules` 與 `storage.rules` 的 `ADMIN_UID` 標記。UID 本身不是私密憑證，而且 Security Rules 必須包含它才能在 Firebase 端授權；不要只設定瀏覽器環境變數而漏掉 Rules。

### 4. 部署 Rules 與 index

```powershell
npx firebase login
npm run firebase:deploy:rules
```

此 repository 的預設 Firebase 專案已在 `.firebaserc` 設為 `personalweb-8915`。

Cloud Storage for Firebase 需要 Blaze 隨用隨付方案。首次部署 Storage Rules 前，需先在
Firebase Console 升級方案、建立預設 bucket 並選擇儲存位置；未完成前仍可新增不含封面圖片的貼文。

Storage Rules 第一次透過 `firestore.get()` 檢查文章發布狀態時，Firebase 可能要求啟用 Storage Rules 讀取 Firestore 的產品連線權限，依 Console 或 CLI 提示確認即可。

公開文章列表的 query 是：

```txt
posts
  where status == "published"
  orderBy publishedAt desc
```

需要的 composite index 已寫在 `firestore.indexes.json`，隨 `firebase:deploy:rules` 一起部署。

## 使用管理後台新增動態貼文

1. 開啟 `/admin/` 並用指定的 Google 帳號登入。
2. 選擇「新增貼文」，輸入 title、slug、excerpt、Markdown content、tags 與 status。
3. 封面圖片會先上傳到 Storage，儲存貼文後 download URL 與 object path 會寫入 Firestore。
4. 草稿只有管理員能讀取；改為「發布」後才會出現在 `/blog/` 與首頁最新文章。
5. 刪除前會再次確認，確認後會交易式刪除貼文與 slug 保留資料，再清理 Storage 圖片。

## 新增靜態 Markdown 貼文（既有流程）

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

## 三語內容

- 中文使用網站根路徑，例如 `/projects/`。
- 英文使用 `/en/`，例如 `/en/projects/`。
- 日文使用 `/ja/`，例如 `/ja/projects/`。

三種語言使用相同的 `slug`，語言切換才能留在同一頁。例如三個版本的 2-DOF 專題都必須使用 `slug: 2-dof-robot-arm`。新增中文專題後，如果翻譯尚未完成，不要先建立空白語言頁；完成翻譯後再將對應 Markdown 加入 `content/en/projects/` 與 `content/ja/projects/`。

## 興趣頁與收合內容

興趣內容位於三個語系的 `pages/interests.md`。長清單可以使用以下語法產生可收合區塊：

```md
:::details 區塊標題
- 第一個項目
- 第二個項目
:::
```

三語版本請維持相同的 `slug: interests`，語言下拉選單才會切換到對應頁面。

## 發布到 GitHub Pages

1. 在 GitHub 建立一個新的 repository，例如 `personal-website`。
2. 把這個資料夾裡的檔案推到 repository 的 `main` branch。
3. 到 repository 的 `Settings` > `Pages`。
4. 在 `Build and deployment` 的 `Source` 選擇 `GitHub Actions`。
5. 到 repository 的 **Settings > Secrets and variables > Actions > Variables**，建立 `.env.example` 中的七個同名變數。
6. 等待 `Actions` 執行 `npm ci`、lint、tests 與 build；完成後網站會出現在 GitHub Pages 提供的網址。

GitHub Pages 只部署網站檔案，不會自動部署 Firestore／Storage Rules；Rules 仍需先用 `npm run firebase:deploy:rules` 部署到 Firebase project。

## 發布到 Firebase Hosting（可選）

`firebase.json` 已將 `/blog/**` rewrite 到動態文章 renderer。先完成 Firebase CLI project 選擇，再執行：

```powershell
npm run check
npm run firebase:deploy
```

這會部署 `dist/`、Firestore Rules、composite indexes 與 Storage Rules。若仍要沿用現有 GitHub Pages，只需使用上一節，不必改用 Firebase Hosting。

## 本機預覽

安裝套件後啟動本機預覽：

```powershell
npm install
npm run dev
```

然後開啟 `http://localhost:4173`。內建預覽伺服器會處理 `/blog/{slug}/` 的動態 route；若測試 Google Sign-In，請在 Firebase Authorized domains 加入 `localhost`。

完整檢查：

```powershell
npm run check
```

這會依序執行 ESLint、Node tests 與 production build。
