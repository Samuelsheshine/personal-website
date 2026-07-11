---
title: AI 輔助工程知識系統
slug: ai-knowledge-system
category: 學習系統
status: 持續進行
year: 2026
role: 工作流程設計與維護
stack: ChatGPT, Codex, GitHub, Markdown, GitHub Pages
order: 4
excerpt: 設計、驗證並維護一套 AI 輔助工程工作流，將零散資料轉成可追蹤、可版本控制的專題與文章。
---

## 系統概述

這個系統的重點不是「有使用 AI」，而是設計一個可以重複執行、人工檢查並持續改善的流程。ChatGPT 用於釐清與結構化，Codex 協助在既有 repository 中實作，Markdown 與 GitHub 則保存來源、版本和公開成果。

## 工作流程

```
Capture
  -> screenshots, articles, ideas, questions
Clarify
  -> explain, classify, identify missing evidence
Build
  -> update content and code with ChatGPT, Codex and VS Code
Store
  -> Markdown, Git and GitHub version history
Publish
  -> project pages, notes and technical writing
Review
  -> verify facts, links, build output and reflection
```

## 儲存庫結構

```
content/posts/       Markdown 文章
content/projects/    專題案例
content/pages/       固定內容頁
scripts/             靜態網站建置邏輯
assets/              公開圖片與已確認文件
dist/                產生的部署輸出
```

## 內容更新流程

1. 收集原始問題、資料來源或專題變更
2. 請 AI 整理問題並揭露假設
3. 將事實陳述與建議、預留內容分開
4. 以小而可檢查的範圍更新 Markdown 或網站程式
5. 執行建置並檢查產生的頁面
6. 檢查連結、響應式版面與敏感資訊
7. 只提交預定的來源檔，部署內容由系統自動產生

## 查核規則

| 內容類型 | AI 可協助的部分 | 必須人工查核的部分 |
|---|---|---|
| 工程說明 | 結構整理與替代解釋 | 方程式、單位、假設與模擬結果 |
| 交換資訊 | 檢查清單與問題整理 | 官方日期、簽證規定與大學要求 |
| 網站程式 | 實作與重構 | 建置輸出、連結、無障礙與部署行為 |
| 個人資料 | 編輯與翻譯 | 正確性、隱私及內容是否適合公開 |

## AI 的限制

- AI 可能產生流暢但缺乏依據的陳述
- 產生的程式可能單獨可用，卻與現有建置流程衝突
- 摘要可能遺漏日期、單位，或混淆計畫與已完成工作
- 私人檔案不能只因適合作為參考資料就被公開

## 使用前後比較

**使用前：** 筆記、截圖與決策容易散失，更新頁面時也常需要手動重複內容。

**目前流程：** 以結構化 Markdown 作為內容來源，建置程式產生一致頁面，Git 則記錄所有變更。由於尚未量測節省的時間，本頁不宣稱具體效率數字。

## 下一步

新增包含資料來源、最後更新日期、隱私檢查與失效連結驗證的內容清單，再量測這套流程是否真的減少重複工作。
