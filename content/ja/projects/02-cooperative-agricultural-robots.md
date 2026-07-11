---
title: 農業収穫ロボットの協調システム
slug: cooperative-agricultural-robots
category: ロボットシステム
status: 開発中
year: 2026
role: システム設計・開発
stack: ROS, Python, OpenCV, Embedded Systems, Multi-Robot
order: 2
excerpt: 2台のロボットで知覚、移動、収穫、運搬、タスク配分、通信を連携させるシステムです。
---

## 概要

低い位置にある作物や傷つきやすい作物を、2台のロボットで協調して収穫する方法を検討します。ROS、Python、組込みコントローラ、コンピュータビジョンを使い、知覚、移動、収穫、運搬、タスク配分を接続します。

以下は提案中の構成であり、テスト結果により変更する可能性があります。

## システム目標

- 識別可能な2台の自律移動プラットフォーム
- 作物検出と局所位置推定
- 協調タスク配分と状態管理
- 再試行・失敗状態を含むロボット間通信
- 全体統合前のモジュール単体テスト

## 提案する役割

### Robot A — 知覚・収穫

作物検出、目標への接近、局所操作、結果報告。

### Robot B — 収集・運搬

収集、運搬、保管、タスク状態の調整。

## ROS構成案

```
camera_node -> crop_detection_node -> harvest_planner_node
navigation_node -> robot_controller_node
task_allocation_node <-> communication_node <-> status_monitor_node
```

## 通信仕様

| 項目 | 定義する内容 |
|---|---|
| ロボット識別 | 安定したIDと役割 |
| タスク状態 | queued, accepted, active, completed, failed |
| 目標データ | ID、位置、信頼度、時刻 |
| 復旧 | timeout、再試行回数、代替担当 |
| 安全 | 停止、経路遮断、低電力、通信喪失 |

## 次のステップ

単機の最小移動テストを作り、最初のtopic、message fields、task-state transitionを定義します。
