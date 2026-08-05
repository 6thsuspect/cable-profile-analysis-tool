# Physical Formulation

This document is the authoritative description of what the solver computes, in enough
detail that a reviewer can reproduce any number the tool reports. It supersedes the
solver description in `TECHNICAL_DESIGN.md`.

Units throughout: **kN, m, mm², MPa (= N/mm²), °C**. Sign convention: *x* to the right
from Tower A, *y* upwards, point loads **P** positive downwards.

---

## 1. The problem with treating H as an input

Version 1 accepted the horizontal tension **H** as a user input. For a weightless cable
with a single midspan load that gives

```
δ = P·L / (4H)
```

— linear in **P** and **unbounded**. Doubling the load doubles the sag; a large enough
load produces a sag of hundreds of metres on a hundred-metre span. That is *kinematics*,
not statics: it silently allows the cable to lengthen by whatever amount the load
demands, and because the geometry always accommodates the load, no tension limit is ever
reached.

A real cable is manufactured to a length. Once it is strung between two saddles, that
**unstressed (cut) length L₀** is fixed. Adding load cannot make the cable longer except
by stretching it elastically, so the cable pulls *tighter* instead of sagging further.
**H is therefore an unknown**, and the equation that determines it is axial compatibility.

---

## 2. The governing compatibility equation

```
S(H)  =  L₀·(1 + α·ΔT)  +  (1/EA)·∫T ds  +  δ_support(H)
└────┘    └────────────┘     └─────────┘     └──────────┘
deformed   thermally           elastic        extra length
arc        adjusted cut        stretch        released by
length     length                             flexible saddles
```

* `S(H)` — the arc length the equilibrium shape actually needs. **Falls** as H rises.
* `L₀(1+αΔT)` — the cut length at the case temperature. A temperature **drop** shortens
  it and therefore **raises** the tension; this is why the −25 °C combination usually
  governs the rope.
* `(1/EA)·∫T ds` — elastic elongation. **Rises** with H.
* `δ_support(H) = (H − H_ref)·(1/k_L + 1/k_R)` — horizontal movement of the two saddle
  tops, treated to first order as extra available length.

Because the left side decreases and the right side increases monotonically with H, the
root is unique. It is found with Brent's method. `solveH()` in `parabolic.ts`.

**Consequence.** The sag can only grow by the elastic stretch plus temperature movement
plus support give — millimetres, not metres. What grows instead is the tension, and it
grows until it reaches a genuine limit state. That limit is what the break-point search
reports.

### Establishing L₀

L₀ is back-calculated from the **installed state** — the cable under dead load alone —
using whichever of these the user specifies:

| Control | Procedure |
| --- | --- |
| Installed sag | Solve H so that `maxSag(H) = f₀`, then `L₀ = S(H) − H·Q/EA` |
| Installed tension H₀ | Evaluate the shape at H₀, then `L₀ = S(H₀) − H₀·Q/EA` |
| Cut length | L₀ given directly |
| Rigid (legacy) | H imposed on every case; compatibility **not** enforced |

For the catenary model L₀ is refined by an outer Brent iteration so that the target is
met with the exact catenary shape rather than its parabolic approximation.

The reported L₀ is a construction output in its own right: it is the length to order.

---

## 3. Elastic parabolic model (segmental)

The cable is divided into segments at every point load and at every change of
distributed load, so *w* is constant inside each segment. With H constant:

```
H·y″ = w        ⇒     y(ξ) = y_i + C_i·ξ + w_i·ξ²/(2H)
                      C_i  = (y_{i+1} − y_i)/ℓ_i − w_i·ℓ_i/(2H)
```

### Node equilibrium

Vertical equilibrium of the kink at interior node *j*:

```
H·(m_R − m_L) = P_j

(y_{j+1} − y_j)/ℓ_j − (y_j − y_{j−1})/ℓ_{j−1} = [P_j + (w_j·ℓ_j + w_{j−1}·ℓ_{j−1})/2] / H
```

For a trial H this is a **tridiagonal system** in the node elevations — the classic taut
string — solved by the Thomas algorithm.

### Closed-form integrals

With `u(ξ) = C + a·ξ` and `a = w/H`:

```
S   = ∫√(1+u²) dξ = (1/a)·½[ u√(1+u²) + asinh u ]        (series form when |a·ℓ| is tiny)
Q   = ∫(1+u²)  dξ = ℓ(1+C²) + C·a·ℓ² + a²ℓ³/3            (expanded — no cancellation)
∫T ds = H·Q                                               since T = H√(1+u²), ds = √(1+u²)dξ
```

That last identity is what makes the elastic term of the compatibility equation
closed-form instead of numerical.

Maximum sag, lowest point and clearance extrema are all found from **exact stationary
points** (`y′ = target slope`), not by scanning samples.

### Self weight per horizontal metre

Rope weight is naturally *per metre of cable* (γ), while this model needs *per horizontal
metre*: `w = γ·ds/dx`. Solved as a per-segment fixed point. For a shallow symmetric cable
the fixed point is `s = 1 + κ·s²` with `κ = γ²L²/(24H²)`, which has a real solution only
while

```
κ ≤ ¼      ⇔      H ≥ γ·L/√6
```

Below that threshold the "load per horizontal projection" idealisation **does not exist**.
The factor is capped so the residual stays defined and the root bracket stays valid, and
any converged answer inside the capped region raises a warning telling the user to switch
to the catenary model.

### Known approximation

The elastic integral is referred to the deformed length rather than the unstressed
length, an **O(ε)** error of roughly 0.1 % at working stress. Benchmark 14 in the
verification suite measures it explicitly rather than hiding it. The elastic catenary has
no such approximation.

---

## 4. Elastic catenary model (exact)

With *p* the unstressed arc coordinate, `V(p) = V_i + w₀·p`, `T = √(H² + V²)` and
`τ = 1 + α·ΔT`:

```
dx/dp = (1 + T/EA + α·ΔT)·H/T
dy/dp = (1 + T/EA + α·ΔT)·V/T
```

which integrates exactly over one element of unstressed length ℓ₀:

```
Δx  = τ·(H/w₀)·[ asinh(V_j/H) − asinh(V_i/H) ] + H·ℓ₀/EA
Δy  = τ·(T_j − T_i)/w₀                          + ℓ₀·(V_i + V_j)/(2·EA)
arc = ℓ₀·τ + (1/EA)·∫T dp
∫T dp = (1/2w₀)·[ V√(H²+V²) + H²·asinh(V/H) ]
```

No small-sag assumption anywhere. This is the reference model; the parabolic form is its
shallow-cable limit.

### Chain with point loads

A cable carrying *n* point loads is a chain of *n+1* such elements, with `V_right =
V_left + P_j` at each load.

Because a load is attached at a fixed **horizontal** position while the element equations
are parameterised by **unstressed length**, the element lengths are themselves unknowns:

| Unknowns (n+2) | Equations (n+2) |
| --- | --- |
| H | `Σ Δx = L + δ_support` |
| V₀ | `Σ Δy = y_R − y_L` |
| ℓ₀¹ … ℓ₀ⁿ (with `Σ ℓ₀ = L₀`) | cumulative `Σ Δx` at load *j* equals `x_j`, for each load |

Solved by damped Newton with a numerical Jacobian, seeded from the parabolic solution
(which is always close). If Newton fails to converge the parabolic result is reported for
that case together with an explicit warning — never a silent substitution.

---

## 5. Saddles, towers and anchors

Three saddle idealisations are offered because they give genuinely different tower
designs, and version 1 silently mixed two of them.

| Mode | Backstay tension | Consequence |
| --- | --- | --- |
| `BALANCED_BACKSTAY` | `T_bs = H / sin α` | Horizontal thrust cancels; mast in near-pure compression. How a temporary launching mast is normally tuned. |
| `ROLLER_SADDLE` | `T_bs = T_main` | Tension continuous through a frictionless saddle. Horizontal components no longer cancel; the mast carries `H − T_main·sin α` as shear and base moment. |
| `CLAMPED_SADDLE` | user-specified | Cable clamped at the head, backstay stressed independently. |

α is measured **from vertical**, so `H_bs = T_bs·sin α` and `V_bs = T_bs·cos α`.

> A steep backstay (small α) needs an enormous force to hold H back. With α = 30° the
> backstay carries twice the span thrust. This is why the backstay is so often the
> governing element, and why laying it back matters.

Tower actions, taken as a cantilever mast with the saddle load at the top:

```
axial       N = W_tower + max(0, −R_y)
base shear  V = |R_x|
base moment M = |R_x|·h
Euler       P_cr = π²EI / (K·h)²
overturning FoS = N·(b/2) / M
```

Anchor block, with the backstay pulling it up and towards the tower:

```
uplift   FoS = (W + T_tiedown) / (T_bs·cos α)
sliding  FoS = [ μ·(W + T_tiedown − T_bs·cos α) + R_passive ] / (T_bs·sin α)
```

---

## 6. Capacity and the break point

```
MBL_eff   = MBL · η_termination · η_bend
T_rope    = T_system · share_factor / n_ropes
service   : T_rope ≤ MBL_eff / FoS
factored  : T_rope ≤ MBL_eff / γ_M
σ = T_rope / A_m,     ε = σ / E
```

Service (unfactored) combinations use the **factor of safety**; factored (ULS)
combinations use the **material factor** instead. If both were applied the load factors
and the FoS would multiply and the check would be meaningless — a 1.5 load factor with a
FoS of 3 is an effective factor of 4.5 against breaking load.

### The break-point search

A single scalar λ multiplies all **variable** load (point loads and launching load) while
self weight is held constant. λ is swept over a graded grid, then each limit state is
refined by bisection to find the λ at which its utilisation reaches 1.0. The output is:

* **λ_allowable** and which check causes it — the first genuine limit state,
* **λ_ultimate** — where the rope reaches `MBL_eff`, i.e. rupture,
* the **full ordered list** of limit states, so the user can see what to strengthen first,
* the corresponding allowable and ultimate variable loads in kN.

If no variable load is applied at all, λ is instead interpreted as a probe point load at
midspan, so the report reads directly as *"this system can carry X kN at midspan."*

Checks marked **advisory** (saddle D/d, parabolic sag-ratio validity) never govern and
never report FAIL — they are detailing and modelling guidance, not exhausted capacities.

---

## 7. Stiffness

```
E_Dischinger = E / [ 1 + w²·L²·EA / (12·H³) ]
k_vertical   = dP/dδ,   by central difference through the full nonlinear solve
```

The Dischinger modulus is the secant stiffness once the sag change that accompanies a
tension change is allowed for. In a deep-sag cable it can fall to well under half the
material modulus.

`dH/dP`, `dSag/dP`, `dSag/dT` and `dH/dT` are all obtained the same way — by re-solving
the whole nonlinear problem with a perturbation — so they are consistent with the model
rather than with a linearised approximation of it.

---

## 8. Launching

The launched unit is carried by *n* bogies riding on the cable, spaced at
`bogieSpacing` behind the leading bogie. Only bogies **between the saddles** load the
cable; the rest are still supported by the banks, and that weight is reported separately.

The envelope sweeps the leading bogie from Tower A until the last bogie leaves the span
and records tension, H, sag, clearance, saddle resultants and worst utilisation at each
position. Because the load pattern is not symmetric, the governing position is generally
**not** midspan.

Clearance is assessed only between the two crest positions — measuring it at the tower
bases would just return the tower height. The cable-to-soffit depth (slings plus girder
depth) is deducted only over the stretch the unit actually occupies.

---

## 9. Wind

Lateral wind is handled as an **in-plane equivalent**: the cable is taken to carry the
resultant of the vertical load and the lateral force, so the tension is amplified by
`1/cos φ` where `φ = atan(F_lat / W)`, and the unit swings through φ. Out-of-plane
displacement of the cable requires a three-dimensional analysis this tool does not
perform, and the result is labelled advisory throughout.

---

## 10. Verification

`src/solver/verification.ts` runs 16 benchmarks on fixed inputs, independent of user
input, and the results appear in the UI and in the PDF report. Each has a closed-form
answer that does not come from this code.

| Benchmark | Reference |
| --- | --- |
| Symmetric parabolic sag | `f = wL²/8H` |
| Parabolic arc length | series `L[1 + 8/3(f/L)² − 32/5(f/L)⁴]` |
| Midspan point load, sag | `δ = PL/4H` |
| Midspan point load, tension | `T = √(H² + (P/2)²)` |
| Slope discontinuity | `H(m_R − m_L) = P` |
| Global vertical equilibrium | `H(m_R − m_L) = Σwℓ + ΣP` |
| Compatibility residual | `S = L₀ + ∫T ds/EA` |
| Inextensible cable under 40× load | `S(H) = L₀` when `EA → ∞` |
| Installed sag round-trip | `sag(L₀) = prescribed sag` |
| Elastic catenary H, sag, end tension | `a = H/γ`, `f = a(cosh(L/2a) − 1)`, `T = H·cosh(L/2a)` |
| Straight tie stretch, catenary | `H = EA(L − L₀)/L₀`, exact |
| Straight tie stretch, parabolic | same, documents the O(ε) offset |
| Thermal relaxation | `H = EA(L/L₀ − 1 − αΔT)` |
| Parabolic vs catenary at 1/40 sag | the two models must converge |

Run head-lessly with:

```bash
npm run check      # verification suite + full analysis of every preset
npm run check:ui   # server-renders every panel and generates every PDF
npm run verify     # typecheck + both of the above
```

---

## 11. Assumptions and limitations

* Planar (two-dimensional) analysis.
* The cable carries no bending stiffness and no compression.
* Small strain; see the O(ε) note in §3.
* Saddle friction is not modelled. Real friction locks in a tension difference either
  side of the saddle.
* Ropes are assumed prestretched, so the catalogue modulus applies. **Constructional
  stretch of a new rope is not included and must be added to the cut length.**
* No creep, relaxation or fatigue assessment. Repeated launching cycles also require a
  bending-fatigue check over the saddles.
* Catalogue MBL, area and modulus are **indicative** values derived from construction
  constants (fill factor, breaking-force factor, spinning loss). Substitute the certified
  figures from the manufacturer's test certificate before issuing a design.
* Load factors and factors of safety are user inputs with conventional defaults. They are
  **not tied to any particular code** and must be confirmed against the governing
  standard for the project.
* Towers are cantilever masts with the saddle load at the top. Foundation settlement and
  rotation are not modelled; use the tower-top stiffness input to represent overall
  flexibility.
