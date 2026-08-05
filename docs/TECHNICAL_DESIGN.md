# Technical Design Document

## Cable Profile & Point-Load Analysis Tool

**Version:** 1.0.0  
**Author:** Arvind Singh Rawat  
**Last Updated:** January 2026

---

## Table of Contents

1. [Overview](#1-overview)
2. [System Architecture](#2-system-architecture)
3. [Mathematical Models](#3-mathematical-models)
4. [Data Structures](#4-data-structures)
5. [Algorithm Design](#5-algorithm-design)
6. [Component Design](#6-component-design)
7. [State Management](#7-state-management)
8. [PDF Generation](#8-pdf-generation)
9. [Error Handling](#9-error-handling)
10. [Performance Considerations](#10-performance-considerations)

---

## 1. Overview

### 1.1 Purpose

This document describes the technical design and implementation details of the Cable Profile & Point-Load Analysis Tool.

### 1.2 Technology Stack

| Layer | Technology |
|-------|------------|
| Language | TypeScript 5.x |
| Framework | React 19 |
| Build Tool | Vite 7 |
| Styling | Tailwind CSS 4 |
| PDF Generation | jsPDF + jspdf-autotable |
| Deployment | Single HTML file (vite-plugin-singlefile) |

### 1.3 Design Principles

1. **Separation of Concerns**: Solver logic separate from UI
2. **Immutability**: State updates via new objects
3. **Type Safety**: Full TypeScript coverage
4. **Real-time Updates**: Reactive computation
5. **Transparency**: Show all calculation steps

---

## 2. System Architecture

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Application                           │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   Input     │  │   Solver    │  │      Output         │ │
│  │   Panel     │→→│   Engine    │→→│   Components        │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
│        │                │                    │              │
│        ▼                ▼                    ▼              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                    State (React)                     │   │
│  │         CableInput  ←→  AnalysisResult              │   │
│  └─────────────────────────────────────────────────────┘   │
│                          │                                  │
│                          ▼                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                   PDF Export                         │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Module Structure

```
src/
├── App.tsx                 # Main application component
├── main.tsx               # Entry point
├── types.ts               # TypeScript interfaces
├── index.css              # Global styles
├── solver/
│   └── CableSolver.ts     # Core calculation engine
├── components/
│   ├── InputPanel.tsx     # Input form
│   ├── CableDiagram.tsx   # SVG cable visualization
│   ├── ForceDiagram.tsx   # Force vector diagrams
│   ├── ResultsPanel.tsx   # Results display
│   ├── EquationsRef.tsx   # Equations reference
│   └── PointLoadSlider.tsx # Interactive slider
├── report/
│   └── pdfExport.ts       # PDF generation
└── utils/
    └── cn.ts              # Class name utility
```

---

## 3. Mathematical Models

### 3.1 Coordinate System

```
        y ↑
          │
          │    Cable Profile
          │   ╭────────────╮
    yL ───┼───●            ●─── yR
          │   │            │
          │   │            │
          └───┼────────────┼───→ x
              0            L
```

- **Origin**: Left tower base
- **x-axis**: Horizontal, positive rightward
- **y-axis**: Vertical, positive upward

### 3.2 Parabolic Model

#### Governing Differential Equation

```
H · d²y/dx² = w
```

Where:
- H = horizontal tension component (constant)
- w = load per unit horizontal length

#### General Solution

```
y(x) = yL + C₁·x + w·x²/(2H)
```

Where:
```
C₁ = (yR - yL)/L - w·L/(2H)
```

#### Slope

```
dy/dx = C₁ + w·x/H
```

#### Tension

```
T(x) = H · √(1 + (dy/dx)²) = H / cos(θ)
```

### 3.3 Catenary Model

#### Governing Equation

```
y(x) = a · cosh((x - x₀)/a) + C
```

Where:
- a = H/γ (catenary parameter)
- γ = weight per unit cable length
- x₀ = horizontal position of lowest point

#### Tension

```
T(x) = H · cosh((x - x₀)/a)
```

#### Arc Length

```
s = a · sinh(x/a)
```

### 3.4 Point Load Analysis

#### Slope Discontinuity

At a point load P at position xₚ:

```
H · (m_right - m_left) = P
```

Where m_left and m_right are slopes immediately left and right of the load.

#### Multi-Segment Solution

For n point loads, the cable is divided into n+1 parabolic segments. At each load point:

1. **Continuity**: y_left(xᵢ) = y_right(xᵢ)
2. **Equilibrium**: H · (mᵣ - mₗ) = Pᵢ

This forms a tridiagonal linear system solved using the Thomas algorithm.

### 3.5 Tower Equilibrium

#### Main Cable Force

```
T_main = H / cos(θ_main)
H_main = H
V_main = H · tan(θ_main)
```

#### Backstay Force

For backstay at angle α from vertical:

```
T_backstay = H / sin(α)
H_backstay = H
V_backstay = T_backstay · cos(α)
```

#### Resultant

```
Rₓ = H_main + H_backstay (considering directions)
Rᵧ = V_main + V_backstay (considering directions)
R = √(Rₓ² + Rᵧ²)
```

---

## 4. Data Structures

### 4.1 Input Types

```typescript
interface CableInput {
  geometry: GeometryInput;
  cable: CableProperties;
  pointLoads: PointLoad[];
  options: AnalysisOptions;
  H_input: number;
}

interface GeometryInput {
  yL: number;      // Left tower elevation (m)
  yR: number;      // Right tower elevation (m)
  L: number;       // Horizontal span (m)
  La: number;      // Left backstay length (m)
  Ra: number;      // Right backstay length (m)
  alphaL: number;  // Left anchor angle (deg)
  alphaR: number;  // Right anchor angle (deg)
}

interface PointLoad {
  id: string;
  x: number;       // Position from left tower (m)
  P: number;       // Magnitude (kN, positive down)
  label: string;
}
```

### 4.2 Output Types

```typescript
interface AnalysisResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  calculationSteps: string[];
  
  H: number;
  model: AnalysisModel;
  profile: ProfilePoint[];
  
  slopeLeft: number;
  slopeRight: number;
  thetaLeft: number;
  thetaRight: number;
  
  pointLoadResults: PointLoadResult[];
  leftTower: TowerResult;
  rightTower: TowerResult;
  
  maxSag: number;
  sagRatio: number;
  cableLength: number;
  maxForces: MaxForcesResult;
}
```

### 4.3 Profile Point

```typescript
interface ProfilePoint {
  x: number;       // Horizontal position
  y: number;       // Elevation
  slope: number;   // dy/dx
  theta: number;   // Angle (radians)
  T: number;       // Tension
  V: number;       // Vertical force component
}
```

---

## 5. Algorithm Design

### 5.1 Parabolic Solver

```
FUNCTION solveParabolicWithLoads(input):
    1. Extract geometry and loads
    2. Sort point loads by x-coordinate
    3. Create segment boundaries [0, x₁, x₂, ..., xₙ, L]
    4. For given H:
        a. Set up tridiagonal system for internal elevations
        b. Solve using Thomas algorithm
    5. Build profile points for each segment
    6. Calculate endpoint slopes
    7. Validate equilibrium at each load point
    8. Compute tower reactions
    9. Find maximum sag point
    10. Return AnalysisResult
```

### 5.2 Thomas Algorithm (Tridiagonal Solver)

```
FUNCTION thomasSolve(A, b, n):
    // Forward elimination
    FOR i = 1 TO n-1:
        m = A[i][i-1] / A[i-1][i-1]
        A[i][i] -= m * A[i-1][i]
        b[i] -= m * b[i-1]
    
    // Back substitution
    x[n-1] = b[n-1] / A[n-1][n-1]
    FOR i = n-2 DOWNTO 0:
        x[i] = (b[i] - A[i][i+1] * x[i+1]) / A[i][i]
    
    RETURN x
```

### 5.3 Catenary Solver

```
FUNCTION solveCatenary(input):
    1. Calculate catenary parameter a = H/γ
    2. Find x₀ using Brent's method:
        - Root of: a·(cosh((L-x₀)/a) - cosh(-x₀/a)) - (yR-yL) = 0
    3. Calculate constant C = yL - a·cosh(-x₀/a)
    4. Build profile: y(x) = a·cosh((x-x₀)/a) + C
    5. Calculate arc length: s = a·(sinh((L-x₀)/a) - sinh(-x₀/a))
    6. Return AnalysisResult
```

### 5.4 Brent's Method (Root Finding)

```
FUNCTION brentSolve(f, a, b, tol, maxIter):
    // Bracketed root finding with inverse quadratic interpolation
    fa = f(a), fb = f(b)
    ENSURE fa * fb < 0  // Root is bracketed
    
    FOR iter = 1 TO maxIter:
        IF |fb| < |fa|: SWAP(a,b), SWAP(fa,fb)
        
        m = (c - b) / 2
        IF |m| < tol OR fb == 0: RETURN b
        
        // Try interpolation or bisection
        IF conditions_for_interpolation:
            use inverse quadratic interpolation
        ELSE:
            use bisection
        
        UPDATE a, b, c, fa, fb, fc
    
    RETURN b
```

---

## 6. Component Design

### 6.1 App Component

**Responsibilities:**
- Hold application state (CableInput)
- Trigger solver on input changes
- Coordinate child components

**Key Logic:**
```typescript
const result = useMemo(() => {
  try {
    return solveCable(input);
  } catch (e) {
    return null;
  }
}, [input]);
```

### 6.2 CableDiagram Component

**Responsibilities:**
- Render SVG cable profile
- Handle mouse interactions
- Display hover tooltips

**Scaling:**
```typescript
const scaleX = (x: number) => 
  marginL + ((x - bounds.minX) / (bounds.maxX - bounds.minX)) * plotW;

const scaleY = (y: number) => 
  marginT + (1 - (y - bounds.minY) / (bounds.maxY - bounds.minY)) * plotH;
```

### 6.3 PointLoadSlider Component

**Responsibilities:**
- Render draggable load markers
- Handle drag interactions
- Update load positions in real-time

**Drag Logic:**
```typescript
useEffect(() => {
  if (!dragging) return;
  
  const handleMouseMove = (e: MouseEvent) => {
    const newX = getXFromMouse(e);
    onChange(dragging, newX);
  };
  
  window.addEventListener('mousemove', handleMouseMove);
  window.addEventListener('mouseup', handleMouseUp);
  
  return () => {
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
  };
}, [dragging]);
```

---

## 7. State Management

### 7.1 State Structure

```typescript
// In App.tsx
const [input, setInput] = useState<CableInput>(DEFAULT_INPUT);
const [activeTab, setActiveTab] = useState<Tab>('diagram');

// Derived state (computed)
const result = useMemo(() => solveCable(input), [input]);
```

### 7.2 Update Patterns

**Geometry Update:**
```typescript
const updateGeometry = (key: string, value: number) => {
  onChange({
    ...input,
    geometry: { ...input.geometry, [key]: value },
  });
};
```

**Point Load Update:**
```typescript
const updatePointLoad = (id: string, key: keyof PointLoad, value: any) => {
  onChange({
    ...input,
    pointLoads: input.pointLoads.map(pl =>
      pl.id === id ? { ...pl, [key]: value } : pl
    ),
  });
};
```

---

## 8. PDF Generation

### 8.1 Architecture

```
pdfExport.ts
├── exportReport(input, result)
│   ├── Create jsPDF document
│   ├── Add title and metadata
│   ├── drawCableProfileFigure()
│   ├── Add input tables (autoTable)
│   ├── Add results tables
│   ├── Add calculation steps
│   └── Save PDF
```

### 8.2 Drawing Cable Profile

```typescript
function drawCableProfileFigure(doc, input, result, startY):
    1. Calculate bounds from profile points
    2. Define scale functions
    3. Draw grid lines
    4. Draw towers (doc.line)
    5. Draw backstays (dashed)
    6. Draw main cable (iterate profile)
    7. Draw point loads (arrows)
    8. Mark and annotate max sag point
    9. Add legend
    10. Return next Y position
```

### 8.3 jsPDF Methods Used

| Method | Purpose |
|--------|---------|
| `doc.text()` | Add text |
| `doc.line()` | Draw line |
| `doc.circle()` | Draw circle |
| `doc.rect()` | Draw rectangle |
| `doc.triangle()` | Draw triangle (arrow heads) |
| `doc.setDrawColor()` | Set stroke color |
| `doc.setFillColor()` | Set fill color |
| `doc.setLineDashPattern()` | Dashed lines |
| `autoTable()` | Data tables |

---

## 9. Error Handling

### 9.1 Input Validation

```typescript
// In solver
for (const ld of loads) {
  if (ld.x <= 0 || ld.x >= L) {
    errors.push(`Point load "${ld.label}" at x=${ld.x} is outside span`);
  }
}
```

### 9.2 Solver Errors

```typescript
// In App.tsx
const result = useMemo(() => {
  try {
    return solveCable(input);
  } catch (e) {
    console.error('Solver error:', e);
    return null;
  }
}, [input]);
```

### 9.3 Warning Generation

```typescript
if (sagRatio > 0.1) {
  warnings.push('Sag/span ratio > 0.1. Parabolic approximation may be inaccurate.');
}
```

---

## 10. Performance Considerations

### 10.1 Memoization

- `useMemo` for solver computation
- `useCallback` for event handlers
- Avoids unnecessary re-calculations

### 10.2 Profile Sampling

```typescript
diagramSamples: 200  // Points along cable
```

Configurable for performance vs. smoothness trade-off.

### 10.3 SVG Optimization

- Path commands batched
- Minimal DOM updates
- Hardware-accelerated transforms

### 10.4 Build Optimization

- Vite tree-shaking
- Single-file output (inlined assets)
- Minification and compression

---

## Appendix A: File Dependencies

```
App.tsx
├── types.ts
├── solver/CableSolver.ts
│   └── types.ts
├── components/InputPanel.tsx
│   └── types.ts
├── components/CableDiagram.tsx
│   └── types.ts
├── components/ForceDiagram.tsx
│   └── types.ts
├── components/ResultsPanel.tsx
│   └── types.ts
├── components/EquationsRef.tsx
│   └── types.ts
├── components/PointLoadSlider.tsx
│   └── types.ts
└── report/pdfExport.ts
    └── types.ts
```

---

© 2026 Arvind Singh Rawat. All Rights Reserved.
