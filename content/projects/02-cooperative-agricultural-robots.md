---
title: Cooperative Agricultural Harvesting Robots
slug: cooperative-agricultural-robots
category: Robotics System
status: In Development
year: 2026
role: System designer / developer
stack: ROS, Python, OpenCV, Embedded Systems, Multi-Robot
order: 2
excerpt: 雙機協作農作物採收機器人：規劃感知、導航、採收、運輸、任務分配與機器人間通訊的整合系統。
---

## Project Summary

這個專題探索兩台機器人如何協作採收草莓、番茄等低矮或易受損作物。系統預計以 ROS、Python、嵌入式控制器與 computer vision 串接感知、導航、採收、運輸和任務分配。

目前仍在開發階段；下列分工與元件是 proposed architecture，會隨實驗結果調整。

## Background

- 農業勞動力不足與採收工作的高度重複性
- 易受損作物需要更精細的辨識與操作
- 單一機器人同時負責採收與運輸，可能造成等待與效率瓶頸
- 多機協作可以拆分工作，但會增加通訊、同步與故障處理複雜度

## System Goals

- 建立兩台可辨識身分與狀態的自主移動平台
- 支援 crop detection、導航和局部操作
- 建立合作式 task allocation 與任務狀態追蹤
- 設計 robot-to-robot communication 與失敗重試行為
- 在整合前分別測試感知、移動、操作與通訊模組

## Proposed Robot Roles

### Robot A — Perception and Harvesting

- 作物偵測與位置估計
- 接近目標與局部定位
- 採收或夾取操作
- 回報任務結果與異常

### Robot B — Collection and Transport

- 接收或收集採收物
- 運輸與儲存
- 支援任務排程與狀態同步
- 在 Robot A 忙碌時前往下一個集合點

> 角色分工仍是提案，不代表最終機構或控制架構。

## Candidate Hardware

Raspberry Pi、Arduino 或 ESP32、camera、distance sensor、motor driver、DC motors、servo motors、gripper、battery 與 power regulation。實際 BOM 會在需求與預算確認後更新。

## Software Direction

- Ubuntu and ROS
- Python；必要的底層控制使用 C / C++
- OpenCV for visual detection and image processing
- GitHub for version control and issue tracking
- MATLAB when modeling or simulation is useful

## Proposed ROS Architecture

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

## Communication Contract to Define

| Item | What must be documented |
|---|---|
| Robot identity | Stable robot ID and role |
| Task state | queued, accepted, active, completed, failed |
| Target data | Target ID, position, confidence and timestamp |
| Failure handling | Timeout, retry limit and fallback owner |
| Safety state | Stop, blocked path, low battery and lost communication |

## Development Roadmap

1. Define requirements and success criteria
2. Validate single-robot movement
3. Integrate sensors and motor control
4. Prototype crop detection
5. Build a manipulator or gripper prototype
6. Establish robot-to-robot communication
7. Implement task allocation
8. Integrate perception, motion and task state
9. Test failures and recovery behavior
10. Prepare a reproducible final demonstration

## Development Log

### Current Goal

將系統邊界、兩台機器人的責任與第一階段可驗證功能寫清楚。

### Problems

目前硬體分工、作物目標與通訊格式仍未定案；在這些決策完成前，不把候選元件寫成既定設計。

### Next Step

建立單機移動的最小測試，並定義第一版 topic、message fields 與 task-state transition。
