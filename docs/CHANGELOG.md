# Changelog

All notable changes to the Cable Profile & Point-Load Analysis Tool will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.0.0] - 2026-08-06

### 🔬 Physics rewrite — sag under load is now bounded

The headline defect in 1.x was that the horizontal tension **H** was a user input held
constant across every load case. That makes the deflection under a point load
`δ = P·L/(4H)` — linear in P and **unbounded** — so adding load produced ever-increasing
sag and no tension limit was ever reached.

**H is now an unknown**, solved from axial compatibility against the cable's unstressed
(cut) length `L₀`:

```
S(H) = L₀·(1 + α·ΔT) + (1/EA)·∫T ds + δ_support(H)
```

Adding load now pulls the cable tighter. The sag grows only by the elastic stretch of the
rope, and the tension climbs until a genuine limit state is reached.

For a 120 m crossing erected to 8 m sag, applying a 900 kN girder now increases the sag by
**1.08 m** and the tension from 200 kN to 2996 kN. Under the old model the same load gave
**15.8 m** of sag on a 120 m span at unchanged tension. The `Rigid prescribed-H (legacy)`
preset reproduces the old behaviour side by side for comparison.

### Added — physical modelling

- **Installed-state control**: define the cable by target dead-load sag, target dead-load
  tension, or the cut length directly. The required cut length `L₀` is reported as a
  construction output.
- **Elastic elongation** via the exact identity `∫T ds = H·∫(1+y′²)dx`.
- **Temperature change** per load case. A drop shortens the cable and raises the tension,
  so the −25 °C combination frequently governs the rope.
- **Tower-top horizontal flexibility** as extra available cable length.
- **Exact elastic catenary with point loads** — a damped-Newton chain of closed-form
  elastic-catenary elements, seeded from the parabolic solution. The 1.x catenary model
  could not carry point loads at all and fell back to a warning.
- **Segmented distributed load**: superimposed UDL over any part of the span.
- **Detection of the region where the "load per horizontal metre" idealisation has no
  solution** (`H < γL/√6`), with a warning directing the user to the catenary model.

### Added — capacity, the break point, and the load cap

- **Cable section catalogue** — 6×36 IWRC, 6×19 IWRC, spiral strand, full-locked coil and
  7-wire prestressing strand, with metallic area, modulus, MBL, mass and recommended D/d.
- **Configurable strength limits**: MBL, termination efficiency, saddle bending
  efficiency, number of parallel ropes, load-sharing factor, factor of safety, and a
  separate ULS material factor so load factors and the FoS no longer multiply.
- **Break-point search** — the variable-load multiplier λ at which each limit state is
  reached, in order, and the load at which the rope ruptures. With no variable load
  applied it reports the maximum midspan payload directly.
- **Section suggestion** when a strength check fails.
- **Nineteen capacity checks** across cable, backstay, tower, anchor, geometry and
  serviceability, with advisory checks that never govern or report FAIL.

### Added — structure and site

- **Three saddle idealisations** (balanced backstay, frictionless roller saddle, clamped
  head). 1.x silently mixed two of them.
- **Tower checks**: base axial, shear and moment, Euler buckling, N–M interaction,
  overturning.
- **Anchor checks**: uplift and sliding with block weight, rock/ground tie-downs, friction
  and passive restraint, plus the block weight each check demands.
- **Ravine geometry**: bank levels, bed level and position, crest positions, highest flood
  level and required clearance. Clearance is assessed over the actual gap rather than at
  the tower bases, and the controlling level is the greater of ground and flood level.

### Added — launching

- **Incremental launching module**: total weight, unit length, bogie count, spacing,
  weight distribution, dynamic amplification factor and cable-to-soffit depth.
- **Launching envelope**: the unit swept across the crossing with tension, H, sag,
  clearance and saddle reactions against nose position, and the governing position
  identified. Weight still on the banks is accounted for separately. The cable-to-soffit
  depth is deducted only over the stretch the unit occupies.
- Clicking the envelope chart or table moves the launch to that position.

### Added — analysis and reporting

- **Load combinations**: installed, service, service ± 25 °C, service + wind, factored
  ULS, with editable factors.
- **Stiffness reporting**: EA, Dischinger equivalent modulus, vertical stiffness at a
  probe point, and `dH/dP`, `dSag/dP`, `dSag/dT`, `dH/dT` — each from a re-solve of the
  nonlinear problem rather than a linearisation.
- **Built-in verification suite**: 16 closed-form benchmarks, shown in the UI and the PDF.
- **Advisory lateral wind** as an in-plane equivalent, clearly labelled as such.
- **Nine-page PDF report** with the figure, all inputs, the governing case in detail,
  every check, the break point, the launching envelope, the verification table, the
  assumptions and the full calculation trail.
- **Head-less checks**: `npm run check`, `npm run check:ui`, `npm run verify`.
- **Six worked scenarios**, including a deliberately overloaded case and the legacy rigid
  mode.

### Fixed

- Global vertical equilibrium was checked against `γ·L` instead of `γ ×` arc length,
  producing a spurious ~0.15 % error warning on every case.
- `∫(1+u²)dx` was evaluated as `(H/w)[u + u³/3]`, which overflowed to ~1e165 at small `H`
  and destroyed the root bracket. Now expanded in closed form with no cancellation.
- The `w = γ·ds/dx` fixed point diverged exponentially at large sag; it is now damped and
  capped, with the divergence condition documented and reported.
- Arc length lost all significant digits for a nearly straight segment; a series form is
  used there.
- Backstay tension was described as a frictionless-pulley result while actually computing
  the balanced-backstay result. Both are now available and named correctly.
- Maximum sag, lowest point and clearance minima are found from exact stationary points
  instead of by scanning plot samples.
- A near-vertical backstay no longer produces a fictitious `H × 1000` tension.
- Point loads outside the span are drawn to the nearest usable position with a warning
  rather than silently corrupting the tridiagonal system.

### Changed

- **Breaking**: `CableInput` and `AnalysisResult` are substantially extended. Saved 1.x
  inputs are not compatible.
- `docs/PHYSICS.md` is now the authoritative solver description; the solver sections of
  `TECHNICAL_DESIGN.md`, `ARCHITECTURE.md` and `API_REFERENCE.md` describe 1.x.

---

## [1.0.0] - 2026-01-XX

### 🎉 Initial Release

First public release of the Cable Profile & Point-Load Analysis Tool.

### Added

#### Core Features
- **Parabolic Cable Model**: Analysis with uniform load per horizontal projection
- **Catenary Cable Model**: Analysis with self-weight per cable length
- **Multi-Point Load Support**: Add multiple downward point loads at any position
- **Real-time Calculation**: Results update instantly as inputs change

#### Geometry Input
- Tower-to-tower horizontal span (L)
- Left and right tower elevations (yL, yR)
- Left and right backstay lengths (La, Ra)
- Left and right anchor angles from vertical (αL, αR)

#### Cable Properties
- Unit weight per horizontal projection (w)
- Unit weight per cable length (γ)
- User-prescribed horizontal tension (H)

#### Calculations
- Cable profile y(x) along span
- Cable slope and angle at any point
- Tension components (H, V, T) along cable
- Maximum sag and location
- Total cable length
- Point-load equilibrium validation
- Tower/pulley force reactions
- Backstay tensions and forces
- Maximum forces summary

#### Visualization
- **Cable Profile Diagram**: Interactive SVG with:
  - Main cable curve
  - Tower representations
  - Backstay cables (dashed)
  - Anchor points
  - Point load arrows
  - Sag annotation with measurement
  - Hover tooltips showing local values (x, y, θ, T)
  
- **Force Diagrams**: Vector diagrams showing:
  - Tower force equilibrium (main cable + backstay → resultant)
  - Point load equilibrium (left tension + right tension + load)

- **Results Panel**: Collapsible sections for:
  - Summary results
  - Maximum forces
  - Point-load details
  - Tower/pulley results
  - Calculation steps

- **Equations Reference**: Display of governing equations for both models

#### Interactive Features
- **Point Load Slider**: Drag-and-drop control for load positions
- **Preset Configurations**: Quick-load example setups
  - Symmetric span
  - Asymmetric span
  - Single point load
  - Multiple point loads
  - Catenary model

#### PDF Export
- Complete calculation report with:
  - Cable profile figure showing max sag point
  - Input parameters table
  - Point loads table
  - Results summary
  - Maximum forces summary
  - Detailed point-load results
  - Tower/pulley results
  - Calculation steps
  - Warnings

#### Documentation
- Product Requirements Document (PRD.md)
- User Guide (USER_GUIDE.md)
- Technical Design Document (TECHNICAL_DESIGN.md)
- API Reference (API_REFERENCE.md)
- System Architecture (ARCHITECTURE.md)
- Development Guide (DEVELOPMENT_GUIDE.md)
- Changelog (CHANGELOG.md)

#### Technical
- TypeScript implementation with strict typing
- React 19 with functional components and hooks
- Tailwind CSS 4 for styling
- Vite 7 build tool
- Single-file HTML output for easy distribution
- Responsive layout (optimized for desktop)

### Technical Details

#### Numerical Methods
- **Brent's Method**: Root finding for catenary parameter
- **Thomas Algorithm**: Tridiagonal system solver for multi-point loads
- **Memoization**: Optimized re-computation using React useMemo

#### Validation
- Equilibrium check at each point load: H·(mR - mL) = P
- Sag/span ratio warning when > 0.1 (parabolic approximation limit)
- Input validation for geometry constraints

---

## [Unreleased]

### Planned for v1.1
- [ ] Save/load analysis configurations to file
- [ ] Unit system toggle (SI / Imperial)
- [ ] Additional load types (distributed, inclined)
- [ ] Print-friendly view
- [ ] Keyboard shortcuts

### Planned for v1.2
- [ ] Elastic cable analysis (cable elongation)
- [ ] Temperature effects
- [ ] Multiple span analysis
- [ ] Comparison mode (side-by-side analyses)

### Planned for v2.0
- [ ] 3D cable analysis
- [ ] Dynamic/wind analysis
- [ ] Integration API
- [ ] Cloud storage for projects

---

## Migration Notes

### Upgrading from Development Versions

If you have been using development versions, note that:

1. **Input format** has been finalized - ensure your saved configurations match the `CableInput` interface
2. **PDF layout** has been redesigned - new reports include cable profile figure
3. **Point load slider** is a new feature - available below the diagram

---

## Version History Summary

| Version | Date | Highlights |
|---------|------|------------|
| 1.0.0 | Jan 2026 | Initial release |

---

## Contributing

See [DEVELOPMENT_GUIDE.md](./DEVELOPMENT_GUIDE.md) for contribution guidelines.

When contributing, please:
1. Update this changelog under `[Unreleased]`
2. Follow the format: `- **Category**: Description`
3. Reference issue numbers where applicable

---

## Authors

**Arvind Singh Rawat**  
Bridge & Structural Design Engineer  
Email: arvindrawat400@gmail.com  
LinkedIn: linkedin.com/in/arvindrawat400

---

© 2026 Arvind Singh Rawat. All Rights Reserved.
