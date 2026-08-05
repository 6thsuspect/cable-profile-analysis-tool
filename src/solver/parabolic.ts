// ============================================================
// Segmental parabolic cable — ELASTIC, length-compatible
// ------------------------------------------------------------
// The cable is divided into segments at every point load and at every
// change of distributed load. Within a segment the horizontal force H is
// constant, so
//
//     H·y'' = w        ⇒     y(ξ) = y_i + C_i·ξ + w_i·ξ²/(2H)
//     C_i  = (y_{i+1} − y_i)/ℓ_i − w_i·ℓ_i/(2H)
//
// For a trial H the node elevations follow from vertical equilibrium at
// every interior node (a tridiagonal system — this is the classic taut
// string). H itself is NOT free: it is fixed by AXIAL COMPATIBILITY of a
// cable whose unstressed length L₀ was set at installation:
//
//     S(H) = L₀·(1 + α·ΔT) + (1/EA)∫T ds + δ_support(H)
//
// With T = H·√(1+y'²) and ds = √(1+y'²)dx the elastic integral is exact:
//
//     ∫T ds = H·∫(1 + y'²) dx
//
// Both S(H) and ∫(1+y'²)dx are evaluated in closed form below. S falls and
// the right-hand side rises with H, so the root is unique — which is exactly
// why sag can no longer run away when load is added.
// ============================================================
import { asinh, brent, solveTridiagonal, sqrtIntegral } from './numeric';

export interface SpanDef {
  L: number;
  yL: number;
  yR: number;
  /** Node abscissae, ascending, including 0 and L. */
  xs: number[];
  /** Superimposed UDL per horizontal metre, one entry per segment (kN/m). */
  wSup: number[];
  /** Cable system self weight per metre of CABLE (kN/m). */
  gammaSelf: number;
  /** Point load at each interior node (kN, downward positive). */
  P: number[];
}

export interface ParabolicState {
  H: number;
  /** Node elevations, including the two supports. */
  ys: number[];
  /** Effective UDL used on each segment, per horizontal metre (kN/m). */
  wSeg: number[];
  /** Slope at the start / end of each segment. */
  slopeStart: number[];
  slopeEnd: number[];
  /** Deformed arc length (m). */
  S: number;
  /** ∫(1+y'²)dx over the whole span (m) — the elastic-work kernel. */
  Q: number;
  /** Mean secant factor ds/dx per segment. */
  secant: number[];
  /**
   * True when the ds/dx correction had to be capped. The fixed point
   * s = 1 + κs² only has a real solution while κ = γ²L²/(24H²) ≤ ¼, i.e. while
   * H ≥ γ·L/√6. Below that the "load per horizontal metre" idealisation does
   * not exist at all, so the factor is capped to keep the residual defined and
   * the bracket valid; any converged answer in that region is flagged.
   */
  secantClamped: boolean;
  ok: boolean;
}

export interface CompatibilityInput {
  EA: number;           // kN
  L0: number;           // unstressed length at the reference temperature (m)
  alphaDT: number;      // α·ΔT (dimensionless)
  compliance: number;   // total horizontal compliance of the two tower tops (m/kN)
  H_ref: number;        // H at which the support give is zero (kN)
}

/** Cap on the ds/dx self-weight correction (sag/span ≈ 1/2 — far beyond validity). */
const SECANT_MAX = 2.5;
/** Relaxation on the ds/dx fixed point. */
const SECANT_RELAX = 0.7;

// ------------------------------------------------------------
// Node elevations for a trial H
// ------------------------------------------------------------
function nodeElevations(def: SpanDef, H: number, wSeg: number[]): number[] | null {
  const { xs, yL, yR, P } = def;
  const nSeg = xs.length - 1;
  const nInt = nSeg - 1;
  if (nInt === 0) return [yL, yR];

  const ell: number[] = [];
  for (let k = 0; k < nSeg; k++) ell.push(xs[k + 1] - xs[k]);

  const sub = new Array<number>(nInt).fill(0);
  const diag = new Array<number>(nInt).fill(0);
  const sup = new Array<number>(nInt).fill(0);
  const rhs = new Array<number>(nInt).fill(0);

  for (let j = 0; j < nInt; j++) {
    const lL = ell[j];       // segment left of interior node j (node index j+1)
    const lR = ell[j + 1];   // segment right of it
    diag[j] = -(1 / lL + 1 / lR);
    if (j > 0) sub[j] = 1 / lL;
    if (j < nInt - 1) sup[j] = 1 / lR;
    let b = (P[j] + 0.5 * (wSeg[j] * lL + wSeg[j + 1] * lR)) / H;
    if (j === 0) b -= yL / lL;
    if (j === nInt - 1) b -= yR / lR;
    rhs[j] = b;
  }

  const yInt = solveTridiagonal(sub, diag, sup, rhs);
  if (!yInt) return null;
  return [yL, ...yInt, yR];
}

// ------------------------------------------------------------
// Arc length and elastic kernel of one segment (closed form)
// ------------------------------------------------------------
function segmentIntegrals(ell: number, w: number, H: number, C: number) {
  const a = w / H;                     // du/dξ
  const du = a * ell;
  const uE = C + du;

  // Q = ∫₀^ℓ (1 + (C + aξ)²) dξ — expanded, so there is no cancellation and
  // no overflow from dividing by a vanishing w.
  const Q = ell * (1 + C * C) + C * a * ell * ell + (a * a * ell * ell * ell) / 3;

  let S: number;
  if (Math.abs(du) > 1e-4 * Math.max(1, Math.abs(C))) {
    S = (sqrtIntegral(uE) - sqrtIntegral(C)) / a;
  } else {
    // Series form for a nearly straight segment, where (1/a)·ΔF loses all
    // its significant digits. Accurate to O(du³).
    const c2 = 1 + C * C;
    const r = Math.sqrt(c2);
    S = ell * r * (
      1 + (C * du + (du * du) / 3) / (2 * c2) - (C * C * du * du) / (6 * c2 * c2)
    );
  }
  return { S, Q, uEnd: uE };
}

/**
 * Full kinematic state for a trial H. The self-weight term is specified per
 * metre of cable, so an inner fixed point converts it to the per-horizontal-metre
 * intensity the parabolic model needs (w = γ·ds/dx, segment average).
 */
export function evaluateParabolic(def: SpanDef, H: number): ParabolicState {
  const { xs, gammaSelf, wSup } = def;
  const nSeg = xs.length - 1;
  const ell: number[] = [];
  for (let k = 0; k < nSeg; k++) ell.push(xs[k + 1] - xs[k]);

  const secant = new Array<number>(nSeg).fill(1);
  let ys: number[] | null = null;
  const wSeg = new Array<number>(nSeg).fill(0);
  let S = 0;
  let Q = 0;
  let clamped = false;
  const slopeStart = new Array<number>(nSeg).fill(0);
  const slopeEnd = new Array<number>(nSeg).fill(0);

  const fail = (): ParabolicState => ({
    H, ys: [def.yL, def.yR], wSeg, slopeStart, slopeEnd,
    S: NaN, Q: NaN, secant, secantClamped: clamped, ok: false,
  });

  if (!Number.isFinite(H) || H <= 0) return fail();

  const passes = gammaSelf === 0 ? 1 : 30;
  for (let iter = 0; iter < passes; iter++) {
    for (let k = 0; k < nSeg; k++) wSeg[k] = wSup[k] + gammaSelf * secant[k];
    ys = nodeElevations(def, H, wSeg);
    if (!ys) return fail();
    S = 0;
    Q = 0;
    let delta = 0;
    for (let k = 0; k < nSeg; k++) {
      const C = (ys[k + 1] - ys[k]) / ell[k] - (wSeg[k] * ell[k]) / (2 * H);
      const seg = segmentIntegrals(ell[k], wSeg[k], H, C);
      if (!Number.isFinite(seg.S) || !Number.isFinite(seg.Q)) return fail();
      slopeStart[k] = C;
      slopeEnd[k] = seg.uEnd;
      S += seg.S;
      Q += seg.Q;
      const raw = seg.S / ell[k];
      const capped = Math.min(SECANT_MAX, Math.max(1, raw));
      if (raw > SECANT_MAX) clamped = true;
      const next = secant[k] + SECANT_RELAX * (capped - secant[k]);
      delta = Math.max(delta, Math.abs(next - secant[k]));
      secant[k] = next;
    }
    if (gammaSelf === 0 || delta < 1e-14) break;
  }

  const ok = !!ys && Number.isFinite(S) && Number.isFinite(Q);
  return {
    H, ys: ys ?? [def.yL, def.yR], wSeg, slopeStart, slopeEnd,
    S, Q, secant, secantClamped: clamped, ok,
  };
}

/** Length the cable makes available at this H (unstressed + elastic + thermal + support give). */
export function availableLength(state: ParabolicState, c: CompatibilityInput): number {
  const elastic = (state.H * state.Q) / c.EA;
  const give = c.compliance * (state.H - c.H_ref);
  return c.L0 * (1 + c.alphaDT) + elastic + give;
}

/** Compatibility residual S(H) − available(H). Strictly decreasing in H. */
export function compatibilityResidual(def: SpanDef, H: number, c: CompatibilityInput): number {
  const st = evaluateParabolic(def, H);
  if (!st.ok) return Number.NaN;
  return st.S - availableLength(st, c);
}

export interface HSolution {
  H: number;
  state: ParabolicState;
  converged: boolean;
  residual: number;
  iterations: number;
}

/** Solve axial compatibility for H. */
export function solveH(def: SpanDef, c: CompatibilityInput): HSolution {
  const totalLoad =
    def.P.reduce((a, b) => a + Math.abs(b), 0) +
    Math.abs(def.gammaSelf) * def.L +
    def.wSup.reduce((a, w, k) => a + Math.abs(w) * (def.xs[k + 1] - def.xs[k]), 0);
  const scale = Math.max(1, totalLoad);
  const lo = 1e-4 * scale;
  const hi = 1e5 * scale;

  const root = brent(H => compatibilityResidual(def, H, c), lo, hi, 1e-10, 250);
  const state = evaluateParabolic(def, root.x);
  return {
    H: root.x,
    state,
    converged: root.converged && state.ok,
    residual: root.f,
    iterations: root.iterations,
  };
}

/** Solve for the H that produces a prescribed maximum sag (used to set up the installed state). */
export function solveHForSag(def: SpanDef, targetSag: number): HSolution {
  const totalLoad =
    def.P.reduce((a, b) => a + Math.abs(b), 0) + Math.abs(def.gammaSelf) * def.L;
  const scale = Math.max(1, totalLoad);
  const f = (H: number) => {
    const st = evaluateParabolic(def, H);
    if (!st.ok) return Number.NaN;
    return maxSagOf(def, st) - targetSag;
  };
  // sag falls monotonically with H, so the residual rises with H
  const root = brent(f, 1e-4 * scale, 1e5 * scale, 1e-12, 250);
  const state = evaluateParabolic(def, root.x);
  return {
    H: root.x,
    state,
    converged: root.converged && state.ok,
    residual: root.f,
    iterations: root.iterations,
  };
}

// ------------------------------------------------------------
// Post-processing
// ------------------------------------------------------------

/** Elevation inside a segment at local abscissa ξ. */
export function yInSegment(state: ParabolicState, k: number, xi: number): number {
  return state.ys[k] + state.slopeStart[k] * xi + (state.wSeg[k] * xi * xi) / (2 * state.H);
}

export function slopeInSegment(state: ParabolicState, k: number, xi: number): number {
  return state.slopeStart[k] + (state.wSeg[k] * xi) / state.H;
}

/**
 * Maximum vertical sag measured below the straight chord between the two
 * supports. Found exactly: within each segment the chord-offset is a parabola,
 * so its extremum is at a closed-form stationary point.
 */
export function maxSagOf(def: SpanDef, state: ParabolicState): number {
  const chordSlope = (def.yR - def.yL) / def.L;
  const chordY = (x: number) => def.yL + chordSlope * x;
  let best = 0;
  const nSeg = def.xs.length - 1;
  for (let k = 0; k < nSeg; k++) {
    const ell = def.xs[k + 1] - def.xs[k];
    const candidates = [0, ell];
    const w = state.wSeg[k];
    if (w !== 0) {
      // d/dξ [chordY − y] = 0  ⇒  ξ* = H(chordSlope − C)/w
      const xi = (state.H * (chordSlope - state.slopeStart[k])) / w;
      if (xi > 0 && xi < ell) candidates.push(xi);
    }
    for (const xi of candidates) {
      const x = def.xs[k] + xi;
      const sag = chordY(x) - yInSegment(state, k, xi);
      if (sag > best) best = sag;
    }
  }
  return best;
}

export function maxSagLocation(def: SpanDef, state: ParabolicState): { sag: number; x: number } {
  const chordSlope = (def.yR - def.yL) / def.L;
  let best = 0;
  let bestX = 0;
  const nSeg = def.xs.length - 1;
  for (let k = 0; k < nSeg; k++) {
    const ell = def.xs[k + 1] - def.xs[k];
    const candidates = [0, ell];
    const w = state.wSeg[k];
    if (w !== 0) {
      const xi = (state.H * (chordSlope - state.slopeStart[k])) / w;
      if (xi > 0 && xi < ell) candidates.push(xi);
    }
    for (const xi of candidates) {
      const x = def.xs[k] + xi;
      const sag = def.yL + chordSlope * x - yInSegment(state, k, xi);
      if (sag > best) { best = sag; bestX = x; }
    }
  }
  return { sag: best, x: bestX };
}

/** Lowest point of the cable (absolute elevation). */
export function lowestPoint(def: SpanDef, state: ParabolicState): { x: number; y: number } {
  let bestY = Infinity;
  let bestX = 0;
  const nSeg = def.xs.length - 1;
  for (let k = 0; k < nSeg; k++) {
    const ell = def.xs[k + 1] - def.xs[k];
    const candidates = [0, ell];
    const w = state.wSeg[k];
    if (w !== 0) {
      const xi = (-state.slopeStart[k] * state.H) / w;   // y' = 0
      if (xi > 0 && xi < ell) candidates.push(xi);
    }
    for (const xi of candidates) {
      const y = yInSegment(state, k, xi);
      if (y < bestY) { bestY = y; bestX = def.xs[k] + xi; }
    }
  }
  return { x: bestX, y: bestY };
}

/** Sample the profile for plotting, with at least one sample at every node. */
export function sampleProfile(
  def: SpanDef,
  state: ParabolicState,
  totalSamples: number,
): { x: number; y: number; slope: number }[] {
  const nSeg = def.xs.length - 1;
  const out: { x: number; y: number; slope: number }[] = [];
  for (let k = 0; k < nSeg; k++) {
    const ell = def.xs[k + 1] - def.xs[k];
    const n = Math.max(4, Math.round((totalSamples * ell) / def.L));
    for (let i = 0; i <= n; i++) {
      if (k > 0 && i === 0) continue;   // avoid duplicating the node
      const xi = (i / n) * ell;
      out.push({
        x: def.xs[k] + xi,
        y: yInSegment(state, k, xi),
        slope: slopeInSegment(state, k, xi),
      });
    }
  }
  return out;
}

/** Straight-line distance between the two supports. */
export function chordLength(def: SpanDef): number {
  const dy = def.yR - def.yL;
  return Math.sqrt(def.L * def.L + dy * dy);
}

/** Exact arc length of a parabolic segment — exposed for the verification suite. */
export function parabolicArc(ell: number, w: number, H: number, C: number): number {
  return segmentIntegrals(ell, w, H, C).S;
}

export { asinh };
