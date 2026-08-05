// ============================================================
// Capacity checks, break-point search, stiffness reporting
// ------------------------------------------------------------
// Every limit state the temporary launching system can reach is expressed
// as demand / capacity so that (a) the governing one is obvious and (b) a
// single scalar — the variable-load multiplier λ — can be pushed until each
// one is exhausted. That multiplier IS the break point the tool was missing.
// ============================================================
import type {
  AnchorResult, BreakPointReport, CableInput, CapacityCheck, CaseResult,
  CheckStatus, StiffnessReport, TowerResult,
} from '../types';
import { bisectRising } from './numeric';

/** Utilisation above which a check is flagged but not failed. */
const WARN_AT = 0.85;

function statusOf(utilization: number, checked: boolean): CheckStatus {
  if (!checked) return 'NOT_CHECKED';
  if (!Number.isFinite(utilization)) return 'NOT_CHECKED';
  if (utilization > 1) return 'FAIL';
  if (utilization > WARN_AT) return 'WARNING';
  return 'OK';
}

function check(
  id: string,
  group: CapacityCheck['group'],
  label: string,
  demand: number,
  capacity: number,
  unit: string,
  note: string,
  advisory = false,
): CapacityCheck {
  const checked = capacity > 0 && Number.isFinite(capacity);
  const utilization = checked ? demand / capacity : Number.NaN;
  const status = statusOf(utilization, checked);
  return {
    id, group, label, demand, capacity, unit,
    utilization,
    // An advisory item is never reported as a failure — it flags a modelling or
    // detailing concern, not an exhausted capacity.
    status: advisory && status === 'FAIL' ? 'WARNING' : status,
    note,
    advisory,
  };
}

/** A check written the other way round: a factor of safety that must be met. */
function fosCheck(
  id: string,
  group: CapacityCheck['group'],
  label: string,
  actual: number,
  required: number,
  note: string,
): CapacityCheck {
  const checked = required > 0 && Number.isFinite(actual);
  const utilization = checked ? required / Math.max(1e-9, actual) : Number.NaN;
  return {
    id, group, label,
    demand: required,
    capacity: Number.isFinite(actual) ? actual : 0,
    unit: 'FoS',
    utilization,
    status: statusOf(utilization, checked),
    note,
    advisory: false,
  };
}

export interface CheckInputs {
  T_perRope: number;
  T_backstayPerRope: number;
  stress: number;
  towers: TowerResult[];
  anchors: AnchorResult[];
  /** Governing clearance, already net of the hang depth under the unit. */
  minClearance: number;
  /** Clearance to the cable itself. */
  cableClearance: number;
  /** Cable-to-soffit depth, 0 if nothing is suspended. */
  hangDepth: number;
  footprint: { from: number; to: number } | null;
  sagRatio: number;
  limitState: 'SLS' | 'ULS' | 'INSTALL';
  model: string;
}

export function buildChecks(input: CableInput, ci: CheckInputs): CapacityCheck[] {
  const { cable, towers: tc, anchors: ac, site, options } = input;
  const sec = cable.section;
  const eta = cable.etaTermination * cable.etaBend;
  const MBL_eff = sec.MBL * eta;

  // Allowable-stress design on unfactored loads uses the full factor of safety;
  // a factored (ULS) combination uses the material factor instead, otherwise the
  // load factors and the FoS would multiply and the check would be meaningless.
  const isULS = ci.limitState === 'ULS';
  const divisor = isULS ? Math.max(1.0, cable.gammaM) : Math.max(1.05, cable.FoS);
  const divisorLabel = isULS ? `γ_M ${divisor.toFixed(2)}` : `FoS ${divisor.toFixed(2)}`;
  const T_allow = MBL_eff / divisor;
  const sigmaAllow = (MBL_eff * 1000) / sec.Am / divisor;

  const out: CapacityCheck[] = [];

  out.push(check(
    'cable-allowable', 'Cable',
    `Rope tension vs allowable (MBL·η / ${divisorLabel})`,
    ci.T_perRope, T_allow, 'kN',
    `MBL ${sec.MBL.toFixed(1)} kN × η ${eta.toFixed(3)} ÷ ${divisorLabel}`,
  ));

  out.push(check(
    'cable-rupture', 'Cable',
    'Rope tension vs breaking load (rupture)',
    ci.T_perRope, MBL_eff, 'kN',
    'Utilisation of 1.00 is cable failure — no reserve whatsoever.',
  ));

  out.push(check(
    'cable-stress', 'Cable',
    'Rope stress vs allowable stress',
    ci.stress, sigmaAllow, 'MPa',
    `On the metallic area ${sec.Am.toFixed(1)} mm²`,
  ));

  out.push(check(
    'backstay-allowable', 'Backstay',
    'Backstay tension vs allowable',
    ci.T_backstayPerRope, T_allow, 'kN',
    tc.saddleMode === 'BALANCED_BACKSTAY'
      ? 'Balanced saddle: T_backstay = H / sin α, so a steep backstay is often the critical element.'
      : tc.saddleMode === 'ROLLER_SADDLE'
        ? 'Frictionless saddle: T_backstay = T_main.'
        : 'Backstay tension prescribed by the user.',
  ));

  ci.towers.forEach(tw => {
    const tag = tw.side === 'left' ? 'A' : 'B';
    if (tc.axialCapacity > 0) {
      out.push(check(
        `tower-${tw.side}-axial`, 'Tower',
        `Tower ${tag} axial compression`,
        tw.axial, tc.axialCapacity, 'kN',
        'Saddle vertical reaction plus tower self weight.',
      ));
    }
    if (tc.momentCapacity > 0) {
      out.push(check(
        `tower-${tw.side}-moment`, 'Tower',
        `Tower ${tag} base moment`,
        tw.baseMoment, tc.momentCapacity, 'kNm',
        'Unbalanced saddle thrust × tower height (cantilever mast).',
      ));
    }
    if (tc.axialCapacity > 0 && tc.momentCapacity > 0) {
      const interaction =
        tw.axial / tc.axialCapacity + tw.baseMoment / tc.momentCapacity;
      out.push(check(
        `tower-${tw.side}-interaction`, 'Tower',
        `Tower ${tag} axial + bending interaction`,
        interaction, 1, '—',
        'Linear N/Nc + M/Mc interaction.',
      ));
    }
    if (tw.eulerCritical > 0) {
      out.push(check(
        `tower-${tw.side}-buckling`, 'Tower',
        `Tower ${tag} vs Euler load / 2.0`,
        tw.axial, tw.eulerCritical / 2, 'kN',
        `P_cr = π²EI/(K·h)² = ${tw.eulerCritical.toFixed(0)} kN; a factor of 2.0 on the ` +
        'elastic critical load is usual for temporary masts.',
      ));
    }
    if (tc.baseWidth > 0 && tw.baseMoment > 1e-9) {
      out.push(fosCheck(
        `tower-${tw.side}-overturn`, 'Tower',
        `Tower ${tag} overturning`,
        tw.overturningFoS, tc.requiredFoSOverturn,
        'Stabilising N·b/2 against overturning moment.',
      ));
    }
  });

  ci.anchors.forEach(an => {
    const tag = an.side === 'left' ? 'A' : 'B';
    out.push(fosCheck(
      `anchor-${an.side}-uplift`, 'Anchor',
      `Anchor ${tag} uplift`,
      an.upliftFoS, ac.requiredFoSUplift,
      `Backstay pulls up with ${an.upliftDemand.toFixed(1)} kN against ` +
      `${an.upliftResistance.toFixed(1)} kN (block ${an.weight.toFixed(0)} kN + tie-downs ` +
      `${an.tieDown.toFixed(0)} kN). Block weight needed: ${an.requiredWeightUplift.toFixed(1)} kN.`,
    ));
    out.push(fosCheck(
      `anchor-${an.side}-sliding`, 'Anchor',
      `Anchor ${tag} sliding`,
      an.slidingFoS, ac.requiredFoSSliding,
      `Horizontal pull ${an.slidingDemand.toFixed(1)} kN against ` +
      `${an.slidingResistance.toFixed(1)} kN of friction + passive resistance.`,
    ));
  });

  if (site.requiredClearance > 0) {
    const underUnit = ci.hangDepth > 0 && ci.footprint !== null;
    out.push(check(
      'clearance', 'Geometry',
      underUnit ? 'Clearance under the launched unit' : 'Clearance under the cable',
      site.requiredClearance, Math.max(0, ci.minClearance), 'm',
      `Cable clears the controlling level by ${ci.cableClearance.toFixed(3)} m between ` +
      `x = ${site.crestLeftX.toFixed(0)} m and x = ${site.crestRightX.toFixed(0)} m` +
      (underUnit
        ? `; ${ci.hangDepth.toFixed(2)} m of slings + girder depth is deducted over ` +
          `x = ${ci.footprint!.from.toFixed(1)}…${ci.footprint!.to.toFixed(1)} m`
        : '') +
      (site.hflLevel > 0
        ? `. Controlling level is the greater of ground and HFL ${site.hflLevel.toFixed(1)} m.`
        : '.'),
    ));
  }

  if (cable.saddleDiameter > 0) {
    const ratio = cable.saddleDiameter / sec.d;
    out.push(check(
      'saddle-dd', 'Geometry',
      'Saddle D/d ratio (detailing)',
      sec.minBendRatio, ratio, '—',
      `D/d = ${ratio.toFixed(1)}; ${sec.construction} wants ≥ ${sec.minBendRatio}. ` +
      'Below this, reduce the bending efficiency η_bend to suit.',
      true,
    ));
  }

  if (options.model === 'PARABOLIC_HORIZONTAL_LOAD') {
    out.push(check(
      'sag-ratio', 'Serviceability',
      'Sag / span vs parabolic validity limit (advisory)',
      ci.sagRatio, 0.1, '—',
      'Above 1/10 the parabolic model loses accuracy — switch to the elastic catenary.',
      true,
    ));
  }

  return out;
}

export function worstCheck(checks: CapacityCheck[]): CapacityCheck | null {
  let best: CapacityCheck | null = null;
  for (const c of checks) {
    if (c.advisory) continue;
    if (c.status === 'NOT_CHECKED' || !Number.isFinite(c.utilization)) continue;
    if (!best || c.utilization > best.utilization) best = c;
  }
  return best;
}

export function worstUtilization(checks: CapacityCheck[]): number {
  const w = worstCheck(checks);
  return w ? w.utilization : 0;
}

// ------------------------------------------------------------
// Break-point search
// ------------------------------------------------------------

/** Checks whose exhaustion is a genuine collapse rather than an advisory. */
const STRENGTH_CHECK_IDS = [
  'cable-allowable', 'cable-rupture', 'cable-stress', 'backstay-allowable',
  'tower-left-axial', 'tower-right-axial',
  'tower-left-moment', 'tower-right-moment',
  'tower-left-interaction', 'tower-right-interaction',
  'tower-left-buckling', 'tower-right-buckling',
  'tower-left-overturn', 'tower-right-overturn',
  'anchor-left-uplift', 'anchor-right-uplift',
  'anchor-left-sliding', 'anchor-right-sliding',
  'clearance',
];

export interface BreakPointOptions {
  /** Solve the governing load pattern with the variable load scaled by λ. */
  solveAt: (lambda: number) => CaseResult | null;
  baseVariableLoad: number;
  lambdaMax: number;
}

export function searchBreakPoint(opts: BreakPointOptions): BreakPointReport {
  const { solveAt, baseVariableLoad, lambdaMax } = opts;

  const base = solveAt(1);
  if (!base) {
    return {
      available: false,
      lambdaAllowable: 0, lambdaAllowableCheck: '—',
      lambdaUltimate: 0, ultimateCheck: '—',
      baseVariableLoad, allowableVariableLoad: 0, ultimateVariableLoad: 0,
      reserveRatio: 0, T_atUltimate: 0, sag_atUltimate: 0,
      firstLimitStates: [],
      note: 'Break-point search unavailable — the base load case did not solve.',
    };
  }

  const utilOf = (c: CaseResult | null, id: string): number => {
    if (!c) return Number.POSITIVE_INFINITY;
    const found = c.checks.find(k => k.id === id);
    if (!found || found.status === 'NOT_CHECKED' || !Number.isFinite(found.utilization)) {
      return Number.NEGATIVE_INFINITY;
    }
    return found.utilization;
  };

  const cache = new Map<number, CaseResult | null>();
  const solveCached = (lambda: number) => {
    const key = Math.round(lambda * 1e6) / 1e6;
    if (!cache.has(key)) cache.set(key, solveAt(key));
    return cache.get(key) ?? null;
  };

  // A coarse λ grid is swept once (dense near λ = 1, where the answers matter)
  // and every check is then refined inside the interval the sweep bracketed.
  // That keeps the whole search to a few dozen solves instead of one bisection
  // per limit state.
  const GRID = 22;
  const grid: number[] = [];
  for (let i = 0; i <= GRID; i++) {
    grid.push(1 + (lambdaMax - 1) * Math.pow(i / GRID, 2));
  }
  const gridResults = grid.map(l => (l === 1 ? base : solveCached(l)));

  // A λ where the solve itself fails is the end of the searchable range, not a
  // limit state — scanning past it would report the solver breaking as a failure.
  let searchable = GRID;
  for (let i = 1; i <= GRID; i++) {
    if (!gridResults[i]) { searchable = i - 1; break; }
  }
  const truncated = searchable < GRID;

  const limitStates: { lambda: number; check: string; label: string }[] = [];
  for (const id of STRENGTH_CHECK_IDS) {
    const u1 = utilOf(base, id);
    if (!Number.isFinite(u1)) continue;                 // not applicable to this model
    const label = base.checks.find(c => c.id === id)?.label ?? id;
    if (u1 >= 1) {
      limitStates.push({ lambda: u1 > 1 ? 0 : 1, check: id, label });
      continue;
    }
    let hit = -1;
    for (let i = 1; i <= searchable; i++) {
      if (utilOf(gridResults[i], id) >= 1) { hit = i; break; }
    }
    if (hit < 0) continue;                               // never reached in range
    const root = bisectRising(
      l => utilOf(solveCached(l), id) - 1,
      grid[hit - 1], grid[hit], 1e-4, 24,
    );
    limitStates.push({ lambda: root.converged ? root.x : grid[hit], check: id, label });
  }
  limitStates.sort((a, b) => a.lambda - b.lambda);

  const firstNonRupture = limitStates.find(s => s.check !== 'cable-rupture');
  const rupture = limitStates.find(s => s.check === 'cable-rupture');

  const lambdaAllowable = firstNonRupture?.lambda ?? 0;
  const lambdaUltimate = rupture?.lambda ?? 0;
  const atUltimate = lambdaUltimate > 0 ? solveCached(lambdaUltimate) : null;

  const alreadyOver = limitStates.some(s => s.lambda === 0);

  return {
    available: true,
    lambdaAllowable,
    lambdaAllowableCheck: firstNonRupture?.label ?? 'no limit reached in range',
    lambdaUltimate,
    ultimateCheck: rupture?.label ?? 'rupture not reached in range',
    baseVariableLoad,
    allowableVariableLoad: lambdaAllowable * baseVariableLoad,
    ultimateVariableLoad: lambdaUltimate * baseVariableLoad,
    reserveRatio: lambdaAllowable,
    T_atUltimate: atUltimate?.T_perRope ?? 0,
    sag_atUltimate: atUltimate?.maxSag ?? 0,
    firstLimitStates: limitStates,
    note: (alreadyOver
      ? 'One or more limit states are ALREADY exceeded at the applied load — the reserve is negative.'
      : limitStates.length === 0
        ? `No limit state is reached up to ${grid[searchable].toFixed(0)}× the variable load.`
        : `Searched the variable-load multiplier λ over 1…${grid[searchable].toFixed(0)}×, holding self weight constant.`)
      + (truncated
        ? ` The search stopped at ${grid[searchable].toFixed(1)}× because the cable model ` +
          'no longer converges beyond that load — treat any limit state above it as unknown.'
        : ''),
  };
}

// ------------------------------------------------------------
// Stiffness
// ------------------------------------------------------------

export interface StiffnessOptions {
  EA: number;
  EA_perRope: number;
  E: number;
  L: number;
  H: number;
  w: number;                 // effective UDL per horizontal metre (kN/m)
  probeX: number;
  /** Deflection at probeX with an extra probe load dP applied there. */
  probeDeflection: (dP: number) => { y: number; H: number; sag: number } | null;
  /** State at a temperature offset dT. */
  atTemperature: (dT: number) => { H: number; sag: number } | null;
}

export function buildStiffness(o: StiffnessOptions): StiffnessReport {
  const { EA, EA_perRope, E, L, H, w, probeX } = o;

  // Dischinger equivalent (secant) modulus: allows for the sag change that
  // accompanies a tension change in a cable of finite sag.
  const E_dischinger =
    H > 0 ? E / (1 + (w * w * L * L * EA) / (12 * Math.pow(H, 3))) : E;

  const dP = Math.max(0.5, 0.005 * Math.max(1, H));
  const a = o.probeDeflection(0);
  const b = o.probeDeflection(dP);
  let verticalStiffness = 0;
  let dH_dP = 0;
  let dSag_dP = 0;
  if (a && b) {
    const dy = a.y - b.y;                 // downward movement, m
    verticalStiffness = dy > 1e-12 ? dP / dy : Number.POSITIVE_INFINITY;
    dH_dP = (b.H - a.H) / dP;
    dSag_dP = ((b.sag - a.sag) / dP) * 1000;
  }

  const dT = 10;
  const t0 = o.atTemperature(0);
  const t1 = o.atTemperature(dT);
  let dSag_dT = 0;
  let dH_dT = 0;
  if (t0 && t1) {
    dSag_dT = ((t1.sag - t0.sag) / dT) * 1000;
    dH_dT = (t1.H - t0.H) / dT;
  }

  return {
    EA,
    EA_perRope,
    E_dischinger,
    E_ratio: E > 0 ? E_dischinger / E : 0,
    verticalStiffness,
    probeX,
    deflectionPerKN: Number.isFinite(verticalStiffness) && verticalStiffness > 0
      ? 1000 / verticalStiffness
      : 0,
    dH_dP,
    dSag_dP,
    dSag_dT,
    dH_dT,
    geometricStiffness: L > 0 ? H / L : 0,
  };
}
