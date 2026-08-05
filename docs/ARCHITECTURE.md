# System Architecture

## Cable Profile & Point-Load Analysis Tool

> [!IMPORTANT]
> **This document describes version 1.x and has not been updated for the 2.0 physics
> rewrite.** In 2.0 the horizontal tension `H` is solved from axial compatibility against
> the cable's unstressed length rather than accepted as an input, and the solver module structure below has been replaced by `parabolic.ts`, `elasticCatenary.ts`, `structure.ts`, `capacity.ts` and `verification.ts`.
> See [`PHYSICS.md`](PHYSICS.md) for the authoritative formulation and
> [`CHANGELOG.md`](CHANGELOG.md) for the full list of changes.


**Version:** 1.0.0  
**Author:** Arvind Singh Rawat

---

## 1. Architecture Overview

### 1.1 High-Level Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              BROWSER                                         │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                         React Application                              │  │
│  │  ┌─────────────────────────────────────────────────────────────────┐  │  │
│  │  │                         App.tsx                                  │  │  │
│  │  │  ┌──────────────┐   ┌──────────────┐   ┌──────────────────────┐ │  │  │
│  │  │  │    State     │   │    Solver    │   │      Rendering       │ │  │  │
│  │  │  │  CableInput  │──▶│  solveCable  │──▶│    Components        │ │  │  │
│  │  │  └──────────────┘   └──────────────┘   └──────────────────────┘ │  │  │
│  │  │         ▲                                        │               │  │  │
│  │  │         │                                        ▼               │  │  │
│  │  │  ┌──────────────┐                       ┌──────────────────────┐ │  │  │
│  │  │  │ InputPanel   │                       │ CableDiagram         │ │  │  │
│  │  │  │ PointSlider  │                       │ ForceDiagram         │ │  │  │
│  │  │  └──────────────┘                       │ ResultsPanel         │ │  │  │
│  │  │                                         └──────────────────────┘ │  │  │
│  │  └─────────────────────────────────────────────────────────────────┘  │  │
│  │                                    │                                   │  │
│  │                                    ▼                                   │  │
│  │  ┌─────────────────────────────────────────────────────────────────┐  │  │
│  │  │                       PDF Export                                 │  │  │
│  │  │                    (jsPDF + autoTable)                          │  │  │
│  │  └─────────────────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Technology Stack

```
┌─────────────────────────────────────────┐
│              Application                 │
├─────────────────────────────────────────┤
│  React 19        │  UI Framework        │
│  TypeScript 5    │  Language            │
│  Tailwind CSS 4  │  Styling             │
├─────────────────────────────────────────┤
│  jsPDF           │  PDF Generation      │
│  jspdf-autotable │  PDF Tables          │
├─────────────────────────────────────────┤
│  Vite 7          │  Build Tool          │
│  vite-singlefile │  Bundle to HTML      │
└─────────────────────────────────────────┘
```

---

## 2. Component Architecture

### 2.1 Component Hierarchy

```
App
├── Header
│   ├── Title
│   ├── Presets Buttons
│   └── Export PDF Button
│
├── Main Content
│   ├── Left Panel (Input)
│   │   └── InputPanel
│   │       ├── Model Selection
│   │       ├── Geometry Inputs
│   │       ├── Cable Properties
│   │       └── Point Loads
│   │
│   └── Right Panel (Output)
│       ├── Status Bar
│       ├── Tab Navigation
│       ├── Tab Content
│       │   ├── CableDiagram (tab: diagram)
│       │   ├── ForceDiagram (tab: forces)
│       │   ├── ResultsPanel (tab: results)
│       │   └── EquationsRef (tab: equations)
│       ├── PointLoadSlider
│       └── Info Footer
│
└── Author Footer
```

### 2.2 Component Communication

```
                    ┌─────────────┐
                    │    App      │
                    │  (State)    │
                    └──────┬──────┘
                           │
           ┌───────────────┼───────────────┐
           │               │               │
           ▼               ▼               ▼
    ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
    │ InputPanel  │ │   Solver    │ │  Output     │
    │             │ │             │ │ Components  │
    └──────┬──────┘ └──────┬──────┘ └─────────────┘
           │               │               ▲
           │               │               │
           ▼               ▼               │
    ┌─────────────────────────────────────────────┐
    │              Props / Callbacks               │
    │  input ────────────▶ result ────────────▶   │
    │  onChange ◀────────── (computed)            │
    └─────────────────────────────────────────────┘
```

---

## 3. Data Flow

### 3.1 Unidirectional Data Flow

```
User Input ──▶ State Update ──▶ Solver ──▶ Results ──▶ UI Update
     ▲                                                      │
     └──────────────────────────────────────────────────────┘
                        (User Interaction)
```

### 3.2 Detailed Data Flow

```
┌──────────────────────────────────────────────────────────────────┐
│                         DATA FLOW                                 │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  1. User modifies input                                          │
│     │                                                            │
│     ▼                                                            │
│  2. InputPanel calls onChange(newInput)                          │
│     │                                                            │
│     ▼                                                            │
│  3. App.setInput(newInput) updates state                         │
│     │                                                            │
│     ▼                                                            │
│  4. useMemo triggers: result = solveCable(input)                 │
│     │                                                            │
│     ├──▶ Parabolic Solver ──┐                                    │
│     │                       │                                    │
│     └──▶ Catenary Solver ───┼──▶ AnalysisResult                  │
│                             │                                    │
│     ◀───────────────────────┘                                    │
│     │                                                            │
│     ▼                                                            │
│  5. React re-renders with new result                             │
│     │                                                            │
│     ├──▶ CableDiagram receives result                            │
│     ├──▶ ForceDiagram receives result                            │
│     ├──▶ ResultsPanel receives result                            │
│     └──▶ StatusBar updates                                       │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

### 3.3 Point Load Slider Flow

```
┌─────────────────────────────────────────────────────────────┐
│                  SLIDER INTERACTION                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. User drags load marker                                   │
│     │                                                        │
│     ▼                                                        │
│  2. PointLoadSlider.handleMouseMove                          │
│     │                                                        │
│     ├── getXFromMouse(event) → newX                          │
│     │                                                        │
│     ▼                                                        │
│  3. Call onChange(loadId, newX)                              │
│     │                                                        │
│     ▼                                                        │
│  4. App.handlePointLoadPositionChange                        │
│     │                                                        │
│     ├── Update input.pointLoads[id].x = newX                 │
│     │                                                        │
│     ▼                                                        │
│  5. State update → Solver → UI update                        │
│     (Real-time feedback)                                     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Module Architecture

### 4.1 Module Dependencies

```
                    ┌─────────────┐
                    │   types.ts  │
                    └──────┬──────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ▼                  ▼                  ▼
┌───────────────┐  ┌───────────────┐  ┌───────────────┐
│  CableSolver  │  │  Components   │  │  pdfExport    │
│               │  │               │  │               │
│ - Parabolic   │  │ - InputPanel  │  │ - Tables      │
│ - Catenary    │  │ - Diagram     │  │ - Figure      │
│ - Brent       │  │ - Results     │  │ - Download    │
└───────────────┘  └───────────────┘  └───────────────┘
        │                  │                  │
        └──────────────────┼──────────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │   App.tsx   │
                    └─────────────┘
```

### 4.2 File Structure

```
src/
│
├── App.tsx                    # Main application component
├── main.tsx                   # Entry point (ReactDOM.render)
├── types.ts                   # TypeScript type definitions
├── index.css                  # Global styles + Tailwind
│
├── solver/
│   └── CableSolver.ts         # Core calculation engine
│       ├── solveCable()       # Main entry point
│       ├── solveParabolic()   # Parabolic model
│       ├── solveCatenary()    # Catenary model
│       ├── brentSolve()       # Root finder
│       └── thomasSolve()      # Tridiagonal solver
│
├── components/
│   ├── InputPanel.tsx         # Input form component
│   ├── CableDiagram.tsx       # SVG cable visualization
│   ├── ForceDiagram.tsx       # Force vector diagrams
│   ├── ResultsPanel.tsx       # Results display
│   ├── EquationsRef.tsx       # Equations reference
│   └── PointLoadSlider.tsx    # Interactive slider
│
├── report/
│   └── pdfExport.ts           # PDF generation
│       ├── exportReport()     # Main export function
│       └── drawCableFigure()  # Cable profile drawing
│
└── utils/
    └── cn.ts                  # Class name utility
```

---

## 5. Solver Architecture

### 5.1 Solver Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        SOLVER ENGINE                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  solveCable(input)                                               │
│       │                                                          │
│       ├── model === 'CATENARY' ──▶ solveCatenary()               │
│       │                                  │                       │
│       │                                  ├── Calculate a = H/γ   │
│       │                                  ├── Find x₀ (Brent)     │
│       │                                  └── Build cosh profile  │
│       │                                                          │
│       └── model === 'PARABOLIC' ──▶ solveParabolicWithLoads()    │
│                                          │                       │
│                                          ├── Sort point loads    │
│                                          ├── Create segments     │
│                                          ├── Solve elevations    │
│                                          │   (Thomas algorithm)  │
│                                          ├── Build profiles      │
│                                          └── Validate equilib.   │
│                                                                  │
│  Both paths:                                                     │
│       │                                                          │
│       ├── computeTowerResult() × 2                               │
│       ├── Find max sag point                                     │
│       ├── Calculate cable length                                 │
│       ├── Compute maxForces                                      │
│       └── Return AnalysisResult                                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 Multi-Segment Solution

```
┌─────────────────────────────────────────────────────────────────┐
│               POINT LOAD SEGMENTATION                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  For n point loads at x₁, x₂, ..., xₙ:                           │
│                                                                  │
│  Tower A      P₁         P₂              Tower B                 │
│     ●─────────┼──────────┼────────────────●                      │
│     0         x₁         x₂              L                       │
│                                                                  │
│  Segments: [0, x₁], [x₁, x₂], [x₂, L]                            │
│                                                                  │
│  Unknowns: y₁, y₂ (elevations at load points)                   │
│                                                                  │
│  Equations at each load:                                         │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Continuity: y_left(xᵢ) = y_right(xᵢ) = yᵢ             │    │
│  │  Equilibrium: H·(m_right - m_left) = Pᵢ                 │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  Forms tridiagonal system → Thomas algorithm                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 6. Rendering Architecture

### 6.1 SVG Diagram Structure

```
<svg>
  │
  ├── <g> Grid Lines
  │   └── <line> × n
  │
  ├── <g> Reference Lines
  │   └── <line> Ground, Chord
  │
  ├── <g> Towers
  │   ├── <line> Left tower
  │   └── <line> Right tower
  │
  ├── <g> Backstays
  │   ├── <path> Left backstay (dashed)
  │   └── <path> Right backstay (dashed)
  │
  ├── <g> Anchors
  │   ├── <circle> Left anchor
  │   └── <circle> Right anchor
  │
  ├── <path> Main Cable Profile
  │
  ├── <g> Pulleys
  │   ├── <circle> Left pulley
  │   └── <circle> Right pulley
  │
  ├── <g> Point Loads
  │   └── <g> × n
  │       ├── <line> Arrow shaft
  │       ├── <circle> Contact point
  │       └── <text> Label
  │
  ├── <g> Sag Annotation
  │   ├── <line> Measurement line
  │   ├── <circle> Max sag point
  │   └── <text> Sag value
  │
  └── <g> Tooltip (conditional)
      ├── <circle> Highlight
      ├── <rect> Background
      └── <text> × 4 (x, y, θ, T)
</svg>
```

### 6.2 Coordinate Transformation

```
Engineering Space              SVG Space
      ↑ y                           ┌───────────────→ x
      │                             │
      │    (x, y)                   │    (sx, sy)
      │       ●                     │       ●
      │                             │
      └────────→ x                  ▼ y


Transformation:
  sx = marginL + ((x - minX) / (maxX - minX)) * plotW
  sy = marginT + (1 - (y - minY) / (maxY - minY)) * plotH
                  ↑
                  └── Flip y-axis
```

---

## 7. Build Architecture

### 7.1 Build Pipeline

```
┌──────────────────────────────────────────────────────────────┐
│                      BUILD PIPELINE                           │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  Source Files                                                 │
│  ├── .tsx, .ts files                                          │
│  ├── .css files                                               │
│  └── index.html                                               │
│       │                                                       │
│       ▼                                                       │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                    Vite Build                            │ │
│  │  ├── TypeScript compilation                              │ │
│  │  ├── JSX transformation                                  │ │
│  │  ├── Tailwind CSS processing                             │ │
│  │  ├── Tree shaking                                        │ │
│  │  ├── Minification                                        │ │
│  │  └── Code splitting                                      │ │
│  └─────────────────────────────────────────────────────────┘ │
│       │                                                       │
│       ▼                                                       │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │              vite-plugin-singlefile                      │ │
│  │  ├── Inline JavaScript                                   │ │
│  │  ├── Inline CSS                                          │ │
│  │  └── Base64 encode assets                                │ │
│  └─────────────────────────────────────────────────────────┘ │
│       │                                                       │
│       ▼                                                       │
│  Output: dist/index.html (single file, ~1MB)                  │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

### 7.2 Bundle Composition

```
dist/index.html (~1.1 MB)
│
├── Inlined JavaScript (~800 KB)
│   ├── React runtime
│   ├── Application code
│   ├── jsPDF library
│   └── jspdf-autotable
│
├── Inlined CSS (~50 KB)
│   └── Tailwind utilities
│
└── HTML structure
```

---

## 8. Performance Architecture

### 8.1 Optimization Strategies

```
┌─────────────────────────────────────────────────────────────────┐
│                    PERFORMANCE OPTIMIZATIONS                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Memoization                                                  │
│     ┌────────────────────────────────────────────────────────┐  │
│     │  const result = useMemo(() => solveCable(input),       │  │
│     │                               [input]);                 │  │
│     │  // Only recomputes when input changes                 │  │
│     └────────────────────────────────────────────────────────┘  │
│                                                                  │
│  2. Callback Stability                                           │
│     ┌────────────────────────────────────────────────────────┐  │
│     │  const handleChange = useCallback((v) => {             │  │
│     │    setInput(prev => ({...prev, ...v}));                │  │
│     │  }, []);                                                │  │
│     │  // Prevents child re-renders                          │  │
│     └────────────────────────────────────────────────────────┘  │
│                                                                  │
│  3. SVG Path Batching                                            │
│     ┌────────────────────────────────────────────────────────┐  │
│     │  const path = profile.map((pt, i) =>                   │  │
│     │    `${i === 0 ? 'M' : 'L'}${x},${y}`                   │  │
│     │  ).join(' ');                                          │  │
│     │  // Single path element vs. many line elements         │  │
│     └────────────────────────────────────────────────────────┘  │
│                                                                  │
│  4. Lazy PDF Generation                                          │
│     ┌────────────────────────────────────────────────────────┐  │
│     │  // PDF only generated on export button click          │  │
│     │  // Not computed during normal interaction             │  │
│     └────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 9. Deployment Architecture

### 9.1 Single-File Deployment

```
┌─────────────────────────────────────────────────────────────────┐
│                   DEPLOYMENT MODEL                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Build Output: dist/index.html                                   │
│       │                                                          │
│       ├──▶ Static hosting (GitHub Pages, Netlify, etc.)          │
│       │                                                          │
│       ├──▶ Local file (file:// protocol)                         │
│       │                                                          │
│       ├──▶ Embedded in other applications                        │
│       │                                                          │
│       └──▶ Offline usage (no server required)                    │
│                                                                  │
│  Benefits:                                                       │
│  ✓ No server dependencies                                        │
│  ✓ Easy distribution                                             │
│  ✓ Works offline                                                 │
│  ✓ Simple deployment                                             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

© 2026 Arvind Singh Rawat. All Rights Reserved.
