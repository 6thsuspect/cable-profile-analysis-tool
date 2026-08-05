// ============================================================
// Cable Profile & Point-Load Analysis Tool — application shell
// ============================================================
import { useCallback, useMemo, useState } from 'react';
import type { AnalysisResult, CableInput } from './types';
import { solveCable } from './solver/CableSolver';
import { PRESETS, defaultInput } from './solver/presets';
import { InputPanel } from './components/InputPanel';
import { CableDiagram } from './components/CableDiagram';
import { ForceDiagram } from './components/ForceDiagram';
import { ResultsPanel } from './components/ResultsPanel';
import { EquationsRef } from './components/EquationsRef';
import { PointLoadSlider } from './components/PointLoadSlider';
import { CapacityPanel } from './components/CapacityPanel';
import { CasesPanel } from './components/CasesPanel';
import { LaunchingPanel } from './components/LaunchingPanel';
import { Stat, num } from './components/ui';
import { exportReport } from './report/pdfExport';

type Tab = 'profile' | 'capacity' | 'launch' | 'cases' | 'forces' | 'calc' | 'equations';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'profile', label: 'Profile', icon: '📈' },
  { id: 'capacity', label: 'Capacity & Break Point', icon: '⚡' },
  { id: 'launch', label: 'Launching', icon: '🚧' },
  { id: 'cases', label: 'Load Cases', icon: 'Σ' },
  { id: 'forces', label: 'Force Diagrams', icon: '⇄' },
  { id: 'calc', label: 'Calculation Trail', icon: '📝' },
  { id: 'equations', label: 'Equations & Verification', icon: '📐' },
];

export default function App() {
  const [input, setInput] = useState<CableInput>(defaultInput);
  const [tab, setTab] = useState<Tab>('profile');
  const [showCaseId, setShowCaseId] = useState<string | null>(null);

  const { result, error } = useMemo(() => {
    try {
      return { result: solveCable(input), error: null as string | null };
    } catch (e) {
      return { result: null as AnalysisResult | null, error: (e as Error).message };
    }
  }, [input]);

  const shown = useMemo(() => {
    if (!result) return null;
    return result.cases.find(c => c.id === showCaseId) ?? result.primary;
  }, [result, showCaseId]);

  const setFrontPosition = useCallback((x: number) => {
    setInput(p => ({ ...p, launching: { ...p.launching, frontPosition: x } }));
  }, []);
  const setPointLoadX = useCallback((id: string, x: number) => {
    setInput(p => ({
      ...p, pointLoads: p.pointLoads.map(l => (l.id === id ? { ...l, x } : l)),
    }));
  }, []);
  const setPointLoadP = useCallback((id: string, P: number) => {
    setInput(p => ({
      ...p, pointLoads: p.pointLoads.map(l => (l.id === id ? { ...l, P } : l)),
    }));
  }, []);

  const loadPreset = useCallback((id: string) => {
    const p = PRESETS.find(x => x.id === id);
    if (p) {
      setInput(p.build());
      setShowCaseId(null);
    }
  }, []);

  const exportPdf = useCallback(() => {
    if (result) exportReport(input, result);
  }, [input, result]);

  const failing = result
    ? result.cases.flatMap(c => c.checks.filter(k => k.status === 'FAIL')).length
    : 0;

  return (
    <div className="min-h-screen bg-slate-100">
      {/* ───────── header ───────── */}
      <header className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white shadow-lg sticky top-0 z-30">
        <div className="max-w-[1720px] mx-auto px-4 py-2.5">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-base font-bold tracking-tight flex items-center gap-2">
                <span className="text-xl">🔗</span>
                Cable Profile &amp; Point-Load Analysis
              </h1>
              <p className="text-[10px] text-blue-300 mt-0.5">
                Length-compatible elastic cable analysis for temporary launching systems over a crossing
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <select
                onChange={e => { if (e.target.value) loadPreset(e.target.value); e.target.value = ''; }}
                defaultValue=""
                className="bg-slate-700 text-white text-[11px] px-2 py-1.5 rounded border border-slate-600 outline-none max-w-[220px]"
              >
                <option value="">Load a worked scenario…</option>
                {PRESETS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
              <button onClick={exportPdf} disabled={!result}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-xs font-medium rounded transition-colors">
                📄 Export PDF
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-[1720px] mx-auto px-4 py-3">
        <div className="flex gap-3 items-start">
          {/* ───────── inputs ───────── */}
          <div className="w-[368px] flex-shrink-0">
            <div className="sticky top-[74px] max-h-[calc(100vh-88px)] overflow-y-auto pr-1">
              <InputPanel input={input} onChange={setInput} />
            </div>
          </div>

          {/* ───────── results ───────── */}
          <div className="flex-1 min-w-0 space-y-3">
            {error && (
              <div className="bg-red-50 border border-red-300 rounded-lg p-4">
                <h3 className="text-sm font-bold text-red-800">The model could not be solved</h3>
                <p className="text-xs text-red-700 mt-1">{error}</p>
              </div>
            )}

            {result && shown && (
              <>
                {/* summary strip */}
                <div className="bg-white border border-slate-300 rounded-lg overflow-hidden">
                  <div className={`px-3 py-1.5 text-xs font-semibold flex items-center justify-between gap-3 flex-wrap ${
                    failing > 0 ? 'bg-red-700 text-white' : 'bg-emerald-700 text-white'}`}>
                    <span>
                      {failing > 0
                        ? `${failing} limit-state exceedance${failing > 1 ? 's' : ''} across ${result.cases.length} combination${result.cases.length > 1 ? 's' : ''}`
                        : `All ${result.cases.length} combinations satisfy every limit state`}
                      {' — governing: '}{result.governingCase.label}
                    </span>
                    <span className="font-normal opacity-90">
                      {shown.model === 'PARABOLIC_HORIZONTAL_LOAD' ? 'Elastic parabolic' : 'Elastic catenary'}
                      {' · '}{input.cable.nCables} × {input.cable.section.name}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 md:grid-cols-4 xl:grid-cols-7 divide-x divide-slate-200">
                    <Stat label="Installed sag" value={num(result.installed.sag0, 3)} unit="m"
                      note={`H₀ = ${num(result.installed.H0, 0)} kN`} />
                    <Stat label={`Sag — ${shown.label.split('—')[0].trim()}`}
                      value={num(shown.maxSag, 3)} unit="m"
                      note={`+${num((shown.maxSag - result.installed.sag0) * 1000, 0)} mm under load`} />
                    <Stat label="Horizontal tension H" value={num(shown.H, 0)} unit="kN" />
                    <Stat label="Tension per rope" value={num(shown.T_perRope, 1)} unit="kN"
                      tone={shown.utilizationMBL > 0.9 ? 'bad' : shown.utilizationMBL > 0.6 ? 'warn' : 'good'}
                      note={`σ = ${num(shown.stress, 0)} MPa`} />
                    <Stat label="Actual FoS" value={num(shown.FoS_actual, 2)}
                      tone={shown.FoS_actual < input.cable.FoS ? 'bad' : 'good'}
                      note={`required ${num(input.cable.FoS, 2)}`} />
                    <Stat label="Break point"
                      value={result.breakPoint.available && result.breakPoint.lambdaAllowable > 0
                        ? `${num(result.breakPoint.lambdaAllowable, 2)}×` : '—'}
                      tone={result.breakPoint.lambdaAllowable >= 1.25 ? 'good'
                        : result.breakPoint.lambdaAllowable >= 1 ? 'warn' : 'bad'}
                      note={result.breakPoint.available
                        ? `${num(result.breakPoint.allowableVariableLoad, 0)} kN allowable`
                        : 'not run'} />
                    <Stat label="Clearance" value={num(shown.minClearance, 2)} unit="m"
                      tone={shown.minClearance < input.site.requiredClearance ? 'bad' : 'good'}
                      note={`required ${num(input.site.requiredClearance, 1)} m`} />
                  </div>
                  {result.warnings.length > 0 && (
                    <div className="border-t border-amber-200 bg-amber-50 px-3 py-1.5">
                      <details>
                        <summary className="text-[11px] text-amber-800 font-medium cursor-pointer">
                          {result.warnings.length} warning{result.warnings.length > 1 ? 's' : ''}
                        </summary>
                        <ul className="mt-1 space-y-0.5">
                          {result.warnings.map((w, i) => (
                            <li key={i} className="text-[11px] text-amber-800 leading-snug">• {w}</li>
                          ))}
                        </ul>
                      </details>
                    </div>
                  )}
                </div>

                {/* case selector */}
                <div className="flex items-center gap-2 flex-wrap bg-white border border-slate-300 rounded-lg px-3 py-2">
                  <span className="text-[11px] font-semibold text-slate-600">Showing:</span>
                  {result.cases.map(c => {
                    const active = c.id === shown.id;
                    const bad = c.checks.some(k => k.status === 'FAIL');
                    return (
                      <button key={c.id} onClick={() => setShowCaseId(c.id)}
                        className={`px-2 py-1 rounded text-[11px] border transition-colors ${
                          active
                            ? 'bg-blue-700 text-white border-blue-700'
                            : bad
                              ? 'bg-red-50 text-red-700 border-red-300 hover:bg-red-100'
                              : 'bg-slate-50 text-slate-600 border-slate-300 hover:bg-slate-100'}`}>
                        {c.label}
                        {c.id === result.governingCase.id && <span className="ml-1 font-bold">★</span>}
                      </button>
                    );
                  })}
                  <span className="text-[10px] text-slate-400 ml-auto">★ governs</span>
                </div>

                {/* tabs */}
                <div className="flex border-b border-slate-300 overflow-x-auto">
                  {TABS.map(t => (
                    <button key={t.id} onClick={() => setTab(t.id)}
                      className={`px-3 py-2 text-xs font-medium border-b-2 whitespace-nowrap transition-colors ${
                        tab === t.id
                          ? 'border-blue-600 text-blue-700 bg-white'
                          : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}>
                      {t.icon} {t.label}
                    </button>
                  ))}
                </div>

                {tab === 'profile' && (
                  <>
                    <CableDiagram input={input} result={result} caseResult={shown} />
                    <PointLoadSlider input={input}
                      onSetPointLoadX={setPointLoadX}
                      onSetPointLoadP={setPointLoadP}
                      onSetFrontPosition={setFrontPosition} />
                  </>
                )}
                {tab === 'capacity' && (
                  <CapacityPanel input={input} result={result} caseResult={shown} />
                )}
                {tab === 'launch' && (
                  <>
                    <LaunchingPanel input={input} result={result}
                      onSetFrontPosition={setFrontPosition} />
                    <PointLoadSlider input={input}
                      onSetPointLoadX={setPointLoadX}
                      onSetPointLoadP={setPointLoadP}
                      onSetFrontPosition={setFrontPosition} />
                  </>
                )}
                {tab === 'cases' && (
                  <CasesPanel input={input} result={result}
                    selectedId={shown.id} onSelect={setShowCaseId} />
                )}
                {tab === 'forces' && <ForceDiagram caseResult={shown} />}
                {tab === 'calc' && <ResultsPanel result={result} />}
                {tab === 'equations' && (
                  <EquationsRef model={input.options.model} verification={result.verification} />
                )}

                {/* footer strip */}
                <div className="bg-slate-800 text-slate-400 rounded-lg px-4 py-2.5 text-[10px] grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <span className="text-slate-500">Coordinates</span><br />
                    x → right from Tower A, y → up. P downward positive.
                  </div>
                  <div>
                    <span className="text-slate-500">Units</span><br />
                    kN, m, mm², MPa, °C
                  </div>
                  <div>
                    <span className="text-slate-500">System</span><br />
                    Anchor A → Tower A → crossing → Tower B → Anchor B
                  </div>
                  <div>
                    <span className="text-slate-500">Model</span><br />
                    H solved from axial compatibility with the cut length L₀ = {num(result.installed.L0, 3)} m
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ───────── author ───────── */}
      <footer className="max-w-[1720px] mx-auto px-4 pb-6">
        <div className="bg-gradient-to-r from-slate-800 via-slate-900 to-slate-800 text-white rounded-xl p-5 shadow-lg border border-slate-700">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-700 flex items-center justify-center text-lg font-bold flex-shrink-0 shadow ring-2 ring-slate-600">
              AR
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-xs font-semibold text-slate-300 tracking-wider uppercase mb-1">About the Author</h3>
              <h2 className="text-base font-bold text-white">Arvind Singh Rawat</h2>
              <p className="text-xs text-blue-300 font-medium mb-1.5">Bridge &amp; Structural Design Engineer</p>
              <p className="text-[11px] text-slate-400 leading-relaxed max-w-2xl">
                Structural engineer with <span className="text-white font-semibold">7+ years of experience</span> in
                RCC, PSC and steel bridge design. Passionate about combining{' '}
                <span className="text-white font-semibold">structural engineering, design codes and software development</span>{' '}
                to create practical, transparent and reliable engineering tools.
              </p>
              <div className="flex items-center gap-4 mt-2.5 flex-wrap">
                <a href="mailto:arvindrawat400@gmail.com"
                  className="flex items-center gap-1.5 text-[11px] text-slate-300 hover:text-blue-400 transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                  </svg>
                  arvindrawat400@gmail.com
                </a>
                <a href="https://linkedin.com/in/arvindrawat400" target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-[11px] text-slate-300 hover:text-blue-400 transition-colors">
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                  </svg>
                  linkedin.com/in/arvindrawat400
                </a>
              </div>
              <p className="text-[10px] text-slate-500 mt-2.5">
                &copy; 2026 Arvind Singh Rawat. All Rights Reserved.
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
