// ============================================================
// Load-case comparison and per-case detail
// ============================================================
import React from 'react';
import type { AnalysisResult, CableInput } from '../types';
import { Card, Row, StatusBadge, SubHeader, UtilBar, num, numOrInf } from './ui';

const RAD = 180 / Math.PI;

interface Props {
  input: CableInput;
  result: AnalysisResult;
  selectedId: string;
  onSelect: (id: string) => void;
}

export const CasesPanel: React.FC<Props> = ({ input, result, selectedId, onSelect }) => {
  const sel = result.cases.find(c => c.id === selectedId) ?? result.primary;
  const inst = result.installed;

  return (
    <div className="space-y-3">
      {/* ── installed state ── */}
      <Card title="Installed State — the invariant behind every load case" icon="⚓"
        color="bg-slate-700"
        subtitle={`cut length L₀ = ${num(inst.L0, 4)} m`}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
          <div className="divide-y divide-slate-100">
            <Row label="Defined by" value={describeControl(inst.derivedFrom)} />
            <Row label="Dead-load tension H₀" value={num(inst.H0, 3)} unit="kN" highlight />
            <Row label="Dead-load sag" value={num(inst.sag0, 4)} unit="m" highlight />
            <Row label="Sag / span" value={inst.sag0 > 0 ? `1 / ${num(input.geometry.L / inst.sag0, 1)}` : '—'} />
            <Row label="Deformed arc length" value={num(inst.arcLength0, 5)} unit="m" />
          </div>
          <div className="divide-y divide-slate-100">
            <Row label="Unstressed (cut) length L₀" value={num(inst.L0, 5)} unit="m" highlight
              note="Order this length. Everything downstream is compatible with it." />
            <Row label="Elastic stretch at installation"
              value={num(inst.elasticElongation0 * 1000, 1)} unit="mm" />
            <Row label="Installed stress" value={num(inst.stress0, 1)} unit="MPa" />
            <Row label="System self weight" value={num(inst.gammaSelf, 4)} unit="kN/m"
              note="per metre of cable" />
            <Row label="Equivalent per horizontal metre" value={num(inst.wSelf, 4)} unit="kN/m" />
          </div>
        </div>
      </Card>

      {/* ── comparison table ── */}
      <Card title="Load Combinations" icon="Σ" color="bg-violet-700"
        subtitle={`governing: ${result.governingCase.label}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead className="bg-slate-100">
              <tr className="text-slate-600">
                <th className="px-2 py-1.5 text-left font-semibold">Combination</th>
                <th className="px-2 py-1.5 text-right font-semibold">H<br /><span className="font-normal">kN</span></th>
                <th className="px-2 py-1.5 text-right font-semibold">sag<br /><span className="font-normal">m</span></th>
                <th className="px-2 py-1.5 text-right font-semibold">Δsag<br /><span className="font-normal">mm</span></th>
                <th className="px-2 py-1.5 text-right font-semibold">T sys<br /><span className="font-normal">kN</span></th>
                <th className="px-2 py-1.5 text-right font-semibold">T/rope<br /><span className="font-normal">kN</span></th>
                <th className="px-2 py-1.5 text-right font-semibold">σ<br /><span className="font-normal">MPa</span></th>
                <th className="px-2 py-1.5 text-right font-semibold">FoS<br /><span className="font-normal">—</span></th>
                <th className="px-2 py-1.5 text-right font-semibold">clear.<br /><span className="font-normal">m</span></th>
                <th className="px-2 py-1.5 text-left font-semibold pl-3">Governing check</th>
                <th className="px-2 py-1.5 text-center font-semibold">Show</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
              {result.cases.map(c => {
                const isGov = c.id === result.governingCase.id;
                const isSel = c.id === sel.id;
                return (
                  <tr key={c.id} className={
                    isSel ? 'bg-blue-50' : isGov ? 'bg-amber-50/70' : ''}>
                    <td className="px-2 py-1.5 font-sans">
                      <span className="flex items-center gap-1.5">
                        <StatusBadge status={
                          c.checks.some(k => k.status === 'FAIL') ? 'FAIL'
                            : c.worstUtilization > 0.85 ? 'WARNING' : 'OK'} />
                        <span className={isGov ? 'font-bold' : ''}>{c.label}</span>
                        {isGov && <span className="text-[9px] text-amber-700 font-bold">GOVERNS</span>}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-right">{num(c.H, 1)}</td>
                    <td className="px-2 py-1.5 text-right">{num(c.maxSag, 3)}</td>
                    <td className="px-2 py-1.5 text-right text-slate-500">
                      {c.maxSag >= inst.sag0 ? '+' : ''}{num((c.maxSag - inst.sag0) * 1000, 0)}
                    </td>
                    <td className="px-2 py-1.5 text-right">{num(c.T_max, 0)}</td>
                    <td className="px-2 py-1.5 text-right font-semibold">{num(c.T_perRope, 1)}</td>
                    <td className="px-2 py-1.5 text-right">{num(c.stress, 0)}</td>
                    <td className={`px-2 py-1.5 text-right ${c.FoS_actual < input.cable.FoS ? 'text-red-700 font-bold' : ''}`}>
                      {num(c.FoS_actual, 2)}
                    </td>
                    <td className="px-2 py-1.5 text-right">{num(c.minClearance, 2)}</td>
                    <td className="px-2 py-1.5 pl-3 font-sans">
                      <span className="flex items-center gap-2">
                        <span className="text-slate-600 truncate max-w-[180px]" title={c.governingCheck?.label}>
                          {c.governingCheck?.label ?? '—'}
                        </span>
                        <UtilBar utilization={c.worstUtilization} width={50} />
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <input type="radio" checked={isSel} onChange={() => onSelect(c.id)}
                        className="accent-blue-600" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-3 py-2 border-t border-slate-200 text-[10px] text-slate-500 leading-snug">
          Δsag is the growth from the installed profile. It is bounded by the elastic stretch of
          the rope plus any temperature movement and tower-top give — which is why it stays small
          even when the tension multiplies. A temperature <em>drop</em> shortens the cable and
          therefore raises the tension; a rise does the opposite and eats into the clearance.
        </div>
      </Card>

      {/* ── selected case detail ── */}
      <Card title={`Detail — ${sel.label}`} icon="📋" color="bg-blue-700">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
          <div>
            <SubHeader>Cable</SubHeader>
            <div className="divide-y divide-slate-100">
              <Row label="Horizontal tension H" value={num(sel.H, 3)} unit="kN" highlight />
              <Row label="Maximum tension (system)" value={num(sel.T_max, 2)} unit="kN"
                note={sel.T_maxDescription} />
              <Row label="Maximum tension per rope" value={num(sel.T_perRope, 2)} unit="kN" highlight
                note={`includes the load-sharing factor ${num(input.cable.shareFactor, 2)}`} />
              <Row label="Stress" value={num(sel.stress, 1)} unit="MPa" />
              <Row label="Strain" value={num(sel.strain * 1e6, 0)} unit="µε" />
              <Row label="Utilisation of MBL·η" value={`${(sel.utilizationMBL * 100).toFixed(1)} %`} />
              <Row label="Actual factor of safety" value={num(sel.FoS_actual, 3)} unit="—" highlight />
              <Row label="Left cable angle θL" value={num(sel.thetaLeft * RAD, 3)} unit="deg" />
              <Row label="Right cable angle θR" value={num(sel.thetaRight * RAD, 3)} unit="deg" />
              <Row label="Left slope" value={num(sel.slopeLeft, 6)} />
              <Row label="Right slope" value={num(sel.slopeRight, 6)} />
            </div>
            <SubHeader>Geometry</SubHeader>
            <div className="divide-y divide-slate-100">
              <Row label="Maximum sag below the chord" value={num(sel.maxSag, 4)} unit="m" highlight
                note={`at x = ${num(sel.maxSagX, 2)} m`} />
              <Row label="Sag / span" value={sel.sagRatio > 0 ? `1 / ${num(1 / sel.sagRatio, 1)}` : '—'} />
              <Row label="Lowest point of the cable" value={num(sel.lowestPointY, 3)} unit="m"
                note={`at x = ${num(sel.lowestPointX, 2)} m`} />
              <Row label="Clearance to the cable" value={num(sel.minCableClearance, 3)} unit="m" />
              <Row label="Governing clearance" value={num(sel.minClearance, 3)} unit="m" highlight
                note={`at x = ${num(sel.minClearanceX, 2)} m` +
                  (sel.unitFootprint ? `; unit occupies x = ${num(sel.unitFootprint.from, 1)}…${num(sel.unitFootprint.to, 1)} m` : '')} />
            </div>
          </div>

          <div>
            <SubHeader>Length book-keeping</SubHeader>
            <div className="divide-y divide-slate-100">
              <Row label="Deformed arc length S" value={num(sel.arcLength, 5)} unit="m" />
              <Row label="Unstressed length L₀" value={num(inst.L0, 5)} unit="m" />
              <Row label="Elastic stretch" value={num(sel.elasticElongation * 1000, 2)} unit="mm" highlight
                note="∫T ds / EA — the only way the sag can grow" />
              <Row label="Thermal movement" value={num(sel.thermalElongation * 1000, 2)} unit="mm"
                note={`ΔT = ${num(sel.combination.dT, 1)} °C`} />
              <Row label="Tower-top give" value={num(sel.supportGive * 1000, 2)} unit="mm" />
              <Row label="Compatibility residual" value={sel.residual.toExponential(2)} unit="m"
                note="how exactly S = L₀ + stretch + thermal + give is satisfied" />
              <Row label="Solver iterations" value={String(sel.iterations)} />
            </div>
            <SubHeader>Loads</SubHeader>
            <div className="divide-y divide-slate-100">
              <Row label="Factored dead load on the span" value={num(sel.totalDeadLoad, 2)} unit="kN"
                note="γ × arc length + superimposed UDL" />
              <Row label="Factored variable load" value={num(sel.totalVariableLoad, 2)} unit="kN" highlight />
              <Row label="γ_DL / γ_LL"
                value={`${num(sel.combination.gDL, 2)} / ${num(sel.combination.gLL, 2)}`} />
              <Row label="DAF applied"
                value={sel.combination.useDAF ? num(input.launching.DAF, 2) : 'no'} />
              {sel.windAmplification > 1 && (
                <>
                  <Row label="Wind swing angle" value={num(sel.windSwingAngle, 2)} unit="deg" />
                  <Row label="Wind tension amplification" value={num(sel.windAmplification, 4)} unit="×" />
                </>
              )}
              <Row label="Vertical equilibrium check"
                value={`${num(sel.H * (sel.slopeRight - sel.slopeLeft), 3)} kN`}
                note={`must equal the total applied load ${num(sel.totalDeadLoad + sel.totalVariableLoad, 3)} kN`} />
            </div>
          </div>
        </div>

        {/* point loads */}
        {sel.pointLoadResults.length > 0 && (
          <>
            <SubHeader color="bg-rose-50 text-rose-800">
              Point loads / bogies — {sel.pointLoadResults.length}
            </SubHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead className="bg-slate-100 text-slate-600">
                  <tr>
                    {['load', 'x (m)', 'P (kN)', 'cable y (m)', 'dip vs installed (mm)',
                      'm left', 'm right', 'θL (°)', 'θR (°)', 'T left (kN)', 'T right (kN)',
                      'H·Δm (kN)', 'error (kN)'].map(h => (
                      <th key={h} className="px-2 py-1.5 text-right font-semibold whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
                  {sel.pointLoadResults.map((p, i) => (
                    <tr key={i} className={i % 2 ? 'bg-slate-50/60' : ''}>
                      <td className="px-2 py-1 text-right font-sans font-semibold">{p.load.label}</td>
                      <td className="px-2 py-1 text-right">{num(p.load.x, 2)}</td>
                      <td className="px-2 py-1 text-right">{num(p.load.P, 2)}</td>
                      <td className="px-2 py-1 text-right">{num(p.yp, 3)}</td>
                      <td className="px-2 py-1 text-right">{num(p.deflectionFromInstalled * 1000, 0)}</td>
                      <td className="px-2 py-1 text-right">{num(p.slopeLeft, 5)}</td>
                      <td className="px-2 py-1 text-right">{num(p.slopeRight, 5)}</td>
                      <td className="px-2 py-1 text-right">{num(p.thetaLeft * RAD, 2)}</td>
                      <td className="px-2 py-1 text-right">{num(p.thetaRight * RAD, 2)}</td>
                      <td className="px-2 py-1 text-right">{num(p.T_left, 2)}</td>
                      <td className="px-2 py-1 text-right">{num(p.T_right, 2)}</td>
                      <td className="px-2 py-1 text-right">{num(p.equilibriumCheck, 3)}</td>
                      <td className={`px-2 py-1 text-right ${p.equilibriumError > 1e-3 ? 'text-red-600' : 'text-emerald-600'}`}>
                        {p.equilibriumError.toExponential(1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-3 py-1.5 text-[10px] text-slate-500">
              H·(m_R − m_L) must equal P at every load — this is the vertical equilibrium of the
              kink the load puts in the cable, and the error column shows how well it is satisfied.
            </div>
          </>
        )}
      </Card>

      {/* ── stiffness ── */}
      <Card title="Stiffness" icon="↕" color="bg-cyan-800">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
          <div className="divide-y divide-slate-100">
            <Row label="Axial rigidity EA, one rope" value={num(result.stiffness.EA_perRope, 0)} unit="kN" />
            <Row label="Axial rigidity EA, system" value={num(result.stiffness.EA, 0)} unit="kN" highlight />
            <Row label="Dischinger equivalent modulus" value={num(result.stiffness.E_dischinger, 0)} unit="MPa"
              note={`${(result.stiffness.E_ratio * 100).toFixed(1)} % of the material modulus — the shortfall is the sag change that accompanies a tension change`} />
            <Row label="Taut-string term H/L" value={num(result.stiffness.geometricStiffness, 2)} unit="kN/m" />
          </div>
          <div className="divide-y divide-slate-100">
            <Row label="Vertical stiffness at the probe"
              value={numOrInf(result.stiffness.verticalStiffness, 1)} unit="kN/m" highlight
              note={`dP/dδ at x = ${num(result.stiffness.probeX, 1)} m, from the full nonlinear solve`} />
            <Row label="Deflection per kN" value={num(result.stiffness.deflectionPerKN, 3)} unit="mm/kN" />
            <Row label="dH / dP" value={num(result.stiffness.dH_dP, 3)} unit="kN/kN"
              note="how much the horizontal tension rises per kN of extra load" />
            <Row label="dSag / dP" value={num(result.stiffness.dSag_dP, 3)} unit="mm/kN" />
            <Row label="dSag / dT" value={num(result.stiffness.dSag_dT, 3)} unit="mm/°C" />
            <Row label="dH / dT" value={num(result.stiffness.dH_dT, 3)} unit="kN/°C"
              note="negative: warming relaxes the cable" />
          </div>
        </div>
      </Card>
    </div>
  );
};

function describeControl(mode: string): string {
  switch (mode) {
    case 'INSTALLED_SAG': return 'prescribed installed sag → cut length back-calculated';
    case 'INSTALLED_H': return 'prescribed installed tension → cut length back-calculated';
    case 'UNSTRESSED_LENGTH': return 'cut length prescribed directly';
    case 'RIGID_FIXED_H': return 'H prescribed for every case (rigid, non-physical)';
    default: return mode;
  }
}
