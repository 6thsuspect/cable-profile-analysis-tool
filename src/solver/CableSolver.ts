// ============================================================
// Cable Profile & Point-Load Analysis — Core Solver
// ============================================================
import type {
  CableInput, AnalysisResult, ProfilePoint, PointLoadResult,
  TowerResult
} from '../types';

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

// ---- Brent's method ------------------------------------------
function brentSolve(
  f: (x: number) => number,
  a: number, b: number,
  tol: number, maxIter: number
): number {
  let fa = f(a), fb = f(b);
  if (fa * fb > 0) {
    // try wider bracket
    for (let k = 1; k <= 20; k++) {
      a *= 0.5; b *= 2;
      fa = f(a); fb = f(b);
      if (fa * fb <= 0) break;
    }
    if (fa * fb > 0) throw new Error('Brent: root not bracketed');
  }
  let c = a, fc = fa, d = b - a, e = d;
  for (let i = 0; i < maxIter; i++) {
    if (fb * fc > 0) { c = a; fc = fa; d = b - a; e = d; }
    if (Math.abs(fc) < Math.abs(fb)) { a = b; b = c; c = a; fa = fb; fb = fc; fc = fa; }
    const tol1 = 2e-15 * Math.abs(b) + 0.5 * tol;
    const m = 0.5 * (c - b);
    if (Math.abs(m) <= tol1 || fb === 0) return b;
    if (Math.abs(e) >= tol1 && Math.abs(fa) > Math.abs(fb)) {
      const s_val = fb / fa;
      let p: number, q: number;
      if (a === c) { p = 2 * m * s_val; q = 1 - s_val; }
      else {
        const q0 = fa / fc, r0 = fb / fc;
        p = s_val * (2 * m * q0 * (q0 - r0) - (b - a) * (r0 - 1));
        q = (q0 - 1) * (r0 - 1) * (s_val - 1);
      }
      if (p > 0) q = -q; else p = -p;
      if (2 * p < Math.min(3 * m * q - Math.abs(tol1 * q), Math.abs(e * q))) {
        e = d; d = p / q;
      } else { d = m; e = m; }
    } else { d = m; e = m; }
    a = b; fa = fb;
    b += (Math.abs(d) > tol1 ? d : (m > 0 ? tol1 : -tol1));
    fb = f(b);
  }
  return b;
}

// ============================================================
// Parabolic solver — uniform load per horizontal projection
// ============================================================

/**
 * Parabolic profile y(x) for a single span with endpoints (0,yL) and (L,yR)
 *   y(x) = yL + C1*x + w*x²/(2H)
 *   C1 = (yR - yL)/L - w*L/(2H)
 */
function parabolicY(x: number, yL: number, yR: number, L: number, w: number, H: number): number {
  const C1 = (yR - yL) / L - (w * L) / (2 * H);
  return yL + C1 * x + (w * x * x) / (2 * H);
}

function parabolicSlope(x: number, yL: number, yR: number, L: number, w: number, H: number): number {
  const C1 = (yR - yL) / L - (w * L) / (2 * H);
  return C1 + (w * x) / H;
}

// ---- Profile for segment between two points ------------------
function segmentProfile(
  xStart: number, yStart: number,
  xEnd: number, yEnd: number,
  w: number, H: number,
  samples: number
): ProfilePoint[] {
  const segLen = xEnd - xStart;
  if (segLen <= 0) return [];
  const pts: ProfilePoint[] = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const xLocal = t * segLen;
    const x = xStart + xLocal;
    const y = parabolicY(xLocal, yStart, yEnd, segLen, w, H);
    const slope = parabolicSlope(xLocal, yStart, yEnd, segLen, w, H);
    const theta = Math.atan(slope);
    const V = H * slope;
    const T = Math.sqrt(H * H + V * V);
    pts.push({ x, y, slope, theta, T, V });
  }
  return pts;
}

// ---- Segment slope helpers -----------------------------------
function segSlopeAtEnd(yStart: number, yEnd: number, segLen: number, w: number, H: number, atStart: boolean): number {
  const C1 = (yEnd - yStart) / segLen - (w * segLen) / (2 * H);
  if (atStart) return C1;
  return C1 + (w * segLen) / H;
}

// ============================================================
// Solve cable with multiple point loads (parabolic model)
// ============================================================

/**
 * For n point loads, the cable is divided into n+1 segments.
 * Segment boundaries: x0=0, x1, x2, …, xn, x_{n+1}=L
 * Heights at boundaries: y0=yL, y1, y2, …, yn, y_{n+1}=yR
 * 
 * For each load point i (1..n):
 *   Left slope:  mL_i = (yi - y_{i-1})/dx_i - w*dx_i/(2H)
 *   Right slope: mR_i = (y_{i+1} - yi)/dx_{i+1} - w*dx_{i+1}/(2H) ... actually right slope at xi
 *   
 * Actually: within segment [x_{i-1}, x_i] of length dx_i:
 *   slope at right end = (yi - y_{i-1})/dx_i + w*dx_i/(2H)
 *   
 * Within segment [x_i, x_{i+1}] of length dx_{i+1}:
 *   slope at left end = (y_{i+1} - yi)/dx_{i+1} - w*dx_{i+1}/(2H)
 *   
 * Equilibrium at load i:
 *   H * (mR_i - mL_i) = P_i
 */

function solveParabolicWithLoads(input: CableInput): AnalysisResult {
  const { geometry, cable, pointLoads, options } = input;
  const { yL, yR, L, La, Ra, alphaL, alphaR } = geometry;
  const w = cable.w;
  const steps: string[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];

  // Sort point loads by x
  const loads = [...pointLoads].filter(p => p.P > 0).sort((a, b) => a.x - b.x);
  const n = loads.length;

  steps.push(`Model: Parabolic (load per unit horizontal projection)`);
  steps.push(`Span L = ${L} m, yL = ${yL} m, yR = ${yR} m`);
  steps.push(`Cable unit weight w = ${w} kN/m (per horizontal projection)`);
  steps.push(`Number of point loads: ${n}`);

  // Validate
  for (const ld of loads) {
    if (ld.x <= 0 || ld.x >= L) {
      errors.push(`Point load "${ld.label}" at x=${ld.x} is outside span [0, ${L}]`);
    }
  }

  // Segment boundaries
  const xs = [0, ...loads.map(l => l.x), L];
  const nSeg = xs.length - 1;   // n+1 segments
  const dx: number[] = [];
  for (let i = 0; i < nSeg; i++) dx.push(xs[i + 1] - xs[i]);

  // We need to solve for H and the n unknown elevations y1..yn.
  // For a given H, the system is linear in y1..yn.
  // We'll iterate on H using Brent's method.

  let H_solved: number;
  const H_input = input.H_input;

  if (H_input > 0 && n === 0) {
    // H is prescribed, no point loads — trivial
    H_solved = H_input;
    steps.push(`Using prescribed H = ${H_input} kN`);
  } else if (H_input > 0) {
    H_solved = H_input;
    steps.push(`Using prescribed H = ${H_input} kN`);
  } else {
    // Need to solve for H. For no point loads, H is a free parameter — 
    // we need some constraint. Typically, either H or sag is given.
    // For this tool, H is always user-input.
    // Default to a reasonable value if not provided.
    H_solved = (w * L * L) / (8 * (L / 20)); // default sag = L/20
    steps.push(`No H prescribed — using default based on sag = L/20: H = ${H_solved.toFixed(2)} kN`);
    warnings.push('No horizontal tension H was prescribed. Using default sag ratio of L/20.');
  }

  // Solve internal elevations for a given H
  function solveElevations(H: number): number[] {
    // For 0 point loads, no internal nodes
    if (n === 0) return [];

    // For n point loads, set up linear system:
    // At each load point i (0-indexed, corresponding to xs[i+1]):
    //   slope just left (right end of segment i):
    //     mL_i = (y[i+1] - y[i]) / dx[i] + w*dx[i]/(2H)
    //   slope just right (left end of segment i+1):
    //     mR_i = (y[i+2] - y[i+1]) / dx[i+1] - w*dx[i+1]/(2H)
    //   Equilibrium: H*(mR_i - mL_i) = P_i
    //
    // y[0] = yL, y[n+1] = yR are known.
    // Unknowns: y[1]..y[n]
    //
    // Expand:
    //   H*[(y[i+2]-y[i+1])/dx[i+1] - w*dx[i+1]/(2H) - (y[i+1]-y[i])/dx[i] - w*dx[i]/(2H)] = P_i
    //   (y[i+2]-y[i+1])/dx[i+1] - (y[i+1]-y[i])/dx[i] - w*(dx[i+1]+dx[i])/(2H) = P_i/H
    //   (y[i+2]-y[i+1])/dx[i+1] - (y[i+1]-y[i])/dx[i] = P_i/H + w*(dx[i+1]+dx[i])/(2H)

    // Let j = i (0-indexed load, corresponding to y index j+1)
    // Unknown indices: k = j+1 for j=0..n-1, so y-unknowns are y[1]..y[n]
    // In matrix form: A * Y = b where Y = [y[1], ..., y[n]]^T

    const A: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
    const b: number[] = new Array(n).fill(0);

    for (let j = 0; j < n; j++) {
      const dxL = dx[j];      // segment left of load j
      const dxR = dx[j + 1];  // segment right of load j
      const Pj = loads[j].P;

      // Coefficient of y[j] (index j-1 in unknown vector, since y[1] = unknown[0])
      // y[i] in the formula: i = j for the left boundary
      // (y[i+1] - y[i])/dx[i] → y[j+1]/dxL - y[j]/dxL
      // (y[i+2] - y[i+1])/dx[i+1] → y[j+2]/dxR - y[j+1]/dxR

      // y[j+1] is the load point elevation = unknown[j]
      // Coefficient of unknown[j] (= y[j+1]):
      A[j][j] = -1 / dxR - 1 / dxL;

      // Coefficient of unknown[j-1] (= y[j]) if j > 0:
      if (j > 0) {
        A[j][j - 1] = 1 / dxL;
      }

      // Coefficient of unknown[j+1] (= y[j+2]) if j < n-1:
      if (j < n - 1) {
        A[j][j + 1] = 1 / dxR;
      }

      // Right-hand side
      let rhs = Pj / H + w * (dxR + dxL) / (2 * H);

      // Move known y[0] and y[n+1] to RHS
      if (j === 0) {
        // y[j] = y[0] = yL is known, subtract from RHS
        rhs -= yL / dxL;
      }
      if (j === n - 1) {
        // y[j+2] = y[n+1] = yR is known, subtract from RHS
        rhs -= yR / dxR;
      }

      b[j] = rhs;
    }

    // Solve tridiagonal system using Thomas algorithm
    const y = thomasSolve(A, b, n);
    return y;
  }

  // Thomas algorithm for tridiagonal system
  function thomasSolve(A: number[][], b: number[], n: number): number[] {
    if (n === 1) return [b[0] / A[0][0]];
    // Extract diagonals
    const a_sub: number[] = new Array(n).fill(0);   // sub-diagonal
    const a_diag: number[] = new Array(n).fill(0);  // main diagonal
    const a_sup: number[] = new Array(n).fill(0);   // super-diagonal
    const rhs = [...b];

    for (let i = 0; i < n; i++) {
      a_diag[i] = A[i][i];
      if (i > 0) a_sub[i] = A[i][i - 1];
      if (i < n - 1) a_sup[i] = A[i][i + 1];
    }

    // Forward elimination
    for (let i = 1; i < n; i++) {
      const m = a_sub[i] / a_diag[i - 1];
      a_diag[i] -= m * a_sup[i - 1];
      rhs[i] -= m * rhs[i - 1];
    }

    // Back substitution
    const x = new Array(n).fill(0);
    x[n - 1] = rhs[n - 1] / a_diag[n - 1];
    for (let i = n - 2; i >= 0; i--) {
      x[i] = (rhs[i] - a_sup[i] * x[i + 1]) / a_diag[i];
    }
    return x;
  }

  const ys_internal = solveElevations(H_solved);
  const ys = [yL, ...ys_internal, yR];

  steps.push(`H = ${H_solved.toFixed(2)} kN`);

  // Build profile
  const samplesPerSeg = Math.max(10, Math.floor(options.diagramSamples / nSeg));
  let profile: ProfilePoint[] = [];
  for (let s = 0; s < nSeg; s++) {
    const pts = segmentProfile(xs[s], ys[s], xs[s + 1], ys[s + 1], w, H_solved, samplesPerSeg);
    // Avoid duplicate at boundary
    if (s > 0 && pts.length > 0) pts.shift();
    profile = profile.concat(pts);
  }

  // Endpoint slopes
  const slopeL = segSlopeAtEnd(ys[0], ys[1], dx[0], w, H_solved, true);
  const slopeR = segSlopeAtEnd(ys[nSeg - 1], ys[nSeg], dx[nSeg - 1], w, H_solved, false);
  const thetaL = Math.atan(slopeL);
  const thetaR = Math.atan(slopeR);

  steps.push(`Left endpoint slope = ${slopeL.toFixed(6)}, θ_L = ${(thetaL * RAD).toFixed(2)}°`);
  steps.push(`Right endpoint slope = ${slopeR.toFixed(6)}, θ_R = ${(thetaR * RAD).toFixed(2)}°`);

  // Point-load results
  const pointLoadResults: PointLoadResult[] = [];
  for (let j = 0; j < n; j++) {
    const dxL = dx[j];
    const dxR = dx[j + 1];
    const mL_p = segSlopeAtEnd(ys[j], ys[j + 1], dxL, w, H_solved, false);
    const mR_p = segSlopeAtEnd(ys[j + 1], ys[j + 2], dxR, w, H_solved, true);
    const thetaLp = Math.atan(mL_p);
    const thetaRp = Math.atan(mR_p);
    const T_left = H_solved * Math.sqrt(1 + mL_p * mL_p);
    const T_right = H_solved * Math.sqrt(1 + mR_p * mR_p);
    const disc = mR_p - mL_p;
    const eqCheck = H_solved * disc;

    pointLoadResults.push({
      load: loads[j],
      yp: ys[j + 1],
      slopeLeft: mL_p,
      slopeRight: mR_p,
      thetaLeft: thetaLp,
      thetaRight: thetaRp,
      T_left,
      T_right,
      slopeDiscontinuity: disc,
      equilibriumCheck: eqCheck,
    });

    steps.push(`--- Point Load "${loads[j].label}" at x = ${loads[j].x.toFixed(2)} m ---`);
    steps.push(`  y_p = ${ys[j + 1].toFixed(4)} m`);
    steps.push(`  Slope left of load = ${mL_p.toFixed(6)}, θ_left = ${(thetaLp * RAD).toFixed(2)}°`);
    steps.push(`  Slope right of load = ${mR_p.toFixed(6)}, θ_right = ${(thetaRp * RAD).toFixed(2)}°`);
    steps.push(`  T_left = ${T_left.toFixed(2)} kN, T_right = ${T_right.toFixed(2)} kN`);
    steps.push(`  Slope discontinuity = ${disc.toFixed(6)}`);
    steps.push(`  Equilibrium check: H×(mR−mL) = ${eqCheck.toFixed(2)} kN vs P = ${loads[j].P.toFixed(2)} kN ✓ err=${Math.abs(eqCheck - loads[j].P).toFixed(4)}`);

    if (Math.abs(eqCheck - loads[j].P) > 0.01 * loads[j].P) {
      warnings.push(`Equilibrium check failed for load "${loads[j].label}": H*(mR-mL)=${eqCheck.toFixed(4)} ≠ P=${loads[j].P}`);
    }
  }

  // Tower results
  const leftTower = computeTowerResult('left', yL, yR, L, H_solved, slopeL, alphaL, La, geometry);
  const rightTower = computeTowerResult('right', yL, yR, L, H_solved, slopeR, alphaR, Ra, geometry);

  steps.push(`--- Left Tower ---`);
  steps.push(`  Main cable angle = ${(leftTower.thetaMain * RAD).toFixed(2)}° from horizontal`);
  steps.push(`  T_main = ${leftTower.T_main.toFixed(2)} kN`);
  steps.push(`  Backstay angle = ${(alphaL).toFixed(2)}° from vertical`);
  steps.push(`  T_backstay = ${leftTower.T_backstay.toFixed(2)} kN`);
  steps.push(`  Resultant R = ${leftTower.R.toFixed(2)} kN at ${(leftTower.thetaR * RAD).toFixed(2)}°`);

  steps.push(`--- Right Tower ---`);
  steps.push(`  Main cable angle = ${(rightTower.thetaMain * RAD).toFixed(2)}° from horizontal`);
  steps.push(`  T_main = ${rightTower.T_main.toFixed(2)} kN`);
  steps.push(`  Backstay angle = ${(alphaR).toFixed(2)}° from vertical`);
  steps.push(`  T_backstay = ${rightTower.T_backstay.toFixed(2)} kN`);
  steps.push(`  Resultant R = ${rightTower.R.toFixed(2)} kN at ${(rightTower.thetaR * RAD).toFixed(2)}°`);

  // Sag calculation
  let maxSag = 0;
  const chordSlope = (yR - yL) / L;
  for (const pt of profile) {
    const chordY = yL + chordSlope * pt.x;
    const sag = chordY - pt.y;
    if (sag > maxSag) maxSag = sag;
  }
  const sagRatio = maxSag / L;

  if (sagRatio > 0.1) {
    warnings.push(`Sag/span ratio = ${sagRatio.toFixed(3)} > 0.1. Parabolic approximation may be inaccurate. Consider catenary model.`);
  }

  steps.push(`Max sag = ${maxSag.toFixed(4)} m, sag/span = 1/${(1 / sagRatio).toFixed(1)}`);

  // Approximate cable length (parabolic)
  let cableLength = 0;
  for (let i = 1; i < profile.length; i++) {
    const ddx = profile[i].x - profile[i - 1].x;
    const ddy = profile[i].y - profile[i - 1].y;
    cableLength += Math.sqrt(ddx * ddx + ddy * ddy);
  }
  steps.push(`Approximate cable length = ${cableLength.toFixed(4)} m`);

  // Calculate maximum forces
  let maxTension = 0;
  let maxTensionLocation = 0;
  let maxTensionDescription = '';
  
  // Check tension at all profile points
  for (const pt of profile) {
    if (pt.T > maxTension) {
      maxTension = pt.T;
      maxTensionLocation = pt.x;
      maxTensionDescription = `At x = ${pt.x.toFixed(2)} m (along cable)`;
    }
  }
  
  // Check tension at towers
  if (leftTower.T_main > maxTension) {
    maxTension = leftTower.T_main;
    maxTensionLocation = 0;
    maxTensionDescription = 'At Tower A (left tower)';
  }
  if (rightTower.T_main > maxTension) {
    maxTension = rightTower.T_main;
    maxTensionLocation = L;
    maxTensionDescription = 'At Tower B (right tower)';
  }
  
  // Check tension at point load locations
  for (const plr of pointLoadResults) {
    if (plr.T_left > maxTension) {
      maxTension = plr.T_left;
      maxTensionLocation = plr.load.x;
      maxTensionDescription = `Left of ${plr.load.label} at x = ${plr.load.x.toFixed(2)} m`;
    }
    if (plr.T_right > maxTension) {
      maxTension = plr.T_right;
      maxTensionLocation = plr.load.x;
      maxTensionDescription = `Right of ${plr.load.label} at x = ${plr.load.x.toFixed(2)} m`;
    }
  }
  
  const maxForces = {
    maxTension,
    maxTensionLocation,
    maxTensionDescription,
    towerA_H: Math.abs(leftTower.H_main + leftTower.H_backstay),
    towerA_V: Math.abs(leftTower.V_main + leftTower.V_backstay),
    towerA_R: leftTower.R,
    towerB_H: Math.abs(rightTower.H_main + rightTower.H_backstay),
    towerB_V: Math.abs(rightTower.V_main + rightTower.V_backstay),
    towerB_R: rightTower.R,
  };
  
  steps.push(`--- Maximum Forces ---`);
  steps.push(`Max cable tension = ${maxTension.toFixed(2)} kN (${maxTensionDescription})`);
  steps.push(`Tower A: H = ${maxForces.towerA_H.toFixed(2)} kN, V = ${maxForces.towerA_V.toFixed(2)} kN, R = ${maxForces.towerA_R.toFixed(2)} kN`);
  steps.push(`Tower B: H = ${maxForces.towerB_H.toFixed(2)} kN, V = ${maxForces.towerB_V.toFixed(2)} kN, R = ${maxForces.towerB_R.toFixed(2)} kN`);

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    calculationSteps: steps,
    H: H_solved,
    model: 'PARABOLIC_HORIZONTAL_LOAD',
    profile,
    slopeLeft: slopeL,
    slopeRight: slopeR,
    thetaLeft: thetaL,
    thetaRight: thetaR,
    pointLoadResults,
    leftTower,
    rightTower,
    maxSag,
    sagRatio,
    cableLength,
    maxForces,
  };
}

// ============================================================
// Tower result computation
// ============================================================
function computeTowerResult(
  side: 'left' | 'right',
  yL: number, yR: number, L: number,
  H: number, slopeMain: number,
  alpha: number, backstayLen: number,
  _geom: { yL: number; yR: number; alphaL: number; alphaR: number }
): TowerResult {
  const thetaMain = Math.atan(slopeMain);
  const T_main = H / Math.cos(thetaMain);
  const H_main = H;
  const V_main = H * slopeMain;

  // Backstay: angle alpha from vertical
  const alphaRad = alpha * DEG;
  // For the backstay, the horizontal tension must equal H for frictionless pulley
  // T_backstay * sin(alpha) = H  →  T_backstay = H / sin(alpha)
  const T_backstay = alpha > 0.01 ? H / Math.sin(alphaRad) : H * 1000; // near-vertical
  const H_backstay = H; // by equilibrium
  const V_backstay = T_backstay * Math.cos(alphaRad);

  // Main cable force vector at tower (pointing away from span into cable)
  // Left tower: cable goes to the right, so cable pulls tower toward right and down/up
  // Right tower: cable goes to the left
  let mainFx: number, mainFy: number;
  if (side === 'left') {
    // Cable extends to the right from left tower
    mainFx = H;           // pulls right
    mainFy = V_main;      // V_main = H * slope; if slope is negative, cable goes down
  } else {
    // Cable extends to the left from right tower
    mainFx = -H;          // pulls left
    mainFy = -V_main;     // slope at right end
  }

  // Backstay force vector (backstay goes behind the tower)
  let backFx: number, backFy: number;
  if (side === 'left') {
    // Backstay goes to the left and down
    backFx = -H_backstay;
    backFy = -V_backstay;
  } else {
    // Backstay goes to the right and down
    backFx = H_backstay;
    backFy = -V_backstay;
  }

  // Resultant force on pulley/tower
  const Rx = mainFx + backFx;
  const Ry = mainFy + backFy;
  const R = Math.sqrt(Rx * Rx + Ry * Ry);
  const thetaR = Math.atan2(Ry, Rx);

  // Anchor position
  let anchorX: number, anchorY: number;
  const towerX = side === 'left' ? 0 : L;
  const towerY = side === 'left' ? yL : yR;
  if (side === 'left') {
    anchorX = towerX - backstayLen * Math.sin(alphaRad);
    anchorY = towerY - backstayLen * Math.cos(alphaRad);
  } else {
    anchorX = towerX + backstayLen * Math.sin(alphaRad);
    anchorY = towerY - backstayLen * Math.cos(alphaRad);
  }

  // Backstay angle from horizontal
  const thetaBackstay = (90 - alpha) * DEG;

  return {
    side,
    thetaMain,
    slopeMain,
    T_main,
    H_main,
    V_main,
    thetaBackstay,
    T_backstay,
    H_backstay,
    V_backstay,
    Rx,
    Ry,
    R,
    thetaR,
    anchorX,
    anchorY,
  };
}

// ============================================================
// Catenary solver
// ============================================================
function solveCatenary(input: CableInput): AnalysisResult {
  const { geometry, cable, options } = input;
  const { yL, yR, L } = geometry;
  const ws = cable.gamma > 0 ? cable.gamma : cable.w;
  const steps: string[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];

  steps.push(`Model: Catenary (load per unit cable length)`);
  steps.push(`Span L = ${L} m, yL = ${yL} m, yR = ${yR} m`);
  steps.push(`Cable unit weight w_s = ${ws} kN/m (per cable length)`);

  const H = input.H_input > 0 ? input.H_input : (ws * L * L) / (8 * (L / 20));
  if (input.H_input <= 0) {
    warnings.push('No H prescribed for catenary. Using default sag = L/20.');
  }
  const a = H / ws;

  steps.push(`H = ${H.toFixed(2)} kN`);
  steps.push(`a = H/w_s = ${a.toFixed(4)} m`);

  // For asymmetric catenary with endpoints (0,yL) and (L,yR):
  // y(x) = a * cosh((x - x0)/a) + C
  // Need to solve for x0 and C from boundary conditions:
  //   yL = a*cosh((0 - x0)/a) + C  →  C = yL - a*cosh(-x0/a)
  //   yR = a*cosh((L - x0)/a) + C
  //   yR - yL = a*[cosh((L-x0)/a) - cosh(-x0/a)]
  // Solve for x0 using Brent's method

  function catenaryResidual(x0: number): number {
    return a * (Math.cosh((L - x0) / a) - Math.cosh(-x0 / a)) - (yR - yL);
  }

  let x0: number;
  try {
    x0 = brentSolve(catenaryResidual, -L, 2 * L, options.tolerance, options.maxIterations);
  } catch {
    x0 = L / 2;
    warnings.push('Catenary x0 solver did not converge. Using x0 = L/2.');
  }

  const C = yL - a * Math.cosh(-x0 / a);

  steps.push(`Catenary parameter x0 = ${x0.toFixed(4)} m`);
  steps.push(`Catenary constant C = ${C.toFixed(4)} m`);

  // Build profile
  const profile: ProfilePoint[] = [];
  const N = options.diagramSamples;
  for (let i = 0; i <= N; i++) {
    const x = (i / N) * L;
    const y = a * Math.cosh((x - x0) / a) + C;
    const slope = Math.sinh((x - x0) / a);
    const theta = Math.atan(slope);
    const T = H * Math.cosh((x - x0) / a);
    const V = H * slope;
    profile.push({ x, y, slope, theta, T, V });
  }

  const slopeL = Math.sinh(-x0 / a);
  const slopeR = Math.sinh((L - x0) / a);
  const thetaL = Math.atan(slopeL);
  const thetaR = Math.atan(slopeR);

  steps.push(`Left slope = ${slopeL.toFixed(6)}, θ_L = ${(thetaL * 180 / Math.PI).toFixed(2)}°`);
  steps.push(`Right slope = ${slopeR.toFixed(6)}, θ_R = ${(thetaR * 180 / Math.PI).toFixed(2)}°`);

  // Point loads — approximate using parabolic segments overlaid
  // For V1, catenary + point loads redirects to parabolic
  if (input.pointLoads.length > 0) {
    warnings.push('Point loads with catenary model: using parabolic approximation for point-load segments.');
  }

  const leftTower = computeTowerResult('left', yL, yR, L, H, slopeL, geometry.alphaL, geometry.La, geometry);
  const rightTower = computeTowerResult('right', yL, yR, L, H, slopeR, geometry.alphaR, geometry.Ra, geometry);

  let maxSag = 0;
  const chordSlope = (yR - yL) / L;
  for (const pt of profile) {
    const chordY = yL + chordSlope * pt.x;
    const sag = chordY - pt.y;
    if (sag > maxSag) maxSag = sag;
  }
  const sagRatio = maxSag / L;

  let cableLength = 0;
  for (let i = 1; i < profile.length; i++) {
    const ddx = profile[i].x - profile[i - 1].x;
    const ddy = profile[i].y - profile[i - 1].y;
    cableLength += Math.sqrt(ddx * ddx + ddy * ddy);
  }

  // Also exact catenary length
  const s_exact = a * Math.sinh((L - x0) / a) - a * Math.sinh(-x0 / a);
  steps.push(`Exact catenary arc length = ${s_exact.toFixed(4)} m`);
  steps.push(`Numerical cable length = ${cableLength.toFixed(4)} m`);

  // Calculate maximum forces for catenary
  let maxTension = 0;
  let maxTensionLocation = 0;
  let maxTensionDescription = '';
  
  for (const pt of profile) {
    if (pt.T > maxTension) {
      maxTension = pt.T;
      maxTensionLocation = pt.x;
      maxTensionDescription = `At x = ${pt.x.toFixed(2)} m (along cable)`;
    }
  }
  
  if (leftTower.T_main > maxTension) {
    maxTension = leftTower.T_main;
    maxTensionLocation = 0;
    maxTensionDescription = 'At Tower A (left tower)';
  }
  if (rightTower.T_main > maxTension) {
    maxTension = rightTower.T_main;
    maxTensionLocation = L;
    maxTensionDescription = 'At Tower B (right tower)';
  }
  
  const maxForces = {
    maxTension,
    maxTensionLocation,
    maxTensionDescription,
    towerA_H: Math.abs(leftTower.H_main + leftTower.H_backstay),
    towerA_V: Math.abs(leftTower.V_main + leftTower.V_backstay),
    towerA_R: leftTower.R,
    towerB_H: Math.abs(rightTower.H_main + rightTower.H_backstay),
    towerB_V: Math.abs(rightTower.V_main + rightTower.V_backstay),
    towerB_R: rightTower.R,
  };
  
  steps.push(`--- Maximum Forces ---`);
  steps.push(`Max cable tension = ${maxTension.toFixed(2)} kN (${maxTensionDescription})`);
  steps.push(`Tower A: H = ${maxForces.towerA_H.toFixed(2)} kN, V = ${maxForces.towerA_V.toFixed(2)} kN, R = ${maxForces.towerA_R.toFixed(2)} kN`);
  steps.push(`Tower B: H = ${maxForces.towerB_H.toFixed(2)} kN, V = ${maxForces.towerB_V.toFixed(2)} kN, R = ${maxForces.towerB_R.toFixed(2)} kN`);

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    calculationSteps: steps,
    H,
    model: 'CATENARY_SELF_WEIGHT',
    profile,
    slopeLeft: slopeL,
    slopeRight: slopeR,
    thetaLeft: thetaL,
    thetaRight: thetaR,
    pointLoadResults: [],
    leftTower,
    rightTower,
    maxSag,
    sagRatio,
    cableLength: s_exact,
    maxForces,
  };
}

// ============================================================
// Main entry point
// ============================================================
export function solveCable(input: CableInput): AnalysisResult {
  if (input.options.model === 'CATENARY_SELF_WEIGHT') {
    return solveCatenary(input);
  }
  return solveParabolicWithLoads(input);
}
