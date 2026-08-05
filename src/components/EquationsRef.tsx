// ============================================================
// Governing equations, assumptions and the verification suite
// ============================================================
import React from 'react';
import type { AnalysisModel, VerificationReport } from '../types';
import { Card, StatusBadge, num } from './ui';

interface Props {
  model: AnalysisModel;
  verification: VerificationReport;
}

const Eq: React.FC<{ title: string; lines: string[]; note?: string }> = ({ title, lines, note }) => (
  <div className="px-3 py-2 border-b border-slate-100 last:border-0">
    <h4 className="font-bold text-indigo-800 text-xs mb-1">{title}</h4>
    <div className="font-mono text-[11px] text-slate-700 space-y-0.5">
      {lines.map((l, i) => <div key={i}>{l}</div>)}
    </div>
    {note && <p className="text-[10px] text-slate-500 mt-1 leading-snug">{note}</p>}
  </div>
);

export const EquationsRef: React.FC<Props> = ({ model, verification }) => (
  <div className="space-y-3">
    {/* ── the change that matters ── */}
    <div className="bg-indigo-50 border border-indigo-300 rounded-lg p-4">
      <h3 className="text-sm font-bold text-indigo-900 mb-1.5">
        Why the sag no longer runs away
      </h3>
      <p className="text-xs text-indigo-900 leading-relaxed">
        If H is treated as an input, the deflection under a point load is δ = P·L/(4H) — linear
        in P and unbounded. That is kinematics, not statics: it lets a cable stretch as far as
        the load asks it to. A real cable has a fixed unstressed (cut) length L₀, so adding
        load pulls it <em>tighter</em> instead. H is therefore an <strong>unknown</strong>,
        found from axial compatibility:
      </p>
      <div className="font-mono text-xs bg-white border border-indigo-200 rounded px-3 py-2 mt-2 text-indigo-900">
        S(H) = L₀·(1 + α·ΔT) + (1/EA)·∫T ds + δ_support(H)
      </div>
      <p className="text-xs text-indigo-900 leading-relaxed mt-2">
        The arc length S falls as H rises while the right-hand side rises, so the root is
        unique. The sag can then only grow by the elastic stretch of the rope, plus temperature
        movement and any tower-top give — millimetres, not metres. Tension climbs instead, until
        it reaches a real limit state. That limit is what the break-point search reports.
      </p>
    </div>

    <Card title={`Governing Equations — ${
      model === 'PARABOLIC_HORIZONTAL_LOAD' ? 'elastic parabolic' : 'elastic catenary'}`}
      icon="📐" color="bg-indigo-800">
      {model === 'PARABOLIC_HORIZONTAL_LOAD' ? (
        <>
          <Eq title="Cable equation, per segment" lines={[
            'H · y″ = w',
            'y(ξ) = y_i + C_i·ξ + w_i·ξ² / (2H)',
            'C_i  = (y_{i+1} − y_i)/ℓ_i − w_i·ℓ_i / (2H)',
          ]}
            note="The cable is cut into segments at every point load and every change of distributed load, so w is constant inside each one." />
          <Eq title="Vertical equilibrium at an interior node" lines={[
            'H · (m_R − m_L) = P_j',
            '(y_{j+1} − y_j)/ℓ_j − (y_j − y_{j−1})/ℓ_{j−1} = [P_j + (w_j·ℓ_j + w_{j−1}·ℓ_{j−1})/2] / H',
          ]}
            note="For a trial H this is a tridiagonal system in the node elevations — the classic taut string." />
          <Eq title="Arc length and the elastic kernel (closed form)" lines={[
            'u(ξ) = C_i + w_i·ξ/H',
            'S_i = (H/w_i)·½[ u√(1+u²) + asinh u ]   evaluated u_start → u_end',
            '∫(1+u²)dξ = ℓ(1+C²) + C·a·ℓ² + a²ℓ³/3      a = w/H',
            '∫T ds = H · ∫(1 + y′²) dx                  since T = H√(1+y′²), ds = √(1+y′²)dx',
          ]}
            note="Both integrals are exact. The second identity is what makes the elastic term in the compatibility equation closed-form rather than numerical." />
          <Eq title="Self weight per horizontal metre" lines={[
            'w = γ · ds/dx        solved as a fixed point per segment',
            'exists only while  H ≥ γ·L/√6',
          ]}
            note="γ is the weight per metre of cable. Below that threshold the 'load per horizontal projection' idealisation has no solution at all and the tool says so — use the catenary model there." />
          <Eq title="Tension and angle" lines={[
            'θ = atan(dy/dx)',
            'V = H · dy/dx',
            'T = √(H² + V²) = H / cos θ',
          ]} />
        </>
      ) : (
        <>
          <Eq title="Elastic catenary element" lines={[
            'p  = unstressed arc coordinate,  V(p) = V_i + w₀·p,  T = √(H² + V²)',
            'dx/dp = (1 + T/EA + α·ΔT) · H/T',
            'dy/dp = (1 + T/EA + α·ΔT) · V/T',
          ]} />
          <Eq title="Integrated element (exact)" lines={[
            'Δx = τ·(H/w₀)·[ asinh(V_j/H) − asinh(V_i/H) ] + H·ℓ₀/EA',
            'Δy = τ·(T_j − T_i)/w₀              + ℓ₀·(V_i + V_j)/(2·EA)',
            'arc = ℓ₀·τ + (1/EA)·∫T dp          τ = 1 + α·ΔT',
            '∫T dp = (1/2w₀)·[ V√(H²+V²) + H²·asinh(V/H) ]',
          ]}
            note="No small-sag assumption anywhere. This is the reference model — the parabolic form is its shallow-cable limit." />
          <Eq title="Chain with point loads" lines={[
            'unknowns:  H, V₀, ℓ₀¹ … ℓ₀ⁿ        with  Σ ℓ₀ᵏ = L₀',
            'at each load:  V_right = V_left + P_j',
            'equations:  Σ Δx = L + δ_support,   Σ Δy = y_R − y_L,',
            '            and Σ Δx up to load j = x_j   for every load',
          ]}
            note="Solved by damped Newton with a numerical Jacobian, seeded from the parabolic solution. A load attached at a fixed horizontal position fixes the unstressed length of each element, which is why those lengths are unknowns." />
        </>
      )}
      <Eq title="Saddle and backstay" lines={[
        'balanced backstay:   T_bs = H / sin α          ⇒ net thrust ≈ 0',
        'roller saddle:       T_bs = T_main            ⇒ thrust = H − T_main·sin α',
        'H_bs = T_bs·sin α,   V_bs = T_bs·cos α        α measured from vertical',
        'base moment = |net thrust| · h',
      ]}
        note="A steep backstay (small α) needs an enormous force to hold H back, which is why the backstay is so often the governing element." />
      <Eq title="Anchor block" lines={[
        'uplift    : FoS = (W + T_tiedown) / (T_bs·cos α)',
        'sliding   : FoS = [ μ·(W + T_tiedown − T_bs·cos α) + R_passive ] / (T_bs·sin α)',
      ]} />
      <Eq title="Capacity" lines={[
        'MBL_eff  = MBL · η_termination · η_bend',
        'service  : T_rope ≤ MBL_eff / FoS',
        'factored : T_rope ≤ MBL_eff / γ_M',
        'T_rope   = T_system · share_factor / n_ropes',
        'σ = T_rope / A_m,   ε = σ / E',
      ]}
        note="Service combinations use the factor of safety on unfactored loads; factored combinations use the material factor instead, so the two are never multiplied together." />
      <Eq title="Stiffness" lines={[
        'E_Dischinger = E / [ 1 + w²·L²·EA / (12·H³) ]',
        'k_vertical   = dP/dδ   evaluated through the full nonlinear solve',
      ]}
        note="The Dischinger modulus is the secant stiffness once the sag change that accompanies a tension change is allowed for." />
    </Card>

    {/* ── verification ── */}
    <Card title="Built-in Verification" icon="✓"
      color={verification.allPass ? 'bg-emerald-700' : 'bg-red-700'}
      subtitle={`${verification.items.filter(i => i.pass).length} / ${verification.items.length} benchmarks pass`}>
      <div className="px-3 py-2 text-[11px] text-slate-600 border-b border-slate-200 leading-snug">
        Each benchmark has a closed-form answer that does not come from this code, so a green
        suite is evidence the arithmetic is reproducible by hand. It runs on fixed inputs,
        independent of what you have typed.
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[11px]">
          <thead className="bg-slate-100 text-slate-600">
            <tr>
              <th className="px-2 py-1.5 text-left font-semibold">Benchmark</th>
              <th className="px-2 py-1.5 text-left font-semibold">Reference</th>
              <th className="px-2 py-1.5 text-right font-semibold">Expected</th>
              <th className="px-2 py-1.5 text-right font-semibold">Computed</th>
              <th className="px-2 py-1.5 text-right font-semibold">Rel. error</th>
              <th className="px-2 py-1.5 text-center font-semibold">Result</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {verification.items.map((it, i) => (
              <tr key={i} className={it.pass ? (i % 2 ? 'bg-slate-50/60' : '') : 'bg-red-50'}>
                <td className="px-2 py-1.5 text-slate-700">{it.name}</td>
                <td className="px-2 py-1.5 font-mono text-[10px] text-slate-500">{it.reference}</td>
                <td className="px-2 py-1.5 text-right font-mono tabular-nums">
                  {num(it.expected, 6)} <span className="text-slate-400">{it.unit}</span>
                </td>
                <td className="px-2 py-1.5 text-right font-mono tabular-nums">{num(it.computed, 6)}</td>
                <td className="px-2 py-1.5 text-right font-mono text-[10px] text-slate-500">
                  {it.relativeError.toExponential(1)}
                  <span className="text-slate-400"> / {it.tolerance.toExponential(0)}</span>
                </td>
                <td className="px-2 py-1.5 text-center">
                  <StatusBadge status={it.pass ? 'OK' : 'FAIL'} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>

    {/* ── assumptions ── */}
    <Card title="Assumptions & Limitations" icon="!" color="bg-amber-700" defaultOpen={false}>
      <ul className="p-3 space-y-1.5 text-xs text-slate-700 list-disc list-inside leading-snug">
        <li>Planar (two-dimensional) analysis. Lateral wind is handled as an in-plane
          equivalent — out-of-plane swing needs a three-dimensional check.</li>
        <li>The cable takes no bending stiffness and no compression.</li>
        <li>Small strain: the elastic term is referred to the deformed length in the parabolic
          model, which carries an O(ε) error of roughly 0.1 %. The elastic catenary has no such
          approximation.</li>
        <li>Saddles are frictionless in the roller idealisation. Real saddle friction locks in
          a tension difference either side, which this tool does not model.</li>
        <li>Ropes are assumed prestretched, so the catalogue modulus applies. Constructional
          stretch of a new rope is not included — add it to the cut length.</li>
        <li>No creep, relaxation or fatigue assessment. For repeated launching cycles the rope
          must also be checked for bending fatigue over the saddles.</li>
        <li>Catalogue MBL, area and modulus are indicative values derived from construction
          constants. Substitute the certified figures from the manufacturer before issuing a
          design.</li>
        <li>Load factors and factors of safety are user inputs with conventional defaults. They
          are not tied to any particular code — confirm them against the governing standard for
          your project.</li>
        <li>Towers are treated as cantilever masts with the saddle load applied at the top.
          Foundation settlement and rotation are not modelled; use the tower-top stiffness input
          to represent overall flexibility.</li>
      </ul>
    </Card>
  </div>
);
