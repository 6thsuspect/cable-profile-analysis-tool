// ============================================================
// Cable Profile & Point-Load Analysis — solver orchestration
// ------------------------------------------------------------
// The physical chain is:
//
//   1. installed state    dead load + (target sag | target H | cut length)
//                         → the unstressed length L₀. THIS is the invariant.
//   2. each load case     factored loads + ΔT + support give
//                         → solve axial compatibility for H
//   3. post-processing    tension, stress, sag, clearance, tower & anchor
//                         equilibrium, capacity checks
//   4. searches           break-point λ, launching envelope, stiffness
//
// Because step 2 solves for H instead of accepting it, adding load now
// stiffens the cable: the sag grows only by the elastic stretch of the rope
// and the tension climbs until a real limit state is reached.
// ============================================================
import type {
  AnalysisModel, AnalysisResult, BreakPointReport, CableInput,
  CaseResult, InstalledState, LaunchEnvelopePoint, LaunchReport, LoadCombination,
  PointLoadResult, ProfilePoint, StiffnessReport,
} from '../types';
import { brent, clamp, G, interpolatePolyline, RAD } from './numeric';
import * as Par from './parabolic';
import * as Cat from './elasticCatenary';
import { computeAnchor, computeTower } from './structure';
import {
  buildChecks, buildStiffness, searchBreakPoint, worstCheck,
} from './capacity';
import { runVerification } from './verification';

// ------------------------------------------------------------
// System properties
// ------------------------------------------------------------

interface SystemProps {
  EA: number;              // kN, whole system
  EA_perRope: number;      // kN
  gammaSelf: number;       // kN/m of cable, whole system
  gammaPerRope: number;
  MBL_eff_perRope: number; // kN
  T_allow_perRope: number; // kN
  eta: number;
  compliance: number;      // m/kN (both tower tops together)
}

function systemProps(input: CableInput): SystemProps {
  const { cable } = input;
  const n = Math.max(1, Math.round(cable.nCables));
  const EA_perRope = (cable.section.E * cable.section.Am) / 1000;   // MPa·mm² → kN
  const gammaPerRope = cable.useCatalogWeight
    ? (cable.section.mass * G) / 1000                                // kg/m → kN/m
    : Math.max(0, cable.wSelfOverride);
  const eta = clamp(cable.etaTermination, 0.1, 1) * clamp(cable.etaBend, 0.1, 1);
  const MBL_eff_perRope = cable.section.MBL * eta;
  const k = cable.supportStiffness;
  return {
    EA: EA_perRope * n,
    EA_perRope,
    gammaSelf: gammaPerRope * n,
    gammaPerRope,
    MBL_eff_perRope,
    T_allow_perRope: MBL_eff_perRope / Math.max(1.05, cable.FoS),
    eta,
    compliance: k > 0 ? 2 / k : 0,
  };
}

// ------------------------------------------------------------
// Ground / controlling level below the cable
// ------------------------------------------------------------

interface Terrain {
  polyline: { x: number; y: number }[];
  slopes: number[];
  at: (x: number) => number;         // controlling level (terrain or flood level)
  terrainAt: (x: number) => number;
  /** Range over which clearance is assessed — the actual gap, not the tower bases. */
  zone: { from: number; to: number };
}

function buildTerrain(input: CableInput): Terrain {
  const { site, geometry } = input;
  const L = geometry.L;
  const crestL = clamp(site.crestLeftX, 0, 0.45 * L);
  const crestR = clamp(site.crestRightX, 0.55 * L, L);
  const bedX = clamp(site.bedX, crestL + 0.01 * L, crestR - 0.01 * L);
  const polyline = [
    { x: 0, y: site.bankLeftLevel },
    { x: crestL, y: site.bankLeftLevel },
    { x: bedX, y: site.bedLevel },
    { x: crestR, y: site.bankRightLevel },
    { x: L, y: site.bankRightLevel },
  ];
  const slopes = [
    0,
    (site.bedLevel - site.bankLeftLevel) / Math.max(1e-6, bedX - crestL),
    (site.bankRightLevel - site.bedLevel) / Math.max(1e-6, crestR - bedX),
  ];
  const terrainAt = (x: number) => interpolatePolyline(polyline, x);
  const at = site.hflLevel > 0
    ? (x: number) => Math.max(terrainAt(x), site.hflLevel)
    : terrainAt;
  return { polyline, slopes, at, terrainAt, zone: { from: crestL, to: crestR } };
}

// ------------------------------------------------------------
// Load assembly
// ------------------------------------------------------------

interface AssembledLoads {
  points: { x: number; P: number; label: string; id: string }[];
  uniform: { xStart: number; xEnd: number; w: number }[];
  gammaSelf: number;
  variableTotal: number;
  windSwing: number;
  windAmp: number;
  bogieLoads: number[];
  offSpanWeight: number;
  /** Where the launched unit actually sits on the span, if anywhere. */
  footprint: { from: number; to: number } | null;
}

function bogiePattern(input: CableInput, front: number) {
  const lc = input.launching;
  const n = Math.max(1, Math.min(6, Math.round(lc.nBogies)));
  const spacing = lc.bogieSpacing > 0
    ? lc.bogieSpacing
    : n > 1 ? lc.girderLength / (n - 1) : lc.girderLength;
  const frontShare = clamp(lc.frontShare, 0.05, 0.95);
  const rest = n > 1 ? (1 - frontShare) / (n - 1) : 0;
  const xs: number[] = [];
  const loads: number[] = [];
  for (let i = 0; i < n; i++) {
    xs.push(front - i * spacing);
    loads.push(lc.totalWeight * (i === 0 ? (n > 1 ? frontShare : 1) : rest));
  }
  return { xs, loads, spacing };
}

interface AssembleOptions {
  lambda: number;                       // multiplier on variable load
  launchFront?: number;                 // override the launching position
  extraPoints?: { x: number; P: number; label: string }[];
  syntheticProbe?: { x: number; P: number };  // used when there is no real variable load
}

function assembleLoads(
  input: CableInput,
  sys: SystemProps,
  comb: LoadCombination,
  opts: AssembleOptions,
): AssembledLoads {
  const L = input.geometry.L;
  const margin = Math.max(1e-4, 0.0005 * L);
  const gLL = comb.gLL * opts.lambda;
  const daf = comb.useDAF ? Math.max(1, input.launching.DAF) : 1;

  // ---- variable vertical load, before the wind amplification
  const raw: { x: number; P: number; label: string; id: string }[] = [];
  let bogieLoads: number[] = [];
  let offSpanWeight = 0;
  let footprint: { from: number; to: number } | null = null;

  for (const pl of input.pointLoads) {
    if (pl.P === 0) continue;
    raw.push({
      x: clamp(pl.x, margin, L - margin),
      P: pl.P,
      label: pl.label || pl.id,
      id: pl.id,
    });
  }

  if (input.launching.enabled && input.launching.totalWeight > 0) {
    const front = opts.launchFront ?? input.launching.frontPosition;
    const pat = bogiePattern(input, front);
    bogieLoads = pat.loads;
    pat.xs.forEach((x, i) => {
      if (x > margin && x < L - margin) {
        raw.push({ x, P: pat.loads[i], label: `B${i + 1}`, id: `bogie-${i}` });
      } else {
        offSpanWeight += pat.loads[i];
      }
    });
    // The unit trails behind its leading bogie, so only that stretch of the
    // span actually has something hanging under the cable.
    const from = Math.max(0, front - input.launching.girderLength);
    const to = Math.min(L, front);
    if (to - from > 1e-6 && gLL > 0) footprint = { from, to };
  }

  for (const ex of opts.extraPoints ?? []) {
    raw.push({ x: clamp(ex.x, margin, L - margin), P: ex.P, label: ex.label, id: ex.label });
  }

  if (opts.syntheticProbe) {
    raw.push({
      x: clamp(opts.syntheticProbe.x, margin, L - margin),
      P: opts.syntheticProbe.P,
      label: 'Pλ',
      id: 'probe-lambda',
    });
  }

  const verticalVariable = raw.reduce((a, b) => a + b.P, 0) * gLL * daf;

  // ---- advisory lateral wind: the cable carries the resultant of W and F_lat
  let windSwing = 0;
  let windAmp = 1;
  if (comb.wind && input.wind.enabled && verticalVariable > 1e-9) {
    const area = Math.max(0, input.wind.girderHeight) * Math.max(0, input.launching.girderLength);
    const Flat = input.wind.pressure * Math.max(0, input.wind.dragCoefficient) * area;
    if (Flat > 0) {
      windSwing = Math.atan(Flat / verticalVariable);
      windAmp = 1 / Math.cos(windSwing);
    }
  }

  const factor = gLL * daf * windAmp;
  const points = raw.map(p => ({ ...p, P: p.P * factor }));

  const uniform = input.uniformLoads
    .filter(u => u.w !== 0 && u.xEnd > u.xStart)
    .map(u => ({
      xStart: clamp(u.xStart, 0, L),
      xEnd: clamp(u.xEnd, 0, L),
      w: u.w * comb.gDL,
    }));

  const gammaSelf = sys.gammaSelf * comb.gDL;

  return {
    points,
    uniform,
    gammaSelf,
    variableTotal: points.reduce((a, p) => a + p.P, 0),
    windSwing: windSwing * RAD,
    windAmp,
    bogieLoads,
    offSpanWeight,
    footprint,
  };
}

// ------------------------------------------------------------
// Span discretisation
// ------------------------------------------------------------

interface BuiltSpan {
  def: Par.SpanDef;
  /** Point loads attached to each interior node, for reporting. */
  nodeLabels: string[][];
  nodeLoads: { x: number; P: number; label: string; id: string }[][];
}

function buildSpan(input: CableInput, loads: AssembledLoads): BuiltSpan {
  const { L, yL, yR } = input.geometry;
  const eps = Math.max(1e-9, 1e-7 * L);

  const breaks = new Set<number>([0, L]);
  for (const p of loads.points) breaks.add(p.x);
  for (const u of loads.uniform) { breaks.add(u.xStart); breaks.add(u.xEnd); }

  const sorted = [...breaks].filter(x => x >= 0 && x <= L).sort((a, b) => a - b);
  const xs: number[] = [];
  for (const x of sorted) {
    if (xs.length === 0 || x - xs[xs.length - 1] > eps) xs.push(x);
  }
  if (xs[0] !== 0) xs.unshift(0);
  if (xs[xs.length - 1] !== L) xs.push(L);

  const nSeg = xs.length - 1;
  const wSup = new Array<number>(nSeg).fill(0);
  for (let k = 0; k < nSeg; k++) {
    const mid = 0.5 * (xs[k] + xs[k + 1]);
    for (const u of loads.uniform) {
      if (mid >= u.xStart && mid <= u.xEnd) wSup[k] += u.w;
    }
  }

  const nInt = Math.max(0, nSeg - 1);
  const P = new Array<number>(nInt).fill(0);
  const nodeLabels: string[][] = Array.from({ length: nInt }, () => []);
  const nodeLoads: BuiltSpan['nodeLoads'] = Array.from({ length: nInt }, () => []);
  for (const p of loads.points) {
    let best = -1;
    let bestD = Infinity;
    for (let j = 0; j < nInt; j++) {
      const d = Math.abs(xs[j + 1] - p.x);
      if (d < bestD) { bestD = d; best = j; }
    }
    if (best >= 0) {
      P[best] += p.P;
      nodeLabels[best].push(p.label);
      nodeLoads[best].push(p);
    }
  }

  return {
    def: { L, yL, yR, xs, wSup, gammaSelf: loads.gammaSelf, P },
    nodeLabels,
    nodeLoads,
  };
}

// ------------------------------------------------------------
// Unified solution across the two models
// ------------------------------------------------------------

interface Solution {
  ok: boolean;
  model: AnalysisModel;
  H: number;
  iterations: number;
  residual: number;
  samples: { x: number; y: number; slope: number; T: number; V: number }[];
  slopeSegStart: number[];
  slopeSegEnd: number[];
  nodeY: number[];
  arcLength: number;
  elasticElongation: number;
  maxSag: number;
  maxSagX: number;
  lowest: { x: number; y: number };
  clearanceCandidates: number[];
  fellBack: boolean;
  secantClamped: boolean;
  /** Total vertical load actually applied by the distributed terms (kN). */
  appliedDistributed: number;
}

function catenaryGuess(def: Par.SpanDef, state: Par.ParabolicState, L0: number) {
  const nSeg = def.xs.length - 1;
  const arcs: number[] = [];
  let total = 0;
  for (let k = 0; k < nSeg; k++) {
    const ell = def.xs[k + 1] - def.xs[k];
    const a = Par.parabolicArc(ell, state.wSeg[k], state.H, state.slopeStart[k]);
    arcs.push(a);
    total += a;
  }
  return {
    H: state.H,
    V0: state.H * state.slopeStart[0],
    l0: arcs.map(a => (a / (total || 1)) * L0),
  };
}

function solveParabolicSolution(
  def: Par.SpanDef, compat: Par.CompatibilityInput, samples: number, groundSlopes: number[],
  fixedH?: number,
): Solution {
  const sol = fixedH !== undefined
    ? { H: fixedH, state: Par.evaluateParabolic(def, fixedH), converged: true, residual: 0, iterations: 0 }
    : Par.solveH(def, compat);
  const st = sol.state;
  if (!st.ok) {
    return {
      ok: false, model: 'PARABOLIC_HORIZONTAL_LOAD', H: sol.H, iterations: sol.iterations,
      residual: sol.residual, samples: [], slopeSegStart: [], slopeSegEnd: [], nodeY: [],
      arcLength: 0, elasticElongation: 0, maxSag: 0, maxSagX: 0, lowest: { x: 0, y: 0 },
      clearanceCandidates: [], fellBack: false, secantClamped: st.secantClamped,
      appliedDistributed: 0,
    };
  }
  const raw = Par.sampleProfile(def, st, samples);
  const sag = Par.maxSagLocation(def, st);
  const nSeg = def.xs.length - 1;

  const candidates: number[] = [];
  for (let k = 0; k < nSeg; k++) {
    const ell = def.xs[k + 1] - def.xs[k];
    if (Math.abs(st.wSeg[k]) < 1e-12) continue;
    for (const s of groundSlopes) {
      const xi = (st.H * (s - st.slopeStart[k])) / st.wSeg[k];
      if (xi > 0 && xi < ell) candidates.push(def.xs[k] + xi);
    }
  }

  return {
    ok: true,
    model: 'PARABOLIC_HORIZONTAL_LOAD',
    H: sol.H,
    iterations: sol.iterations,
    residual: sol.residual,
    samples: raw.map(p => ({
      x: p.x, y: p.y, slope: p.slope,
      T: sol.H * Math.sqrt(1 + p.slope * p.slope),
      V: sol.H * p.slope,
    })),
    slopeSegStart: st.slopeStart,
    slopeSegEnd: st.slopeEnd,
    nodeY: st.ys,
    arcLength: st.S,
    elasticElongation: (sol.H * st.Q) / compat.EA,
    maxSag: sag.sag,
    maxSagX: sag.x,
    lowest: Par.lowestPoint(def, st),
    clearanceCandidates: candidates,
    fellBack: false,
    secantClamped: st.secantClamped,
    // Σ w_k·ℓ_k — equals the superimposed UDL plus γ × the deformed arc length,
    // which is the load the cable is genuinely carrying.
    appliedDistributed: st.wSeg.reduce(
      (a, w, k) => a + w * (def.xs[k + 1] - def.xs[k]), 0,
    ),
  };
}

function solveCatenarySolution(
  def: Par.SpanDef, compat: Par.CompatibilityInput, samples: number, groundSlopes: number[],
  maxIterations: number, tolerance: number,
): Solution {
  // The parabolic answer is always a good seed for the Newton iteration.
  const seed = Par.solveH(def, compat);
  const guess = catenaryGuess(def, seed.state, compat.L0);
  const state = Cat.solveElasticCatenary(
    {
      span: def, EA: compat.EA, L0: compat.L0, alphaDT: compat.alphaDT,
      compliance: compat.compliance, H_ref: compat.H_ref,
      maxIterations, tolerance: Math.max(1e-9, tolerance * Math.max(1, def.L)),
    },
    guess,
  );
  if (!state.converged || state.elements.length === 0) {
    const fb = solveParabolicSolution(def, compat, samples, groundSlopes);
    return { ...fb, model: 'CATENARY_SELF_WEIGHT', fellBack: true };
  }

  const tau = 1 + compat.alphaDT;
  const raw = Cat.sampleCatenary(state, compat.EA, tau, samples);
  const sag = Cat.catenaryMaxSag(state, def, compat.EA, tau);

  const candidates: number[] = [];
  state.elements.forEach((e, k) => {
    if (Math.abs(e.w0) < 1e-12) return;
    for (const s of groundSlopes) {
      const p = (state.H * s - e.Vi) / e.w0;
      if (p > 0 && p < e.l0) candidates.push(Cat.pointInElement(state, k, p, compat.EA, tau).x);
    }
  });

  return {
    ok: true,
    model: 'CATENARY_SELF_WEIGHT',
    H: state.H,
    iterations: state.iterations,
    residual: state.residual,
    samples: raw,
    slopeSegStart: state.elements.map(e => e.Vi / state.H),
    slopeSegEnd: state.elements.map(e => e.Vj / state.H),
    nodeY: [...state.elements.map(e => e.y0), def.yR],
    arcLength: state.arcLength,
    elasticElongation: state.arcLength - compat.L0 * tau,
    maxSag: sag.sag,
    maxSagX: sag.x,
    lowest: Cat.catenaryLowestPoint(state, compat.EA, tau),
    clearanceCandidates: candidates,
    fellBack: false,
    secantClamped: false,
    appliedDistributed: state.elements.reduce((a, e) => a + e.w0 * e.l0, 0),
  };
}

function solveSpan(
  model: AnalysisModel,
  def: Par.SpanDef,
  compat: Par.CompatibilityInput,
  input: CableInput,
  groundSlopes: number[],
  samples: number,
  fixedH?: number,
): Solution {
  if (model === 'CATENARY_SELF_WEIGHT' && fixedH === undefined) {
    return solveCatenarySolution(
      def, compat, samples, groundSlopes,
      input.options.maxIterations, input.options.tolerance,
    );
  }
  return solveParabolicSolution(def, compat, samples, groundSlopes, fixedH);
}

// ------------------------------------------------------------
// Installed state
// ------------------------------------------------------------

interface SolverContext {
  input: CableInput;
  sys: SystemProps;
  terrain: Terrain;
  installed: InstalledState;
  installedSamples: { x: number; y: number }[];
  L0: number;
  H_ref: number;
  warnings: string[];
  legacyFixedH: boolean;
}

function deadLoadCombination(): LoadCombination {
  return {
    id: 'INSTALL', label: 'Installed (dead load)', gDL: 1, gLL: 0,
    useDAF: false, dT: 0, wind: false, limitState: 'INSTALL', enabled: true,
  };
}

function buildInstalledState(
  input: CableInput, sys: SystemProps, terrain: Terrain, warnings: string[],
): { installed: InstalledState; L0: number; H_ref: number } {
  const { options } = input;
  const loads = assembleLoads(input, sys, deadLoadCombination(), { lambda: 0 });
  const built = buildSpan(input, loads);
  const def = built.def;
  const model = options.model;

  const compatWith = (L0: number, H_ref: number): Par.CompatibilityInput => ({
    EA: sys.EA, L0, alphaDT: 0, compliance: sys.compliance, H_ref,
  });

  // --- 1. establish H0 and L0 in the parabolic sense (always cheap & robust)
  let H0_par: number;
  switch (options.stateControl) {
    case 'INSTALLED_SAG': {
      const target = Math.max(1e-4, options.installedSag);
      const s = Par.solveHForSag(def, target);
      if (!s.converged) warnings.push('Could not match the specified installed sag; check the geometry and self weight.');
      H0_par = s.H;
      break;
    }
    case 'INSTALLED_H':
      H0_par = Math.max(1e-3, options.installedH);
      break;
    case 'RIGID_FIXED_H':
      H0_par = Math.max(1e-3, input.H_input);
      break;
    case 'UNSTRESSED_LENGTH':
    default: {
      const L0 = Math.max(Par.chordLength(def) * 0.5, options.unstressedLength);
      const s = Par.solveH(def, compatWith(L0, 0));
      H0_par = s.H;
      break;
    }
  }

  const st0 = Par.evaluateParabolic(def, H0_par);
  let L0 = options.stateControl === 'UNSTRESSED_LENGTH'
    ? Math.max(Par.chordLength(def) * 0.5, options.unstressedLength)
    : st0.S - (H0_par * st0.Q) / sys.EA;

  // --- 2. if the catenary model is selected, refine L0 so the TARGET is met
  //        with the catenary shape rather than the parabolic approximation
  let H0 = H0_par;
  if (model === 'CATENARY_SELF_WEIGHT') {
    const chord = Par.chordLength(def);
    const solveAt = (L0try: number) =>
      solveCatenarySolution(def, compatWith(L0try, H0_par), 48, terrain.slopes,
        input.options.maxIterations, input.options.tolerance);

    if (options.stateControl === 'INSTALLED_SAG') {
      const target = Math.max(1e-4, options.installedSag);
      const r = brent(l => {
        const s = solveAt(l);
        return s.ok ? s.maxSag - target : Number.NaN;
      }, chord * 1.0000001, Math.max(chord * 1.02, L0 * 1.5), 1e-9, 80);
      if (r.converged) L0 = r.x;
    } else if (options.stateControl === 'INSTALLED_H' || options.stateControl === 'RIGID_FIXED_H') {
      const targetH = H0_par;
      const r = brent(l => {
        const s = solveAt(l);
        return s.ok ? targetH - s.H : Number.NaN;   // H falls as L0 grows
      }, chord * 1.0000001, Math.max(chord * 1.02, L0 * 1.5), 1e-9, 80);
      if (r.converged) L0 = r.x;
    }
    const fin = solveAt(L0);
    if (fin.ok) H0 = fin.H;
  }

  const compat = compatWith(L0, H0);
  const sol = solveSpan(
    model, def, compat, input, terrain.slopes, input.options.diagramSamples,
    options.stateControl === 'RIGID_FIXED_H' ? H0 : undefined,
  );

  const T0 = sol.samples.reduce((a, p) => Math.max(a, p.T), 0);
  const perRope0 = (T0 * Math.max(1, input.cable.shareFactor)) / Math.max(1, input.cable.nCables);
  const stress0 = (perRope0 * 1000) / input.cable.section.Am;

  if (model === 'CATENARY_SELF_WEIGHT' && options.stateControl === 'RIGID_FIXED_H') {
    warnings.push(
      'Rigid prescribed-H mode imposes H directly, which the catenary chain cannot honour ' +
      '(it solves for H from the cut length). The parabolic shape is used for every case ' +
      'in this combination of settings.',
    );
  }

  const installed: InstalledState = {
    H0: sol.H,
    sag0: sol.maxSag,
    L0,
    arcLength0: sol.arcLength,
    elasticElongation0: sol.elasticElongation,
    strain0: stress0 / input.cable.section.E,
    stress0,
    wSelf: sys.gammaSelf * (sol.arcLength / Math.max(1e-9, input.geometry.L)),
    gammaSelf: sys.gammaSelf,
    profile: toProfilePoints(sol, terrain),
    cuttingLength: L0,
    derivedFrom: options.stateControl,
  };

  return { installed, L0, H_ref: sol.H };
}

// ------------------------------------------------------------
// Post-processing helpers
// ------------------------------------------------------------

function toProfilePoints(sol: Solution, terrain: Terrain): ProfilePoint[] {
  return sol.samples.map(p => {
    const ground = terrain.at(p.x);
    return {
      x: p.x, y: p.y, slope: p.slope, theta: Math.atan(p.slope),
      T: p.T, V: p.V, ground, clearance: p.y - ground,
    };
  });
}

function yAt(samples: { x: number; y: number }[], x: number): number {
  return interpolatePolyline(samples, x);
}

/**
 * Clearance is assessed over the actual gap (crest to crest), not at the tower
 * bases where "clearance" is only the tower height. The hang depth of the
 * launched unit is deducted only over the stretch the unit occupies.
 */
function minClearanceOf(
  sol: Solution,
  terrain: Terrain,
  hangDepth: number,
  footprint: { from: number; to: number } | null,
) {
  const { from, to } = terrain.zone;
  let bestNet = Infinity;
  let bestNetX = from;
  let bestCable = Infinity;
  const deduct = (x: number) =>
    footprint && hangDepth > 0 && x >= footprint.from - 1e-9 && x <= footprint.to + 1e-9
      ? hangDepth
      : 0;
  const consider = (x: number, y: number) => {
    if (x < from - 1e-9 || x > to + 1e-9) return;
    const cable = y - terrain.at(x);
    if (cable < bestCable) bestCable = cable;
    const net = cable - deduct(x);
    if (net < bestNet) { bestNet = net; bestNetX = x; }
  };
  for (const p of sol.samples) consider(p.x, p.y);
  for (const x of sol.clearanceCandidates) consider(x, yAt(sol.samples, x));
  // the ends of the assessed zone and of the unit footprint are candidates too
  for (const x of [from, to, footprint?.from, footprint?.to]) {
    if (x !== undefined) consider(x, yAt(sol.samples, x));
  }
  return {
    clearance: Number.isFinite(bestNet) ? bestNet : 0,
    x: bestNetX,
    cableClearance: Number.isFinite(bestCable) ? bestCable : 0,
  };
}

// ------------------------------------------------------------
// One load case
// ------------------------------------------------------------

interface CaseRequest {
  combination: LoadCombination;
  lambda?: number;
  launchFront?: number;
  extraPoints?: { x: number; P: number; label: string }[];
  syntheticProbe?: { x: number; P: number };
  samples?: number;
  model?: AnalysisModel;
}

function runCase(ctx: SolverContext, req: CaseRequest): CaseResult | null {
  const { input, sys, terrain } = ctx;
  const comb = req.combination;
  const loads = assembleLoads(input, sys, comb, {
    lambda: req.lambda ?? 1,
    launchFront: req.launchFront,
    extraPoints: req.extraPoints,
    syntheticProbe: req.syntheticProbe,
  });
  const built = buildSpan(input, loads);
  const def = built.def;
  const model = req.model ?? input.options.model;
  const samples = req.samples ?? input.options.diagramSamples;

  const compat: Par.CompatibilityInput = {
    EA: sys.EA,
    L0: ctx.L0,
    alphaDT: input.cable.alphaT * comb.dT,
    compliance: sys.compliance,
    H_ref: ctx.H_ref,
  };

  const sol = solveSpan(
    model, def, compat, input, terrain.slopes, samples,
    ctx.legacyFixedH ? Math.max(1e-3, input.H_input) : undefined,
  );
  if (!sol.ok) return null;

  const warnings: string[] = [];
  const steps: string[] = [];
  if (sol.fellBack) {
    warnings.push(
      `${comb.label}: the elastic-catenary Newton solve did not converge; ` +
      'the parabolic result is reported for this case.',
    );
  }

  const L = input.geometry.L;
  const nSeg = def.xs.length - 1;
  const slopeLeft = sol.slopeSegStart[0];
  const slopeRight = sol.slopeSegEnd[nSeg - 1];

  // ---- tension
  let T_max = 0;
  let T_maxX = 0;
  for (const p of sol.samples) {
    if (p.T > T_max) { T_max = p.T; T_maxX = p.x; }
  }
  const nRopes = Math.max(1, Math.round(input.cable.nCables));
  const share = Math.max(1, input.cable.shareFactor);
  const T_perRope = (T_max * share) / nRopes;
  const stress = (T_perRope * 1000) / input.cable.section.Am;
  const strain = stress / input.cable.section.E;
  const utilizationMBL = T_perRope / Math.max(1e-9, sys.MBL_eff_perRope);

  const T_maxDescription =
    T_maxX < 1e-6 ? 'At the left saddle (Tower A)'
      : Math.abs(T_maxX - L) < 1e-6 ? 'At the right saddle (Tower B)'
        : `At x = ${T_maxX.toFixed(2)} m`;

  // ---- towers, backstays, anchors
  const leftTower = computeTower('left', sol.H, slopeLeft, input.geometry, input.towers, warnings);
  const rightTower = computeTower('right', sol.H, slopeRight, input.geometry, input.towers, warnings);
  const leftAnchor = computeAnchor(leftTower, input.anchors);
  const rightAnchor = computeAnchor(rightTower, input.anchors);
  const T_backstayPerRope =
    (Math.max(leftTower.T_backstay, rightTower.T_backstay) * share) / nRopes;

  // ---- point-load results
  const pointLoadResults: PointLoadResult[] = [];
  for (let j = 0; j < built.nodeLoads.length; j++) {
    if (built.nodeLoads[j].length === 0) continue;
    const x = def.xs[j + 1];
    const Ptot = def.P[j];
    const mL = sol.slopeSegEnd[j];
    const mR = sol.slopeSegStart[j + 1];
    const eq = sol.H * (mR - mL);
    const yp = sol.nodeY[j + 1];
    pointLoadResults.push({
      load: {
        id: built.nodeLoads[j].map(l => l.id).join('+'),
        x,
        P: Ptot,
        label: built.nodeLabels[j].join('+'),
      },
      yp,
      slopeLeft: mL,
      slopeRight: mR,
      thetaLeft: Math.atan(mL),
      thetaRight: Math.atan(mR),
      T_left: sol.H * Math.sqrt(1 + mL * mL),
      T_right: sol.H * Math.sqrt(1 + mR * mR),
      slopeDiscontinuity: mR - mL,
      equilibriumCheck: eq,
      equilibriumError: Math.abs(eq - Ptot),
      deflectionFromInstalled: yAt(ctx.installedSamples, x) - yp,
    });
  }

  // ---- clearance
  const suspended = loads.variableTotal > 1e-6 && input.launching.enabled;
  const hangDepth = suspended ? Math.max(0, input.launching.hangDepth) : 0;
  const clr = minClearanceOf(sol, terrain, hangDepth, loads.footprint);

  // ---- checks
  const checks = buildChecks(input, {
    T_perRope,
    T_backstayPerRope,
    stress,
    towers: [leftTower, rightTower],
    anchors: [leftAnchor, rightAnchor],
    minClearance: clr.clearance,
    cableClearance: clr.cableClearance,
    hangDepth,
    footprint: loads.footprint,
    sagRatio: sol.maxSag / L,
    limitState: comb.limitState,
    model,
  });

  // ---- narrative
  const thermal = ctx.L0 * input.cable.alphaT * comb.dT;
  const give = sys.compliance * (sol.H - ctx.H_ref);
  const totalDown = sol.appliedDistributed + loads.variableTotal;
  const reactionSum = sol.H * (slopeRight - slopeLeft);

  steps.push(`── ${comb.label} ──`);
  steps.push(`Factors: γ_DL = ${comb.gDL.toFixed(2)}, γ_LL = ${comb.gLL.toFixed(2)}` +
    `${comb.useDAF ? `, DAF = ${input.launching.DAF.toFixed(2)}` : ''}` +
    `, ΔT = ${comb.dT.toFixed(1)} °C${comb.wind ? ', wind included' : ''}`);
  steps.push(`Model: ${model === 'PARABOLIC_HORIZONTAL_LOAD' ? 'elastic parabolic (segmental)' : 'elastic catenary (exact)'}`);
  if (ctx.legacyFixedH) {
    steps.push(`H PRESCRIBED = ${sol.H.toFixed(2)} kN (rigid mode — axial compatibility NOT enforced)`);
  } else {
    steps.push(`Axial compatibility solved: S = ${sol.arcLength.toFixed(5)} m must equal ` +
      `L₀(1+αΔT) + ∫T ds/EA + δ_support`);
    steps.push(`  L₀ = ${ctx.L0.toFixed(5)} m, thermal = ${(thermal * 1000).toFixed(2)} mm, ` +
      `elastic = ${(sol.elasticElongation * 1000).toFixed(2)} mm, support give = ${(give * 1000).toFixed(2)} mm`);
    steps.push(`  → H = ${sol.H.toFixed(3)} kN (residual ${sol.residual.toExponential(2)} m, ${sol.iterations} iterations)`);
  }
  steps.push(`Self weight γ = ${loads.gammaSelf.toFixed(4)} kN/m of cable over ${nSeg} segment(s)`);
  steps.push(`Dead load on the span = ${sol.appliedDistributed.toFixed(2)} kN ` +
    `(γ × arc length ${sol.arcLength.toFixed(3)} m + superimposed UDL), ` +
    `variable = ${loads.variableTotal.toFixed(2)} kN`);
  if (loads.offSpanWeight > 0) {
    steps.push(`Launched unit: ${loads.offSpanWeight.toFixed(2)} kN is still carried by the banks (bogies off the span)`);
  }
  if (loads.windAmp > 1) {
    steps.push(`Wind: swing angle ${loads.windSwing.toFixed(2)}°, in-plane load amplified ×${loads.windAmp.toFixed(4)}`);
  }
  steps.push(`Sag = ${sol.maxSag.toFixed(4)} m at x = ${sol.maxSagX.toFixed(2)} m (1/${(L / Math.max(1e-9, sol.maxSag)).toFixed(1)} of the span)`);
  steps.push(`Sag growth from the installed profile = ${((sol.maxSag - ctx.installed.sag0) * 1000).toFixed(1)} mm`);
  steps.push(`T_max = ${T_max.toFixed(2)} kN system → ${T_perRope.toFixed(2)} kN per rope ` +
    `(σ = ${stress.toFixed(1)} MPa, ε = ${(strain * 1e6).toFixed(0)} µε)`);
  steps.push(`Rope utilisation vs MBL·η = ${(utilizationMBL * 100).toFixed(1)} %, actual FoS = ${(1 / Math.max(1e-9, utilizationMBL)).toFixed(2)}`);
  steps.push(`Vertical equilibrium: H·(m_R − m_L) = ${reactionSum.toFixed(3)} kN vs total applied ` +
    `${totalDown.toFixed(3)} kN (error ${Math.abs(reactionSum - totalDown).toExponential(2)} kN)`);
  for (const plr of pointLoadResults) {
    steps.push(`  ${plr.load.label} @ x=${plr.load.x.toFixed(2)} m: H·Δm = ${plr.equilibriumCheck.toFixed(3)} kN ` +
      `vs P = ${plr.load.P.toFixed(3)} kN (err ${plr.equilibriumError.toExponential(2)}), ` +
      `dip below the installed profile = ${(plr.deflectionFromInstalled * 1000).toFixed(1)} mm`);
  }
  steps.push(`Clearance: cable ${clr.cableClearance.toFixed(3)} m, governing ` +
    `${clr.clearance.toFixed(3)} m at x = ${clr.x.toFixed(2)} m ` +
    `(assessed over x = ${terrain.zone.from.toFixed(1)}…${terrain.zone.to.toFixed(1)} m)`);
  if (sol.secantClamped) {
    warnings.push(
      `${comb.label}: the sag is so large that the "load per horizontal metre" ` +
      'idealisation had to be capped. Switch to the elastic catenary model — the ' +
      'parabolic result here is not reliable.',
    );
  }

  if (Math.abs(reactionSum - totalDown) > 1e-4 * Math.max(1, totalDown)) {
    warnings.push(`${comb.label}: global vertical equilibrium error ${Math.abs(reactionSum - totalDown).toExponential(2)} kN — treat the result with caution.`);
  }

  const governing = worstCheck(checks);

  return {
    id: comb.id,
    label: comb.label,
    combination: comb,
    converged: !sol.fellBack,
    iterations: sol.iterations,
    residual: sol.residual,
    H: sol.H,
    model,
    profile: toProfilePoints(sol, terrain),
    slopeLeft,
    slopeRight,
    thetaLeft: Math.atan(slopeLeft),
    thetaRight: Math.atan(slopeRight),
    pointLoadResults,
    leftTower,
    rightTower,
    leftAnchor,
    rightAnchor,
    maxSag: sol.maxSag,
    maxSagX: sol.maxSagX,
    sagRatio: sol.maxSag / L,
    lowestPointY: sol.lowest.y,
    lowestPointX: sol.lowest.x,
    arcLength: sol.arcLength,
    elasticElongation: sol.elasticElongation,
    thermalElongation: thermal,
    supportGive: give,
    T_max,
    T_maxX,
    T_maxDescription,
    T_perRope,
    stress,
    strain,
    utilizationMBL,
    FoS_actual: sys.MBL_eff_perRope / Math.max(1e-9, T_perRope),
    minClearance: clr.clearance,
    minClearanceX: clr.x,
    minCableClearance: clr.cableClearance,
    unitFootprint: loads.footprint,
    windSwingAngle: loads.windSwing,
    windAmplification: loads.windAmp,
    checks,
    governingCheck: governing,
    worstUtilization: governing ? governing.utilization : 0,
    totalVariableLoad: loads.variableTotal,
    totalDeadLoad: sol.appliedDistributed,
    warnings,
    calculationSteps: steps,
  };
}

// ------------------------------------------------------------
// Launching envelope
// ------------------------------------------------------------

function runLaunchEnvelope(ctx: SolverContext, comb: LoadCombination): LaunchReport {
  const lc = ctx.input.launching;
  if (!lc.enabled || lc.totalWeight <= 0) {
    return {
      available: false, points: [], worstTension: null, worstSag: null,
      worstClearance: null, totalBogieLoad: 0, bogieLoads: [],
      note: 'Enable the launching module to sweep the girder across the crossing.',
      feasible: true, blockingReason: '',
    };
  }
  const L = ctx.input.geometry.L;
  const pat = bogiePattern(ctx.input, 0);
  const steps = clamp(Math.round(lc.sweepSteps), 5, 200);
  const travel = L + (pat.xs.length - 1) * pat.spacing;

  const points: LaunchEnvelopePoint[] = [];
  let blockingReason = '';
  for (let i = 0; i <= steps; i++) {
    const front = (i / steps) * travel;
    const c = runCase(ctx, { combination: comb, launchFront: front, samples: 60 });
    if (!c) {
      points.push({
        frontPosition: front, H: 0, T_max: 0, T_perRope: 0, maxSag: 0,
        minClearance: 0, towerA_R: 0, towerB_R: 0, utilization: 0,
        bogieX: [], bogieY: [], converged: false,
      });
      continue;
    }
    const bogieX = bogiePattern(ctx.input, front).xs.filter(x => x > 0 && x < L);
    points.push({
      frontPosition: front,
      H: c.H,
      T_max: c.T_max,
      T_perRope: c.T_perRope,
      maxSag: c.maxSag,
      minClearance: c.minClearance,
      towerA_R: c.leftTower.R,
      towerB_R: c.rightTower.R,
      utilization: c.worstUtilization,
      bogieX,
      bogieY: bogieX.map(x => yAt(c.profile, x)),
      converged: c.converged,
    });
    if (!blockingReason) {
      const fail = c.checks.find(k => k.status === 'FAIL');
      if (fail) {
        blockingReason =
          `${fail.label} fails with the leading bogie at x = ${front.toFixed(1)} m ` +
          `(utilisation ${(fail.utilization * 100).toFixed(0)} %)`;
      }
    }
  }

  const pick = (cmp: (a: LaunchEnvelopePoint, b: LaunchEnvelopePoint) => boolean) =>
    points.reduce<LaunchEnvelopePoint | null>((best, p) => (!best || cmp(p, best) ? p : best), null);

  return {
    available: true,
    points,
    worstTension: pick((a, b) => a.T_perRope > b.T_perRope),
    worstSag: pick((a, b) => a.maxSag > b.maxSag),
    worstClearance: pick((a, b) => a.minClearance < b.minClearance),
    totalBogieLoad: lc.totalWeight,
    bogieLoads: pat.loads,
    note: `${pat.xs.length} bogie(s) at ${pat.spacing.toFixed(2)} m centres, swept over ` +
      `${travel.toFixed(1)} m of travel in ${steps} steps under "${comb.label}".`,
    feasible: !blockingReason,
    blockingReason,
  };
}

// ------------------------------------------------------------
// Default combinations
// ------------------------------------------------------------

export const DEFAULT_COMBINATIONS: LoadCombination[] = [
  { id: 'INSTALL', label: 'Installed — dead load only', gDL: 1, gLL: 0, useDAF: false, dT: 0, wind: false, limitState: 'INSTALL', enabled: true },
  { id: 'SLS-LAUNCH', label: 'Service — full variable load', gDL: 1, gLL: 1, useDAF: true, dT: 0, wind: false, limitState: 'SLS', enabled: true },
  { id: 'SLS-COLD', label: 'Service — variable load, ΔT = −25 °C', gDL: 1, gLL: 1, useDAF: true, dT: -25, wind: false, limitState: 'SLS', enabled: true },
  { id: 'SLS-HOT', label: 'Service — variable load, ΔT = +25 °C', gDL: 1, gLL: 1, useDAF: true, dT: 25, wind: false, limitState: 'SLS', enabled: true },
  { id: 'SLS-WIND', label: 'Service — variable load + wind', gDL: 1, gLL: 1, useDAF: true, dT: 0, wind: true, limitState: 'SLS', enabled: true },
  { id: 'ULS', label: 'Ultimate — 1.35 DL + 1.50 LL', gDL: 1.35, gLL: 1.5, useDAF: true, dT: 0, wind: false, limitState: 'ULS', enabled: true },
];

// ------------------------------------------------------------
// Entry point
// ------------------------------------------------------------

export function solveCable(input: CableInput): AnalysisResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const steps: string[] = [];

  const { geometry, cable, options } = input;
  if (!(geometry.L > 0)) errors.push('Span L must be greater than zero.');
  if (!(cable.section.Am > 0) || !(cable.section.E > 0)) errors.push('Cable area and modulus must be positive.');
  if (!(cable.section.MBL > 0)) errors.push('Cable breaking load (MBL) must be positive.');
  if (!(cable.nCables >= 1)) errors.push('At least one rope is required.');
  if (cable.FoS < 1.05) warnings.push('A factor of safety below 1.05 leaves no usable reserve.');
  for (const pl of input.pointLoads) {
    if (pl.x <= 0 || pl.x >= geometry.L) {
      warnings.push(`Point load "${pl.label}" at x = ${pl.x} m lies outside the span and has been drawn in to the nearest usable position.`);
    }
  }
  if (errors.length > 0) {
    throw new Error(errors.join(' '));
  }

  const sys = systemProps(input);
  const terrain = buildTerrain(input);
  const legacyFixedH = options.stateControl === 'RIGID_FIXED_H';

  const { installed, L0, H_ref } = buildInstalledState(input, sys, terrain, warnings);

  const ctx: SolverContext = {
    input, sys, terrain, installed,
    installedSamples: installed.profile.map(p => ({ x: p.x, y: p.y })),
    L0, H_ref, warnings, legacyFixedH,
  };

  steps.push('════ SYSTEM ════');
  steps.push(`${input.cable.nCables} × ${cable.section.name} — ${cable.section.construction}`);
  steps.push(`EA per rope = ${sys.EA_perRope.toFixed(0)} kN, system EA = ${sys.EA.toFixed(0)} kN`);
  steps.push(`Self weight = ${sys.gammaPerRope.toFixed(4)} kN/m per rope → ${sys.gammaSelf.toFixed(4)} kN/m for the system`);
  steps.push(`MBL = ${cable.section.MBL.toFixed(1)} kN/rope × η ${sys.eta.toFixed(3)} = ${sys.MBL_eff_perRope.toFixed(1)} kN effective; ` +
    `allowable at FoS ${cable.FoS.toFixed(2)} = ${sys.T_allow_perRope.toFixed(1)} kN/rope`);
  steps.push(`Tower-top compliance = ${sys.compliance.toExponential(3)} m/kN`);
  steps.push('════ INSTALLED STATE ════');
  steps.push(`Control: ${describeControl(options.stateControl)}`);
  steps.push(`H₀ = ${installed.H0.toFixed(3)} kN, sag₀ = ${installed.sag0.toFixed(4)} m, ` +
    `arc length = ${installed.arcLength0.toFixed(5)} m`);
  steps.push(`Unstressed (cut) length L₀ = ${L0.toFixed(5)} m — the invariant for every later case`);
  steps.push(`Installed elastic stretch = ${(installed.elasticElongation0 * 1000).toFixed(1)} mm, ` +
    `σ₀ = ${installed.stress0.toFixed(1)} MPa`);
  if (legacyFixedH) {
    warnings.push(
      'RIGID / PRESCRIBED-H mode is active: H is imposed on every load case and axial ' +
      'compatibility is NOT enforced, so sag grows without limit as load is added. ' +
      'Use it only to reproduce hand calculations — switch to an installed sag, ' +
      'installed H or cut length for physical results.',
    );
  }

  // ---- all enabled combinations
  const combos = input.combinations.filter(c => c.enabled);
  const active = combos.length > 0 ? combos : [DEFAULT_COMBINATIONS[1]];
  const cases: CaseResult[] = [];
  for (const comb of active) {
    const c = runCase(ctx, { combination: comb });
    if (c) cases.push(c);
    else warnings.push(`Load case "${comb.label}" did not solve and has been omitted.`);
  }
  if (cases.length === 0) {
    throw new Error('No load case could be solved. Check the cable properties and geometry.');
  }
  for (const c of cases) warnings.push(...c.warnings);

  const primary =
    cases.find(c => c.id === options.primaryCaseId) ??
    cases.find(c => c.combination.limitState === 'SLS') ??
    cases[0];
  const governingCase = cases.reduce((a, b) => (b.worstUtilization > a.worstUtilization ? b : a));

  // ---- break point
  const breakPoint = options.runBreakPointSearch
    ? buildBreakPoint(ctx, primary)
    : emptyBreakPoint('Break-point search is switched off.');

  // ---- stiffness
  const stiffness = buildStiffnessReport(ctx, primary);

  // ---- launching envelope
  const launching = options.runLaunchEnvelope
    ? runLaunchEnvelope(ctx, primary.combination)
    : {
      available: false, points: [], worstTension: null, worstSag: null,
      worstClearance: null, totalBogieLoad: 0, bogieLoads: [],
      note: 'Launching envelope is switched off.', feasible: true, blockingReason: '',
    };

  const verification = runVerification();

  steps.push('════ LOAD CASES ════');
  for (const c of cases) steps.push(...c.calculationSteps);
  steps.push('════ GOVERNING ════');
  steps.push(`Governing case: ${governingCase.label} — ${governingCase.governingCheck?.label ?? 'no check applicable'} ` +
    `at ${(governingCase.worstUtilization * 100).toFixed(1)} % utilisation`);
  if (breakPoint.available) {
    steps.push(`First limit state at λ = ${breakPoint.lambdaAllowable.toFixed(3)} (${breakPoint.lambdaAllowableCheck})`);
    steps.push(`Rope rupture at λ = ${breakPoint.lambdaUltimate.toFixed(3)} (${breakPoint.ultimateCheck})`);
  }

  const uniqueWarnings = [...new Set(warnings)];

  return {
    valid: cases.every(c => c.checks.every(k => k.status !== 'FAIL')),
    errors,
    warnings: uniqueWarnings,
    calculationSteps: steps,
    installed,
    cases,
    primary,
    governingCase,
    breakPoint,
    stiffness,
    launching,
    verification,
    // mirrors
    H: primary.H,
    model: primary.model,
    profile: primary.profile,
    slopeLeft: primary.slopeLeft,
    slopeRight: primary.slopeRight,
    thetaLeft: primary.thetaLeft,
    thetaRight: primary.thetaRight,
    pointLoadResults: primary.pointLoadResults,
    leftTower: primary.leftTower,
    rightTower: primary.rightTower,
    maxSag: primary.maxSag,
    sagRatio: primary.sagRatio,
    cableLength: primary.arcLength,
    maxForces: {
      maxTension: primary.T_max,
      maxTensionLocation: primary.T_maxX,
      maxTensionDescription: primary.T_maxDescription,
      towerA_H: Math.abs(primary.leftTower.Rx),
      towerA_V: Math.abs(primary.leftTower.Ry),
      towerA_R: primary.leftTower.R,
      towerB_H: Math.abs(primary.rightTower.Rx),
      towerB_V: Math.abs(primary.rightTower.Ry),
      towerB_R: primary.rightTower.R,
    },
  };
}

function describeControl(mode: CableInput['options']['stateControl']): string {
  switch (mode) {
    case 'INSTALLED_SAG': return 'installed dead-load sag prescribed → cut length back-calculated';
    case 'INSTALLED_H': return 'installed dead-load tension prescribed → cut length back-calculated';
    case 'UNSTRESSED_LENGTH': return 'cut length prescribed directly';
    case 'RIGID_FIXED_H': return 'H prescribed for every case (rigid, non-physical)';
  }
}

function emptyBreakPoint(note: string): BreakPointReport {
  return {
    available: false, lambdaAllowable: 0, lambdaAllowableCheck: '—',
    lambdaUltimate: 0, ultimateCheck: '—', baseVariableLoad: 0,
    allowableVariableLoad: 0, ultimateVariableLoad: 0, reserveRatio: 0,
    T_atUltimate: 0, sag_atUltimate: 0, firstLimitStates: [], note,
  };
}

function buildBreakPoint(ctx: SolverContext, primary: CaseResult): BreakPointReport {
  const hasVariable = primary.totalVariableLoad > 1e-6;
  const probeX = hasVariable ? 0 : ctx.installed.sag0 > 0 ? ctx.input.geometry.L / 2 : ctx.input.geometry.L / 2;

  const solveAt = (lambda: number) =>
    runCase(ctx, {
      combination: primary.combination,
      lambda: hasVariable ? lambda : 1,
      syntheticProbe: hasVariable ? undefined : { x: probeX, P: lambda },
      samples: 60,
    });

  const report = searchBreakPoint({
    solveAt,
    baseVariableLoad: hasVariable ? primary.totalVariableLoad : 1,
    lambdaMax: hasVariable ? 40 : Math.max(50, 200 * Math.max(1, ctx.sys.MBL_eff_perRope / 100)),
  });

  if (!hasVariable && report.available) {
    return {
      ...report,
      note:
        `No variable load is applied, so λ was interpreted as a probe point load at midspan ` +
        `(x = ${probeX.toFixed(1)} m). The figures below are therefore the maximum single ` +
        `midspan load this system can carry: ${report.lambdaAllowable.toFixed(1)} kN at the ` +
        `required factor of safety, ${report.lambdaUltimate.toFixed(1)} kN at rupture.`,
    };
  }
  return report;
}

function buildStiffnessReport(ctx: SolverContext, primary: CaseResult): StiffnessReport {
  const probeX = primary.pointLoadResults.length > 0
    ? primary.pointLoadResults[0].load.x
    : primary.maxSagX || ctx.input.geometry.L / 2;

  const wEff = ctx.sys.gammaSelf * (primary.arcLength / Math.max(1e-9, ctx.input.geometry.L));

  return buildStiffness({
    EA: ctx.sys.EA,
    EA_perRope: ctx.sys.EA_perRope,
    E: ctx.input.cable.section.E,
    L: ctx.input.geometry.L,
    H: primary.H,
    w: wEff,
    probeX,
    probeDeflection: (dP: number) => {
      const c = runCase(ctx, {
        combination: primary.combination,
        extraPoints: dP > 0 ? [{ x: probeX, P: dP, label: 'probe' }] : [],
        samples: 80,
      });
      if (!c) return null;
      return { y: yAt(c.profile, probeX), H: c.H, sag: c.maxSag };
    },
    atTemperature: (dT: number) => {
      const c = runCase(ctx, {
        combination: { ...primary.combination, dT: primary.combination.dT + dT },
        samples: 60,
      });
      if (!c) return null;
      return { H: c.H, sag: c.maxSag };
    },
  });
}

