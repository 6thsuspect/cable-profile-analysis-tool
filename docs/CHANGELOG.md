# Changelog

All notable changes to the Cable Profile & Point-Load Analysis Tool will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
