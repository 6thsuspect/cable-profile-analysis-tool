# Product Requirements Document (PRD)

## Cable Profile & Point-Load Analysis Tool

> [!IMPORTANT]
> **This document describes version 1.x and has not been updated for the 2.0 physics
> rewrite.** In 2.0 the horizontal tension `H` is solved from axial compatibility against
> the cable's unstressed length rather than accepted as an input, and several requirements below are superseded by the capacity, break-point and launching features.
> See [`PHYSICS.md`](PHYSICS.md) for the authoritative formulation and
> [`CHANGELOG.md`](CHANGELOG.md) for the full list of changes.


**Version:** 1.0.0  
**Author:** Arvind Singh Rawat  
**Last Updated:** January 2026

---

## 1. Product Overview

### 1.1 Vision
Develop a browser-based TypeScript engineering application for analysis of cables spanning between two tower pulleys and anchored into rock behind the towers.

### 1.2 Problem Statement
Structural engineers analyzing cable systems for bridges, ropeways, and transmission lines need to calculate cable profiles, tensions, and support reactions. Existing tools are often expensive, desktop-only, or lack transparency in calculations.

### 1.3 Solution
A free, web-based tool that provides:
- Real-time cable profile analysis
- Interactive visualization
- Transparent calculation steps
- PDF report generation

---

## 2. Cable System Configuration

```
Rock Anchor A → Tower/Pulley A → Main Valley Cable → Tower/Pulley B → Rock Anchor B
```

---

## 3. Objectives

| ID | Objective | Success Metric |
|----|-----------|----------------|
| O1 | Calculate cable profile under self-weight | Matches analytical solutions within 0.1% |
| O2 | Calculate effect of point loads | Equilibrium check passes |
| O3 | Interactive engineering diagrams | Real-time updates < 100ms |
| O4 | Export calculation reports | Complete PDF with all results |
| O5 | Educational transparency | Show all equations and steps |

---

## 4. Features

### 4.1 Core Features (v1.0)

#### F1: Analysis Models
- **Parabolic Model**: Load distributed per unit horizontal projection
- **Catenary Model**: Self-weight distributed per unit cable length

#### F2: Geometry Input
| Parameter | Symbol | Unit | Description |
|-----------|--------|------|-------------|
| Left tower elevation | yL | m | Height of left tower pulley |
| Right tower elevation | yR | m | Height of right tower pulley |
| Horizontal span | L | m | Tower-to-tower distance |
| Left backstay length | La | m | Anchor cable length (left) |
| Right backstay length | Ra | m | Anchor cable length (right) |
| Left anchor angle | αL | deg | Angle from vertical |
| Right anchor angle | αR | deg | Angle from vertical |

#### F3: Cable Properties
| Parameter | Symbol | Unit | Description |
|-----------|--------|------|-------------|
| Unit weight (horizontal) | w | kN/m | Weight per horizontal projection |
| Unit weight (length) | γ | kN/m | Weight per cable length |
| Horizontal tension | H | kN | User-prescribed tension |

#### F4: Point Loads
- Add multiple downward point loads
- Specify position (x) and magnitude (P)
- Interactive slider for position adjustment

#### F5: Calculations
- Cable profile y(x)
- Cable slope and angle at any point
- Tension components (H, V, T)
- Tower pulley reactions
- Backstay forces
- Maximum sag and location
- Cable length

#### F6: Interactive Diagram
- Cable profile visualization
- Towers and backstays
- Point load indicators
- Sag annotation
- Hover tooltips with local values

#### F7: Force Diagrams
- Tower force vectors
- Point load equilibrium diagrams

#### F8: Results Display
- Summary panel
- Maximum forces summary
- Point-load details
- Tower/pulley results
- Calculation steps

#### F9: PDF Export
- Complete calculation report
- Cable profile figure
- All input parameters
- Detailed results
- Equations and steps

### 4.2 Preset Configurations
- Symmetric span
- Asymmetric span
- Single point load
- Multiple point loads
- Catenary model

---

## 5. Out of Scope (v1.0)

| Feature | Reason |
|---------|--------|
| Cable bending stiffness | Complex FEA required |
| Elastic elongation | Nonlinear analysis |
| Pulley friction | Additional complexity |
| Wind/dynamic loading | Time-domain analysis |
| Seismic analysis | Specialized module |
| 3D analysis | Planar model sufficient |

---

## 6. User Stories

### US1: Basic Analysis
> As a structural engineer, I want to input cable geometry and properties so that I can calculate the cable profile and tensions.

**Acceptance Criteria:**
- Can input all geometry parameters
- Can select analysis model
- Results update in real-time
- Profile diagram shows correctly

### US2: Point Load Analysis
> As an engineer, I want to add point loads to the cable so that I can analyze loaded conditions.

**Acceptance Criteria:**
- Can add/remove point loads
- Can adjust position via slider
- Equilibrium check validates results
- Tension discontinuity shown

### US3: Report Generation
> As an engineer, I want to export a PDF report so that I can document my analysis.

**Acceptance Criteria:**
- PDF contains all inputs
- PDF contains cable profile figure
- PDF contains all results
- PDF shows calculation steps

### US4: Educational Use
> As a student, I want to see the governing equations so that I can understand cable mechanics.

**Acceptance Criteria:**
- Equations tab shows formulas
- Calculation steps are detailed
- Model assumptions are stated

---

## 7. Technical Requirements

### 7.1 Performance
- Initial load: < 3 seconds
- Analysis update: < 100ms
- PDF generation: < 2 seconds

### 7.2 Browser Support
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

### 7.3 Responsive Design
- Minimum width: 1200px
- Optimized for desktop use

---

## 8. Success Metrics

| Metric | Target |
|--------|--------|
| Calculation accuracy | Within 0.1% of analytical |
| User task completion | 95% without errors |
| PDF export success | 100% |
| Page load time | < 3 seconds |

---

## 9. Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Numerical instability | Incorrect results | Robust solvers with validation |
| Browser compatibility | Limited users | Progressive enhancement |
| PDF generation fails | No documentation | Fallback to data export |

---

## 10. Future Roadmap

### v1.1
- Save/load analysis configurations
- Unit system selection (SI/Imperial)
- Additional load types

### v1.2
- Elastic cable analysis
- Temperature effects
- Multiple spans

### v2.0
- 3D cable analysis
- Dynamic analysis
- API for integration

---

## 11. Approval

| Role | Name | Date |
|------|------|------|
| Product Owner | Arvind Singh Rawat | January 2026 |
| Technical Lead | Arvind Singh Rawat | January 2026 |

---

© 2026 Arvind Singh Rawat. All Rights Reserved.
