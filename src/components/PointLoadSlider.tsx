// ============================================================
// Position controls — launch position and static point loads
// ============================================================
import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { CableInput } from '../types';
import { num } from './ui';

interface Props {
  input: CableInput;
  onSetPointLoadX: (id: string, x: number) => void;
  onSetPointLoadP: (id: string, P: number) => void;
  onSetFrontPosition: (x: number) => void;
}

const COLORS = ['#dc2626', '#7c3aed', '#0891b2', '#ca8a04', '#16a34a', '#db2777'];

export const PointLoadSlider: React.FC<Props> = ({
  input, onSetPointLoadX, onSetPointLoadP, onSetFrontPosition,
}) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const L = input.geometry.L;
  const launching = input.launching;

  // the nose travels from Tower A until the last bogie leaves the span
  const spacing = launching.bogieSpacing > 0
    ? launching.bogieSpacing
    : launching.nBogies > 1 ? launching.girderLength / (launching.nBogies - 1) : launching.girderLength;
  const travel = L + Math.max(0, launching.nBogies - 1) * spacing;

  const xFromEvent = useCallback((clientX: number, span: number) => {
    if (!trackRef.current) return 0;
    const r = trackRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    return ratio * span;
  }, []);

  useEffect(() => {
    if (!dragging) return;
    const move = (e: MouseEvent) => {
      if (dragging === '__launch__') {
        onSetFrontPosition(Math.round(xFromEvent(e.clientX, travel) * 10) / 10);
      } else {
        const x = xFromEvent(e.clientX, travel);
        onSetPointLoadX(dragging, Math.round(Math.min(L, x) * 10) / 10);
      }
    };
    const up = () => setDragging(null);
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
  }, [dragging, L, travel, xFromEvent, onSetPointLoadX, onSetFrontPosition]);

  const hasAnything = launching.enabled || input.pointLoads.length > 0;
  if (!hasAnything) return null;

  const pct = (x: number) => `${(x / travel) * 100}%`;

  return (
    <div className="bg-white border border-slate-300 rounded-lg p-3 mt-3">
      <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
        <h4 className="text-sm font-bold text-slate-700">Position control</h4>
        <span className="text-[10px] text-slate-400">
          Drag the markers, or type into the fields below
        </span>
      </div>

      <div className="relative mb-5">
        <div ref={trackRef}
          className="h-11 bg-gradient-to-r from-slate-100 via-blue-50 to-slate-100 rounded-lg relative border border-slate-200 select-none">
          {/* span region */}
          <div className="absolute top-0 bottom-0 bg-blue-100/70 border-x-2 border-blue-700"
            style={{ left: 0, width: pct(L) }} />
          <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[9px] font-bold text-blue-900">A</span>
          <span className="absolute top-1/2 -translate-y-1/2 -translate-x-full text-[9px] font-bold text-blue-900"
            style={{ left: pct(L), marginLeft: -4 }}>B</span>
          {travel > L && (
            <span className="absolute top-1/2 -translate-y-1/2 text-[9px] text-slate-400"
              style={{ left: pct(L), marginLeft: 8 }}>off span →</span>
          )}

          {[0.25, 0.5, 0.75].map(r => (
            <div key={r} className="absolute top-0 bottom-0 w-px bg-slate-300" style={{ left: pct(r * L) }}>
              <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[8px] text-slate-400">
                {(r * L).toFixed(0)}
              </span>
            </div>
          ))}

          {/* launch nose */}
          {launching.enabled && (
            <div
              className={`absolute top-0 bottom-0 -translate-x-1/2 z-20 ${dragging === '__launch__' ? 'cursor-grabbing' : 'cursor-grab'}`}
              style={{ left: pct(Math.max(0, Math.min(travel, launching.frontPosition))) }}
              onMouseDown={e => { e.preventDefault(); setDragging('__launch__'); }}
            >
              <div className="w-1 h-full bg-teal-700" />
              <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-teal-700 text-white text-[9px] px-1.5 py-0.5 rounded whitespace-nowrap font-semibold">
                nose {num(launching.frontPosition, 1)} m
              </div>
            </div>
          )}
          {/* the trailing unit */}
          {launching.enabled && (
            <div className="absolute top-1.5 h-2.5 bg-teal-600/50 border border-teal-700 rounded-sm pointer-events-none"
              style={{
                left: pct(Math.max(0, launching.frontPosition - launching.girderLength)),
                width: pct(Math.min(launching.frontPosition, launching.girderLength)),
              }} />
          )}

          {/* static point loads */}
          {input.pointLoads.map((pl, i) => (
            <div key={pl.id}
              className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-10 ${dragging === pl.id ? 'cursor-grabbing scale-125' : 'cursor-grab hover:scale-110'} transition-transform`}
              style={{ left: pct(Math.max(0, Math.min(L, pl.x))) }}
              onMouseDown={e => { e.preventDefault(); setDragging(pl.id); }}
            >
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold shadow border-2 border-white"
                style={{ backgroundColor: COLORS[i % COLORS.length] }}>
                {pl.label.slice(0, 2)}
              </div>
              {dragging === pl.id && (
                <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[9px] px-1.5 py-0.5 rounded whitespace-nowrap">
                  x = {num(pl.x, 1)} m
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-0.5 text-[9px] text-slate-400">
          <span>0 m</span>
          <span>travel {num(travel, 0)} m</span>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
        {launching.enabled && (
          <div className="flex items-center gap-2 p-2 rounded border border-teal-600 bg-teal-50">
            <div className="w-5 h-5 rounded-sm bg-teal-700 flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0">
              ↦
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] text-slate-500">launch nose</div>
              <div className="flex items-center gap-1">
                <input type="number" value={launching.frontPosition} step={1}
                  onChange={e => onSetFrontPosition(parseFloat(e.target.value) || 0)}
                  className="w-16 px-1 py-0.5 border border-slate-300 rounded text-[11px] text-right tabular-nums" />
                <span className="text-[10px] text-slate-500">m</span>
              </div>
            </div>
          </div>
        )}
        {input.pointLoads.map((pl, i) => (
          <div key={pl.id} className="flex items-center gap-2 p-2 rounded border"
            style={{ borderColor: COLORS[i % COLORS.length], backgroundColor: `${COLORS[i % COLORS.length]}12` }}>
            <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0"
              style={{ backgroundColor: COLORS[i % COLORS.length] }}>
              {pl.label.slice(0, 2)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] text-slate-500">x = {num(pl.x, 1)} m</div>
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-slate-600">P</span>
                <input type="number" value={pl.P} step={10} min={0}
                  onChange={e => onSetPointLoadP(pl.id, parseFloat(e.target.value) || 0)}
                  className="w-16 px-1 py-0.5 border border-slate-300 rounded text-[11px] text-right tabular-nums" />
                <span className="text-[10px] text-slate-500">kN</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
