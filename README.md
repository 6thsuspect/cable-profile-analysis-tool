# Cable Profile & Tension Analysis Tool

An interactive engineering application for analysing flexible cables spanning between tower pulleys and anchored to rock behind the towers.

## 📌 Overview

**Cable Profile & Tension Analysis Tool** calculates the cable profile, tension, slope/angles, point-load effects, backstay forces and tower/pulley reactions. The application provides an interactive diagram, step-by-step calculations, validation checks and PDF report generation.

The tool supports both:

* **Parabolic cable analysis** — self-weight uniformly distributed per unit horizontal projection.
* **Catenary analysis** — self-weight uniformly distributed per unit actual cable length.

---

## 🏗️ Cable Arrangement

The analysed system consists of:

```text
Rock Anchor ── Backstay ── Tower/Pulley ╲
                                         ╲
                                          ╲  Cable
                                           ╲──────● Point Load
                                            ╲
                                             ╲
                                      Tower/Pulley ── Backstay ── Rock Anchor
```

The main valley cable passes over pulleys located at the top of the towers and continues as backstay cables to rock anchors.

---

## ⚙️ Key Features

* Interactive cable geometry and profile.
* Parabolic cable analysis.
* Exact catenary analysis.
* Self-weight calculation.
* Single and multiple downward point loads.
* Cable angle on either side of point loads.
* Cable angle at tower pulleys.
* Horizontal cable tension calculation.
* Resultant cable tension.
* Backstay force calculation.
* Predefined backstay angle with vertical.
* Tower/pulley resultant reaction.
* Interactive force and angle diagrams.
* Automatic equilibrium validation.
* Step-by-step calculation display.
* Engineering equation display.
* PDF calculation report.
* Unit-aware input and output.
* Numerical solver with convergence checks.

---

## 📐 Main Equations

### Parabolic Cable

For a cable carrying uniform load `w` per unit horizontal projection:

[
H\frac{d^2y}{dx^2}=w
]

The cable profile is:

[
y(x)=y_L+m_Lx+\frac{wx^2}{2H}
]

where:

[
m_L=\frac{y_R-y_L}{L}-\frac{wL}{2H}
]

---

### Cable Angle

At any point:

[
m=\frac{dy}{dx}
]

[
\theta=\tan^{-1}(m)
]

where `θ` is the cable angle with respect to the horizontal.

---

### Cable Tension

Horizontal component:

[
H=\text{constant}
]

Vertical component:

[
V=Hm
]

Resultant tension:

[
T=\sqrt{H^2+V^2}
]

or:

[
T=\frac{H}{\cos\theta}
]

---

## ⬇️ Point Load

For a downward point load `P` applied at any location along the cable, the cable is divided into two segments.

The elevation remains continuous:

[
y_{left}=y_{right}
]

The change in vertical cable force is:

[
\boxed{H(m_R-m_L)=P}
]

Therefore:

[
\boxed{H[\tan(\theta_R)-\tan(\theta_L)]=P}
]

This equation is used to determine the change in cable angle across the point load.

The tension on each side is:

[
T_L=H\sqrt{1+m_L^2}
]

[
T_R=H\sqrt{1+m_R^2}
]

---

## 🗼 Tower Cable Angle

The cable angle at each tower is obtained from the cable tangent immediately adjacent to the pulley:

[
\theta_T=\tan^{-1}\left(\frac{dy}{dx}\right)
]

The angle with vertical is:

[
\beta=90^\circ-|\theta_T|
]

---

## 🪨 Backstay / Rock Anchor

If the backstay cable has a predefined angle `α` with the vertical:

[
\theta_{backstay}=90^\circ-\alpha
]

For backstay tension `Tₐ`:

[
H_a=T_a\sin\alpha
]

[
V_a=T_a\cos\alpha
]

The corresponding anchor force is equal and opposite to the cable force.

---

## 🔩 Tower / Pulley Reaction

For a frictionless pulley with cable tension `T` on both sides:

[
F_x=T\cos\theta_1+T\cos\theta_2
]

[
F_y=T\sin\theta_1+T\sin\theta_2
]

Resultant:

[
R=\sqrt{F_x^2+F_y^2}
]

Direction:

[
\theta_R=\tan^{-1}\left(\frac{F_y}{F_x}\right)
]

---

## 🔬 Catenary Model

For cable self-weight distributed along the actual cable length:

[
y=a\cosh\left(\frac{x-x_0}{a}\right)+C
]

where:

[
a=\frac{H}{w_s}
]

For a symmetric cable:

[
y=a[\cosh(x/a)-1]
]

The cable tension is:

[
T=H\cosh(x/a)
]

The parabolic approximation is:

[
y\approx\frac{x^2}{2a}
]

for relatively small sag.

---

## ✅ Validation Checks

The software automatically checks:

### Geometry

* Span `L > 0`
* Point loads located within the main span.
* Valid backstay angle.
* Non-negative cable weight.
* Non-negative point loads.

### Boundary Conditions

[
y(0)=y_L
]

[
y(L)=y_R
]

### Point Load Equilibrium

[
|H(m_R-m_L)-P|\leq tolerance
]

### Cable Continuity

[
|y_L-y_R|\leq tolerance
]

at every point load.

### Tension

[
T\geq H>0
]

### Global Equilibrium

[
\Sigma F_x\approx0
]

[
\Sigma F_y\approx0
]

The program shall report solver convergence, residual and validation status.

---

## 🖥️ Interactive Diagram

The application should provide an interactive SVG-based engineering diagram showing:

* Rock anchors
* Towers
* Tower pulleys
* Main cable
* Backstay cables
* Point loads
* Cable angles
* Tension vectors
* Tower reactions
* Dimensions
* Elevations
* Lowest cable point

Users can modify geometry and loads interactively and immediately see the cable profile and forces update.

---

## 🧮 Recommended Technology

* **TypeScript**
* **React**
* **Vite**
* **SVG**
* **KaTeX / MathJax**
* Numerical root-solving algorithms
* PDF report generation

---

## 📁 Suggested Project Structure

```text
src/
├── components/
│   ├── CableDiagram/
│   ├── InputPanel/
│   ├── ResultPanel/
│   ├── EquationPanel/
│   ├── ValidationPanel/
│   └── ReportPanel/
│
├── core/
│   ├── geometry.ts
│   ├── parabolicCable.ts
│   ├── catenaryCable.ts
│   ├── pointLoads.ts
│   ├── backstay.ts
│   ├── towerForces.ts
│   ├── solver.ts
│   └── validation.ts
│
├── types/
│   ├── cable.ts
│   ├── loads.ts
│   └── results.ts
│
├── utils/
│   ├── units.ts
│   ├── angles.ts
│   └── numerical.ts
│
└── reports/
    └── reportBuilder.ts
```

---

## 🧪 Verification Example

For a symmetric parabolic cable:

* Span = `100 m`
* Sag = `5 m`
* Self-weight = `1 kN/m`

Horizontal cable tension:

[
H=\frac{wL^2}{8f}
]

[
H=\frac{1\times100^2}{8\times5}
]

[
\boxed{H=250\ kN}
]

Tower slope:

[
m=\frac{4f}{L}=0.20
]

Tower cable angle:

[
\boxed{\theta=11.3099^\circ}
]

Tower tension:

[
T=250\sqrt{1+0.2^2}
]

[
\boxed{T=254.951\ kN}
]

These values should be included as automated regression tests.

---

## 📄 Calculation Report

The generated PDF report should contain:

1. Project information
2. Input parameters
3. Cable arrangement diagram
4. Analysis assumptions
5. Governing equations
6. Cable profile calculation
7. Point-load calculations
8. Cable angles
9. Cable tensions
10. Backstay forces
11. Tower reactions
12. Validation checks
13. Summary of results
14. Engineering warnings and limitations

---

## ⚠️ Engineering Limitations

This application represents an ideal flexible cable model.

The following should be separately verified for final engineering design:

* Cable tensile capacity
* Rock-anchor capacity
* Anchorage/socket capacity
* Pulley/sheave capacity
* Tower local forces
* Tower global stability
* Foundation capacity
* Construction-stage stability
* Wind effects
* Seismic effects
* Fatigue
* Cable vibration
* Corrosion allowance
* Applicable load factors and design codes

The results should therefore be reviewed by a qualified structural engineer before being used for final design or construction.

---

## 📚 Documentation

Additional project documentation:

* [Product Requirements Document](./Cable_Analysis_Typescript_PRD.md)
* Cable calculation and validation equations
* Calculation methodology
* Verification test cases

---

## 👨‍💻 Author

**Arvind Singh Rawat**
Bridge Design Engineer

Email: [arvindrawat400@gmail.com](mailto:arvindrawat400@gmail.com)
LinkedIn: [https://www.linkedin.com/in/arvindrawat400/](https://www.linkedin.com/in/arvindrawat400/)

---

## 📜 License

Add the applicable project license here.

---

**Cable Profile & Tension Analysis Tool**
*Interactive engineering analysis of suspended cables, point loads, backstays and tower reactions.*
