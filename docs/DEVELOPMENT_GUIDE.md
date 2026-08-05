# Development Guide

## Cable Profile & Point-Load Analysis Tool

> [!IMPORTANT]
> **This document describes version 1.x and has not been updated for the 2.0 physics
> rewrite.** In 2.0 the horizontal tension `H` is solved from axial compatibility against
> the cable's unstressed length rather than accepted as an input, and the module layout and available npm scripts have changed.
> See [`PHYSICS.md`](PHYSICS.md) for the authoritative formulation and
> [`CHANGELOG.md`](CHANGELOG.md) for the full list of changes.


**Version:** 1.0.0  
**Author:** Arvind Singh Rawat

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Getting Started](#2-getting-started)
3. [Project Structure](#3-project-structure)
4. [Development Workflow](#4-development-workflow)
5. [Code Style Guide](#5-code-style-guide)
6. [Adding Features](#6-adding-features)
7. [Testing](#7-testing)
8. [Building](#8-building)
9. [Troubleshooting](#9-troubleshooting)

---

## 1. Prerequisites

### 1.1 Required Software

| Software | Version | Purpose |
|----------|---------|---------|
| Node.js | 18+ | JavaScript runtime |
| npm | 9+ | Package manager |
| Git | 2.x | Version control |

### 1.2 Recommended Tools

| Tool | Purpose |
|------|---------|
| VS Code | IDE |
| ESLint extension | Linting |
| Prettier extension | Formatting |
| TypeScript extension | Type checking |

### 1.3 Check Installation

```bash
node --version   # Should be 18+
npm --version    # Should be 9+
git --version    # Should be 2.x
```

---

## 2. Getting Started

### 2.1 Clone Repository

```bash
git clone <repository-url>
cd cable-analysis-tool
```

### 2.2 Install Dependencies

```bash
npm install
```

### 2.3 Start Development Server

```bash
npm run dev
```

Open http://localhost:5173 in your browser.

### 2.4 Build for Production

```bash
npm run build
```

Output: `dist/index.html`

### 2.5 Preview Production Build

```bash
npm run preview
```

---

## 3. Project Structure

```
cable-analysis-tool/
│
├── src/                          # Source code
│   ├── App.tsx                   # Main application
│   ├── main.tsx                  # Entry point
│   ├── types.ts                  # TypeScript interfaces
│   ├── index.css                 # Global styles
│   │
│   ├── solver/                   # Calculation engine
│   │   └── CableSolver.ts
│   │
│   ├── components/               # React components
│   │   ├── InputPanel.tsx
│   │   ├── CableDiagram.tsx
│   │   ├── ForceDiagram.tsx
│   │   ├── ResultsPanel.tsx
│   │   ├── EquationsRef.tsx
│   │   └── PointLoadSlider.tsx
│   │
│   ├── report/                   # PDF export
│   │   └── pdfExport.ts
│   │
│   └── utils/                    # Utilities
│       └── cn.ts
│
├── docs/                         # Documentation
│   ├── PRD.md
│   ├── USER_GUIDE.md
│   ├── TECHNICAL_DESIGN.md
│   ├── API_REFERENCE.md
│   ├── ARCHITECTURE.md
│   ├── DEVELOPMENT_GUIDE.md
│   └── CHANGELOG.md
│
├── public/                       # Static assets
│
├── dist/                         # Build output
│   └── index.html
│
├── index.html                    # HTML template
├── package.json                  # Dependencies
├── tsconfig.json                 # TypeScript config
├── vite.config.ts               # Vite config
└── README.md
```

---

## 4. Development Workflow

### 4.1 Making Changes

1. **Create feature branch**
   ```bash
   git checkout -b feature/my-feature
   ```

2. **Make changes**
   - Edit source files
   - Hot reload shows changes instantly

3. **Test changes**
   - Verify in browser
   - Check console for errors

4. **Build and verify**
   ```bash
   npm run build
   ```

5. **Commit changes**
   ```bash
   git add .
   git commit -m "feat: description of change"
   ```

### 4.2 Commit Message Format

```
<type>: <description>

[optional body]

[optional footer]
```

**Types:**
| Type | Description |
|------|-------------|
| feat | New feature |
| fix | Bug fix |
| docs | Documentation |
| style | Formatting |
| refactor | Code restructuring |
| perf | Performance improvement |
| test | Adding tests |
| chore | Maintenance |

**Examples:**
```
feat: add multiple point load support
fix: correct sag calculation for asymmetric spans
docs: update user guide with slider instructions
```

### 4.3 Branch Naming

```
feature/description    # New features
fix/description        # Bug fixes
docs/description       # Documentation
refactor/description   # Refactoring
```

---

## 5. Code Style Guide

### 5.1 TypeScript

**Use strict typing:**
```typescript
// ✅ Good
function calculate(x: number, y: number): number {
  return x + y;
}

// ❌ Avoid
function calculate(x, y) {
  return x + y;
}
```

**Use interfaces for objects:**
```typescript
// ✅ Good
interface Point {
  x: number;
  y: number;
}

const point: Point = { x: 10, y: 20 };

// ❌ Avoid
const point = { x: 10, y: 20 };
```

### 5.2 React Components

**Functional components with TypeScript:**
```typescript
interface Props {
  value: number;
  onChange: (v: number) => void;
}

const MyComponent: React.FC<Props> = ({ value, onChange }) => {
  return (
    <input
      type="number"
      value={value}
      onChange={e => onChange(parseFloat(e.target.value))}
    />
  );
};
```

**Use hooks appropriately:**
```typescript
// State that triggers re-render
const [value, setValue] = useState(0);

// Memoized computation
const result = useMemo(() => expensiveCalc(value), [value]);

// Stable callbacks
const handleClick = useCallback(() => {
  setValue(v => v + 1);
}, []);
```

### 5.3 File Organization

**One component per file:**
```
components/
├── InputPanel.tsx      # InputPanel component
├── CableDiagram.tsx    # CableDiagram component
└── ResultsPanel.tsx    # ResultsPanel component
```

**Export at bottom:**
```typescript
// Component definition
const MyComponent: React.FC<Props> = ({ ... }) => {
  // ...
};

// Export at end
export { MyComponent };
// or
export default MyComponent;
```

### 5.4 CSS / Tailwind

**Use Tailwind utilities:**
```tsx
// ✅ Good
<div className="flex items-center gap-2 p-4 bg-white rounded-lg">

// ❌ Avoid inline styles
<div style={{ display: 'flex', alignItems: 'center' }}>
```

**Group related classes:**
```tsx
<div className={cn(
  // Layout
  "flex items-center gap-2",
  // Spacing
  "p-4 m-2",
  // Visual
  "bg-white rounded-lg shadow",
  // Conditional
  isActive && "ring-2 ring-blue-500"
)}>
```

### 5.5 Comments

**Document complex logic:**
```typescript
/**
 * Solves tridiagonal system using Thomas algorithm.
 * 
 * @param A - Coefficient matrix (tridiagonal)
 * @param b - Right-hand side vector
 * @param n - System size
 * @returns Solution vector x
 */
function thomasSolve(A: number[][], b: number[], n: number): number[] {
  // Forward elimination
  for (let i = 1; i < n; i++) {
    // ... implementation
  }
}
```

**Explain engineering formulas:**
```typescript
// Parabolic cable profile equation:
// y(x) = yL + C1*x + w*x²/(2H)
// where C1 = (yR - yL)/L - w*L/(2H)
const y = yL + C1 * x + (w * x * x) / (2 * H);
```

---

## 6. Adding Features

### 6.1 Adding a New Input Parameter

1. **Update types.ts:**
   ```typescript
   interface GeometryInput {
     // ... existing
     newParam: number;  // Add new parameter
   }
   ```

2. **Update InputPanel.tsx:**
   ```typescript
   {numInput('New Parameter', input.geometry.newParam, 
     v => updateGeometry('newParam', v), 'unit')}
   ```

3. **Update solver if needed:**
   ```typescript
   const { newParam } = geometry;
   // Use in calculations
   ```

4. **Update PDF export:**
   ```typescript
   ['New parameter', 'symbol', input.geometry.newParam.toFixed(2), 'unit'],
   ```

### 6.2 Adding a New Calculation

1. **Add to AnalysisResult type:**
   ```typescript
   interface AnalysisResult {
     // ... existing
     newResult: number;
   }
   ```

2. **Calculate in solver:**
   ```typescript
   const newResult = /* calculation */;
   
   return {
     // ... existing
     newResult,
   };
   ```

3. **Display in ResultsPanel:**
   ```typescript
   <Row label="New Result" value={result.newResult.toFixed(2)} unit="unit" />
   ```

### 6.3 Adding a New Component

1. **Create component file:**
   ```typescript
   // src/components/NewComponent.tsx
   import React from 'react';
   
   interface Props {
     // Define props
   }
   
   export const NewComponent: React.FC<Props> = ({ ... }) => {
     return (
       // JSX
     );
   };
   ```

2. **Import in App.tsx:**
   ```typescript
   import { NewComponent } from './components/NewComponent';
   ```

3. **Add to render:**
   ```tsx
   <NewComponent prop={value} />
   ```

---

## 7. Testing

### 7.1 Manual Testing Checklist

**Input Validation:**
- [ ] All inputs accept valid values
- [ ] Invalid inputs show appropriate feedback
- [ ] Extreme values don't crash solver

**Calculations:**
- [ ] Symmetric span gives symmetric results
- [ ] Equilibrium checks pass for point loads
- [ ] Results match hand calculations

**Visualization:**
- [ ] Diagram scales correctly
- [ ] All elements visible
- [ ] Hover tooltips work

**PDF Export:**
- [ ] PDF generates successfully
- [ ] All sections present
- [ ] Figure renders correctly

### 7.2 Test Cases

**TC1: Symmetric Span**
- L = 200m, yL = yR = 50m
- H = 500kN, w = 0.5 kN/m
- Expected: Symmetric sag profile

**TC2: Point Load Equilibrium**
- Single load P at x = L/2
- Check: H·(mR - mL) = P

**TC3: Catenary vs Parabolic**
- Compare for small sag (< 5%)
- Should be nearly identical

---

## 8. Building

### 8.1 Development Build

```bash
npm run dev
```
- Hot module replacement
- Source maps enabled
- No minification

### 8.2 Production Build

```bash
npm run build
```
- Minified output
- Tree shaking
- Single HTML file

### 8.3 Build Output

```
dist/
└── index.html    # ~1.1 MB single file
```

### 8.4 Analyzing Bundle

Check build output:
```bash
npm run build -- --debug
```

---

## 9. Troubleshooting

### 9.1 Common Issues

**Build fails with type errors:**
```
Error: Property 'x' does not exist on type 'Y'
```
**Solution:** Check type definitions match usage.

**SVG not rendering:**
- Check viewBox dimensions
- Verify scale functions return valid numbers
- Check for NaN in calculations

**PDF export fails:**
```
Error: Cannot read property of undefined
```
**Solution:** Ensure result object is valid before export.

### 9.2 Development Server Issues

**Port already in use:**
```bash
# Use different port
npm run dev -- --port 3000
```

**Hot reload not working:**
- Check file is saved
- Clear browser cache
- Restart dev server

### 9.3 Debugging

**Browser DevTools:**
- Console for errors
- Network tab for requests
- React DevTools for component state

**Add debug logging:**
```typescript
console.log('Debug:', { value, result });
```

**Solver debugging:**
```typescript
steps.push(`Debug: x=${x}, y=${y}`);
// Shows in Calculation Steps section
```

---

## Appendix A: VS Code Settings

**.vscode/settings.json:**
```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "typescript.preferences.importModuleSpecifier": "relative"
}
```

## Appendix B: Useful Commands

```bash
# Development
npm run dev              # Start dev server
npm run build            # Production build
npm run preview          # Preview build

# Utilities
npm run lint             # Run linter (if configured)
npm run format           # Format code (if configured)
```

---

© 2026 Arvind Singh Rawat. All Rights Reserved.
