// ============================================================
// Cable Profile & Point-Load Analysis Tool — Main Application
// ============================================================
import { useState, useMemo, useCallback } from 'react';
import type { CableInput, AnalysisResult } from './types';
import { solveCable } from './solver/CableSolver';
import { InputPanel } from './components/InputPanel';
import { CableDiagram } from './components/CableDiagram';
import { ForceDiagram } from './components/ForceDiagram';
import { ResultsPanel } from './components/ResultsPanel';
import { EquationsRef } from './components/EquationsRef';
import { PointLoadSlider } from './components/PointLoadSlider';
import { exportReport } from './report/pdfExport';

const DEFAULT_INPUT: CableInput = {
  geometry: {
    yL: 50,
    yR: 45,
    L: 200,
    La: 30,
    Ra: 30,
    alphaL: 30,
    alphaR: 30,
  },
  cable: {
    w: 0.5,
    gamma: 0.52,
  },
  pointLoads: [],
  options: {
    model: 'PARABOLIC_HORIZONTAL_LOAD',
    diagramSamples: 200,
    tolerance: 1e-10,
    maxIterations: 200,
  },
  H_input: 500,
};

type Tab = 'diagram' | 'forces' | 'results' | 'equations';

export default function App() {
  const [input, setInput] = useState<CableInput>(DEFAULT_INPUT);
  const [activeTab, setActiveTab] = useState<Tab>('diagram');

  const result: AnalysisResult | null = useMemo(() => {
    try {
      return solveCable(input);
    } catch (e) {
      console.error('Solver error:', e);
      return null;
    }
  }, [input]);

  const handleInputChange = useCallback((newInput: CableInput) => {
    setInput(newInput);
  }, []);

  const handleExportPDF = useCallback(() => {
    if (result) {
      exportReport(input, result);
    }
  }, [input, result]);

  // Handler for point load position changes from slider
  const handlePointLoadPositionChange = useCallback((id: string, x: number) => {
    setInput(prev => ({
      ...prev,
      pointLoads: prev.pointLoads.map(pl =>
        pl.id === id ? { ...pl, x } : pl
      ),
    }));
  }, []);

  // Handler for point load magnitude changes from slider
  const handlePointLoadMagnitudeChange = useCallback((id: string, P: number) => {
    setInput(prev => ({
      ...prev,
      pointLoads: prev.pointLoads.map(pl =>
        pl.id === id ? { ...pl, P } : pl
      ),
    }));
  }, []);

  const handleLoadPreset = useCallback((preset: string) => {
    switch (preset) {
      case 'symmetric':
        setInput({
          ...DEFAULT_INPUT,
          geometry: { ...DEFAULT_INPUT.geometry, yL: 50, yR: 50, L: 200 },
          pointLoads: [],
          H_input: 500,
        });
        break;
      case 'asymmetric':
        setInput({
          ...DEFAULT_INPUT,
          geometry: { ...DEFAULT_INPUT.geometry, yL: 60, yR: 40, L: 250 },
          pointLoads: [],
          H_input: 600,
        });
        break;
      case 'point_load':
        setInput({
          ...DEFAULT_INPUT,
          geometry: { ...DEFAULT_INPUT.geometry, yL: 50, yR: 50, L: 200 },
          pointLoads: [
            { id: 'P1', x: 100, P: 20, label: 'P1' },
          ],
          H_input: 500,
        });
        break;
      case 'multi_load':
        setInput({
          ...DEFAULT_INPUT,
          geometry: { ...DEFAULT_INPUT.geometry, yL: 55, yR: 45, L: 300 },
          pointLoads: [
            { id: 'P1', x: 100, P: 15, label: 'P1' },
            { id: 'P2', x: 200, P: 25, label: 'P2' },
          ],
          H_input: 800,
        });
        break;
      case 'catenary':
        setInput({
          ...DEFAULT_INPUT,
          geometry: { ...DEFAULT_INPUT.geometry, yL: 50, yR: 50, L: 200 },
          cable: { w: 0.5, gamma: 0.52 },
          options: { ...DEFAULT_INPUT.options, model: 'CATENARY_SELF_WEIGHT' },
          pointLoads: [],
          H_input: 500,
        });
        break;
    }
  }, []);

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'diagram', label: 'Cable Profile', icon: '📈' },
    { id: 'forces', label: 'Force Diagrams', icon: '⚡' },
    { id: 'results', label: 'Detailed Results', icon: '📊' },
    { id: 'equations', label: 'Equations', icon: '📐' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200">
      {/* Header */}
      <header className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white shadow-xl">
        <div className="max-w-[1600px] mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
                <span className="text-2xl">🔗</span>
                Cable Profile & Point-Load Analysis Tool
              </h1>
              <p className="text-xs text-blue-300 mt-0.5">
                Engineering analysis for valley span cable systems with backstay anchors
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-slate-400 mr-1">Presets:</span>
                {[
                  { id: 'symmetric', label: 'Symmetric' },
                  { id: 'asymmetric', label: 'Asymmetric' },
                  { id: 'point_load', label: '1 Load' },
                  { id: 'multi_load', label: '2 Loads' },
                  { id: 'catenary', label: 'Catenary' },
                ].map(p => (
                  <button
                    key={p.id}
                    onClick={() => handleLoadPreset(p.id)}
                    className="px-2 py-1 text-[10px] bg-slate-700 hover:bg-slate-600 rounded transition-colors"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <button
                onClick={handleExportPDF}
                disabled={!result}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-xs font-medium rounded transition-colors flex items-center gap-1"
              >
                📄 Export PDF
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-[1600px] mx-auto px-4 py-4">
        <div className="flex gap-4">
          {/* Left Panel — Inputs */}
          <div className="w-[360px] flex-shrink-0 space-y-2">
            <div className="sticky top-4 max-h-[calc(100vh-100px)] overflow-y-auto pr-1">
              <InputPanel input={input} onChange={handleInputChange} />
            </div>
          </div>

          {/* Right Panel — Diagram + Results */}
          <div className="flex-1 min-w-0 space-y-3">
            {/* Status bar */}
            {result && (
              <div className={`px-4 py-2 rounded-lg text-xs font-medium flex items-center justify-between ${
                result.valid && result.errors.length === 0
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : 'bg-red-100 text-red-800 border border-red-300'
              }`}>
                <span>
                  {result.valid ? '✓ Analysis complete' : '✗ Analysis has errors'} — 
                  {' '}{result.model === 'PARABOLIC_HORIZONTAL_LOAD' ? 'Parabolic' : 'Catenary'} model
                  {' '}| H = {result.H.toFixed(2)} kN
                  {' '}| T_max = {result.maxForces.maxTension.toFixed(2)} kN
                  {' '}| Sag = {result.maxSag.toFixed(2)} m (1/{(1/result.sagRatio).toFixed(0)})
                  {result.pointLoadResults.length > 0 && ` | ${result.pointLoadResults.length} point load(s)`}
                </span>
                {result.warnings.length > 0 && (
                  <span className="text-amber-700">⚠ {result.warnings.length} warning(s)</span>
                )}
              </div>
            )}

            {/* Tabs */}
            <div className="flex border-b border-slate-300">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-600 text-blue-700 bg-white'
                      : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                  }`}
                >
                  {tab.icon} {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            {result ? (
              <div>
                {activeTab === 'diagram' && (
                  <CableDiagram input={input} result={result} />
                )}
                {activeTab === 'forces' && (
                  <ForceDiagram result={result} />
                )}
                {activeTab === 'results' && (
                  <ResultsPanel result={result} />
                )}
                {activeTab === 'equations' && (
                  <EquationsRef model={input.options.model} />
                )}
                
                {/* Point Load Slider - shown on all tabs when point loads exist */}
                {input.pointLoads.length > 0 && (
                  <PointLoadSlider
                    pointLoads={input.pointLoads}
                    spanL={input.geometry.L}
                    onChange={handlePointLoadPositionChange}
                    onChangeP={handlePointLoadMagnitudeChange}
                  />
                )}
              </div>
            ) : (
              <div className="bg-white border border-slate-300 rounded-lg p-12 text-center">
                <div className="text-4xl mb-3">⚙️</div>
                <h3 className="text-lg font-semibold text-slate-700">Analysis Error</h3>
                <p className="text-sm text-slate-500 mt-1">
                  Check input parameters. The solver encountered an error.
                </p>
              </div>
            )}

            {/* Quick info footer */}
            <div className="bg-slate-800 text-slate-400 rounded-lg px-4 py-3 text-[10px] grid grid-cols-4 gap-4">
              <div>
                <span className="text-slate-500">Coordinate System:</span><br />
                x → horizontal (right), y → elevation (up)
              </div>
              <div>
                <span className="text-slate-500">Sign Convention:</span><br />
                Positive: x rightward, y upward, P downward
              </div>
              <div>
                <span className="text-slate-500">Cable System:</span><br />
                Anchor A → Tower A → Valley Span → Tower B → Anchor B
              </div>
              <div>
                <span className="text-slate-500">Assumptions:</span><br />
                Frictionless pulleys, inextensible cable, planar analysis
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* About the Author */}
      <footer className="max-w-[1600px] mx-auto px-4 pb-6">
        <div className="bg-gradient-to-r from-slate-800 via-slate-900 to-slate-800 text-white rounded-xl p-6 shadow-lg border border-slate-700">
          <div className="flex items-start gap-5">
            {/* Avatar */}
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-indigo-700 flex items-center justify-center text-xl font-bold flex-shrink-0 shadow-md ring-2 ring-slate-600">
              AR
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-slate-300 tracking-wider uppercase mb-1">About the Author</h3>
              <h2 className="text-lg font-bold text-white">Arvind Singh Rawat</h2>
              <p className="text-sm text-blue-300 font-medium mb-2">Bridge &amp; Structural Design Engineer</p>
              <p className="text-xs text-slate-400 leading-relaxed max-w-2xl">
                Structural engineer with <span className="text-white font-semibold">7+ years of experience</span> in RCC, PSC and steel bridge design.
                Passionate about combining <span className="text-white font-semibold">structural engineering, design codes and software development</span> to
                create practical, transparent and reliable engineering tools.
              </p>

              <div className="flex items-center gap-4 mt-3">
                <a
                  href="mailto:arvindrawat400@gmail.com"
                  className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-blue-400 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                  </svg>
                  arvindrawat400@gmail.com
                </a>
                <a
                  href="https://linkedin.com/in/arvindrawat400"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-blue-400 transition-colors"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                  </svg>
                  linkedin.com/in/arvindrawat400
                </a>
              </div>

              <p className="text-[10px] text-slate-500 mt-3">
                &copy; 2026 Arvind Singh Rawat. All Rights Reserved.
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
