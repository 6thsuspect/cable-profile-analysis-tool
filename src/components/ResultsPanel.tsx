// ============================================================
// Results Panel — Displays analysis results, calculations, warnings
// ============================================================
import React, { useState } from 'react';
import type { AnalysisResult } from '../types';

const RAD = 180 / Math.PI;

interface Props {
  result: AnalysisResult;
}

export const ResultsPanel: React.FC<Props> = ({ result }) => {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    summary: true,
    maxForces: true,
    pointLoads: true,
    towers: true,
    steps: false,
  });

  const toggle = (key: string) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const SectionHeader: React.FC<{ id: string; title: string; icon: string; color: string }> = ({ id, title, icon, color }) => (
    <button
      onClick={() => toggle(id)}
      className={`w-full flex items-center gap-2 px-3 py-2 rounded-t-lg text-white text-sm font-semibold ${color} hover:opacity-90 transition`}
    >
      <span>{icon}</span>
      <span className="flex-1 text-left">{title}</span>
      <span className="text-xs opacity-80">{expandedSections[id] ? '▼' : '▶'}</span>
    </button>
  );

  const Row: React.FC<{ label: string; value: string; unit?: string; highlight?: boolean }> = ({ label, value, unit, highlight }) => (
    <div className={`flex items-center px-3 py-1.5 text-sm ${highlight ? 'bg-blue-50' : ''}`}>
      <span className="text-slate-600 flex-1">{label}</span>
      <span className="font-mono font-medium text-slate-800">{value}</span>
      {unit && <span className="text-slate-400 ml-1 w-10 text-xs">{unit}</span>}
    </div>
  );

  return (
    <div className="space-y-3">
      {/* Errors */}
      {result.errors.length > 0 && (
        <div className="bg-red-50 border border-red-300 rounded-lg p-3">
          <h4 className="text-sm font-bold text-red-700 mb-1">❌ Errors</h4>
          {result.errors.map((e, i) => (
            <p key={i} className="text-xs text-red-600">{e}</p>
          ))}
        </div>
      )}

      {/* Warnings */}
      {result.warnings.length > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg p-3">
          <h4 className="text-sm font-bold text-amber-700 mb-1">⚠️ Warnings</h4>
          {result.warnings.map((w, i) => (
            <p key={i} className="text-xs text-amber-700">{w}</p>
          ))}
        </div>
      )}

      {/* Summary */}
      <div className="bg-white border border-slate-300 rounded-lg overflow-hidden">
        <SectionHeader id="summary" title="Results Summary" icon="📊" color="bg-blue-700" />
        {expandedSections.summary && (
          <div className="divide-y divide-slate-100">
            <Row label="Model" value={result.model === 'PARABOLIC_HORIZONTAL_LOAD' ? 'Parabolic' : 'Catenary'} highlight />
            <Row label="Horizontal Tension (H)" value={result.H.toFixed(2)} unit="kN" highlight />
            <Row label="Left Cable Angle (θL)" value={(result.thetaLeft * RAD).toFixed(3)} unit="deg" />
            <Row label="Right Cable Angle (θR)" value={(result.thetaRight * RAD).toFixed(3)} unit="deg" />
            <Row label="Left Slope" value={result.slopeLeft.toFixed(6)} />
            <Row label="Right Slope" value={result.slopeRight.toFixed(6)} />
            <Row label="Maximum Sag" value={result.maxSag.toFixed(4)} unit="m" highlight />
            <Row label="Sag / Span" value={result.sagRatio > 0 ? `1/${(1 / result.sagRatio).toFixed(1)}` : '—'} />
            <Row label="Cable Length" value={result.cableLength.toFixed(4)} unit="m" />
          </div>
        )}
      </div>

      {/* Maximum Forces Summary */}
      <div className="bg-white border border-slate-300 rounded-lg overflow-hidden">
        <SectionHeader id="maxForces" title="Maximum Forces Summary" icon="⚡" color="bg-purple-700" />
        {expandedSections.maxForces && (
          <div className="divide-y divide-slate-100">
            {/* Max Cable Tension */}
            <div className="bg-purple-50 px-3 py-1.5 text-xs font-bold text-purple-800">
              Maximum Cable Tension
            </div>
            <Row label="Max Tension (T_max)" value={result.maxForces.maxTension.toFixed(2)} unit="kN" highlight />
            <Row label="Location" value={result.maxForces.maxTensionDescription} />
            <Row label="x coordinate" value={result.maxForces.maxTensionLocation.toFixed(2)} unit="m" />
            
            {/* Tower A Forces */}
            <div className="bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-800">
              Tower A (Left) — Net Forces
            </div>
            <Row label="Horizontal Force (H)" value={result.maxForces.towerA_H.toFixed(2)} unit="kN" highlight />
            <Row label="Vertical Force (V)" value={result.maxForces.towerA_V.toFixed(2)} unit="kN" highlight />
            <Row label="Resultant Force (R)" value={result.maxForces.towerA_R.toFixed(2)} unit="kN" highlight />
            
            {/* Tower B Forces */}
            <div className="bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800">
              Tower B (Right) — Net Forces
            </div>
            <Row label="Horizontal Force (H)" value={result.maxForces.towerB_H.toFixed(2)} unit="kN" highlight />
            <Row label="Vertical Force (V)" value={result.maxForces.towerB_V.toFixed(2)} unit="kN" highlight />
            <Row label="Resultant Force (R)" value={result.maxForces.towerB_R.toFixed(2)} unit="kN" highlight />
          </div>
        )}
      </div>

      {/* Point Load Results */}
      {result.pointLoadResults.length > 0 && (
        <div className="bg-white border border-slate-300 rounded-lg overflow-hidden">
          <SectionHeader id="pointLoads" title="Point-Load Results" icon="⬇️" color="bg-red-700" />
          {expandedSections.pointLoads && (
            <div>
              {result.pointLoadResults.map((plr, idx) => (
                <div key={idx} className="border-b border-slate-200 last:border-0">
                  <div className="bg-red-50 px-3 py-1.5 text-xs font-bold text-red-800">
                    {plr.load.label} — x = {plr.load.x.toFixed(2)} m, P = {plr.load.P.toFixed(2)} kN
                  </div>
                  <div className="divide-y divide-slate-100">
                    <Row label="Cable elevation (yp)" value={plr.yp.toFixed(4)} unit="m" />
                    <Row label="Slope left of load" value={plr.slopeLeft.toFixed(6)} />
                    <Row label="Slope right of load" value={plr.slopeRight.toFixed(6)} />
                    <Row label="Angle left (θL)" value={(plr.thetaLeft * RAD).toFixed(3)} unit="deg" />
                    <Row label="Angle right (θR)" value={(plr.thetaRight * RAD).toFixed(3)} unit="deg" />
                    <Row label="Tension left (TL)" value={plr.T_left.toFixed(2)} unit="kN" highlight />
                    <Row label="Tension right (TR)" value={plr.T_right.toFixed(2)} unit="kN" highlight />
                    <Row label="Slope discontinuity (mR−mL)" value={plr.slopeDiscontinuity.toFixed(6)} />
                    <Row
                      label="Equilibrium: H·(mR−mL)"
                      value={`${plr.equilibriumCheck.toFixed(2)} ≈ ${plr.load.P.toFixed(2)}`}
                      unit="kN"
                      highlight
                    />
                    <div className="px-3 py-1 text-xs">
                      <span className={Math.abs(plr.equilibriumCheck - plr.load.P) < 0.01 ? 'text-green-600' : 'text-red-600'}>
                        {Math.abs(plr.equilibriumCheck - plr.load.P) < 0.01 ? '✓ Equilibrium satisfied' : '✗ Equilibrium not satisfied'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tower Results */}
      <div className="bg-white border border-slate-300 rounded-lg overflow-hidden">
        <SectionHeader id="towers" title="Tower / Pulley Results" icon="🗼" color="bg-emerald-700" />
        {expandedSections.towers && (
          <div>
            {[result.leftTower, result.rightTower].map((tw, idx) => (
              <div key={idx} className="border-b border-slate-200 last:border-0">
                <div className="bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800">
                  {tw.side === 'left' ? 'Left Tower (A)' : 'Right Tower (B)'}
                </div>
                <div className="divide-y divide-slate-100">
                  <div className="px-3 py-1 text-[10px] font-medium text-slate-500 uppercase tracking-wider">Main Cable</div>
                  <Row label="Cable angle from horizontal" value={(tw.thetaMain * RAD).toFixed(3)} unit="deg" />
                  <Row label="Cable angle from vertical" value={(90 - Math.abs(tw.thetaMain * RAD)).toFixed(3)} unit="deg" />
                  <Row label="Cable tension (T_main)" value={tw.T_main.toFixed(2)} unit="kN" highlight />
                  <Row label="Horizontal component (H)" value={tw.H_main.toFixed(2)} unit="kN" />
                  <Row label="Vertical component (V)" value={tw.V_main.toFixed(2)} unit="kN" />

                  <div className="px-3 py-1 text-[10px] font-medium text-slate-500 uppercase tracking-wider">Backstay</div>
                  <Row label="Backstay angle from horizontal" value={(tw.thetaBackstay * RAD).toFixed(3)} unit="deg" />
                  <Row label="Backstay tension (T_backstay)" value={tw.T_backstay.toFixed(2)} unit="kN" highlight />
                  <Row label="Horizontal component (H)" value={tw.H_backstay.toFixed(2)} unit="kN" />
                  <Row label="Vertical component (V)" value={tw.V_backstay.toFixed(2)} unit="kN" />

                  <div className="px-3 py-1 text-[10px] font-medium text-slate-500 uppercase tracking-wider">Tower Resultant</div>
                  <Row label="Resultant force (R)" value={tw.R.toFixed(2)} unit="kN" highlight />
                  <Row label="Rx (horizontal)" value={tw.Rx.toFixed(2)} unit="kN" />
                  <Row label="Ry (vertical)" value={tw.Ry.toFixed(2)} unit="kN" />
                  <Row label="Direction from horizontal" value={(tw.thetaR * RAD).toFixed(3)} unit="deg" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Calculation Steps */}
      <div className="bg-white border border-slate-300 rounded-lg overflow-hidden">
        <SectionHeader id="steps" title="Calculation Steps & Equations" icon="📝" color="bg-slate-700" />
        {expandedSections.steps && (
          <div className="p-3 max-h-80 overflow-y-auto">
            {result.calculationSteps.map((step, i) => (
              <div key={i} className="text-xs font-mono text-slate-700 py-0.5 border-b border-slate-50">
                {step}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
