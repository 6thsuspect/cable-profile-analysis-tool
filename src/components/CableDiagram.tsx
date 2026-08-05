// ============================================================
// Interactive Cable Profile & Force Diagram (SVG)
// ============================================================
import React, { useMemo, useState, useCallback } from 'react';
import type { CableInput, AnalysisResult, ProfilePoint } from '../types';

const RAD = 180 / Math.PI;

interface Props {
  input: CableInput;
  result: AnalysisResult;
}

export const CableDiagram: React.FC<Props> = ({ input, result }) => {
  const [hoveredPoint, setHoveredPoint] = useState<ProfilePoint | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const { geometry } = input;
  const { profile, leftTower, rightTower } = result;

  // Compute bounding box
  const bounds = useMemo(() => {
    let minX = Math.min(leftTower.anchorX, 0);
    let maxX = Math.max(rightTower.anchorX, geometry.L);
    let minY = Infinity;
    let maxY = -Infinity;

    for (const pt of profile) {
      if (pt.y < minY) minY = pt.y;
      if (pt.y > maxY) maxY = pt.y;
    }

    minY = Math.min(minY, leftTower.anchorY, rightTower.anchorY);
    maxY = Math.max(maxY, geometry.yL, geometry.yR, leftTower.anchorY, rightTower.anchorY);

    const padX = (maxX - minX) * 0.12;
    const padY = (maxY - minY) * 0.2;
    minX -= padX; maxX += padX;
    minY -= padY; maxY += padY;

    // Ensure minimum range
    if (maxY - minY < 1) { minY -= 5; maxY += 5; }
    if (maxX - minX < 1) { minX -= 5; maxX += 5; }

    return { minX, maxX, minY, maxY };
  }, [profile, geometry, leftTower, rightTower]);

  const svgW = 900;
  const svgH = 500;
  const marginL = 60;
  const marginR = 30;
  const marginT = 30;
  const marginB = 40;
  const plotW = svgW - marginL - marginR;
  const plotH = svgH - marginT - marginB;

  const scaleX = useCallback((x: number) => {
    return marginL + ((x - bounds.minX) / (bounds.maxX - bounds.minX)) * plotW;
  }, [bounds, plotW]);

  const scaleY = useCallback((y: number) => {
    // Flip: y increases upward in engineering, but SVG y increases downward
    return marginT + (1 - (y - bounds.minY) / (bounds.maxY - bounds.minY)) * plotH;
  }, [bounds, plotH]);

  // Cable path
  const cablePath = useMemo(() => {
    if (profile.length === 0) return '';
    return profile.map((pt, i) => {
      const cmd = i === 0 ? 'M' : 'L';
      return `${cmd}${scaleX(pt.x).toFixed(1)},${scaleY(pt.y).toFixed(1)}`;
    }).join(' ');
  }, [profile, scaleX, scaleY]);

  // Backstay paths
  const leftBackstay = `M${scaleX(0).toFixed(1)},${scaleY(geometry.yL).toFixed(1)} L${scaleX(leftTower.anchorX).toFixed(1)},${scaleY(leftTower.anchorY).toFixed(1)}`;
  const rightBackstay = `M${scaleX(geometry.L).toFixed(1)},${scaleY(geometry.yR).toFixed(1)} L${scaleX(rightTower.anchorX).toFixed(1)},${scaleY(rightTower.anchorY).toFixed(1)}`;

  // Grid lines
  const gridLines = useMemo(() => {
    const lines: { x1: number; y1: number; x2: number; y2: number; label: string; axis: 'x' | 'y' }[] = [];
    const rangeX = bounds.maxX - bounds.minX;
    const rangeY = bounds.maxY - bounds.minY;
    const stepX = niceStep(rangeX / 6);
    const stepY = niceStep(rangeY / 5);

    for (let x = Math.ceil(bounds.minX / stepX) * stepX; x <= bounds.maxX; x += stepX) {
      lines.push({ x1: scaleX(x), y1: marginT, x2: scaleX(x), y2: svgH - marginB, label: x.toFixed(1), axis: 'x' });
    }
    for (let yy = Math.ceil(bounds.minY / stepY) * stepY; yy <= bounds.maxY; yy += stepY) {
      lines.push({ x1: marginL, y1: scaleY(yy), x2: svgW - marginR, y2: scaleY(yy), label: yy.toFixed(1), axis: 'y' });
    }
    return lines;
  }, [bounds, scaleX, scaleY]);

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    setMousePos({ x: mx, y: my });

    // Find nearest profile point
    if (profile.length === 0) return;
    let best = profile[0];
    let bestDist = Infinity;
    for (const pt of profile) {
      const dx = scaleX(pt.x) - mx;
      const dy = scaleY(pt.y) - my;
      const d = dx * dx + dy * dy;
      if (d < bestDist) { bestDist = d; best = pt; }
    }
    if (bestDist < 900) {
      setHoveredPoint(best);
    } else {
      setHoveredPoint(null);
    }
  }, [profile, scaleX, scaleY]);

  // Tower pillar height — draw towers from ground (minY) up to pulley elevation
  const towerBaseY = bounds.minY;

  return (
    <div className="bg-white border border-slate-300 rounded-lg overflow-hidden">
      <div className="bg-slate-800 text-white px-4 py-2 text-sm font-semibold flex justify-between items-center">
        <span>Cable Profile Diagram</span>
        <span className="text-xs opacity-70">
          {result.model === 'PARABOLIC_HORIZONTAL_LOAD' ? 'Parabolic Model' : 'Catenary Model'}
        </span>
      </div>
      <svg
        width="100%"
        height={svgH}
        viewBox={`0 0 ${svgW} ${svgH}`}
        className="bg-slate-50"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoveredPoint(null)}
      >
        {/* Grid */}
        {gridLines.map((gl, i) => (
          <g key={i}>
            <line x1={gl.x1} y1={gl.y1} x2={gl.x2} y2={gl.y2}
              stroke="#e2e8f0" strokeWidth={0.5} />
            {gl.axis === 'x' && (
              <text x={gl.x1} y={svgH - marginB + 14} textAnchor="middle"
                className="text-[10px] fill-slate-500">{gl.label}</text>
            )}
            {gl.axis === 'y' && (
              <text x={marginL - 5} y={gl.y1 + 3} textAnchor="end"
                className="text-[10px] fill-slate-500">{gl.label}</text>
            )}
          </g>
        ))}

        {/* Axes labels */}
        <text x={svgW / 2} y={svgH - 4} textAnchor="middle"
          className="text-[11px] fill-slate-600 font-medium">x (m)</text>
        <text x={12} y={svgH / 2} textAnchor="middle"
          className="text-[11px] fill-slate-600 font-medium"
          transform={`rotate(-90 12 ${svgH / 2})`}>y (m)</text>

        {/* Ground / reference line */}
        <line x1={marginL} y1={scaleY(0)} x2={svgW - marginR} y2={scaleY(0)}
          stroke="#94a3b8" strokeWidth={1} strokeDasharray="6,3" />

        {/* Towers */}
        {/* Left tower */}
        <line
          x1={scaleX(0)} y1={scaleY(towerBaseY)}
          x2={scaleX(0)} y2={scaleY(geometry.yL)}
          stroke="#475569" strokeWidth={4} />
        {/* Right tower */}
        <line
          x1={scaleX(geometry.L)} y1={scaleY(towerBaseY)}
          x2={scaleX(geometry.L)} y2={scaleY(geometry.yR)}
          stroke="#475569" strokeWidth={4} />

        {/* Backstay cables */}
        <path d={leftBackstay} fill="none" stroke="#f97316" strokeWidth={2} strokeDasharray="6,3" />
        <path d={rightBackstay} fill="none" stroke="#f97316" strokeWidth={2} strokeDasharray="6,3" />

        {/* Anchor points */}
        <circle cx={scaleX(leftTower.anchorX)} cy={scaleY(leftTower.anchorY)} r={5} fill="#f97316" />
        <circle cx={scaleX(rightTower.anchorX)} cy={scaleY(rightTower.anchorY)} r={5} fill="#f97316" />
        <text x={scaleX(leftTower.anchorX) - 5} y={scaleY(leftTower.anchorY) + 15}
          className="text-[9px] fill-orange-600 font-medium">Anchor A</text>
        <text x={scaleX(rightTower.anchorX) + 5} y={scaleY(rightTower.anchorY) + 15}
          className="text-[9px] fill-orange-600 font-medium">Anchor B</text>

        {/* Main cable */}
        <path d={cablePath} fill="none" stroke="#2563eb" strokeWidth={2.5} />

        {/* Chord line */}
        <line
          x1={scaleX(0)} y1={scaleY(geometry.yL)}
          x2={scaleX(geometry.L)} y2={scaleY(geometry.yR)}
          stroke="#94a3b8" strokeWidth={0.7} strokeDasharray="4,4" />

        {/* Tower pulleys */}
        <circle cx={scaleX(0)} cy={scaleY(geometry.yL)} r={6} fill="#1e40af" stroke="#fff" strokeWidth={2} />
        <circle cx={scaleX(geometry.L)} cy={scaleY(geometry.yR)} r={6} fill="#1e40af" stroke="#fff" strokeWidth={2} />

        {/* Tower labels */}
        <text x={scaleX(0)} y={scaleY(geometry.yL) - 12}
          textAnchor="middle" className="text-[10px] fill-blue-800 font-bold">Tower A</text>
        <text x={scaleX(geometry.L)} y={scaleY(geometry.yR) - 12}
          textAnchor="middle" className="text-[10px] fill-blue-800 font-bold">Tower B</text>

        {/* Point loads */}
        {result.pointLoadResults.map((plr, idx) => {
          const px = scaleX(plr.load.x);
          const py = scaleY(plr.yp);
          const arrowLen = 35;
          return (
            <g key={idx}>
              {/* Arrow */}
              <line x1={px} y1={py - arrowLen} x2={px} y2={py}
                stroke="#dc2626" strokeWidth={2.5} markerEnd="url(#arrowDown)" />
              {/* Load label */}
              <text x={px + 5} y={py - arrowLen - 5}
                className="text-[10px] fill-red-700 font-bold">
                {plr.load.label}: {plr.load.P} kN
              </text>
              {/* Contact point */}
              <circle cx={px} cy={py} r={4} fill="#dc2626" />
            </g>
          );
        })}

        {/* Arrow marker definition */}
        <defs>
          <marker id="arrowDown" markerWidth="8" markerHeight="8" refX="4" refY="8"
            orient="auto">
            <path d="M0,0 L4,8 L8,0" fill="#dc2626" />
          </marker>
          <marker id="arrowForce" markerWidth="6" markerHeight="6" refX="6" refY="3"
            orient="auto">
            <path d="M0,0 L6,3 L0,6" fill="#059669" />
          </marker>
        </defs>

        {/* Hover tooltip */}
        {hoveredPoint && (
          <g>
            <circle
              cx={scaleX(hoveredPoint.x)}
              cy={scaleY(hoveredPoint.y)}
              r={5}
              fill="none"
              stroke="#2563eb"
              strokeWidth={2}
            />
            <rect
              x={mousePos.x + 10}
              y={mousePos.y - 70}
              width={170}
              height={62}
              rx={4}
              fill="rgba(15,23,42,0.92)"
            />
            <text x={mousePos.x + 18} y={mousePos.y - 54}
              className="text-[10px] fill-white font-mono">
              x = {hoveredPoint.x.toFixed(2)} m
            </text>
            <text x={mousePos.x + 18} y={mousePos.y - 42}
              className="text-[10px] fill-white font-mono">
              y = {hoveredPoint.y.toFixed(3)} m
            </text>
            <text x={mousePos.x + 18} y={mousePos.y - 30}
              className="text-[10px] fill-white font-mono">
              θ = {(hoveredPoint.theta * RAD).toFixed(2)}°
            </text>
            <text x={mousePos.x + 18} y={mousePos.y - 18}
              className="text-[10px] fill-white font-mono">
              T = {hoveredPoint.T.toFixed(2)} kN
            </text>
          </g>
        )}

        {/* Max sag annotation */}
        {result.maxSag > 0 && (() => {
          // Find profile point with max sag
          const chordSlope = (geometry.yR - geometry.yL) / geometry.L;
          let maxSagPt = profile[0];
          let maxS = 0;
          for (const pt of profile) {
            const chordY = geometry.yL + chordSlope * pt.x;
            const s = chordY - pt.y;
            if (s > maxS) { maxS = s; maxSagPt = pt; }
          }
          const chordY = geometry.yL + chordSlope * maxSagPt.x;
          return (
            <g>
              <line
                x1={scaleX(maxSagPt.x)} y1={scaleY(chordY)}
                x2={scaleX(maxSagPt.x)} y2={scaleY(maxSagPt.y)}
                stroke="#8b5cf6" strokeWidth={1.5} strokeDasharray="3,2"
              />
              <text x={scaleX(maxSagPt.x) + 5}
                y={(scaleY(chordY) + scaleY(maxSagPt.y)) / 2}
                className="text-[9px] fill-purple-600 font-medium">
                sag = {result.maxSag.toFixed(2)} m
              </text>
            </g>
          );
        })()}
      </svg>
    </div>
  );
};

function niceStep(rough: number): number {
  const pow = Math.pow(10, Math.floor(Math.log10(rough)));
  const frac = rough / pow;
  if (frac <= 1) return pow;
  if (frac <= 2) return 2 * pow;
  if (frac <= 5) return 5 * pow;
  return 10 * pow;
}
