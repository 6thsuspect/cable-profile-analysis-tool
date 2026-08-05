// ============================================================
// Force Diagram — Shows force vectors at towers and point loads
// ============================================================
import React from 'react';
import type { AnalysisResult, TowerResult, PointLoadResult } from '../types';

const RAD = 180 / Math.PI;

interface Props {
  result: AnalysisResult;
}

const TowerForceDiag: React.FC<{ tower: TowerResult; label: string }> = ({ tower, label }) => {
  const cx = 130;
  const cy = 130;
  const scale = 100 / Math.max(tower.T_main, tower.T_backstay, tower.R, 1);

  // Main cable vector
  const mainAngle = tower.thetaMain;
  const mainLen = tower.T_main * scale;
  const mainDx = Math.cos(mainAngle) * mainLen * (tower.side === 'left' ? 1 : -1);
  const mainDy = -Math.sin(mainAngle) * mainLen * (tower.side === 'left' ? 1 : -1);

  // Backstay vector
  const bsAngle = tower.thetaBackstay;
  const bsLen = tower.T_backstay * scale;
  const bsDx = -Math.cos(bsAngle) * bsLen * (tower.side === 'left' ? 1 : -1);
  const bsDy = Math.sin(bsAngle) * bsLen;

  // Resultant
  const rLen = tower.R * scale;
  const rAngle = tower.thetaR;
  const rDx = Math.cos(rAngle) * rLen;
  const rDy = -Math.sin(rAngle) * rLen;

  return (
    <div className="bg-white border border-slate-300 rounded-lg overflow-hidden">
      <div className="bg-emerald-700 text-white px-3 py-1.5 text-xs font-semibold">{label}</div>
      <svg width="260" height="260" viewBox="0 0 260 260" className="bg-slate-50">
        {/* Origin dot */}
        <circle cx={cx} cy={cy} r={5} fill="#1e40af" stroke="#fff" strokeWidth={2} />

        {/* Main cable force */}
        <line x1={cx} y1={cy} x2={cx + mainDx} y2={cy + mainDy}
          stroke="#2563eb" strokeWidth={2.5} markerEnd="url(#arrowBlue)" />
        <text x={cx + mainDx * 0.5 + 8} y={cy + mainDy * 0.5 - 5}
          className="text-[9px] fill-blue-700 font-medium">
          T={tower.T_main.toFixed(1)}kN
        </text>

        {/* Backstay force */}
        <line x1={cx} y1={cy} x2={cx + bsDx} y2={cy + bsDy}
          stroke="#f97316" strokeWidth={2.5} markerEnd="url(#arrowOrange)" />
        <text x={cx + bsDx * 0.5 - 5} y={cy + bsDy * 0.5 + 12}
          className="text-[9px] fill-orange-700 font-medium">
          T={tower.T_backstay.toFixed(1)}kN
        </text>

        {/* Resultant */}
        <line x1={cx} y1={cy} x2={cx + rDx} y2={cy + rDy}
          stroke="#059669" strokeWidth={2} strokeDasharray="4,2" markerEnd="url(#arrowGreen)" />
        <text x={cx + rDx * 0.5 + 8} y={cy + rDy * 0.5 + 12}
          className="text-[9px] fill-emerald-700 font-bold">
          R={tower.R.toFixed(1)}kN
        </text>

        {/* Angle labels */}
        <text x={cx} y={cy + 18}
          className="text-[8px] fill-slate-500" textAnchor="middle">
          θ_main={Math.abs(tower.thetaMain * RAD).toFixed(1)}°
        </text>

        <defs>
          <marker id="arrowBlue" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
            <path d="M0,0 L8,3 L0,6" fill="#2563eb" />
          </marker>
          <marker id="arrowOrange" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
            <path d="M0,0 L8,3 L0,6" fill="#f97316" />
          </marker>
          <marker id="arrowGreen" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
            <path d="M0,0 L8,3 L0,6" fill="#059669" />
          </marker>
        </defs>

        {/* Legend */}
        <line x1={10} y1={240} x2={30} y2={240} stroke="#2563eb" strokeWidth={2} />
        <text x={34} y={243} className="text-[8px] fill-slate-600">Main cable</text>
        <line x1={90} y1={240} x2={110} y2={240} stroke="#f97316" strokeWidth={2} />
        <text x={114} y={243} className="text-[8px] fill-slate-600">Backstay</text>
        <line x1={160} y1={240} x2={180} y2={240} stroke="#059669" strokeWidth={2} strokeDasharray="4,2" />
        <text x={184} y={243} className="text-[8px] fill-slate-600">Resultant</text>
      </svg>
    </div>
  );
};

const PointLoadForceDiag: React.FC<{ plr: PointLoadResult; H: number }> = ({ plr, H }) => {
  const cx = 130;
  const cy = 100;
  const maxT = Math.max(plr.T_left, plr.T_right, plr.load.P);
  const scale = 70 / Math.max(maxT, 1);

  // Left cable vector (going up-left from load point)
  const leftAngle = plr.thetaLeft;
  const leftLen = plr.T_left * scale;
  const leftDx = -Math.cos(leftAngle) * leftLen;
  const leftDy = Math.sin(leftAngle) * leftLen;

  // Right cable vector (going up-right from load point)
  const rightAngle = plr.thetaRight;
  const rightLen = plr.T_right * scale;
  const rightDx = Math.cos(rightAngle) * rightLen;
  const rightDy = -Math.sin(rightAngle) * rightLen;

  // Point load (downward)
  const pLen = plr.load.P * scale;

  return (
    <div className="bg-white border border-slate-300 rounded-lg overflow-hidden">
      <div className="bg-red-700 text-white px-3 py-1.5 text-xs font-semibold">
        {plr.load.label} — Force Equilibrium
      </div>
      <svg width="260" height="200" viewBox="0 0 260 200" className="bg-slate-50">
        {/* Load point */}
        <circle cx={cx} cy={cy} r={4} fill="#dc2626" />

        {/* Left cable tension */}
        <line x1={cx} y1={cy} x2={cx + leftDx} y2={cy + leftDy}
          stroke="#2563eb" strokeWidth={2} markerEnd="url(#arrowBlue2)" />
        <text x={cx + leftDx - 5} y={cy + leftDy - 5}
          className="text-[9px] fill-blue-700 font-medium" textAnchor="end">
          TL={plr.T_left.toFixed(1)}kN
        </text>

        {/* Right cable tension */}
        <line x1={cx} y1={cy} x2={cx + rightDx} y2={cy + rightDy}
          stroke="#2563eb" strokeWidth={2} markerEnd="url(#arrowBlue2)" />
        <text x={cx + rightDx + 5} y={cy + rightDy - 5}
          className="text-[9px] fill-blue-700 font-medium">
          TR={plr.T_right.toFixed(1)}kN
        </text>

        {/* Point load */}
        <line x1={cx} y1={cy} x2={cx} y2={cy + pLen}
          stroke="#dc2626" strokeWidth={2.5} markerEnd="url(#arrowRed)" />
        <text x={cx + 8} y={cy + pLen + 5}
          className="text-[9px] fill-red-700 font-bold">
          P={plr.load.P.toFixed(1)}kN
        </text>

        {/* Angle annotations */}
        <text x={cx - 10} y={cy + 15}
          className="text-[8px] fill-slate-500" textAnchor="end">
          θL={Math.abs(plr.thetaLeft * RAD).toFixed(1)}°
        </text>
        <text x={cx + 10} y={cy + 15}
          className="text-[8px] fill-slate-500">
          θR={Math.abs(plr.thetaRight * RAD).toFixed(1)}°
        </text>

        {/* Equilibrium check */}
        <text x={cx} y={185} textAnchor="middle"
          className="text-[8px] fill-slate-600">
          H·(tan θR − tan θL) = {(H * (Math.tan(plr.thetaRight) - Math.tan(plr.thetaLeft))).toFixed(2)} ≈ P = {plr.load.P.toFixed(2)} kN
        </text>

        <defs>
          <marker id="arrowBlue2" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
            <path d="M0,0 L8,3 L0,6" fill="#2563eb" />
          </marker>
          <marker id="arrowRed" markerWidth="8" markerHeight="8" refX="4" refY="8" orient="auto">
            <path d="M0,0 L4,8 L8,0" fill="#dc2626" />
          </marker>
        </defs>
      </svg>
    </div>
  );
};

export const ForceDiagram: React.FC<Props> = ({ result }) => {
  return (
    <div className="space-y-3">
      <div className="bg-slate-800 text-white px-4 py-2 text-sm font-semibold rounded-t-lg">
        Force Diagrams
      </div>
      <div className="flex flex-wrap gap-3">
        <TowerForceDiag tower={result.leftTower} label="Left Tower (A) — Force Vectors" />
        <TowerForceDiag tower={result.rightTower} label="Right Tower (B) — Force Vectors" />
      </div>
      {result.pointLoadResults.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {result.pointLoadResults.map((plr, i) => (
            <PointLoadForceDiag key={i} plr={plr} H={result.H} />
          ))}
        </div>
      )}
    </div>
  );
};
