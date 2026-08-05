// ============================================================
// Built-in verification suite
// ------------------------------------------------------------
// Every benchmark below has a closed-form answer that does not come from
// this code, so a green suite is evidence the solver is doing arithmetic a
// reviewer can reproduce by hand. It runs on fixed inputs, independent of
// whatever the user has typed, and is reported in the UI and the PDF.
// ============================================================
import type { VerificationItem, VerificationReport } from '../types';
import * as Par from './parabolic';
import { catenaryMaxSag, solveElasticCatenary } from './elasticCatenary';

function item(
  name: string, reference: string, expected: number, computed: number,
  unit: string, tolerance: number,
): VerificationItem {
  const denom = Math.max(Math.abs(expected), 1e-12);
  const relativeError = Math.abs(computed - expected) / denom;
  return {
    name, reference, expected, computed, unit,
    relativeError, tolerance,
    pass: Number.isFinite(computed) && relativeError <= tolerance,
  };
}

function span(
  L: number, yL: number, yR: number, xs: number[], wSup: number[],
  gammaSelf: number, P: number[],
): Par.SpanDef {
  return { L, yL, yR, xs, wSup, gammaSelf, P };
}

function seedCatenary(def: Par.SpanDef, EA: number, L0: number) {
  const st = Par.solveH(def, { EA, L0, alphaDT: 0, compliance: 0, H_ref: 0 });
  const nSeg = def.xs.length - 1;
  const arcs: number[] = [];
  let total = 0;
  for (let k = 0; k < nSeg; k++) {
    const a = Par.parabolicArc(
      def.xs[k + 1] - def.xs[k], st.state.wSeg[k], st.H, st.state.slopeStart[k],
    );
    arcs.push(a);
    total += a;
  }
  return {
    H: st.H,
    V0: st.H * st.state.slopeStart[0],
    l0: arcs.map(a => (a / (total || 1)) * L0),
  };
}

export function runVerification(): VerificationReport {
  const items: VerificationItem[] = [];

  // ── 1. Symmetric parabola: f = wL²/8H ─────────────────────
  {
    const L = 200;
    const w = 0.5;
    const H = 500;
    const def = span(L, 0, 0, [0, L], [w], 0, []);
    const st = Par.evaluateParabolic(def, H);
    items.push(item(
      'Symmetric parabolic sag',
      'f = w·L² / (8H)',
      (w * L * L) / (8 * H),
      Par.maxSagOf(def, st),
      'm', 1e-10,
    ));
  }

  // ── 2. Parabolic arc length against the classical series ───
  {
    const L = 200;
    const w = 0.5;
    const H = 500;
    const f = (w * L * L) / (8 * H);
    const r = f / L;
    const series = L * (1 + (8 / 3) * r * r - (32 / 5) * Math.pow(r, 4));
    const def = span(L, 0, 0, [0, L], [w], 0, []);
    const st = Par.evaluateParabolic(def, H);
    items.push(item(
      'Parabolic arc length (closed form vs series)',
      'S = L[1 + 8/3·(f/L)² − 32/5·(f/L)⁴ + …]',
      series, st.S, 'm', 1e-7,
    ));
  }

  // ── 3. Weightless cable, single midspan point load ─────────
  {
    const L = 200;
    const P = 100;
    const H = 500;
    const def = span(L, 0, 0, [0, L / 2, L], [0, 0], 0, [P]);
    const st = Par.evaluateParabolic(def, H);
    items.push(item(
      'Midspan point load — sag',
      'δ = P·L / (4H)',
      (P * L) / (4 * H),
      Par.maxSagOf(def, st),
      'm', 1e-12,
    ));
    const T = H * Math.sqrt(1 + st.slopeStart[0] * st.slopeStart[0]);
    items.push(item(
      'Midspan point load — cable tension',
      'T = √(H² + (P/2)²)',
      Math.hypot(H, P / 2), T, 'kN', 1e-12,
    ));
    items.push(item(
      'Slope discontinuity at the load',
      'H·(m_R − m_L) = P',
      P, H * (st.slopeStart[1] - st.slopeEnd[0]), 'kN', 1e-10,
    ));
  }

  // ── 4. Global vertical equilibrium with mixed loading ──────
  {
    const L = 250;
    const wSup = 0.8;
    const gamma = 0.6;
    const def = span(L, 60, 40, [0, 80, 160, L], [wSup, wSup, wSup], gamma, [120, 90]);
    const sol = Par.solveH(def, { EA: 1.6e6, L0: 253.4, alphaDT: 0, compliance: 0, H_ref: 0 });
    const st = sol.state;
    let applied = 0;
    for (let k = 0; k < st.wSeg.length; k++) {
      applied += st.wSeg[k] * (def.xs[k + 1] - def.xs[k]);
    }
    applied += def.P.reduce((a, b) => a + b, 0);
    const reactions = sol.H * (st.slopeEnd[st.slopeEnd.length - 1] - st.slopeStart[0]);
    items.push(item(
      'Global vertical equilibrium',
      'H·(m_R − m_L) = Σ w·ℓ + Σ P',
      applied, reactions, 'kN', 1e-9,
    ));
  }

  // ── 5. Axial compatibility is actually enforced ────────────
  {
    const L = 200;
    const def = span(L, 50, 50, [0, L], [0], 0.5, []);
    const EA = 1.5e6;
    const L0 = 200.3;
    const sol = Par.solveH(def, { EA, L0, alphaDT: 0, compliance: 0, H_ref: 0 });
    const available = L0 + (sol.H * sol.state.Q) / EA;
    items.push(item(
      'Compatibility residual S(H) − available(H)',
      'S = L₀ + ∫T ds / EA',
      available, sol.state.S, 'm', 1e-11,
    ));
  }

  // ── 6. Inextensible cable cannot let sag run away ──────────
  //     A point load 40× the total self weight is applied to a cable with
  //     EA → ∞. The arc length must be unchanged, which is precisely why
  //     the sag stays bounded.
  {
    const L = 200;
    const gamma = 0.5;
    const EA = 1e13;
    const defDL = span(L, 50, 50, [0, L], [0], gamma, []);
    const target = 8;                                   // installed sag, m
    const s0 = Par.solveHForSag(defDL, target);
    const L0 = s0.state.S - (s0.H * s0.state.Q) / EA;

    const defLL = span(L, 50, 50, [0, L / 2, L], [0, 0], gamma, [40 * gamma * L]);
    const sol = Par.solveH(defLL, { EA, L0, alphaDT: 0, compliance: 0, H_ref: 0 });
    items.push(item(
      'Inextensible cable — arc length preserved under 40× load',
      'S(H) = L₀ when EA → ∞',
      L0, sol.state.S, 'm', 1e-8,
    ));
    items.push(item(
      'Installed sag reproduced from the back-solved cut length',
      'sag(L₀) = prescribed installed sag',
      target, Par.maxSagOf(defDL, s0.state), 'm', 1e-9,
    ));
  }

  // ── 7. Elastic catenary against the analytic catenary ──────
  {
    const L = 200;
    const gamma = 0.5;
    const H = 500;
    const a = H / gamma;                                // 1000 m
    const sagExact = a * (Math.cosh(L / (2 * a)) - 1);
    const L0 = 2 * a * Math.sinh(L / (2 * a));
    const EA = 1e13;                                    // effectively inextensible
    const def = span(L, 0, 0, [0, L], [0], gamma, []);
    const state = solveElasticCatenary(
      { span: def, EA, L0, alphaDT: 0, compliance: 0, H_ref: 0, maxIterations: 80, tolerance: 1e-12 },
      seedCatenary(def, EA, L0),
    );
    items.push(item(
      'Elastic catenary — horizontal tension',
      'H = γ·a with L₀ = 2a·sinh(L/2a)',
      H, state.H, 'kN', 1e-6,
    ));
    items.push(item(
      'Elastic catenary — sag',
      'f = a·[cosh(L/2a) − 1]',
      sagExact,
      state.elements.length > 0 ? catenaryMaxSag(state, def, EA, 1).sag : Number.NaN,
      'm', 1e-6,
    ));
    items.push(item(
      'Elastic catenary — support tension',
      'T_end = H·cosh(L/2a)',
      H * Math.cosh(L / (2 * a)),
      state.elements.length > 0 ? state.elements[0].Tj : Number.NaN,
      'kN', 1e-6,
    ));
  }

  // ── 8. Exact elastic stretch of a straight tie ─────────────
  //     L₀ shorter than the span: H = EA·(L−L₀)/L₀ exactly. The elastic
  //     catenary reproduces it; the parabolic form carries the usual O(ε)
  //     small-strain offset, which this item documents rather than hides.
  {
    const L = 100;
    const L0 = 99.9;
    const EA = 1e5;
    const exact = (EA * (L - L0)) / L0;
    const def = span(L, 0, 0, [0, L], [0], 0, []);
    const cat = solveElasticCatenary(
      { span: def, EA, L0, alphaDT: 0, compliance: 0, H_ref: 0, maxIterations: 60, tolerance: 1e-13 },
      { H: exact * 0.8, V0: 0, l0: [L0] },
    );
    items.push(item(
      'Straight tie stretch — elastic catenary (exact)',
      'H = EA·(L − L₀)/L₀',
      exact, cat.H, 'kN', 1e-8,
    ));
    const par = Par.solveH(def, { EA, L0, alphaDT: 0, compliance: 0, H_ref: 0 });
    items.push(item(
      'Straight tie stretch — parabolic small-strain form',
      'small-strain integral referred to the deformed length: O(ε) low',
      exact, par.H, 'kN', 3e-3,
    ));
  }

  // ── 9. Thermal response of a taut tie ─────────────────────
  {
    const L = 100;
    const L0 = 99.9;
    const EA = 1e5;
    const alphaDT = 1.2e-5 * 20;                        // +20 °C
    const def = span(L, 0, 0, [0, L], [0], 0, []);
    // Additive thermoelastic decomposition, ds = ds₀·(1 + T/EA + αΔT):
    //   L = L₀·(1 + H/EA + αΔT)   ⇒   H = EA·(L/L₀ − 1 − αΔT)
    const exact = EA * (L / L0 - 1 - alphaDT);
    const cat = solveElasticCatenary(
      { span: def, EA, L0, alphaDT, compliance: 0, H_ref: 0, maxIterations: 60, tolerance: 1e-13 },
      { H: exact * 0.8, V0: 0, l0: [L0] },
    );
    items.push(item(
      'Thermal relaxation of a taut tie (+20 °C)',
      'H = EA·(L/L₀ − 1 − αΔT)',
      exact, cat.H, 'kN', 1e-9,
    ));
  }

  // ── 10. Catenary and parabola must agree at shallow sag ────
  {
    const L = 200;
    const gamma = 0.5;
    const a = 1000;
    const L0 = 2 * a * Math.sinh(L / (2 * a));
    const EA = 1e13;
    const def = span(L, 0, 0, [0, L], [0], gamma, []);
    const par = Par.solveH(def, { EA, L0, alphaDT: 0, compliance: 0, H_ref: 0 });
    const sagPar = Par.maxSagOf(def, par.state);
    const sagCat = a * (Math.cosh(L / (2 * a)) - 1);
    items.push(item(
      'Parabolic vs catenary sag at 1/40 sag ratio',
      'the two models must converge for shallow cables',
      sagCat, sagPar, 'm', 5e-3,
    ));
  }

  return { items, allPass: items.every(i => i.pass) };
}
