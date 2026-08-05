// ============================================================
// Equations Reference Panel
// ============================================================
import React from 'react';
import type { AnalysisModel } from '../types';

interface Props {
  model: AnalysisModel;
}

export const EquationsRef: React.FC<Props> = ({ model }) => {
  return (
    <div className="bg-white border border-slate-300 rounded-lg overflow-hidden">
      <div className="bg-indigo-800 text-white px-4 py-2 text-sm font-semibold">
        📐 Governing Equations — {model === 'PARABOLIC_HORIZONTAL_LOAD' ? 'Parabolic Model' : 'Catenary Model'}
      </div>
      <div className="p-4 text-xs text-slate-700 space-y-4 font-mono leading-relaxed max-h-96 overflow-y-auto">
        {model === 'PARABOLIC_HORIZONTAL_LOAD' ? (
          <>
            <div>
              <h4 className="font-bold text-indigo-700 mb-1 font-sans text-sm">Cable Differential Equation</h4>
              <p>H · d²y/dx² = w</p>
              <p>d²y/dx² = w/H</p>
            </div>
            <div>
              <h4 className="font-bold text-indigo-700 mb-1 font-sans text-sm">General Profile</h4>
              <p>y(x) = yL + C₁·x + w·x²/(2H)</p>
              <p>C₁ = (yR − yL)/L − w·L/(2H)</p>
            </div>
            <div>
              <h4 className="font-bold text-indigo-700 mb-1 font-sans text-sm">Endpoint Slopes</h4>
              <p>mL = (yR − yL)/L − w·L/(2H)</p>
              <p>mR = (yR − yL)/L + w·L/(2H)</p>
            </div>
            <div>
              <h4 className="font-bold text-indigo-700 mb-1 font-sans text-sm">Cable Angle & Tension</h4>
              <p>θ = atan(dy/dx)</p>
              <p>V = H · (dy/dx)</p>
              <p>T = √(H² + V²) = H / cos(θ)</p>
            </div>
            <div>
              <h4 className="font-bold text-indigo-700 mb-1 font-sans text-sm">Point Load — Slope Discontinuity</h4>
              <p>H · (mR,p − mL,p) = P</p>
              <p>H · (tan θR − tan θL) = P</p>
            </div>
            <div>
              <h4 className="font-bold text-indigo-700 mb-1 font-sans text-sm">Backstay</h4>
              <p>Hₐ = Tₐ · sin(α)</p>
              <p>Vₐ = Tₐ · cos(α)</p>
              <p>where α = angle from vertical</p>
            </div>
            <div>
              <h4 className="font-bold text-indigo-700 mb-1 font-sans text-sm">Tower/Pulley Resultant</h4>
              <p>Fx = T₁·cos(θ₁) + T₂·cos(θ₂)</p>
              <p>Fy = T₁·sin(θ₁) + T₂·sin(θ₂)</p>
              <p>R = √(Fx² + Fy²)</p>
            </div>
          </>
        ) : (
          <>
            <div>
              <h4 className="font-bold text-indigo-700 mb-1 font-sans text-sm">Catenary Equation</h4>
              <p>y(x) = a · cosh((x − x₀)/a) + C</p>
              <p>a = H / wₛ</p>
              <p>where wₛ = weight per unit cable length</p>
            </div>
            <div>
              <h4 className="font-bold text-indigo-700 mb-1 font-sans text-sm">Symmetric Case (lowest point at origin)</h4>
              <p>y(x) = a · [cosh(x/a) − 1]</p>
            </div>
            <div>
              <h4 className="font-bold text-indigo-700 mb-1 font-sans text-sm">Tension Along Cable</h4>
              <p>T(x) = H · cosh((x − x₀)/a)</p>
              <p>V(x) = H · sinh((x − x₀)/a)</p>
            </div>
            <div>
              <h4 className="font-bold text-indigo-700 mb-1 font-sans text-sm">Arc Length</h4>
              <p>s = a · sinh(x/a)</p>
            </div>
            <div>
              <h4 className="font-bold text-indigo-700 mb-1 font-sans text-sm">Parabolic Approximation</h4>
              <p>y ≈ x²/(2a)  for small sag/span</p>
              <p className="text-amber-600 font-sans">⚠ Warning: inaccurate when sag/span &gt; 0.1</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
