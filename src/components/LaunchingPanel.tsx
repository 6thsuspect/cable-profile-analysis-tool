// ============================================================
// Launching envelope — sweep the unit across the crossing
// ============================================================
import React, { useMemo, useState } from 'react';
import type { AnalysisResult, CableInput, LaunchEnvelopePoint } from '../types';
import { Card, Row, niceStep, num } from './ui';

interface Props {
  input: CableInput;
  result: AnalysisResult;
  onSetFrontPosition: (x: number) => void;
}

type Series = 'T_perRope' | 'maxSag' | 'minClearance' | 'H' | 'towerA_R' | 'towerB_R' | 'utilization';

const SERIES: { key: Series; label: string; unit: string; colour: string; dp: number }[] = [
  { key: 'T_perRope', label: 'Tension per rope', unit: 'kN', colour: '#1d4ed8', dp: 1 },
  { key: 'H', label: 'Horizontal tension H', unit: 'kN', colour: '#0891b2', dp: 1 },
  { key: 'maxSag', label: 'Maximum sag', unit: 'm', colour: '#7c3aed', dp: 3 },
  { key: 'minClearance', label: 'Minimum clearance', unit: 'm', colour: '#f43f5e', dp: 3 },
  { key: 'towerA_R', label: 'Saddle resultant, Tower A', unit: 'kN', colour: '#059669', dp: 1 },
  { key: 'towerB_R', label: 'Saddle resultant, Tower B', unit: 'kN', colour: '#ca8a04', dp: 1 },
  { key: 'utilization', label: 'Worst utilisation', unit: '—', colour: '#dc2626', dp: 3 },
];

export const LaunchingPanel: React.FC<Props> = ({ input, result, onSetFrontPosition }) => {
  const lr = result.launching;
  const [active, setActive] = useState<Series>('T_perRope');
  const [hover, setHover] = useState<LaunchEnvelopePoint | null>(null);

  if (!lr.available) {
    return (
      <div className="bg-white border border-slate-300 rounded-lg p-8 text-center">
        <div className="text-3xl mb-2">🚧</div>
        <h3 className="text-sm font-semibold text-slate-700">Launching envelope not available</h3>
        <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">{lr.note}</p>
      </div>
    );
  }

  const meta = SERIES.find(s => s.key === active)!;
  const pts = lr.points.filter(p => p.converged);

  const svgW = 940;
  const svgH = 330;
  const mLft = 62;
  const mRt = 26;
  const mTp = 20;
  const mBt = 46;
  const pw = svgW - mLft - mRt;
  const ph = svgH - mTp - mBt;

  const { minX, maxX, minY, maxY } = useMemo(() => {
    const xs = pts.map(p => p.frontPosition);
    const ys = pts.map(p => p[active] as number);
    const lo = Math.min(...ys, active === 'utilization' ? 0 : Math.min(...ys));
    const hi = Math.max(...ys, active === 'utilization' ? 1 : Math.max(...ys));
    const pad = (hi - lo) * 0.12 || 1;
    return {
      minX: Math.min(...xs), maxX: Math.max(...xs),
      minY: lo - pad, maxY: hi + pad,
    };
  }, [pts, active]);

  const sx = (x: number) => mLft + ((x - minX) / (maxX - minX || 1)) * pw;
  const sy = (y: number) => mTp + (1 - (y - minY) / (maxY - minY || 1)) * ph;

  const line = pts
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${sx(p.frontPosition).toFixed(1)},${sy(p[active] as number).toFixed(1)}`)
    .join(' ');

  const extreme = useMemo(() => {
    if (pts.length === 0) return null;
    const worseHigh = active !== 'minClearance';
    return pts.reduce((a, b) =>
      (worseHigh ? (b[active] as number) > (a[active] as number)
        : (b[active] as number) < (a[active] as number)) ? b : a);
  }, [pts, active]);

  const gridX = useMemo(() => {
    const step = niceStep((maxX - minX) / 8);
    const out: number[] = [];
    for (let x = Math.ceil(minX / step) * step; x <= maxX; x += step) out.push(x);
    return out;
  }, [minX, maxX]);
  const gridY = useMemo(() => {
    const step = niceStep((maxY - minY) / 5);
    const out: number[] = [];
    for (let y = Math.ceil(minY / step) * step; y <= maxY; y += step) out.push(y);
    return out;
  }, [minY, maxY]);

  const L = input.geometry.L;
  const required = input.site.requiredClearance;
  const allowPerRope =
    (input.cable.section.MBL * input.cable.etaTermination * input.cable.etaBend) /
    Math.max(1.05, input.cable.FoS);

  const limitLine =
    active === 'T_perRope' ? allowPerRope
      : active === 'minClearance' ? required
        : active === 'utilization' ? 1
          : null;

  return (
    <div className="space-y-3">
      {/* verdict */}
      <div className={`rounded-lg border px-4 py-3 ${
        lr.feasible ? 'bg-emerald-50 border-emerald-300' : 'bg-red-50 border-red-300'}`}>
        <div className="flex items-start gap-3">
          <span className="text-2xl leading-none">{lr.feasible ? '✓' : '✗'}</span>
          <div>
            <div className={`text-sm font-bold ${lr.feasible ? 'text-emerald-800' : 'text-red-800'}`}>
              {lr.feasible
                ? 'The launch can be completed within all limit states'
                : 'The launch cannot be completed as configured'}
            </div>
            {!lr.feasible && (
              <div className="text-xs text-red-700 mt-0.5">{lr.blockingReason}</div>
            )}
            <div className="text-[11px] text-slate-600 mt-1">{lr.note}</div>
          </div>
        </div>
      </div>

      {/* chart */}
      <div className="bg-white border border-slate-300 rounded-lg overflow-hidden">
        <div className="bg-slate-800 text-white px-3 py-2 text-sm font-semibold flex items-center justify-between gap-2 flex-wrap">
          <span>Envelope through the launch</span>
          <select value={active} onChange={e => setActive(e.target.value as Series)}
            className="bg-slate-700 text-white text-[11px] px-2 py-1 rounded border border-slate-600 outline-none">
            {SERIES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </div>

        <svg width="100%" height={svgH} viewBox={`0 0 ${svgW} ${svgH}`} className="bg-slate-50"
          onMouseMove={e => {
            const r = e.currentTarget.getBoundingClientRect();
            const mx = ((e.clientX - r.left) / r.width) * svgW;
            const xVal = minX + ((mx - mLft) / pw) * (maxX - minX);
            let best: LaunchEnvelopePoint | null = null;
            let bd = Infinity;
            for (const p of pts) {
              const d = Math.abs(p.frontPosition - xVal);
              if (d < bd) { bd = d; best = p; }
            }
            setHover(best);
          }}
          onMouseLeave={() => setHover(null)}
          onClick={() => { if (hover) onSetFrontPosition(hover.frontPosition); }}
        >
          {gridX.map(x => (
            <g key={`x${x}`}>
              <line x1={sx(x)} y1={mTp} x2={sx(x)} y2={svgH - mBt} stroke="#e2e8f0" strokeWidth={0.6} />
              <text x={sx(x)} y={svgH - mBt + 14} textAnchor="middle" className="text-[10px] fill-slate-500">
                {x.toFixed(0)}
              </text>
            </g>
          ))}
          {gridY.map(y => (
            <g key={`y${y}`}>
              <line x1={mLft} y1={sy(y)} x2={svgW - mRt} y2={sy(y)} stroke="#e2e8f0" strokeWidth={0.6} />
              <text x={mLft - 6} y={sy(y) + 3} textAnchor="end" className="text-[10px] fill-slate-500">
                {y.toFixed(meta.dp > 2 ? 2 : meta.dp)}
              </text>
            </g>
          ))}

          {/* span markers */}
          {[0, L].map(x => (
            x >= minX && x <= maxX ? (
              <g key={`span${x}`}>
                <line x1={sx(x)} y1={mTp} x2={sx(x)} y2={svgH - mBt}
                  stroke="#1e3a8a" strokeWidth={1} strokeDasharray="3,3" />
                <text x={sx(x) + 3} y={mTp + 11} className="text-[9px] fill-blue-900 font-semibold">
                  {x === 0 ? 'nose at Tower A' : 'nose at Tower B'}
                </text>
              </g>
            ) : null
          ))}

          {/* limit line */}
          {limitLine !== null && limitLine >= minY && limitLine <= maxY && (
            <>
              <line x1={mLft} y1={sy(limitLine)} x2={svgW - mRt} y2={sy(limitLine)}
                stroke="#dc2626" strokeWidth={1.4} strokeDasharray="7,4" />
              <text x={svgW - mRt - 4} y={sy(limitLine) - 4} textAnchor="end"
                className="text-[9px] fill-red-700 font-semibold">
                limit {num(limitLine, meta.dp)} {meta.unit}
              </text>
            </>
          )}

          <path d={line} fill="none" stroke={meta.colour} strokeWidth={2.4} />

          {/* extreme marker */}
          {extreme && (
            <g>
              <circle cx={sx(extreme.frontPosition)} cy={sy(extreme[active] as number)} r={5}
                fill="#fff" stroke={meta.colour} strokeWidth={2.5} />
              <text x={sx(extreme.frontPosition)} y={sy(extreme[active] as number) - 11}
                textAnchor="middle" className="text-[10px] font-bold" fill={meta.colour}>
                {num(extreme[active] as number, meta.dp)} {meta.unit}
              </text>
            </g>
          )}

          {hover && (
            <g>
              <line x1={sx(hover.frontPosition)} y1={mTp} x2={sx(hover.frontPosition)} y2={svgH - mBt}
                stroke="#64748b" strokeWidth={1} />
              <circle cx={sx(hover.frontPosition)} cy={sy(hover[active] as number)} r={4} fill={meta.colour} />
              {(() => {
                const bx = Math.min(sx(hover.frontPosition) + 10, svgW - 172);
                return (
                  <>
                    <rect x={bx} y={mTp + 4} width={162} height={74} rx={4} fill="rgba(15,23,42,0.93)" />
                    {[
                      `nose x = ${num(hover.frontPosition, 1)} m`,
                      `T/rope = ${num(hover.T_perRope, 1)} kN`,
                      `H = ${num(hover.H, 0)} kN`,
                      `sag = ${num(hover.maxSag, 3)} m`,
                      `clearance = ${num(hover.minClearance, 2)} m`,
                    ].map((t, i) => (
                      <text key={i} x={bx + 8} y={mTp + 19 + i * 12}
                        className="text-[10px] fill-white font-mono">{t}</text>
                    ))}
                  </>
                );
              })()}
            </g>
          )}

          <text x={svgW / 2} y={svgH - 6} textAnchor="middle" className="text-[11px] fill-slate-600 font-medium">
            position of the leading bogie (m from Tower A)
          </text>
          <text x={13} y={svgH / 2} textAnchor="middle" className="text-[11px] fill-slate-600 font-medium"
            transform={`rotate(-90 13 ${svgH / 2})`}>{meta.label} ({meta.unit})</text>
        </svg>
        <div className="px-3 py-1.5 border-t border-slate-200 text-[10px] text-slate-500">
          Click anywhere on the chart to move the launch to that position and see the full profile.
        </div>
      </div>

      {/* worst-case summary */}
      <Card title="Governing positions during the launch" icon="◎" color="bg-red-700">
        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-200">
          {[
            { title: 'Peak rope tension', p: lr.worstTension, main: (p: LaunchEnvelopePoint) => `${num(p.T_perRope, 1)} kN/rope` },
            { title: 'Peak sag', p: lr.worstSag, main: (p: LaunchEnvelopePoint) => `${num(p.maxSag, 3)} m` },
            { title: 'Least clearance', p: lr.worstClearance, main: (p: LaunchEnvelopePoint) => `${num(p.minClearance, 3)} m` },
          ].map(({ title, p, main }) => (
            <div key={title} className="p-3">
              <div className="text-[10px] uppercase tracking-wider text-slate-500">{title}</div>
              {p ? (
                <>
                  <div className="font-mono font-bold text-lg text-slate-900 tabular-nums">{main(p)}</div>
                  <div className="text-[11px] text-slate-600 mt-0.5">
                    leading bogie at x = <strong>{num(p.frontPosition, 1)} m</strong>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1 space-y-0.5">
                    <div>H = {num(p.H, 0)} kN · sag {num(p.maxSag, 2)} m · clearance {num(p.minClearance, 2)} m</div>
                    <div>Tower A {num(p.towerA_R, 0)} kN · Tower B {num(p.towerB_R, 0)} kN</div>
                  </div>
                  <button onClick={() => onSetFrontPosition(p.frontPosition)}
                    className="mt-2 px-2 py-1 bg-slate-700 hover:bg-slate-800 text-white text-[10px] rounded">
                    Move the launch here
                  </button>
                </>
              ) : <div className="text-xs text-slate-400">—</div>}
            </div>
          ))}
        </div>
      </Card>

      {/* bogie loads */}
      <Card title="Bogie arrangement" icon="⚙" color="bg-teal-700" defaultOpen={false}>
        <div className="divide-y divide-slate-100">
          <Row label="Total weight of the unit" value={num(lr.totalBogieLoad, 1)} unit="kN" highlight />
          {lr.bogieLoads.map((p, i) => (
            <Row key={i} label={`Bogie B${i + 1} (unfactored)`} value={num(p, 1)} unit="kN"
              note={i === 0 ? 'leading bogie' : undefined} />
          ))}
          <Row label="Dynamic amplification applied" value={num(input.launching.DAF, 2)} unit="—" />
          <Row label="Cable to soffit" value={num(input.launching.hangDepth, 2)} unit="m" />
        </div>
      </Card>

      {/* table */}
      <Card title="Envelope table" icon="▦" color="bg-slate-700" defaultOpen={false}>
        <div className="overflow-x-auto max-h-96">
          <table className="w-full text-[11px]">
            <thead className="bg-slate-100 sticky top-0">
              <tr className="text-slate-600">
                {['nose x (m)', 'H (kN)', 'T sys (kN)', 'T/rope (kN)', 'sag (m)', 'clearance (m)',
                  'Tower A (kN)', 'Tower B (kN)', 'util'].map(h => (
                  <th key={h} className="px-2 py-1.5 text-right font-semibold whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
              {lr.points.map((p, i) => (
                <tr key={i} className={`${p.utilization > 1 ? 'bg-red-50' : i % 2 ? 'bg-slate-50/60' : ''} cursor-pointer hover:bg-blue-50`}
                  onClick={() => onSetFrontPosition(p.frontPosition)}>
                  <td className="px-2 py-1 text-right">{num(p.frontPosition, 1)}</td>
                  <td className="px-2 py-1 text-right">{num(p.H, 0)}</td>
                  <td className="px-2 py-1 text-right">{num(p.T_max, 0)}</td>
                  <td className="px-2 py-1 text-right font-semibold">{num(p.T_perRope, 1)}</td>
                  <td className="px-2 py-1 text-right">{num(p.maxSag, 3)}</td>
                  <td className="px-2 py-1 text-right">{num(p.minClearance, 2)}</td>
                  <td className="px-2 py-1 text-right">{num(p.towerA_R, 0)}</td>
                  <td className="px-2 py-1 text-right">{num(p.towerB_R, 0)}</td>
                  <td className={`px-2 py-1 text-right ${p.utilization > 1 ? 'text-red-700 font-bold' : ''}`}>
                    {(p.utilization * 100).toFixed(0)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
