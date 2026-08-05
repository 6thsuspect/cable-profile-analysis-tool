// ============================================================
// Elastic catenary cable — chain of exact elements with point loads
// ------------------------------------------------------------
// One element, unstressed length ℓ₀, self weight w₀ per unit UNSTRESSED
// length, axial rigidity EA, thermal factor τ = 1 + αΔT. With p the
// unstressed arc coordinate, H constant and V(p) = V_i + w₀·p:
//
//     dx/dp = (1 + T/EA + αΔT)·H/T
//     dy/dp = (1 + T/EA + αΔT)·V/T          T = √(H² + V²)
//
// which integrates in closed form to
//
//     Δx = τ·(H/w₀)[asinh(V_j/H) − asinh(V_i/H)] + H·ℓ₀/EA
//     Δy = τ·(T_j − T_i)/w₀        + ℓ₀·(V_i + V_j)/(2·EA)
//
// A cable carrying n point loads is a chain of n+1 such elements. The
// unknowns are H, the vertical force V₀ at the left support, and the
// unstressed length of each element (their sum being the cut length L₀).
// The equations are: the horizontal position of every load must land where
// the user put it, plus closure in x and y. Solved by damped Newton.
//
// No small-sag assumption anywhere — this is the reference model.
// ============================================================
import { asinh, solveDense } from './numeric';
import type { SpanDef } from './parabolic';

const WEPS = 1e-10;

export interface CatenaryInput {
  span: SpanDef;
  EA: number;
  L0: number;
  alphaDT: number;
  compliance: number;
  H_ref: number;
  maxIterations: number;
  tolerance: number;
}

export interface CatenaryElement {
  l0: number;        // unstressed length (m)
  w0: number;        // weight per unstressed metre (kN/m)
  Vi: number;        // vertical tension component at the start (kN)
  Vj: number;        // at the end (kN)
  Ti: number;
  Tj: number;
  dx: number;
  dy: number;
  arc: number;       // deformed length (m)
  x0: number;        // absolute x at the start
  y0: number;        // absolute y at the start
}

export interface CatenaryState {
  H: number;
  V0: number;
  elements: CatenaryElement[];
  arcLength: number;
  converged: boolean;
  iterations: number;
  residual: number;
}

interface ElementGeom {
  dx: number;
  dy: number;
  arc: number;
  Vj: number;
  Ti: number;
  Tj: number;
}

function elementGeometry(
  H: number, Vi: number, l0: number, w0: number, EA: number, tau: number,
): ElementGeom {
  const W = w0 * l0;
  const Vj = Vi + W;
  const Ti = Math.hypot(H, Vi);
  const Tj = Math.hypot(H, Vj);
  if (Math.abs(W) < WEPS * Math.max(1, H)) {
    const T = Math.hypot(H, Vi);
    return {
      dx: (tau * l0 * H) / T + (H * l0) / EA,
      dy: (tau * l0 * Vi) / T + (l0 * Vi) / EA,
      arc: l0 * tau + (T * l0) / EA,
      Vj, Ti, Tj,
    };
  }
  const dx = tau * (H / w0) * (asinh(Vj / H) - asinh(Vi / H)) + (H * l0) / EA;
  const dy = tau * (Tj - Ti) / w0 + (l0 * (Vi + Vj)) / (2 * EA);
  // ∫T dp = (1/2w₀)[ V√(H²+V²) + H²·asinh(V/H) ]
  const intT =
    (1 / (2 * w0)) *
    ((Vj * Tj + H * H * asinh(Vj / H)) - (Vi * Ti + H * H * asinh(Vi / H)));
  const arc = l0 * tau + intT / EA;
  return { dx, dy, arc, Vj, Ti, Tj };
}

/** Weight per unstressed metre of each element, including superimposed UDL. */
function elementWeights(input: CatenaryInput, dxOverL0: number[]): number[] {
  const { span } = input;
  const nSeg = span.xs.length - 1;
  const out: number[] = [];
  for (let k = 0; k < nSeg; k++) {
    // Self weight is already per cable metre; superimposed UDL is per horizontal
    // metre, so it is converted with the element's own dx/dp ratio.
    out.push(span.gammaSelf + span.wSup[k] * (dxOverL0[k] || 1));
  }
  return out;
}

function assemble(
  input: CatenaryInput, z: number[], w0: number[],
): { elements: CatenaryElement[]; residual: number[]; arcLength: number } | null {
  const { span, EA, L0, alphaDT, compliance, H_ref } = input;
  const nSeg = span.xs.length - 1;
  const nInt = nSeg - 1;
  const tau = 1 + alphaDT;

  const H = z[0];
  const V0 = z[1];
  if (!(H > 0)) return null;

  const l0: number[] = [];
  let sum = 0;
  for (let k = 0; k < nSeg - 1; k++) {
    const v = z[2 + k];
    if (!(v > 0)) return null;
    l0.push(v);
    sum += v;
  }
  const last = L0 - sum;
  if (!(last > 0)) return null;
  l0.push(last);

  const elements: CatenaryElement[] = [];
  let Vi = V0;
  let x = 0;
  let y = span.yL;
  let arcTotal = 0;
  for (let k = 0; k < nSeg; k++) {
    const g = elementGeometry(H, Vi, l0[k], w0[k], EA, tau);
    if (!Number.isFinite(g.dx) || !Number.isFinite(g.dy)) return null;
    elements.push({
      l0: l0[k], w0: w0[k], Vi, Vj: g.Vj, Ti: g.Ti, Tj: g.Tj,
      dx: g.dx, dy: g.dy, arc: g.arc, x0: x, y0: y,
    });
    x += g.dx;
    y += g.dy;
    arcTotal += g.arc;
    // a downward point load raises the vertical tension component
    Vi = g.Vj + (k < nInt ? span.P[k] : 0);
  }

  const residual: number[] = [];
  let cx = 0;
  for (let j = 0; j < nInt; j++) {
    cx += elements[j].dx;
    residual.push(cx - span.xs[j + 1]);
  }
  const targetX = span.L + compliance * (H - H_ref);
  residual.push(x - targetX);
  residual.push((y - span.yL) - (span.yR - span.yL));

  return { elements, residual, arcLength: arcTotal };
}

function norm(v: number[]): number {
  return Math.sqrt(v.reduce((a, b) => a + b * b, 0));
}

/**
 * Solve the chain. `guess` supplies H, V0 and the element unstressed lengths
 * (normally taken from the parabolic solution, which is always close).
 */
export function solveElasticCatenary(
  input: CatenaryInput,
  guess: { H: number; V0: number; l0: number[] },
): CatenaryState {
  const { span, L0, maxIterations, tolerance } = input;
  const nSeg = span.xs.length - 1;
  const nUnknown = nSeg + 1;   // H, V0, and (nSeg − 1) free lengths

  let z = [guess.H, guess.V0, ...guess.l0.slice(0, nSeg - 1)];
  let w0 = elementWeights(
    input,
    guess.l0.map((l, k) => (span.xs[k + 1] - span.xs[k]) / Math.max(1e-9, l)),
  );

  type Assembled = { elements: CatenaryElement[]; residual: number[]; arcLength: number };
  let best: Assembled | null = null;
  let iterations = 0;
  let converged = false;

  // Outer pass reconciles the "superimposed UDL per horizontal metre" conversion.
  for (let outer = 0; outer < (span.wSup.some(w => Math.abs(w) > 0) ? 4 : 1); outer++) {
    const seeded = assemble(input, z, w0);
    if (!seeded) break;
    let cur: Assembled = seeded;

    for (let it = 0; it < maxIterations; it++) {
      iterations++;
      const r0 = norm(cur.residual);
      if (r0 < tolerance) { converged = true; break; }

      // numerical Jacobian
      const J: number[][] = Array.from({ length: nUnknown }, () => new Array(nUnknown).fill(0));
      let jacobianOk = true;
      for (let c = 0; c < nUnknown && jacobianOk; c++) {
        const h = Math.max(1e-7, 1e-6 * Math.abs(z[c]));
        const zp = z.slice();
        zp[c] += h;
        const pert = assemble(input, zp, w0);
        if (!pert) { jacobianOk = false; break; }
        for (let r = 0; r < nUnknown; r++) {
          J[r][c] = (pert.residual[r] - cur.residual[r]) / h;
        }
      }
      if (!jacobianOk) break;

      const step = solveDense(J, cur.residual.map(v => -v));
      if (!step) break;

      // damped update, shrinking until the residual falls and the state is legal
      let lambda = 1;
      let accepted: Assembled | null = null;
      for (let t = 0; t < 30; t++) {
        const zTry = z.map((v, i) => v + lambda * step[i]);
        if (zTry[0] > 0) {
          const tryState = assemble(input, zTry, w0);
          if (tryState && norm(tryState.residual) < r0) {
            z = zTry;
            accepted = tryState;
            break;
          }
        }
        lambda *= 0.5;
      }
      if (!accepted) break;
      cur = accepted;
    }

    best = cur;
    // refresh the UDL conversion using the converged element geometry
    const lengths = cur.elements.map(e => e.l0);
    w0 = elementWeights(input, cur.elements.map((e, k) => e.dx / Math.max(1e-9, lengths[k])));
    if (converged) {
      const recheck = assemble(input, z, w0);
      if (recheck) {
        best = recheck;
        converged = norm(recheck.residual) < tolerance * 50;
      }
    }
  }

  if (!best) {
    return {
      H: guess.H, V0: guess.V0, elements: [], arcLength: L0,
      converged: false, iterations, residual: Number.NaN,
    };
  }

  return {
    H: z[0],
    V0: z[1],
    elements: best.elements,
    arcLength: best.arcLength,
    converged,
    iterations,
    residual: norm(best.residual),
  };
}

// ------------------------------------------------------------
// Post-processing
// ------------------------------------------------------------

/** Position, slope and tension at unstressed distance p into element k. */
export function pointInElement(
  state: CatenaryState, k: number, p: number, EA: number, tau: number,
): { x: number; y: number; slope: number; T: number; V: number } {
  const e = state.elements[k];
  const H = state.H;
  const V = e.Vi + e.w0 * p;
  const T = Math.hypot(H, V);
  let dx: number;
  let dy: number;
  if (Math.abs(e.w0 * p) < WEPS * Math.max(1, H)) {
    const T0 = Math.hypot(H, e.Vi);
    dx = (tau * p * H) / T0 + (H * p) / EA;
    dy = (tau * p * e.Vi) / T0 + (p * e.Vi) / EA;
  } else {
    dx = tau * (H / e.w0) * (asinh(V / H) - asinh(e.Vi / H)) + (H * p) / EA;
    dy = tau * (T - e.Ti) / e.w0 + (p * (e.Vi + V)) / (2 * EA);
  }
  return { x: e.x0 + dx, y: e.y0 + dy, slope: V / H, T, V };
}

export function sampleCatenary(
  state: CatenaryState, EA: number, tau: number, totalSamples: number,
): { x: number; y: number; slope: number; T: number; V: number }[] {
  const out: { x: number; y: number; slope: number; T: number; V: number }[] = [];
  const total = state.elements.reduce((a, e) => a + e.l0, 0) || 1;
  state.elements.forEach((e, k) => {
    const n = Math.max(4, Math.round((totalSamples * e.l0) / total));
    for (let i = 0; i <= n; i++) {
      if (k > 0 && i === 0) continue;
      out.push(pointInElement(state, k, (i / n) * e.l0, EA, tau));
    }
  });
  return out;
}

/** Exact stationary points: V = H·target slope. */
function stationaryP(e: CatenaryElement, H: number, targetSlope: number): number | null {
  if (Math.abs(e.w0) < WEPS) return null;
  const p = (H * targetSlope - e.Vi) / e.w0;
  return p > 0 && p < e.l0 ? p : null;
}

export function catenaryMaxSag(
  state: CatenaryState, span: SpanDef, EA: number, tau: number,
): { sag: number; x: number } {
  const chordSlope = (span.yR - span.yL) / span.L;
  let best = 0;
  let bestX = 0;
  state.elements.forEach((e, k) => {
    const ps = [0, e.l0];
    const st = stationaryP(e, state.H, chordSlope);
    if (st !== null) ps.push(st);
    for (const p of ps) {
      const pt = pointInElement(state, k, p, EA, tau);
      const sag = span.yL + chordSlope * pt.x - pt.y;
      if (sag > best) { best = sag; bestX = pt.x; }
    }
  });
  return { sag: best, x: bestX };
}

export function catenaryLowestPoint(
  state: CatenaryState, EA: number, tau: number,
): { x: number; y: number } {
  let bestY = Infinity;
  let bestX = 0;
  state.elements.forEach((e, k) => {
    const ps = [0, e.l0];
    const st = stationaryP(e, state.H, 0);
    if (st !== null) ps.push(st);
    for (const p of ps) {
      const pt = pointInElement(state, k, p, EA, tau);
      if (pt.y < bestY) { bestY = pt.y; bestX = pt.x; }
    }
  });
  return { x: bestX, y: bestY };
}
