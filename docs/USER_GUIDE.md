# User Guide

## Cable Profile & Point-Load Analysis Tool

**Version:** 1.0.0  
**Author:** Arvind Singh Rawat

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Getting Started](#2-getting-started)
3. [Input Parameters](#3-input-parameters)
4. [Analysis Models](#4-analysis-models)
5. [Adding Point Loads](#5-adding-point-loads)
6. [Understanding Results](#6-understanding-results)
7. [Interactive Diagrams](#7-interactive-diagrams)
8. [Exporting Reports](#8-exporting-reports)
9. [Preset Configurations](#9-preset-configurations)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Introduction

### 1.1 What is this tool?

The Cable Profile & Point-Load Analysis Tool is a web-based engineering application for analyzing cable systems spanning between two towers with backstay anchors.

### 1.2 Cable System Configuration

```
                    Main Valley Cable
    Anchor A ←── Tower A ════════════════ Tower B ──→ Anchor B
         ↘        │                            │        ↙
          backstay│      cable profile         │backstay
                  │    ╭──────────────╮        │
                  └────╯              ╰────────┘
```

### 1.3 Key Capabilities

- ✅ Calculate cable profile under self-weight
- ✅ Analyze effects of point loads
- ✅ Compute tensions and support reactions
- ✅ Interactive visualization
- ✅ PDF report generation

---

## 2. Getting Started

### 2.1 Interface Overview

The application has three main areas:

| Area | Location | Purpose |
|------|----------|---------|
| Input Panel | Left sidebar | Enter parameters |
| Visualization | Main area | View diagrams |
| Results | Main area (tabs) | Review calculations |

### 2.2 Quick Start

1. **Select a preset** (top right) to load example values
2. **Modify parameters** in the left panel
3. **View results** in the tabs
4. **Export PDF** when ready

---

## 3. Input Parameters

### 3.1 Analysis Model

Choose between two models:

| Model | Best For | Assumption |
|-------|----------|------------|
| **Parabolic** | Most engineering cases | Load per horizontal projection |
| **Catenary** | Accurate self-weight | Load per cable length |

> ⚠️ Use catenary model when sag/span ratio > 0.1

### 3.2 Geometry Parameters

#### Tower Configuration

| Parameter | Symbol | Description | Typical Range |
|-----------|--------|-------------|---------------|
| Horizontal span (L) | L | Distance between towers | 50 - 1000 m |
| Left tower elevation (yL) | yL | Height of left pulley | 0 - 200 m |
| Right tower elevation (yR) | yR | Height of right pulley | 0 - 200 m |

#### Backstay Configuration

| Parameter | Symbol | Description | Typical Range |
|-----------|--------|-------------|---------------|
| Left backstay length (La) | La | Left anchor cable | 10 - 100 m |
| Right backstay length (Ra) | Ra | Right anchor cable | 10 - 100 m |
| Left anchor angle (αL) | αL | Angle from vertical | 15° - 45° |
| Right anchor angle (αR) | αR | Angle from vertical | 15° - 45° |

### 3.3 Cable Properties

| Parameter | Symbol | Unit | Description |
|-----------|--------|------|-------------|
| Unit weight w (horiz.) | w | kN/m | Weight per horizontal meter |
| Unit weight γ (length) | γ | kN/m | Weight per cable meter |
| Horizontal tension (H) | H | kN | Applied horizontal force |

#### Converting Cable Weight

If you know cable mass per meter (kg/m):

```
w (kN/m) = mass (kg/m) × 9.81 / 1000
```

**Example:** 5 kg/m cable → w = 5 × 9.81 / 1000 = 0.049 kN/m

---

## 4. Analysis Models

### 4.1 Parabolic Model

**Governing Equation:**
```
y(x) = yL + C₁·x + w·x²/(2H)
```

**When to use:**
- Standard engineering analysis
- Sag/span ratio < 0.1
- Quick calculations

### 4.2 Catenary Model

**Governing Equation:**
```
y(x) = a·cosh((x - x₀)/a) + C
```
where `a = H/γ`

**When to use:**
- Accurate self-weight analysis
- Large sag/span ratios
- Validation studies

---

## 5. Adding Point Loads

### 5.1 Adding a Load

1. Scroll to **Point Loads** section in left panel
2. Click **+ Add Point Load**
3. Enter:
   - **Label**: Identifier (e.g., P1, P2)
   - **x**: Horizontal position from left tower (m)
   - **P**: Load magnitude (kN, downward positive)

### 5.2 Using the Slider

Below the diagram, use the **Point Load Position Control**:
- **Drag** markers to adjust position
- **Type** directly in magnitude fields
- Real-time updates as you adjust

### 5.3 Removing Loads

Click the **✕** button next to any load to remove it.

### 5.4 Multiple Loads

You can add multiple loads. The solver divides the cable into segments and solves for continuity and equilibrium at each load point.

---

## 6. Understanding Results

### 6.1 Status Bar

The top status bar shows key values:
- Analysis status (✓ complete / ✗ errors)
- Model type
- Horizontal tension (H)
- Maximum tension (T_max)
- Maximum sag
- Warning count

### 6.2 Results Summary Tab

| Parameter | Description |
|-----------|-------------|
| Horizontal Tension (H) | Constant throughout cable |
| Cable Angles (θL, θR) | Angles at towers from horizontal |
| Maximum Sag | Vertical drop from chord line |
| Sag/Span Ratio | Sag divided by span (e.g., 1/20) |
| Cable Length | Total arc length |

### 6.3 Maximum Forces Summary

| Parameter | Description |
|-----------|-------------|
| Max Tension | Highest cable tension |
| Location | Where max tension occurs |
| Tower A Forces | H, V, R at left tower |
| Tower B Forces | H, V, R at right tower |

### 6.4 Point-Load Results

For each point load:
- Cable elevation at load (yp)
- Slopes left/right of load
- Angles left/right of load
- Tensions left/right of load
- Equilibrium check

### 6.5 Tower/Pulley Results

For each tower:
- **Main Cable**: angle, tension, H, V
- **Backstay**: angle, tension, H, V
- **Resultant**: magnitude and direction

---

## 7. Interactive Diagrams

### 7.1 Cable Profile Tab

Features:
- **Cable curve** (blue) - main span profile
- **Backstays** (orange dashed) - anchor cables
- **Towers** (gray) - support structures
- **Point loads** (red arrows) - applied loads
- **Sag annotation** (purple) - maximum sag point

**Hover** over the cable to see local values:
- x position
- y elevation
- angle θ
- tension T

### 7.2 Force Diagrams Tab

Shows vector diagrams at each tower:
- Main cable tension vector
- Backstay tension vector
- Resultant force (dashed)

For point loads, shows equilibrium:
- Left cable tension
- Right cable tension
- Applied load

---

## 8. Exporting Reports

### 8.1 Generate PDF

1. Click **📄 Export PDF** button (top right)
2. PDF downloads automatically
3. File name: `cable-analysis-report.pdf`

### 8.2 PDF Contents

1. **Cable Profile Diagram** - Visual with max sag marked
2. **Input Parameters** - All geometry and properties
3. **Point Loads** - Load table (if any)
4. **Results Summary** - Key calculated values
5. **Maximum Forces** - Critical forces summary
6. **Point-Load Results** - Detailed per-load results
7. **Tower Results** - Forces at each tower
8. **Calculation Steps** - Detailed equations
9. **Warnings** - Any analysis warnings

---

## 9. Preset Configurations

Click preset buttons to load example configurations:

| Preset | Description |
|--------|-------------|
| **Symmetric** | Equal tower heights, no loads |
| **Asymmetric** | Different tower heights |
| **1 Load** | Single centered point load |
| **2 Loads** | Two point loads |
| **Catenary** | Catenary model example |

---

## 10. Troubleshooting

### 10.1 Common Issues

#### "Analysis has errors"

**Causes:**
- Point load outside span (x < 0 or x > L)
- Invalid geometry (L ≤ 0)
- Zero or negative tension

**Solution:** Check input values are within valid ranges.

#### Equilibrium check fails

**Cause:** Numerical precision issues with extreme values.

**Solution:** Adjust H or load values. Check for very small or very large ratios.

#### Sag warning appears

**Message:** "Sag/span ratio > 0.1"

**Meaning:** Parabolic approximation may be inaccurate.

**Solution:** Switch to Catenary model for better accuracy.

### 10.2 Tips for Accuracy

1. Use realistic cable weights (0.1 - 5 kN/m typical)
2. Keep sag/span ratio reasonable (1/20 to 1/50)
3. Verify equilibrium checks pass
4. Compare with hand calculations for validation

### 10.3 Browser Issues

If the application doesn't load:
- Clear browser cache
- Try a different browser
- Check JavaScript is enabled
- Ensure minimum screen width (1200px)

---

## Appendix A: Sign Conventions

| Quantity | Positive Direction |
|----------|-------------------|
| x | Rightward (toward Tower B) |
| y | Upward |
| Point load P | Downward |
| Cable angle θ | Counter-clockwise from horizontal |
| Backstay angle α | From vertical |

---

## Appendix B: Equations Reference

### Parabolic Cable
```
y(x) = yL + [(yR-yL)/L - wL/(2H)]·x + w·x²/(2H)

Slope: dy/dx = (yR-yL)/L - wL/(2H) + w·x/H

Tension: T = H / cos(θ) = H·√(1 + (dy/dx)²)
```

### Point Load Equilibrium
```
H·(tan θ_right - tan θ_left) = P
```

### Backstay Forces
```
H_backstay = T_backstay · sin(α)
V_backstay = T_backstay · cos(α)
```

---

## Support

**Author:** Arvind Singh Rawat  
**Email:** arvindrawat400@gmail.com  
**LinkedIn:** linkedin.com/in/arvindrawat400

---

© 2026 Arvind Singh Rawat. All Rights Reserved.
