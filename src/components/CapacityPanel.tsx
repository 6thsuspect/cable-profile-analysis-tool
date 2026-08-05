// ============================================================
// Capacity & break-point panel
// ============================================================
import React, { useMemo } from 'react';
import type { AnalysisResult, CableInput, CapacityCheck, CaseResult } from '../types';
import { suggestSection } from '../solver/cableLibrary';
import { Card, Row, StatusBadge, SubHeader, UtilBar, num, numOrInf } from './ui';

interface Props {
  input: CableInput;
  result: AnalysisResult;
  caseResult: CaseResult;
}

const GROUP_ORDER: CapacityCheck['group'][] = [
  'Cable', 'Backstay', 'Tower', 'Anchor', 'Geometry', 'Serviceability',
];

export const CapacityPanel: React.FC<Props> = ({ input, result, caseResult }) => {
  const bp = result.breakPoint;
  const grouped = useMemo(() => {
    const map = new Map<string, CapacityCheck[]>();
    for (const g of GROUP_ORDER) map.set(g, []);
    for (const c of caseResult.checks) {
      if (c.status === 'NOT_CHECKED') continue;
      map.get(c.group)?.push(c);
    }
    return [...map.entries()].filter(([, v]) => v.length > 0);
  }, [caseResult.checks]);

  const failing = caseResult.checks.filter(c => c.status === 'FAIL');
  const worst = caseResult.governingCheck;

  const suggestion = useMemo(() => {
    if (failing.length === 0) return null;
    const needsMoreRope = failing.some(
      c => c.id === 'cable-allowable' || c.id === 'cable-stress' || c.id === 'backstay-allowable',
    );
    if (!needsMoreRope) return null;
    const demand = Math.max(
      caseResult.T_perRope,
      caseResult.leftTower.T_backstay * input.cable.shareFactor / input.cable.nCables,
      caseResult.rightTower.T_backstay * input.cable.shareFactor / input.cable.nCables,
    ) * input.cable.nCables / input.cable.shareFactor;
    const divisor = caseResult.combination.limitState === 'ULS'
      ? input.cable.gammaM : input.cable.FoS;
    const s = suggestSection(
      demand, input.cable.nCables, divisor,
      input.cable.etaTermination * input.cable.etaBend,
    );
    return s;
  }, [failing, caseResult, input.cable]);

  return (
    <div className="space-y-3">
      {/* ── verdict strip ── */}
      <div className={`rounded-lg border px-4 py-3 ${
        failing.length > 0
          ? 'bg-red-50 border-red-300'
          : worst && worst.utilization > 0.85
            ? 'bg-amber-50 border-amber-300'
            : 'bg-emerald-50 border-emerald-300'}`}>
        <div className="flex items-start gap-3">
          <span className="text-2xl leading-none">
            {failing.length > 0 ? '✗' : worst && worst.utilization > 0.85 ? '!' : '✓'}
          </span>
          <div className="flex-1 min-w-0">
            <div className={`text-sm font-bold ${
              failing.length > 0 ? 'text-red-800'
                : worst && worst.utilization > 0.85 ? 'text-amber-800' : 'text-emerald-800'}`}>
              {failing.length > 0
                ? `${failing.length} limit state${failing.length > 1 ? 's' : ''} exceeded`
                : 'All limit states satisfied'}
            </div>
            <div className="text-xs text-slate-700 mt-0.5">
              Governing case <strong>{result.governingCase.label}</strong>
              {worst && <> — <strong>{worst.label}</strong> at {(worst.utilization * 100).toFixed(1)} % utilisation</>}
            </div>
            {failing.length > 0 && (
              <ul className="mt-1.5 space-y-0.5">
                {failing.map(f => (
                  <li key={f.id} className="text-xs text-red-700">
                    • {f.label} — {(f.utilization * 100).toFixed(0)} % ({num(f.demand, 1)} vs {num(f.capacity, 1)} {f.unit})
                  </li>
                ))}
              </ul>
            )}
            {suggestion && (
              <div className="mt-2 text-xs bg-white border border-slate-300 rounded px-2 py-1.5">
                <strong className="text-slate-700">Smallest catalogue section that would work:</strong>{' '}
                <span className="font-mono">{suggestion.name}</span>{' '}
                (MBL {num(suggestion.MBL, 0)} kN, {num(suggestion.Am, 0)} mm²) with the same number of ropes.
                Increasing the rope count is the other lever.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── break point ── */}
      <Card title="Break Point — how much more load the system can take" icon="⚡"
        color="bg-purple-800"
        subtitle={bp.available ? `first limit at λ = ${num(bp.lambdaAllowable, 2)}` : 'not run'}>
        {!bp.available ? (
          <div className="p-3 text-xs text-slate-600">{bp.note}</div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-slate-200 border-b border-slate-200">
              <BigStat label="Variable load applied" value={num(bp.baseVariableLoad, 0)} unit="kN"
                note="at λ = 1" />
              <BigStat label="Allowable variable load" value={num(bp.allowableVariableLoad, 0)} unit="kN"
                tone={bp.lambdaAllowable >= 1 ? 'good' : 'bad'}
                note={bp.lambdaAllowableCheck} />
              <BigStat label="Load at rupture" value={num(bp.ultimateVariableLoad, 0)} unit="kN"
                tone="bad" note={`λ = ${num(bp.lambdaUltimate, 2)}`} />
              <BigStat label="Reserve on variable load"
                value={bp.lambdaAllowable > 0 ? `${num(bp.lambdaAllowable, 2)}×` : 'none'}
                tone={bp.lambdaAllowable >= 1.25 ? 'good' : bp.lambdaAllowable >= 1 ? 'warn' : 'bad'}
                note={bp.lambdaAllowable >= 1
                  ? `${((bp.lambdaAllowable - 1) * 100).toFixed(0)} % spare`
                  : 'already over the limit'} />
            </div>

            <div className="p-3">
              <p className="text-[11px] text-slate-600 leading-snug mb-2">{bp.note}</p>
              {bp.firstLimitStates.length > 0 && (
                <>
                  <SubHeader>Order in which limit states are reached</SubHeader>
                  <div className="mt-1 space-y-1">
                    {bp.firstLimitStates.map((ls, i) => {
                      const over = ls.lambda === 0;
                      const scale = Math.min(1, ls.lambda / Math.max(1e-6, bp.lambdaUltimate || 1));
                      return (
                        <div key={ls.check} className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-400 w-4 text-right">{i + 1}</span>
                          <span className="font-mono text-[11px] w-16 text-right tabular-nums font-semibold
                            text-slate-700">
                            {over ? '< 1.00' : `${num(ls.lambda, 3)}×`}
                          </span>
                          <span className="flex-1 h-2 bg-slate-100 rounded-sm relative overflow-hidden">
                            <span className={`absolute left-0 top-0 h-full ${
                              over ? 'bg-red-600'
                                : ls.check === 'cable-rupture' ? 'bg-red-500' : 'bg-amber-500'}`}
                              style={{ width: `${Math.max(2, scale * 100)}%` }} />
                          </span>
                          <span className="text-[11px] text-slate-600 w-72 truncate" title={ls.label}>
                            {ls.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-4 border-t border-slate-100 pt-2">
                <Row label="Rope tension at rupture" value={num(bp.T_atUltimate, 1)} unit="kN" />
                <Row label="Sag at rupture" value={num(bp.sag_atUltimate, 3)} unit="m" />
              </div>
            </div>
          </>
        )}
      </Card>

      {/* ── all checks ── */}
      <Card title={`Capacity Checks — ${caseResult.label}`} icon="☑" color="bg-slate-700">
        <div className="divide-y divide-slate-100">
          {grouped.map(([group, checks]) => (
            <div key={group}>
              <SubHeader color="bg-slate-100 text-slate-600">{group}</SubHeader>
              {checks.map(c => (
                <div key={c.id} className={`px-3 py-2 ${c.status === 'FAIL' ? 'bg-red-50' : ''}`}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <StatusBadge status={c.status} />
                    <span className="text-xs text-slate-700 flex-1 min-w-[180px]">{c.label}</span>
                    <span className="font-mono text-[11px] text-slate-600 tabular-nums">
                      {num(c.demand, 2)} / {numOrInf(c.capacity, 2)} {c.unit}
                    </span>
                    <UtilBar utilization={c.utilization} />
                  </div>
                  {c.note && (
                    <div className="text-[10px] text-slate-500 mt-0.5 leading-snug pl-12">{c.note}</div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </Card>

      {/* ── towers & anchors ── */}
      <Card title="Tower & Anchor Actions" icon="🗼" color="bg-emerald-700">
        <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
          {[
            { t: caseResult.leftTower, a: caseResult.leftAnchor, tag: 'A (left)' },
            { t: caseResult.rightTower, a: caseResult.rightAnchor, tag: 'B (right)' },
          ].map(({ t, a, tag }) => (
            <div key={tag}>
              <SubHeader color="bg-emerald-50 text-emerald-800">Tower {tag}</SubHeader>
              <div className="divide-y divide-slate-100">
                <Row label="Main cable angle" value={num(t.thetaMain * (180 / Math.PI), 3)} unit="deg" />
                <Row label="Main cable tension" value={num(t.T_main, 2)} unit="kN" highlight />
                <Row label="Backstay angle from vertical" value={num(t.alpha, 2)} unit="deg" />
                <Row label="Backstay tension" value={num(t.T_backstay, 2)} unit="kN" highlight
                  note={t.saddleMode === 'BALANCED_BACKSTAY'
                    ? 'T = H / sin α — a steeper backstay needs more force'
                    : t.saddleMode === 'ROLLER_SADDLE'
                      ? 'T continuous through a frictionless saddle'
                      : 'prescribed by the user'} />
                <Row label="Net horizontal thrust at the saddle" value={num(t.Rx, 2)} unit="kN" />
                <Row label="Net vertical at the saddle" value={num(t.Ry, 2)} unit="kN" />
                <Row label="Resultant on the saddle" value={num(t.R, 2)} unit="kN" />
                <Row label="Base axial" value={num(t.axial, 2)} unit="kN" highlight />
                <Row label="Base shear" value={num(t.shear, 2)} unit="kN" />
                <Row label="Base moment" value={num(t.baseMoment, 2)} unit="kNm" />
                <Row label="Euler critical load" value={t.eulerCritical > 0 ? num(t.eulerCritical, 0) : '—'} unit="kN" />
                <Row label="Overturning FoS"
                  value={t.overturningFoS > 0 ? numOrInf(t.overturningFoS, 2) : 'n/a'} unit="—" />
              </div>
              <SubHeader color="bg-orange-50 text-orange-800">Anchor {tag}</SubHeader>
              <div className="divide-y divide-slate-100">
                <Row label="Uplift on the block" value={num(a.upliftDemand, 2)} unit="kN" />
                <Row label="Uplift resistance" value={num(a.upliftResistance, 2)} unit="kN"
                  note={`block ${num(a.weight, 0)} kN + tie-downs ${num(a.tieDown, 0)} kN`} />
                <Row label="Uplift FoS" value={numOrInf(a.upliftFoS, 2)} unit="—" highlight />
                <Row label="Horizontal pull" value={num(a.slidingDemand, 2)} unit="kN" />
                <Row label="Sliding resistance" value={num(a.slidingResistance, 2)} unit="kN" />
                <Row label="Sliding FoS" value={numOrInf(a.slidingFoS, 2)} unit="—" highlight />
                <Row label="Block weight needed (uplift)" value={num(a.requiredWeightUplift, 0)} unit="kN" />
                <Row label="Block weight needed (sliding)" value={numOrInf(a.requiredWeightSliding, 0)} unit="kN" />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

const BigStat: React.FC<{
  label: string; value: string; unit?: string; note?: string;
  tone?: 'neutral' | 'good' | 'warn' | 'bad';
}> = ({ label, value, unit, note, tone = 'neutral' }) => {
  const tones = {
    neutral: 'text-slate-900', good: 'text-emerald-700',
    warn: 'text-amber-700', bad: 'text-red-700',
  };
  return (
    <div className="px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-wider text-slate-500 leading-tight">{label}</div>
      <div className={`font-mono font-bold text-xl leading-tight tabular-nums ${tones[tone]}`}>
        {value}{unit && <span className="text-xs font-normal text-slate-500 ml-1">{unit}</span>}
      </div>
      {note && <div className="text-[10px] text-slate-400 leading-snug mt-0.5">{note}</div>}
    </div>
  );
};
