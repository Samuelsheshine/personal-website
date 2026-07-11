---
title: AI-Assisted Engineering Knowledge System
slug: ai-knowledge-system
category: Learning System
status: Ongoing
year: 2026
role: Workflow designer / maintainer
stack: ChatGPT, Codex, GitHub, Markdown, GitHub Pages
order: 4
excerpt: 設計、驗證並維護一套 AI 輔助工程工作流，將零散資料轉成可追蹤、可版本控制的專題與文章。
---

## Overview

這個系統的重點不是「有使用 AI」，而是設計一個可以重複執行、人工檢查並持續改善的流程。ChatGPT 用於釐清與結構化，Codex 協助在既有 repository 中實作，Markdown 與 GitHub 則保存來源、版本和公開成果。

## Workflow

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

## Repository Structure

```
content/posts/       writing in Markdown
content/projects/    project case studies
content/pages/       Now, Resume and Academic Journey
scripts/             static-site build logic
assets/              public images and verified documents
dist/                generated deployment output
```

## Content Update Process

1. Capture the original question, source or project change
2. Ask AI to organize the problem and expose assumptions
3. Keep factual claims separate from suggestions and placeholders
4. Update Markdown or site code in a small, reviewable scope
5. Run the build and inspect generated pages
6. Check links, responsive layout and sensitive information
7. Commit only the intended source files; deployment is generated automatically

## Verification Rules

| Content type | AI can help with | Manual verification required |
|---|---|---|
| Engineering explanation | Structure and alternative explanations | Equations, units, assumptions and simulation results |
| Exchange information | Checklist and question generation | Official dates, visa rules and university requirements |
| Website code | Implementation and refactoring | Build output, links, accessibility and deployment behavior |
| Personal profile | Editing and translation | Accuracy, privacy and whether the claim is appropriate to publish |

## AI Limitations

- AI can produce fluent but unsupported claims
- Generated code may work in isolation but conflict with the existing build flow
- Summaries can lose dates, units or the distinction between plans and completed work
- Private files should not become public merely because they are useful source material

## Before and After

**Before:** Notes, screenshots and decisions were easy to lose; updating one page often meant manually repeating content.

**Current workflow:** Structured Markdown is the source of truth, the build script creates consistent pages, and Git records what changed. Time savings have not yet been measured, so this page does not claim a numerical improvement.

## Next Step

Add a lightweight content checklist for sources, last-updated dates, privacy review and broken-link validation, then measure whether the workflow actually reduces repeated work.
