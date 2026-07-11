---
title: Cooperative Agricultural Harvesting Robots
slug: cooperative-agricultural-robots
category: Robotics System
status: In Development
year: 2026
role: System designer / developer
stack: ROS, Python, OpenCV, Embedded Systems, Multi-Robot
order: 2
excerpt: A two-robot system for perception, navigation, harvesting, transport, task allocation, and inter-robot communication.
---

## Summary

This project explores two robots cooperating to harvest low-growing or fragile crops. ROS, Python, embedded controllers, and computer vision are expected to connect perception, navigation, harvesting, transport, and task allocation.

The following design is a proposed architecture and may change after testing.

## System Goals

- Two identifiable autonomous mobile platforms
- Crop detection and local position estimation
- Cooperative task allocation and status tracking
- Robot-to-robot communication with retries and failure states
- Modular tests before full-system integration

## Proposed Roles

### Robot A — Perception and Harvesting

Crop detection, target approach, local manipulation, and result reporting.

### Robot B — Collection and Transport

Collection, transport, storage, and task-status coordination.

## Proposed ROS Architecture

```
camera_node -> crop_detection_node -> harvest_planner_node
navigation_node -> robot_controller_node
task_allocation_node <-> communication_node <-> status_monitor_node
```

## Communication Contract

| Item | Definition needed |
|---|---|
| Robot identity | Stable robot ID and role |
| Task state | queued, accepted, active, completed, failed |
| Target data | ID, position, confidence, timestamp |
| Recovery | Timeout, retry limit, fallback owner |
| Safety | Stop, blocked path, low battery, lost communication |

## Roadmap

1. Requirements and success criteria
2. Single-robot motion
3. Sensor and motor integration
4. Crop-detection prototype
5. Manipulator or gripper prototype
6. Inter-robot communication
7. Task allocation and integration
8. Failure testing and final demonstration

## Next Step

Build a minimal single-robot motion test and define the first topic, message fields, and task-state transitions.
