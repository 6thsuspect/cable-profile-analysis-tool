// ============================================================
// Cable profile diagram — ravine, masts, backstays, launched unit,
// installed vs loaded profile, clearance envelope
// ============================================================
import React, { useCallback, useMemo, useState } from 'react';
import type { AnalysisResult, CableInput, CaseResult, ProfilePoint } from '../types';
import { niceStep, num } from './ui';

const RAD = 180 / Math.PI;

interface Props {
  input: CableInput;
  result: AnalysisResult;
  caseResult: CaseResult;
}

export const CableDiagram: React.FC<Props> = ({ input, result, caseResult }) => {
  const [hover, setHover] = useState<ProfilePoint | null>(null);
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const [showInstalled, setShowInstalled] = useState(true);
  const [showClearance, setShowClearance] = useState(true);

  const { geometry, site, towers, launching } = input;
  const { profile, leftTower, rightTower } = caseResult;
  const L = geometry.L;

  const svgW = 940;
  const svgH = 520;
  const mL = 62;
  const mR = 26;
  const mT = 26;
  const mB = 42;
  const plotW = svgW - mL - mR;
  const plotH = svgH - mT - mB;

  // ---- ground polyline (mirrors the solver's terrain construction)
  const ground = useMemo(() => {
    const crestL = Math.max(0, Math.min(0.45 * L, site.crestLeftX));
    const crestR = Math.max(0.55 * L, Math.min(L, site.crestRightX));
    const bedX = Math.max(crestL + 0.01 * L, Math.min(crestR - 0.01 * L, site.bedX));
    return {
      pts: [
        { x: 0, y: site.bankLeftLevel },
        { x: crestL, y: site.bankLeftLevel },
        { x: bedX, y: site.bedLevel },
        { x: crestR, y: site.bankRightLevel },
        { x: L, y: site.bankRightLevel },
      ],
      crestL, crestR,
    };
  }, [L, site]);

  const bounds = useMemo(() => {
    let minX = Math.min(leftTower.anchorX, 0);
    let maxX = Math.max(rightTower.anchorX, L);
    let minY = Infinity;
    let maxY = -Infinity;
    for (const p of profile) { minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); }
    for (const p of result.installed.profile) { minY = Math.min(minY, p.y); }
    for (const g of ground.pts) { minY = Math.min(minY, g.y); maxY = Math.max(maxY, g.y); }
    minY = Math.min(minY, leftTower.anchorY, rightTower.anchorY, leftTower.baseY, rightTower.baseY);
    maxY = Math.max(maxY, geometry.yL, geometry.yR);
    const padX = Math.max(2, (maxX - minX) * 0.06);
    const padY = Math.max(2, (maxY - minY) * 0.14);
    minX -= padX; maxX += padX;
    minY -= padY; maxY += padY;
    if (maxY - minY < 1) { minY -= 5; maxY += 5; }
    return { minX, maxX, minY, maxY };
  }, [profile, result.installed.profile, ground, geometry, leftTower, rightTower, L]);

  const sx = useCallback(
    (x: number) => mL + ((x - bounds.minX) / (bounds.maxX - bounds.minX)) * plotW,
    [bounds, plotW],
  );
  const sy = useCallback(
    (y: number) => mT + (1 - (y - bounds.minY) / (bounds.maxY - bounds.minY)) * plotH,
    [bounds, plotH],
  );

  const path = (pts: { x: number; y: number }[]) =>
    pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(' ');

  const cablePath = useMemo(() => path(profile), [profile, sx, sy]);
  const installedPath = useMemo(() => path(result.installed.profile), [result.installed.profile, sx, sy]);

  const groundFill = useMemo(() => {
    const top = ground.pts.map((p, i) =>
      `${i === 0 ? 'M' : 'L'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(' ');
    return `${top} L${sx(L).toFixed(1)},${svgH - mB} L${sx(0).toFixed(1)},${svgH - mB} Z`;
  }, [ground, sx, sy, L]);

  // required-clearance envelope: the level the cable must stay above
  const clearancePath = useMemo(() => {
    if (site.requiredClearance <= 0) return '';
    const hang = launching.enabled && caseResult.totalVariableLoad > 0
      ? Math.max(0, launching.hangDepth) : 0;
    const pts: { x: number; y: number }[] = [];
    const n = 120;
    for (let i = 0; i <= n; i++) {
      const x = ground.crestL + (i / n) * (ground.crestR - ground.crestL);
      const g = Math.max(interp(ground.pts, x), site.hflLevel > 0 ? site.hflLevel : -Infinity);
      pts.push({ x, y: g + site.requiredClearance + hang });
    }
    return path(pts);
  }, [ground, site, launching, caseResult.totalVariableLoad, sx, sy]);

  const grid = useMemo(() => {
    const out: { x1: number; y1: number; x2: number; y2: number; label: string; axis: 'x' | 'y' }[] = [];
    const stepX = niceStep((bounds.maxX - bounds.minX) / 7);
    const stepY = niceStep((bounds.maxY - bounds.minY) / 6);
    for (let x = Math.ceil(bounds.minX / stepX) * stepX; x <= bounds.maxX; x += stepX) {
      out.push({ x1: sx(x), y1: mT, x2: sx(x), y2: svgH - mB, label: x.toFixed(0), axis: 'x' });
    }
    for (let y = Math.ceil(bounds.minY / stepY) * stepY; y <= bounds.maxY; y += stepY) {
      out.push({ x1: mL, y1: sy(y), x2: svgW - mR, y2: sy(y), label: y.toFixed(0), axis: 'y' });
    }
    return out;
  }, [bounds, sx, sy]);

  const onMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const mx = ((e.clientX - r.left) / r.width) * svgW;
    const my = ((e.clientY - r.top) / r.height) * svgH;
    setMouse({ x: mx, y: my });
    if (profile.length === 0) return;
    let best = profile[0];
    let bd = Infinity;
    for (const p of profile) {
      const dx = sx(p.x) - mx;
      const dy = sy(p.y) - my;
      const d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = p; }
    }
    setHover(bd < 1400 ? best : null);
  }, [profile, sx, sy]);

  // ---- bogies on the span for this case
  const bogies = useMemo(() => {
    if (!launching.enabled || caseResult.totalVariableLoad <= 0) return [];
    return caseResult.pointLoadResults
      .filter(p => p.load.label.startsWith('B'))
      .map(p => ({ x: p.load.x, y: p.yp, P: p.load.P, label: p.load.label }));
  }, [launching.enabled, caseResult]);

  const unit = caseResult.unitFootprint;
  const chordAt = (x: number) => geometry.yL + ((geometry.yR - geometry.yL) / L) * x;
  const sagY = caseResult.maxSagX;
  const worst = caseResult.governingCheck;

  return (
    <div className="bg-white border border-slate-300 rounded-lg overflow-hidden">
      <div className="bg-slate-800 text-white px-3 py-2 text-sm font-semibold flex justify-between items-center gap-3 flex-wrap">
        <span>Cable Profile — {caseResult.label}</span>
        <div className="flex items-center gap-3 text-[11px] font-normal">
          <label className="flex items-center gap-1 cursor-pointer">
            <input type="checkbox" checked={showInstalled}
              onChange={e => setShowInstalled(e.target.checked)} className="accent-slate-400" />
            Installed profile
          </label>
          <label className="flex items-center gap-1 cursor-pointer">
            <input type="checkbox" checked={showClearance}
              onChange={e => setShowClearance(e.target.checked)} className="accent-slate-400" />
            Clearance envelope
          </label>
          <span className="opacity-70">
            {caseResult.model === 'PARABOLIC_HORIZONTAL_LOAD' ? 'Elastic parabolic' : 'Elastic catenary'}
          </span>
        </div>
      </div>

      <svg width="100%" height={svgH} viewBox={`0 0 ${svgW} ${svgH}`} className="bg-slate-50"
        onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        <defs>
          <marker id="arrowDown" markerWidth="9" markerHeight="9" refX="4.5" refY="8" orient="auto">
            <path d="M0,0 L4.5,9 L9,0" fill="#dc2626" />
          </marker>
          <pattern id="hatch" width="6" height="6" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
            <line x1="0" y1="0" x2="0" y2="6" stroke="#a8a29e" strokeWidth="1.4" />
          </pattern>
        </defs>

        {grid.map((g, i) => (
          <g key={i}>
            <line x1={g.x1} y1={g.y1} x2={g.x2} y2={g.y2} stroke="#e2e8f0" strokeWidth={0.6} />
            {g.axis === 'x'
              ? <text x={g.x1} y={svgH - mB + 14} textAnchor="middle" className="text-[10px] fill-slate-500">{g.label}</text>
              : <text x={mL - 6} y={g.y1 + 3} textAnchor="end" className="text-[10px] fill-slate-500">{g.label}</text>}
          </g>
        ))}
        <text x={svgW / 2} y={svgH - 5} textAnchor="middle" className="text-[11px] fill-slate-600 font-medium">x from left saddle (m)</text>
        <text x={13} y={svgH / 2} textAnchor="middle" className="text-[11px] fill-slate-600 font-medium"
          transform={`rotate(-90 13 ${svgH / 2})`}>elevation (m)</text>

        {/* ── terrain ── */}
        <path d={groundFill} fill="url(#hatch)" opacity={0.5} />
        <path d={path(ground.pts)} fill="none" stroke="#78716c" strokeWidth={1.6} />

        {/* flood level */}
        {site.hflLevel > 0 && (
          <>
            <line x1={sx(ground.crestL)} y1={sy(site.hflLevel)} x2={sx(ground.crestR)} y2={sy(site.hflLevel)}
              stroke="#0ea5e9" strokeWidth={1.4} strokeDasharray="8,3" />
            <text x={sx(ground.crestR) - 4} y={sy(site.hflLevel) - 4} textAnchor="end"
              className="text-[9px] fill-sky-600 font-medium">HFL {num(site.hflLevel, 1)} m</text>
          </>
        )}

        {/* required clearance envelope */}
        {showClearance && clearancePath && (
          <>
            <path d={clearancePath} fill="none" stroke="#f43f5e" strokeWidth={1.3} strokeDasharray="5,4" />
            <text x={sx(ground.crestL) + 6} y={sy(
              Math.max(site.bedLevel, site.hflLevel) + site.requiredClearance) - 5}
              className="text-[9px] fill-rose-600 font-medium">
              min clearance line
            </text>
          </>
        )}

        {/* ── towers ── */}
        {[
          { x: 0, top: geometry.yL, base: leftTower.baseY, h: towers.heightL, tag: 'A' },
          { x: L, top: geometry.yR, base: rightTower.baseY, h: towers.heightR, tag: 'B' },
        ].map(t => (
          <g key={t.tag}>
            <line x1={sx(t.x)} y1={sy(t.base)} x2={sx(t.x)} y2={sy(t.top)}
              stroke="#334155" strokeWidth={6} strokeLinecap="round" />
            <line x1={sx(t.x) - 11} y1={sy(t.base)} x2={sx(t.x) + 11} y2={sy(t.base)}
              stroke="#334155" strokeWidth={3} />
            <text x={sx(t.x)} y={sy(t.top) - 15} textAnchor="middle"
              className="text-[10px] fill-slate-800 font-bold">Tower {t.tag}</text>
            <text x={sx(t.x)} y={sy(t.top) - 5} textAnchor="middle"
              className="text-[9px] fill-slate-500">h = {num(t.h, 1)} m</text>
          </g>
        ))}

        {/* ── backstays and anchors ── */}
        {[
          { fromX: 0, fromY: geometry.yL, t: leftTower, tag: 'A' },
          { fromX: L, fromY: geometry.yR, t: rightTower, tag: 'B' },
        ].map(b => (
          <g key={b.tag}>
            <line x1={sx(b.fromX)} y1={sy(b.fromY)} x2={sx(b.t.anchorX)} y2={sy(b.t.anchorY)}
              stroke="#ea580c" strokeWidth={2} />
            <rect x={sx(b.t.anchorX) - 9} y={sy(b.t.anchorY) - 3} width={18} height={11}
              fill="#ea580c" rx={2} />
            <text x={sx(b.t.anchorX)} y={sy(b.t.anchorY) + 21} textAnchor="middle"
              className="text-[9px] fill-orange-700 font-medium">Anchor {b.tag}</text>
            <text x={sx(b.t.anchorX)} y={sy(b.t.anchorY) + 30} textAnchor="middle"
              className="text-[9px] fill-orange-600">T={num(b.t.T_backstay, 0)} kN</text>
          </g>
        ))}

        {/* ── chord ── */}
        <line x1={sx(0)} y1={sy(geometry.yL)} x2={sx(L)} y2={sy(geometry.yR)}
          stroke="#94a3b8" strokeWidth={0.8} strokeDasharray="4,4" />

        {/* ── installed (dead-load) profile ── */}
        {showInstalled && (
          <>
            <path d={installedPath} fill="none" stroke="#64748b" strokeWidth={1.6} strokeDasharray="7,4" />
            <text x={sx(result.installed.profile[Math.floor(result.installed.profile.length * 0.28)]?.x ?? 0)}
              y={sy(result.installed.profile[Math.floor(result.installed.profile.length * 0.28)]?.y ?? 0) - 6}
              className="text-[9px] fill-slate-500 font-medium">
              installed, sag {num(result.installed.sag0, 2)} m
            </text>
          </>
        )}

        {/* ── loaded cable ── */}
        <path d={cablePath} fill="none" stroke="#1d4ed8" strokeWidth={2.8} />

        {/* saddles */}
        <circle cx={sx(0)} cy={sy(geometry.yL)} r={6} fill="#1e3a8a" stroke="#fff" strokeWidth={2} />
        <circle cx={sx(L)} cy={sy(geometry.yR)} r={6} fill="#1e3a8a" stroke="#fff" strokeWidth={2} />

        {/* ── launched unit ── */}
        {unit && bogies.length > 0 && (() => {
          const yFrom = interpProfile(profile, Math.max(unit.from, profile[0].x));
          const yTo = interpProfile(profile, Math.min(unit.to, profile[profile.length - 1].x));
          const hang = Math.max(0, launching.hangDepth);
          return (
            <g>
              <line x1={sx(unit.from)} y1={sy(yFrom - hang)} x2={sx(unit.to)} y2={sy(yTo - hang)}
                stroke="#0f766e" strokeWidth={7} strokeLinecap="butt" opacity={0.85} />
              <text x={sx((unit.from + unit.to) / 2)} y={sy((yFrom + yTo) / 2 - hang) + 17}
                textAnchor="middle" className="text-[9px] fill-teal-800 font-bold">
                launched unit {num(caseResult.totalVariableLoad, 0)} kN
              </text>
            </g>
          );
        })()}

        {/* ── point loads / bogies ── */}
        {caseResult.pointLoadResults.map((plr, i) => {
          const px = sx(plr.load.x);
          const py = sy(plr.yp);
          const isBogie = plr.load.label.startsWith('B');
          const len = 34;
          return (
            <g key={i}>
              <line x1={px} y1={py - len} x2={px} y2={py - 3}
                stroke="#dc2626" strokeWidth={2.4} markerEnd="url(#arrowDown)" />
              <text x={px + 5} y={py - len - 4} className="text-[9px] fill-red-700 font-bold">
                {plr.load.label} {num(plr.load.P, 0)} kN
              </text>
              <circle cx={px} cy={py} r={isBogie ? 5 : 4}
                fill={isBogie ? '#0f766e' : '#dc2626'} stroke="#fff" strokeWidth={1.2} />
            </g>
          );
        })}

        {/* ── sag annotation ── */}
        {caseResult.maxSag > 0 && (
          <g>
            <line x1={sx(sagY)} y1={sy(chordAt(sagY))} x2={sx(sagY)}
              y2={sy(chordAt(sagY) - caseResult.maxSag)}
              stroke="#7c3aed" strokeWidth={1.4} strokeDasharray="3,2" />
            <circle cx={sx(sagY)} cy={sy(chordAt(sagY) - caseResult.maxSag)} r={3} fill="#7c3aed" />
            <text x={sx(sagY) + 6} y={(sy(chordAt(sagY)) + sy(chordAt(sagY) - caseResult.maxSag)) / 2}
              className="text-[10px] fill-violet-700 font-semibold">
              sag {num(caseResult.maxSag, 3)} m
            </text>
            <text x={sx(sagY) + 6} y={(sy(chordAt(sagY)) + sy(chordAt(sagY) - caseResult.maxSag)) / 2 + 10}
              className="text-[9px] fill-violet-500">
              +{num((caseResult.maxSag - result.installed.sag0) * 1000, 0)} mm vs installed
            </text>
          </g>
        )}

        {/* ── governing clearance marker ── */}
        {site.requiredClearance > 0 && (
          <g>
            <line
              x1={sx(caseResult.minClearanceX)}
              y1={sy(interpProfile(profile, caseResult.minClearanceX))}
              x2={sx(caseResult.minClearanceX)}
              y2={sy(interpProfile(profile, caseResult.minClearanceX) - caseResult.minCableClearance)}
              stroke="#f43f5e" strokeWidth={1.2} strokeDasharray="2,2" />
            <text x={sx(caseResult.minClearanceX) + 5}
              y={sy(interpProfile(profile, caseResult.minClearanceX) - caseResult.minCableClearance) - 4}
              className="text-[9px] fill-rose-600 font-medium">
              clearance {num(caseResult.minClearance, 2)} m
            </text>
          </g>
        )}

        {/* ── hover readout ── */}
        {hover && (() => {
          const bx = Math.min(mouse.x + 12, svgW - 190);
          const by = Math.max(mouse.y - 92, mT + 4);
          return (
            <g>
              <circle cx={sx(hover.x)} cy={sy(hover.y)} r={5} fill="none" stroke="#1d4ed8" strokeWidth={2} />
              <rect x={bx} y={by} width={176} height={86} rx={4} fill="rgba(15,23,42,0.93)" />
              {[
                `x = ${num(hover.x, 2)} m`,
                `y = ${num(hover.y, 3)} m`,
                `θ = ${num(hover.theta * RAD, 2)}°`,
                `T = ${num(hover.T, 1)} kN system`,
                `T = ${num((hover.T * input.cable.shareFactor) / input.cable.nCables, 1)} kN / rope`,
                `clearance = ${num(hover.clearance, 2)} m`,
              ].map((t, i) => (
                <text key={i} x={bx + 9} y={by + 15 + i * 12} className="text-[10px] fill-white font-mono">{t}</text>
              ))}
            </g>
          );
        })()}

        {/* ── governing check chip ── */}
        {worst && (
          <g>
            <rect x={mL + 6} y={mT + 6} width={330} height={22} rx={4}
              fill={worst.status === 'FAIL' ? 'rgba(220,38,38,0.92)'
                : worst.status === 'WARNING' ? 'rgba(217,119,6,0.92)' : 'rgba(5,150,105,0.92)'} />
            <text x={mL + 15} y={mT + 21} className="text-[10px] fill-white font-semibold">
              Governs: {worst.label} — {(worst.utilization * 100).toFixed(0)}%
            </text>
          </g>
        )}
      </svg>

      {/* legend */}
      <div className="px-3 py-2 border-t border-slate-200 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-slate-600">
        <Legend colour="#1d4ed8" w={3}>Loaded cable</Legend>
        <Legend colour="#64748b" dash>Installed (dead load) profile</Legend>
        <Legend colour="#ea580c" w={2}>Backstay</Legend>
        <Legend colour="#0f766e" w={4}>Launched unit</Legend>
        <Legend colour="#f43f5e" dash>Required clearance line</Legend>
        <Legend colour="#0ea5e9" dash>Highest flood level</Legend>
        <Legend colour="#7c3aed" dash>Sag below the chord</Legend>
      </div>
    </div>
  );
};

const Legend: React.FC<{ colour: string; w?: number; dash?: boolean; children: React.ReactNode }> = ({
  colour, w = 2, dash, children,
}) => (
  <span className="inline-flex items-center gap-1.5">
    <svg width="18" height="6"><line x1="0" y1="3" x2="18" y2="3" stroke={colour}
      strokeWidth={w} strokeDasharray={dash ? '4,3' : undefined} /></svg>
    {children}
  </span>
);

function interp(pts: { x: number; y: number }[], x: number): number {
  if (pts.length === 0) return 0;
  if (x <= pts[0].x) return pts[0].y;
  const last = pts[pts.length - 1];
  if (x >= last.x) return last.y;
  for (let i = 1; i < pts.length; i++) {
    if (x <= pts[i].x) {
      const a = pts[i - 1];
      const b = pts[i];
      return a.y + ((x - a.x) / (b.x - a.x || 1)) * (b.y - a.y);
    }
  }
  return last.y;
}

function interpProfile(profile: ProfilePoint[], x: number): number {
  return interp(profile.map(p => ({ x: p.x, y: p.y })), x);
}
