// ============================================================
// Force polygons at the saddles and at each point load
// ============================================================
import React from 'react';
import type { CaseResult, PointLoadResult, TowerResult } from '../types';
import { Card, Row, num } from './ui';

const RAD = 180 / Math.PI;

interface Props {
  caseResult: CaseResult;
}

const TowerDiag: React.FC<{ tower: TowerResult; label: string }> = ({ tower, label }) => {
  const cx = 150;
  const cy = 120;
  const peak = Math.max(tower.T_main, tower.T_backstay, tower.R, 1);
  const scale = 92 / peak;
  const left = tower.side === 'left';

  // main cable pulls the saddle towards the span
  const mainDx = (left ? 1 : -1) * tower.T_main * scale * Math.cos(tower.thetaMain);
  const mainDy = -(left ? 1 : -1) * tower.T_main * scale * Math.sin(tower.thetaMain);
  // backstay pulls back and down
  const a = tower.alpha / RAD;
  const bsDx = (left ? -1 : 1) * tower.T_backstay * scale * Math.sin(a);
  const bsDy = tower.T_backstay * scale * Math.cos(a);
  // resultant
  const rDx = tower.Rx * scale;
  const rDy = -tower.Ry * scale;

  return (
    <div className="bg-white border border-slate-300 rounded-lg overflow-hidden flex-1 min-w-[290px]">
      <div className="bg-emerald-700 text-white px-3 py-1.5 text-xs font-semibold">{label}</div>
      <svg width="100%" height="250" viewBox="0 0 300 250" className="bg-slate-50">
        <defs>
          <marker id="aBlue" markerWidth="9" markerHeight="7" refX="8" refY="3.5" orient="auto">
            <path d="M0,0 L9,3.5 L0,7" fill="#2563eb" /></marker>
          <marker id="aOrange" markerWidth="9" markerHeight="7" refX="8" refY="3.5" orient="auto">
            <path d="M0,0 L9,3.5 L0,7" fill="#ea580c" /></marker>
          <marker id="aGreen" markerWidth="9" markerHeight="7" refX="8" refY="3.5" orient="auto">
            <path d="M0,0 L9,3.5 L0,7" fill="#059669" /></marker>
        </defs>

        {/* reference axes */}
        <line x1={cx - 110} y1={cy} x2={cx + 110} y2={cy} stroke="#cbd5e1" strokeWidth={0.8} strokeDasharray="3,3" />
        <line x1={cx} y1={cy - 100} x2={cx} y2={cy + 110} stroke="#cbd5e1" strokeWidth={0.8} strokeDasharray="3,3" />

        {/* mast */}
        <line x1={cx} y1={cy} x2={cx} y2={cy + 105} stroke="#334155" strokeWidth={5} />
        <line x1={cx - 14} y1={cy + 105} x2={cx + 14} y2={cy + 105} stroke="#334155" strokeWidth={3} />

        <line x1={cx} y1={cy} x2={cx + mainDx} y2={cy + mainDy}
          stroke="#2563eb" strokeWidth={2.6} markerEnd="url(#aBlue)" />
        <text x={cx + mainDx * 0.62 + (left ? 6 : -6)} y={cy + mainDy * 0.62 - 6}
          textAnchor={left ? 'start' : 'end'} className="text-[9px] fill-blue-700 font-semibold">
          T_main {num(tower.T_main, 0)} kN
        </text>

        <line x1={cx} y1={cy} x2={cx + bsDx} y2={cy + bsDy}
          stroke="#ea580c" strokeWidth={2.6} markerEnd="url(#aOrange)" />
        <text x={cx + bsDx * 0.6 + (left ? -4 : 4)} y={cy + bsDy * 0.6 + 12}
          textAnchor={left ? 'end' : 'start'} className="text-[9px] fill-orange-700 font-semibold">
          T_bs {num(tower.T_backstay, 0)} kN
        </text>

        <line x1={cx} y1={cy} x2={cx + rDx} y2={cy + rDy}
          stroke="#059669" strokeWidth={2} strokeDasharray="5,3" markerEnd="url(#aGreen)" />
        <text x={cx + rDx * 0.7 + 8} y={cy + rDy * 0.7 + 4}
          className="text-[9px] fill-emerald-700 font-bold">R {num(tower.R, 0)} kN</text>

        <circle cx={cx} cy={cy} r={5.5} fill="#1e3a8a" stroke="#fff" strokeWidth={2} />

        <text x={12} y={230} className="text-[9px] fill-slate-600">
          θ_main = {num(tower.thetaMain * RAD, 2)}°   α = {num(tower.alpha, 1)}° from vertical
        </text>
        <text x={12} y={242} className="text-[9px] fill-slate-600">
          net thrust Rx = {num(tower.Rx, 1)} kN   base moment = {num(tower.baseMoment, 0)} kNm
        </text>
      </svg>
      <div className="divide-y divide-slate-100 border-t border-slate-200">
        <Row label="Axial at the base" value={num(tower.axial, 2)} unit="kN" />
        <Row label="Shear at the base" value={num(tower.shear, 2)} unit="kN" />
        <Row label="Moment at the base" value={num(tower.baseMoment, 2)} unit="kNm" />
      </div>
    </div>
  );
};

const LoadDiag: React.FC<{ plr: PointLoadResult; H: number }> = ({ plr, H }) => {
  const cx = 150;
  const cy = 92;
  const peak = Math.max(plr.T_left, plr.T_right, plr.load.P, 1);
  const scale = 72 / peak;

  const lDx = -Math.cos(plr.thetaLeft) * plr.T_left * scale;
  const lDy = Math.sin(plr.thetaLeft) * plr.T_left * scale;
  const rDx = Math.cos(plr.thetaRight) * plr.T_right * scale;
  const rDy = -Math.sin(plr.thetaRight) * plr.T_right * scale;
  const pLen = plr.load.P * scale;

  return (
    <div className="bg-white border border-slate-300 rounded-lg overflow-hidden flex-1 min-w-[290px]">
      <div className="bg-rose-700 text-white px-3 py-1.5 text-xs font-semibold">
        {plr.load.label} at x = {num(plr.load.x, 2)} m — equilibrium
      </div>
      <svg width="100%" height="215" viewBox="0 0 300 215" className="bg-slate-50">
        <defs>
          <marker id="aBlue2" markerWidth="9" markerHeight="7" refX="8" refY="3.5" orient="auto">
            <path d="M0,0 L9,3.5 L0,7" fill="#2563eb" /></marker>
          <marker id="aRed" markerWidth="9" markerHeight="9" refX="4.5" refY="9" orient="auto">
            <path d="M0,0 L4.5,9 L9,0" fill="#dc2626" /></marker>
        </defs>
        <line x1={cx} y1={cy} x2={cx + lDx} y2={cy + lDy}
          stroke="#2563eb" strokeWidth={2.4} markerEnd="url(#aBlue2)" />
        <text x={cx + lDx - 4} y={cy + lDy - 6} textAnchor="end"
          className="text-[9px] fill-blue-700 font-semibold">T_L {num(plr.T_left, 0)} kN</text>
        <line x1={cx} y1={cy} x2={cx + rDx} y2={cy + rDy}
          stroke="#2563eb" strokeWidth={2.4} markerEnd="url(#aBlue2)" />
        <text x={cx + rDx + 4} y={cy + rDy - 6}
          className="text-[9px] fill-blue-700 font-semibold">T_R {num(plr.T_right, 0)} kN</text>
        <line x1={cx} y1={cy} x2={cx} y2={cy + pLen}
          stroke="#dc2626" strokeWidth={2.6} markerEnd="url(#aRed)" />
        <text x={cx + 8} y={cy + pLen} className="text-[9px] fill-red-700 font-bold">
          P {num(plr.load.P, 0)} kN
        </text>
        <circle cx={cx} cy={cy} r={4.5} fill="#dc2626" />
        <text x={cx - 12} y={cy + 16} textAnchor="end" className="text-[8px] fill-slate-500">
          θL {num(Math.abs(plr.thetaLeft * RAD), 2)}°
        </text>
        <text x={cx + 12} y={cy + 16} className="text-[8px] fill-slate-500">
          θR {num(Math.abs(plr.thetaRight * RAD), 2)}°
        </text>
        <text x={150} y={200} textAnchor="middle" className="text-[9px] fill-slate-600">
          H·(m_R − m_L) = {num(plr.equilibriumCheck, 3)} ≈ P = {num(plr.load.P, 3)} kN
        </text>
        <text x={150} y={210} textAnchor="middle" className="text-[8px] fill-slate-400">
          H = {num(H, 1)} kN, error {plr.equilibriumError.toExponential(1)} kN
        </text>
      </svg>
    </div>
  );
};

export const ForceDiagram: React.FC<Props> = ({ caseResult }) => (
  <div className="space-y-3">
    <Card title={`Saddle Force Polygons — ${caseResult.label}`} icon="⚡" color="bg-slate-800">
      <div className="p-3 flex flex-wrap gap-3">
        <TowerDiag tower={caseResult.leftTower} label="Tower A (left)" />
        <TowerDiag tower={caseResult.rightTower} label="Tower B (right)" />
      </div>
      <div className="px-3 pb-3 text-[10px] text-slate-500 leading-snug">
        Forces are those the cables apply to the saddle. Under the balanced-backstay
        idealisation the two horizontal components cancel and the mast carries almost pure
        compression; with a roller saddle the tension is continuous through it and the
        residual thrust has to be carried as shear and base moment.
      </div>
    </Card>

    {caseResult.pointLoadResults.length > 0 && (
      <Card title="Point-Load Equilibrium" icon="⬇" color="bg-rose-800">
        <div className="p-3 flex flex-wrap gap-3">
          {caseResult.pointLoadResults.map((p, i) => (
            <LoadDiag key={i} plr={p} H={caseResult.H} />
          ))}
        </div>
      </Card>
    )}
  </div>
);
