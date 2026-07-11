---
title: Singularity Analysis and Avoidance in a 2-DOF Planar Robotic Manipulator
slug: 2-dof-robot-arm
category: Robotics & Control
status: In Development
year: 2026
role: Project owner
stack: MATLAB, Robotics, Jacobian, Pseudoinverse, DLS
order: 1
excerpt: Comparing Jacobian pseudoinverse and damped least squares near singular configurations of a 2R planar manipulator.
---

## Overview

This project studies the numerical and physical behavior of a 2R planar manipulator near singular configurations. It builds a kinematic model, derives the Jacobian, identifies singular boundaries, and compares pseudoinverse inverse velocity kinematics with damped least squares (DLS).

The current page documents the method and validation plan. Final numbers, figures, and conclusions will be based on reproducible MATLAB simulation results.

## Problem

Near a singularity, the Jacobian loses rank or becomes ill-conditioned. A small end-effector command may require very large joint velocities, making numerical inverse kinematics unstable and difficult to execute on a physical system.

## Objectives

- Derive forward kinematics and the Jacobian
- Identify singular configurations and workspace boundaries
- Compare pseudoinverse and DLS under identical trajectories
- Measure condition number, manipulability, joint velocity, and tracking error
- Explain the stability–accuracy trade-off

## Methodology

1. Define the two-link geometry and coordinate frames
2. Derive forward kinematics and the Jacobian
3. Plot the annular workspace and singular boundaries
4. Create normal and near-singular test trajectories
5. Run pseudoinverse and DLS with identical inputs
6. Compare synchronized motion and metric plots

## Validation Table

| Method | Expected behavior | Metric to verify | Open question |
|---|---|---|---|
| Pseudoinverse | Direct solution away from singularities | Tracking error and joint-velocity norm | How rapidly does velocity grow near the boundary? |
| DLS | Reduced velocity amplification | Peak velocity and tracking error | Which damping value gives an acceptable compromise? |

> These are hypotheses to test, not final experimental conclusions.

## What I Am Learning

- Singularity is both a matrix property and a physical motion limitation
- A mathematically computable inverse may still be numerically unsafe
- Damping improves robustness but introduces an accuracy trade-off
- Motion, posture, and metrics must be shown together for interpretable results

## Resources

Code, reports, slides, and videos will only be linked after public files are available and verified.
