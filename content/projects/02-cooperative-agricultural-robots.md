---
title: 農業採收雙機協作系統
slug: cooperative-agricultural-robots
category: 機器人系統
status: 開發中
year: 2026
role: 系統設計與開發
stack: ROS, Python, OpenCV, 嵌入式系統, 多機器人
order: 2
excerpt: 雙機協作農作物採收機器人：規劃感知、導航、採收、運輸、任務分配與機器人間通訊的整合系統。
---

## 專題摘要

這個專題探索兩台機器人如何協作採收草莓、番茄等低矮或易受損作物。系統預計以 ROS、Python、嵌入式控制器與 computer vision 串接感知、導航、採收、運輸和任務分配。

目前仍在開發階段；下列分工與元件是 proposed architecture，會隨實驗結果調整。

## 背景

- 農業勞動力不足與採收工作的高度重複性
- 易受損作物需要更精細的辨識與操作
- 單一機器人同時負責採收與運輸，可能造成等待與效率瓶頸
- 多機協作可以拆分工作，但會增加通訊、同步與故障處理複雜度

## 系統目標

- 建立兩台可辨識身分與狀態的自主移動平台
- 支援 crop detection、導航和局部操作
- 建立合作式 task allocation 與任務狀態追蹤
- 設計 robot-to-robot communication 與失敗重試行為
- 在整合前分別測試感知、移動、操作與通訊模組

## 機器人角色提案

### 機器人 A：感知與採收

- 作物偵測與位置估計
- 接近目標與局部定位
- 採收或夾取操作
- 回報任務結果與異常

### 機器人 B：收集與運輸

- 接收或收集採收物
- 運輸與儲存
- 支援任務排程與狀態同步
- 在 Robot A 忙碌時前往下一個集合點

> 角色分工仍是提案，不代表最終機構或控制架構。

## 候選硬體

Raspberry Pi、Arduino 或 ESP32、camera、distance sensor、motor driver、DC motors、servo motors、gripper、battery 與 power regulation。實際 BOM 會在需求與預算確認後更新。

## 軟體方向

- Ubuntu and ROS
- Python；必要的底層控制使用 C / C++
- OpenCV for visual detection and image processing
- GitHub for version control and issue tracking
- MATLAB when modeling or simulation is useful

## ROS 架構提案

```
camera_node
    -> crop_detection_node
    -> harvest_planner_node

navigation_node
    -> robot_controller_node

task_allocation_node
    <-> communication_node
    <-> status_monitor_node
```

## 待定義的通訊規格

| 項目 | 必須記錄的內容 |
|---|---|
| 機器人身分 | 固定的機器人編號與角色 |
| 任務狀態 | 排隊、接受、執行、完成、失敗 |
| 目標資料 | 目標編號、位置、可信度與時間戳記 |
| 失敗處理 | 逾時、重試次數與替代負責者 |
| 安全狀態 | 停止、路徑阻塞、低電量與通訊中斷 |

## 開發路線

1. 定義需求與成功標準
2. 驗證單機移動
3. 整合感測器與馬達控制
4. 建立作物偵測原型
5. 建立機械手臂或夾爪原型
6. 建立機器人間通訊
7. 實作任務分配
8. 整合感知、移動與任務狀態
9. 測試失敗與復原行為
10. 準備可重現的最終展示

## 開發紀錄

### 目前目標

將系統邊界、兩台機器人的責任與第一階段可驗證功能寫清楚。

### 問題

目前硬體分工、作物目標與通訊格式仍未定案；在這些決策完成前，不把候選元件寫成既定設計。

### 下一步

建立單機移動的最小測試，並定義第一版 topic、message fields 與 task-state transition。
