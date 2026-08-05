# API Reference

## Cable Profile & Point-Load Analysis Tool

> [!IMPORTANT]
> **This document describes version 1.x and has not been updated for the 2.0 physics
> rewrite.** In 2.0 the horizontal tension `H` is solved from axial compatibility against
> the cable's unstressed length rather than accepted as an input, and the `CableInput` / `AnalysisResult` shapes below are out of date.
> See [`PHYSICS.md`](PHYSICS.md) for the authoritative formulation and
> [`CHANGELOG.md`](CHANGELOG.md) for the full list of changes.


**Version:** 1.0.0  
**Author:** Arvind Singh Rawat

---

## Table of Contents

1. [Types](#1-types)
2. [Solver Functions](#2-solver-functions)
3. [Components](#3-components)
4. [Utilities](#4-utilities)

---

## 1. Types

### 1.1 AnalysisModel

```typescript
type AnalysisModel = 'PARABOLIC_HORIZONTAL_LOAD' | 'CATENARY_SELF_WEIGHT';
```

**Values:**
| Value | Description |
|-------|-------------|
| `PARABOLIC_HORIZONTAL_LOAD` | Uniform load per horizontal projection |
| `CATENARY_SELF_WEIGHT` | Self-weight per cable length |

---

### 1.2 PointLoad

```typescript
interface PointLoad {
  id: string;       // Unique identifier
  x: number;        // Horizontal position from left tower (m)
  P: number;        // Load magnitude (kN), positive downward
  label: string;    // Display label
}
```

**Example:**
```typescript
const load: PointLoad = {
  id: 'PL1',
  x: 100,
  P: 20,
  label: 'P1'
};
```

---

### 1.3 GeometryInput

```typescript
interface GeometryInput {
  yL: number;       // Left tower elevation (m)
  yR: number;       // Right tower elevation (m)
  L: number;        // Tower-to-tower horizontal span (m)
  La: number;       // Left backstay length (m)
  Ra: number;       // Right backstay length (m)
  alphaL: number;   // Left anchor angle with vertical (deg)
  alphaR: number;   // Right anchor angle with vertical (deg)
}
```

**Constraints:**
| Parameter | Constraint |
|-----------|------------|
| L | > 0 |
| La, Ra | > 0 |
| alphaL, alphaR | 0° < α < 90° |

---

### 1.4 CableProperties

```typescript
interface CableProperties {
  w: number;        // Unit weight per horizontal projection (kN/m)
  gamma: number;    // Unit weight per actual cable length (kN/m)
}
```

**Notes:**
- Use `w` for parabolic model
- Use `gamma` for catenary model
- Typically γ ≈ w for small sag ratios

---

### 1.5 AnalysisOptions

```typescript
interface AnalysisOptions {
  model: AnalysisModel;
  diagramSamples: number;  // Number of profile points (default: 200)
  tolerance: number;       // Solver tolerance (default: 1e-10)
  maxIterations: number;   // Max solver iterations (default: 200)
}
```

---

### 1.6 CableInput

```typescript
interface CableInput {
  geometry: GeometryInput;
  cable: CableProperties;
  pointLoads: PointLoad[];
  options: AnalysisOptions;
  H_input: number;  // User-prescribed horizontal tension (kN)
}
```

**Complete Example:**
```typescript
const input: CableInput = {
  geometry: {
    yL: 50,
    yR: 45,
    L: 200,
    La: 30,
    Ra: 30,
    alphaL: 30,
    alphaR: 30,
  },
  cable: {
    w: 0.5,
    gamma: 0.52,
  },
  pointLoads: [
    { id: 'P1', x: 100, P: 20, label: 'P1' }
  ],
  options: {
    model: 'PARABOLIC_HORIZONTAL_LOAD',
    diagramSamples: 200,
    tolerance: 1e-10,
    maxIterations: 200,
  },
  H_input: 500,
};
```

---

### 1.7 ProfilePoint

```typescript
interface ProfilePoint {
  x: number;        // Horizontal coordinate (m)
  y: number;        // Elevation (m)
  slope: number;    // dy/dx
  theta: number;    // Angle (radians)
  T: number;        // Tension (kN)
  V: number;        // Vertical force component (kN)
}
```

---

### 1.8 PointLoadResult

```typescript
interface PointLoadResult {
  load: PointLoad;
  yp: number;                  // Cable elevation at load point (m)
  slopeLeft: number;           // Slope immediately left of load
  slopeRight: number;          // Slope immediately right of load
  thetaLeft: number;           // Angle left (radians)
  thetaRight: number;          // Angle right (radians)
  T_left: number;              // Tension left (kN)
  T_right: number;             // Tension right (kN)
  slopeDiscontinuity: number;  // mR - mL
  equilibriumCheck: number;    // H*(mR-mL) should equal P
}
```

---

### 1.9 TowerResult

```typescript
interface TowerResult {
  side: 'left' | 'right';
  
  // Main cable at tower
  thetaMain: number;       // Angle (radians)
  slopeMain: number;       // Slope
  T_main: number;          // Tension (kN)
  H_main: number;          // Horizontal component (kN)
  V_main: number;          // Vertical component (kN)
  
  // Backstay
  thetaBackstay: number;   // Angle (radians)
  T_backstay: number;      // Tension (kN)
  H_backstay: number;      // Horizontal component (kN)
  V_backstay: number;      // Vertical component (kN)
  
  // Resultant force on tower/pulley
  Rx: number;              // Horizontal resultant (kN)
  Ry: number;              // Vertical resultant (kN)
  R: number;               // Resultant magnitude (kN)
  thetaR: number;          // Resultant direction (radians)
  
  // Anchor position
  anchorX: number;         // Anchor x-coordinate (m)
  anchorY: number;         // Anchor y-coordinate (m)
}
```

---

### 1.10 AnalysisResult

```typescript
interface AnalysisResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  calculationSteps: string[];

  H: number;                         // Horizontal tension (kN)
  model: AnalysisModel;

  profile: ProfilePoint[];

  slopeLeft: number;
  slopeRight: number;
  thetaLeft: number;                 // radians
  thetaRight: number;                // radians

  pointLoadResults: PointLoadResult[];

  leftTower: TowerResult;
  rightTower: TowerResult;

  maxSag: number;                    // Maximum sag (m)
  sagRatio: number;                  // sag / L

  cableLength: number;               // Total cable length (m)

  maxForces: {
    maxTension: number;              // Max cable tension (kN)
    maxTensionLocation: number;      // x-coordinate (m)
    maxTensionDescription: string;
    towerA_H: number;                // Tower A horizontal (kN)
    towerA_V: number;                // Tower A vertical (kN)
    towerA_R: number;                // Tower A resultant (kN)
    towerB_H: number;                // Tower B horizontal (kN)
    towerB_V: number;                // Tower B vertical (kN)
    towerB_R: number;                // Tower B resultant (kN)
  };
}
```

---

## 2. Solver Functions

### 2.1 solveCable

```typescript
function solveCable(input: CableInput): AnalysisResult
```

**Description:**  
Main entry point for cable analysis. Dispatches to parabolic or catenary solver based on model selection.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| input | CableInput | Complete input parameters |

**Returns:**  
`AnalysisResult` containing all computed values.

**Example:**
```typescript
import { solveCable } from './solver/CableSolver';

const result = solveCable(input);
if (result.valid) {
  console.log('Horizontal tension:', result.H, 'kN');
  console.log('Max sag:', result.maxSag, 'm');
}
```

**Throws:**  
May throw on numerical errors (e.g., solver non-convergence).

---

### 2.2 Internal: solveParabolicWithLoads

```typescript
function solveParabolicWithLoads(input: CableInput): AnalysisResult
```

**Description:**  
Solves cable with parabolic model, supporting multiple point loads.

**Algorithm:**
1. Sort point loads by x-coordinate
2. Divide cable into n+1 segments
3. Solve tridiagonal system for internal elevations
4. Build profile for each segment
5. Validate equilibrium at load points

---

### 2.3 Internal: solveCatenary

```typescript
function solveCatenary(input: CableInput): AnalysisResult
```

**Description:**  
Solves cable with catenary model (no point loads in v1).

**Algorithm:**
1. Calculate catenary parameter a = H/γ
2. Find x₀ using Brent's method
3. Build hyperbolic cosine profile

---

### 2.4 Internal: brentSolve

```typescript
function brentSolve(
  f: (x: number) => number,
  a: number,
  b: number,
  tol: number,
  maxIter: number
): number
```

**Description:**  
Brent's method for finding roots of nonlinear equations.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| f | function | Function to find root of |
| a | number | Left bracket |
| b | number | Right bracket |
| tol | number | Tolerance |
| maxIter | number | Maximum iterations |

**Returns:**  
Root x such that f(x) ≈ 0.

---

## 3. Components

### 3.1 InputPanel

```typescript
interface InputPanelProps {
  input: CableInput;
  onChange: (input: CableInput) => void;
}

const InputPanel: React.FC<InputPanelProps>
```

**Description:**  
Input form for all cable parameters.

**Sections:**
- Analysis Model selection
- Geometry inputs
- Cable Properties
- Point Loads (add/edit/remove)

---

### 3.2 CableDiagram

```typescript
interface CableDiagramProps {
  input: CableInput;
  result: AnalysisResult;
}

const CableDiagram: React.FC<CableDiagramProps>
```

**Description:**  
Interactive SVG visualization of cable profile.

**Features:**
- Cable profile curve
- Towers and backstays
- Point load arrows
- Sag annotation
- Hover tooltips

---

### 3.3 ForceDiagram

```typescript
interface ForceDiagramProps {
  result: AnalysisResult;
}

const ForceDiagram: React.FC<ForceDiagramProps>
```

**Description:**  
Force vector diagrams for towers and point loads.

**Sub-components:**
- TowerForceDiag: Shows main cable, backstay, and resultant vectors
- PointLoadForceDiag: Shows equilibrium at load points

---

### 3.4 ResultsPanel

```typescript
interface ResultsPanelProps {
  result: AnalysisResult;
}

const ResultsPanel: React.FC<ResultsPanelProps>
```

**Description:**  
Detailed results display with collapsible sections.

**Sections:**
- Results Summary
- Maximum Forces Summary
- Point-Load Results
- Tower/Pulley Results
- Calculation Steps

---

### 3.5 PointLoadSlider

```typescript
interface PointLoadSliderProps {
  pointLoads: PointLoad[];
  spanL: number;
  onChange: (id: string, x: number) => void;
  onChangeP: (id: string, P: number) => void;
}

const PointLoadSlider: React.FC<PointLoadSliderProps>
```

**Description:**  
Interactive slider for adjusting point load positions.

**Features:**
- Draggable markers
- Real-time position updates
- Magnitude input fields

---

### 3.6 EquationsRef

```typescript
interface EquationsRefProps {
  model: AnalysisModel;
}

const EquationsRef: React.FC<EquationsRefProps>
```

**Description:**  
Reference panel showing governing equations.

**Content:**
- Differential equations
- Profile equations
- Tension formulas
- Equilibrium conditions

---

## 4. Utilities

### 4.1 exportReport

```typescript
function exportReport(input: CableInput, result: AnalysisResult): void
```

**Description:**  
Generates and downloads PDF report.

**Output:**  
Downloads `cable-analysis-report.pdf` containing:
- Cable profile figure with max sag
- Input parameters table
- Results summary
- Point-load results
- Tower results
- Calculation steps
- Warnings

**Dependencies:**
- jspdf
- jspdf-autotable

---

### 4.2 cn (Class Names)

```typescript
function cn(...inputs: ClassValue[]): string
```

**Description:**  
Utility for merging Tailwind CSS class names.

**Example:**
```typescript
import { cn } from './utils/cn';

const className = cn(
  'base-class',
  isActive && 'active-class',
  variant === 'primary' ? 'primary' : 'secondary'
);
```

---

## Constants

### RAD / DEG Conversion

```typescript
const DEG = Math.PI / 180;  // Multiply degrees to get radians
const RAD = 180 / Math.PI;  // Multiply radians to get degrees
```

**Usage:**
```typescript
const angleRad = 30 * DEG;      // 30° → 0.524 rad
const angleDeg = 0.524 * RAD;   // 0.524 rad → 30°
```

---

## Error Codes

| Error | Description |
|-------|-------------|
| "Point load outside span" | x < 0 or x > L |
| "Brent: root not bracketed" | Solver failed to bracket root |
| "Equilibrium not satisfied" | H*(mR-mL) ≠ P |

---

## Version History

| Version | Changes |
|---------|---------|
| 1.0.0 | Initial release |

---

© 2026 Arvind Singh Rawat. All Rights Reserved.
