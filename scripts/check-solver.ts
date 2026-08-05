// ============================================================
// Head-less numeric check of the solver.
//   npm run check
// Bundles the solver with esbuild and runs it under node, printing the
// verification suite plus a full analysis of every preset. Non-zero exit
// if a benchmark fails or a preset throws.
// ============================================================
import { solveCable } from '../src/solver/CableSolver';
import { PRESETS } from '../src/solver/presets';
import { runVerification } from '../src/solver/verification';

const pad = (s: string, n: number) => (s.length >= n ? s : s + ' '.repeat(n - s.length));
const padL = (s: string, n: number) => (s.length >= n ? s : ' '.repeat(n - s.length) + s);

let failures = 0;

console.log('\n════════════ VERIFICATION SUITE ════════════');
const v = runVerification();
for (const it of v.items) {
  const mark = it.pass ? 'PASS' : 'FAIL';
  if (!it.pass) failures++;
  console.log(
    `${mark}  ${pad(it.name, 56)} expected ${padL(it.expected.toPrecision(10), 16)} ` +
    `got ${padL(it.computed.toPrecision(10), 16)} ${pad(it.unit, 4)} relerr ${it.relativeError.toExponential(2)}`,
  );
}
console.log(`\n${v.items.filter(i => i.pass).length}/${v.items.length} benchmarks pass`);

for (const preset of PRESETS) {
  console.log(`\n\n════════════ PRESET: ${preset.label} ════════════`);
  const t0 = Date.now();
  let r;
  try {
    r = solveCable(preset.build());
  } catch (e) {
    console.log(`  THREW: ${(e as Error).message}`);
    failures++;
    continue;
  }
  const ms = Date.now() - t0;

  console.log(`  solve time                ${ms} ms`);
  console.log(`  model                     ${r.model}`);
  console.log(`  installed  H0             ${r.installed.H0.toFixed(3)} kN`);
  console.log(`  installed  sag0           ${r.installed.sag0.toFixed(4)} m`);
  console.log(`  cut length L0             ${r.installed.L0.toFixed(5)} m`);
  console.log(`  installed  stress         ${r.installed.stress0.toFixed(1)} MPa`);

  console.log('\n  case                                     H(kN)    sag(m)  T/rope(kN)  util   FoS   clr(m)');
  for (const c of r.cases) {
    console.log(
      `  ${pad(c.label, 38)} ${padL(c.H.toFixed(1), 8)} ${padL(c.maxSag.toFixed(3), 9)} ` +
      `${padL(c.T_perRope.toFixed(1), 11)} ${padL((c.worstUtilization * 100).toFixed(0) + '%', 6)} ` +
      `${padL(c.FoS_actual.toFixed(2), 6)} ${padL(c.minClearance.toFixed(2), 8)}`,
    );
  }

  const g = r.governingCase;
  console.log(`\n  governing case            ${g.label}`);
  console.log(`  governing check           ${g.governingCheck?.label ?? '—'} at ${(g.worstUtilization * 100).toFixed(1)} %`);
  console.log(`  sag growth under load     ${((g.maxSag - r.installed.sag0) * 1000).toFixed(0)} mm ` +
    `(${(g.maxSag / r.installed.sag0).toFixed(3)}× the installed sag)`);
  console.log(`  elastic stretch           ${(g.elasticElongation * 1000).toFixed(1)} mm`);

  console.log('\n  checks (governing case):');
  for (const c of g.checks) {
    if (c.status === 'NOT_CHECKED') continue;
    console.log(
      `    ${pad(c.status, 8)} ${pad(c.label, 52)} ${padL(c.demand.toFixed(2), 12)} / ` +
      `${padL(c.capacity.toFixed(2), 12)} ${pad(c.unit, 5)} = ${(c.utilization * 100).toFixed(1)}%`,
    );
  }

  const bp = r.breakPoint;
  console.log('\n  break point:');
  console.log(`    available               ${bp.available}`);
  console.log(`    first limit state       λ = ${bp.lambdaAllowable.toFixed(3)} — ${bp.lambdaAllowableCheck}`);
  console.log(`    rupture                 λ = ${bp.lambdaUltimate.toFixed(3)} — T = ${bp.T_atUltimate.toFixed(0)} kN/rope, sag ${bp.sag_atUltimate.toFixed(2)} m`);
  console.log(`    variable load @ 1.0     ${bp.baseVariableLoad.toFixed(1)} kN`);
  console.log(`    allowable variable load ${bp.allowableVariableLoad.toFixed(1)} kN`);
  console.log(`    ultimate variable load  ${bp.ultimateVariableLoad.toFixed(1)} kN`);
  for (const ls of bp.firstLimitStates.slice(0, 6)) {
    console.log(`      λ=${ls.lambda.toFixed(3)}  ${ls.label}`);
  }

  const s = r.stiffness;
  console.log('\n  stiffness:');
  console.log(`    EA system               ${s.EA.toFixed(0)} kN`);
  console.log(`    E_dischinger            ${s.E_dischinger.toFixed(0)} MPa (${(s.E_ratio * 100).toFixed(1)} % of E)`);
  console.log(`    vertical stiffness      ${Number.isFinite(s.verticalStiffness) ? s.verticalStiffness.toFixed(1) : '∞'} kN/m at x = ${s.probeX.toFixed(1)} m`);
  console.log(`    deflection per kN       ${s.deflectionPerKN.toFixed(3)} mm/kN`);
  console.log(`    dH/dP                   ${s.dH_dP.toFixed(3)} kN/kN`);
  console.log(`    dSag/dT                 ${s.dSag_dT.toFixed(3)} mm/°C`);
  console.log(`    dH/dT                   ${s.dH_dT.toFixed(3)} kN/°C`);

  if (r.launching.available) {
    const l = r.launching;
    console.log('\n  launching envelope:');
    console.log(`    ${l.note}`);
    console.log(`    worst tension           ${l.worstTension?.T_perRope.toFixed(1)} kN/rope with the nose at x = ${l.worstTension?.frontPosition.toFixed(1)} m`);
    console.log(`    worst sag               ${l.worstSag?.maxSag.toFixed(3)} m at x = ${l.worstSag?.frontPosition.toFixed(1)} m`);
    console.log(`    worst clearance         ${l.worstClearance?.minClearance.toFixed(3)} m at x = ${l.worstClearance?.frontPosition.toFixed(1)} m`);
    console.log(`    feasible                ${l.feasible}${l.feasible ? '' : ' — ' + l.blockingReason}`);
  }

  if (r.warnings.length > 0) {
    console.log('\n  warnings:');
    for (const w of r.warnings) console.log(`    ! ${w}`);
  }
}

console.log(`\n\n${failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECK(S) FAILED'}\n`);
process.exit(failures === 0 ? 0 : 1);
