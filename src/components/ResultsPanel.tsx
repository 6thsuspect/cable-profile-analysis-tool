// ============================================================
// Calculation trail — the full narrative the solver produced
// ============================================================
import React, { useMemo, useState } from 'react';
import type { AnalysisResult } from '../types';
import { Card } from './ui';

interface Props {
  result: AnalysisResult;
}

export const ResultsPanel: React.FC<Props> = ({ result }) => {
  const [filter, setFilter] = useState('');

  const lines = useMemo(() => {
    if (!filter.trim()) return result.calculationSteps;
    const f = filter.toLowerCase();
    return result.calculationSteps.filter(s => s.toLowerCase().includes(f));
  }, [result.calculationSteps, filter]);

  const copy = () => {
    void navigator.clipboard?.writeText(result.calculationSteps.join('\n'));
  };

  return (
    <div className="space-y-3">
      {result.errors.length > 0 && (
        <div className="bg-red-50 border border-red-300 rounded-lg p-3">
          <h4 className="text-sm font-bold text-red-700 mb-1">Errors</h4>
          {result.errors.map((e, i) => <p key={i} className="text-xs text-red-600">{e}</p>)}
        </div>
      )}

      {result.warnings.length > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg p-3">
          <h4 className="text-sm font-bold text-amber-800 mb-1">
            Warnings ({result.warnings.length})
          </h4>
          <ul className="space-y-1">
            {result.warnings.map((w, i) => (
              <li key={i} className="text-xs text-amber-800 leading-snug">• {w}</li>
            ))}
          </ul>
        </div>
      )}

      <Card title="Calculation Trail" icon="📝" color="bg-slate-700"
        subtitle={`${result.calculationSteps.length} lines`}>
        <div className="p-2 flex items-center gap-2 border-b border-slate-200 bg-slate-50">
          <input
            type="text"
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Filter, e.g. equilibrium, compatibility, backstay…"
            className="flex-1 px-2 py-1 border border-slate-300 rounded text-xs outline-none focus:ring-2 focus:ring-blue-400"
          />
          <span className="text-[10px] text-slate-500 tabular-nums">{lines.length} shown</span>
          <button onClick={copy}
            className="px-2 py-1 bg-slate-700 hover:bg-slate-800 text-white text-[10px] rounded">
            Copy all
          </button>
        </div>
        <div className="max-h-[32rem] overflow-y-auto bg-slate-900">
          {lines.map((s, i) => {
            const isHeading = s.startsWith('════') || s.startsWith('──');
            return (
              <div key={i}
                className={`px-3 py-[3px] text-[11px] font-mono leading-relaxed whitespace-pre-wrap ${
                  isHeading
                    ? 'text-cyan-300 font-bold bg-slate-800 mt-1'
                    : s.trimStart().startsWith('→')
                      ? 'text-emerald-300'
                      : s.startsWith('  ')
                        ? 'text-slate-400'
                        : 'text-slate-200'}`}>
                {s}
              </div>
            );
          })}
          {lines.length === 0 && (
            <div className="px-3 py-4 text-xs text-slate-500">Nothing matches that filter.</div>
          )}
        </div>
      </Card>
    </div>
  );
};
