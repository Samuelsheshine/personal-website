---
title: Singularity Analysis and Avoidance in a 2-DOF Planar Robotic Manipulator
slug: 2-dof-robot-arm
category: Robotics & Control
status: In Development
year: 2026
role: Project owner
stack: MATLAB, Robotics, Jacobian, Pseudoinverse, DLS
order: 1
excerpt: 二自由度平面機械手臂的奇異點分析與迴避：比較 Jacobian pseudoinverse 與 damped least squares 的穩定性和追蹤取捨。
---

## Overview

這個專題研究 2R 平面機械手臂接近奇異姿態時的數值與運動行為。核心工作是建立運動學模型、推導 Jacobian、辨識奇異邊界，並用一致的軌跡與指標比較 Jacobian pseudoinverse 和 damped least squares（DLS）。

目前頁面整理的是方法、驗證架構與理論預期；最終數值、圖表和結論會以實際 MATLAB 模擬結果為準。

## Problem

當機械手臂接近奇異姿態時，Jacobian 會失去秩或變得 ill-conditioned。此時很小的末端速度命令也可能對應到非常大的關節速度，讓反運動學數值不穩定、追蹤誤差增加，甚至產生實際系統無法執行的命令。

## Objectives

- 建立 2R 平面機械手臂的幾何與數學模型
- 推導 forward kinematics 與 Jacobian matrix
- 找出 singular configuration conditions
- 視覺化 reachable workspace 與奇異邊界
- 比較 pseudoinverse 和 damped least squares
- 評估追蹤誤差、關節速度放大與 Jacobian 指標
- 說明穩定性和準確度之間的工程取捨

## Methodology

### 1. Robot Geometry and Forward Kinematics

以兩個旋轉關節和連桿長度 `L1`、`L2` 建立平面模型。末端位置由 `q1`、`q2` 決定，並用一致的座標系與單位產生後續圖表。

### 2. Jacobian and Singular Conditions

從末端位置對關節角微分得到 Jacobian。接著檢查 determinant、rank、condition number 與 manipulability，辨識手臂完全伸直或折疊附近的退化情況。

### 3. Workspace and Test Trajectories

先畫出半徑介於 `|L1 - L2|` 與 `L1 + L2` 的 annular workspace，再設計正常區域與靠近奇異邊界的測試軌跡，確保兩種方法使用相同輸入。

### 4. Inverse Velocity Methods

- **Pseudoinverse:** 作為基準方法，觀察接近奇異點時關節速度是否快速放大
- **Damped least squares:** 加入 damping 抑制不穩定命令，並測試不同 damping 對追蹤誤差的影響

### 5. Evaluation Metrics

- Determinant and rank of the Jacobian
- Condition number
- Manipulability
- Joint velocity magnitude
- End-effector tracking error

## Visual Results Checklist

下列圖表會在模擬資料完成後加入，避免用示意圖冒充結果：

1. 2R manipulator geometry
2. Reachable workspace and singular boundaries
3. Normal versus near-singular configurations
4. Normal and near-boundary test trajectories
5. Joint velocity comparison
6. Tracking error comparison
7. Condition number or manipulability plot

## Comparison to Validate

| Method | Theoretical expectation | Metric to verify | Open question |
|---|---|---|---|
| Pseudoinverse | 遠離奇異點時可提供較直接的速度解 | tracking error, joint velocity norm | 接近邊界時速度放大到什麼程度？ |
| Damped Least Squares | 應降低奇異點附近的速度放大 | peak joint velocity, condition range | damping 應如何選擇？ |
| Larger damping | 預期更穩定但偏差可能增加 | stability versus tracking error | 哪個值能取得可接受的折衷？ |

> 這張表是驗證假設，不是最終實驗結論。完成模擬後會以實際數據替換。

## What I Am Learning

- Jacobian singularity 不只是矩陣問題，也直接限制機械手臂能穩定產生的運動
- 數學上可計算的 inverse，不代表數值或實體系統上適合直接執行
- Damping 不是免費的穩定性，需要用追蹤誤差與速度限制共同選擇
- 同步呈現姿態、軌跡和指標，才能把方程式連回實際運動

## Engineering Log

| Problem to investigate | Likely cause | Planned test | Decision rule |
|---|---|---|---|
| Joint velocity grows rapidly | Jacobian nearly singular | Compare identical trajectories with both methods | Reject commands beyond a defined limit |
| Tracking error rises with damping | Damping is too large | Sweep several damping values | Select a documented stability / accuracy compromise |
| Results are hard to interpret | Metrics lack synchronized context | Align trajectory, posture and metric plots | Keep figures with labels, units and captions |

## Project Resources

MATLAB 程式、報告、投影片與 demo 影片尚未整理成可公開連結，因此目前不顯示資源按鈕。
