// ============================================================
// Numerical kernel — root finding, linear algebra, small helpers
// ============================================================

export const DEG = Math.PI / 180;
export const RAD = 180 / Math.PI;
export const G = 9.80665;           // m/s², for kg/m → kN/m

export interface RootResult {
  x: number;
  f: number;
  iterations: number;
  converged: boolean;
}

/**
 * Brent's method on a bracketed root. The bracket is expanded geometrically
 * (upwards and downwards) before giving up, which matters here because the
 * plausible range of H spans several orders of magnitude.
 */
export function brent(
  f: (x: number) => number,
  lo: number,
  hi: number,
  tol = 1e-10,
  maxIter = 200,
): RootResult {
  let a = lo;
  let b = hi;
  let fa = f(a);
  let fb = f(b);

  if (!Number.isFinite(fa) || !Number.isFinite(fb) || fa * fb > 0) {
    let ok = false;
    for (let k = 0; k < 60 && !ok; k++) {
      a = Math.max(a * 0.5, Number.MIN_VALUE);
      b *= 1.8;
      fa = f(a);
      fb = f(b);
      ok = Number.isFinite(fa) && Number.isFinite(fb) && fa * fb <= 0;
    }
    if (!ok) return { x: b, f: fb, iterations: 0, converged: false };
  }

  if (fa === 0) return { x: a, f: 0, iterations: 0, converged: true };
  if (fb === 0) return { x: b, f: 0, iterations: 0, converged: true };

  let c = a;
  let fc = fa;
  let d = b - a;
  let e = d;

  for (let i = 1; i <= maxIter; i++) {
    if (fb * fc > 0) { c = a; fc = fa; d = b - a; e = d; }
    if (Math.abs(fc) < Math.abs(fb)) {
      a = b; b = c; c = a;
      fa = fb; fb = fc; fc = fa;
    }
    const tol1 = 2 * Number.EPSILON * Math.abs(b) + 0.5 * tol;
    const m = 0.5 * (c - b);
    if (Math.abs(m) <= tol1 || fb === 0) {
      return { x: b, f: fb, iterations: i, converged: true };
    }
    if (Math.abs(e) >= tol1 && Math.abs(fa) > Math.abs(fb)) {
      const s = fb / fa;
      let p: number;
      let q: number;
      if (a === c) {
        p = 2 * m * s;
        q = 1 - s;
      } else {
        const q0 = fa / fc;
        const r0 = fb / fc;
        p = s * (2 * m * q0 * (q0 - r0) - (b - a) * (r0 - 1));
        q = (q0 - 1) * (r0 - 1) * (s - 1);
      }
      if (p > 0) q = -q; else p = -p;
      if (2 * p < Math.min(3 * m * q - Math.abs(tol1 * q), Math.abs(e * q))) {
        e = d; d = p / q;
      } else { d = m; e = m; }
    } else { d = m; e = m; }
    a = b; fa = fb;
    b += Math.abs(d) > tol1 ? d : (m > 0 ? tol1 : -tol1);
    fb = f(b);
    if (!Number.isFinite(fb)) return { x: b, f: fb, iterations: i, converged: false };
  }
  return { x: b, f: fb, iterations: maxIter, converged: false };
}

/**
 * Monotone bisection used for capacity searches, where `f` is expensive and
 * only its sign is trustworthy. `f(lo)` must be ≤ 0 and `f(hi)` ≥ 0.
 */
export function bisectRising(
  f: (x: number) => number,
  lo: number,
  hi: number,
  relTol = 1e-4,
  maxIter = 80,
): RootResult {
  let a = lo;
  let b = hi;
  let fa = f(a);
  let fb = f(b);
  if (fa > 0) return { x: a, f: fa, iterations: 0, converged: false };
  if (fb < 0) return { x: b, f: fb, iterations: 0, converged: false };
  let mid = 0.5 * (a + b);
  let fm = 0;
  for (let i = 1; i <= maxIter; i++) {
    mid = 0.5 * (a + b);
    fm = f(mid);
    if (!Number.isFinite(fm)) { b = mid; continue; }
    if (fm >= 0) { b = mid; fb = fm; } else { a = mid; fa = fm; }
    if ((b - a) <= relTol * Math.max(1e-9, Math.abs(mid))) {
      return { x: 0.5 * (a + b), f: fm, iterations: i, converged: true };
    }
  }
  return { x: 0.5 * (a + b), f: fm, iterations: maxIter, converged: false };
}

/**
 * Thomas algorithm for a tridiagonal system given as (sub, diag, sup, rhs).
 * Returns null if the system is singular.
 */
export function solveTridiagonal(
  sub: number[],
  diag: number[],
  sup: number[],
  rhs: number[],
): number[] | null {
  const n = diag.length;
  if (n === 0) return [];
  const c = diag.slice();
  const r = rhs.slice();
  for (let i = 1; i < n; i++) {
    if (Math.abs(c[i - 1]) < 1e-300) return null;
    const m = sub[i] / c[i - 1];
    c[i] -= m * sup[i - 1];
    r[i] -= m * r[i - 1];
  }
  if (Math.abs(c[n - 1]) < 1e-300) return null;
  const x = new Array<number>(n).fill(0);
  x[n - 1] = r[n - 1] / c[n - 1];
  for (let i = n - 2; i >= 0; i--) {
    x[i] = (r[i] - sup[i] * x[i + 1]) / c[i];
  }
  return x.every(Number.isFinite) ? x : null;
}

/** Dense LU solve with partial pivoting. Returns null if singular. */
export function solveDense(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
    }
    if (Math.abs(M[piv][col]) < 1e-14) return null;
    if (piv !== col) { const t = M[piv]; M[piv] = M[col]; M[col] = t; }
    const pv = M[col][col];
    for (let r = col + 1; r < n; r++) {
      const factor = M[r][col] / pv;
      if (factor === 0) continue;
      for (let cc = col; cc <= n; cc++) M[r][cc] -= factor * M[col][cc];
    }
  }
  const x = new Array<number>(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = M[r][n];
    for (let cc = r + 1; cc < n; cc++) s -= M[r][cc] * x[cc];
    x[r] = s / M[r][r];
  }
  return x.every(Number.isFinite) ? x : null;
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function asinh(v: number): number {
  return Math.asinh ? Math.asinh(v) : Math.log(v + Math.sqrt(v * v + 1));
}

/** ∫ √(1+u²) du — closed form, used for exact parabolic arc length. */
export function sqrtIntegral(u: number): number {
  return 0.5 * (u * Math.sqrt(1 + u * u) + asinh(u));
}

/** Linear interpolation on a monotone-x polyline; clamps outside the range. */
export function interpolatePolyline(pts: { x: number; y: number }[], x: number): number {
  if (pts.length === 0) return 0;
  if (x <= pts[0].x) return pts[0].y;
  const last = pts[pts.length - 1];
  if (x >= last.x) return last.y;
  for (let i = 1; i < pts.length; i++) {
    if (x <= pts[i].x) {
      const a = pts[i - 1];
      const b = pts[i];
      const t = (x - a.x) / (b.x - a.x || 1);
      return a.y + t * (b.y - a.y);
    }
  }
  return last.y;
}

export function fmt(v: number, dp = 2): string {
  if (!Number.isFinite(v)) return '—';
  return v.toFixed(dp);
}
