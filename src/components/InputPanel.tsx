// ============================================================
// Input Panel Component
// ============================================================
import React, { useCallback } from 'react';
import type { CableInput, PointLoad, AnalysisModel } from '../types';

interface Props {
  input: CableInput;
  onChange: (input: CableInput) => void;
}

let loadCounter = 1;

export const InputPanel: React.FC<Props> = ({ input, onChange }) => {
  const updateGeometry = useCallback((key: string, value: number) => {
    onChange({
      ...input,
      geometry: { ...input.geometry, [key]: value },
    });
  }, [input, onChange]);

  const updateCable = useCallback((key: string, value: number) => {
    onChange({
      ...input,
      cable: { ...input.cable, [key]: value },
    });
  }, [input, onChange]);

  const updateH = useCallback((value: number) => {
    onChange({ ...input, H_input: value });
  }, [input, onChange]);

  const updateModel = useCallback((model: AnalysisModel) => {
    onChange({
      ...input,
      options: { ...input.options, model },
    });
  }, [input, onChange]);

  const addPointLoad = useCallback(() => {
    const newLoad: PointLoad = {
      id: `PL${loadCounter++}`,
      x: input.geometry.L / 2,
      P: 10,
      label: `P${input.pointLoads.length + 1}`,
    };
    onChange({ ...input, pointLoads: [...input.pointLoads, newLoad] });
  }, [input, onChange]);

  const removePointLoad = useCallback((id: string) => {
    onChange({
      ...input,
      pointLoads: input.pointLoads.filter(pl => pl.id !== id),
    });
  }, [input, onChange]);

  const updatePointLoad = useCallback((id: string, key: keyof PointLoad, value: string | number) => {
    onChange({
      ...input,
      pointLoads: input.pointLoads.map(pl =>
        pl.id === id ? { ...pl, [key]: value } : pl
      ),
    });
  }, [input, onChange]);

  const numInput = (
    label: string, value: number, onChangeVal: (v: number) => void,
    unit: string, min?: number, max?: number, step?: number
  ) => (
    <div className="flex items-center gap-2">
      <label className="text-xs font-medium text-slate-600 w-40 flex-shrink-0">{label}</label>
      <input
        type="number"
        value={value}
        onChange={e => onChangeVal(parseFloat(e.target.value) || 0)}
        min={min}
        max={max}
        step={step || 1}
        className="w-24 px-2 py-1.5 border border-slate-300 rounded text-sm text-right focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none"
      />
      <span className="text-xs text-slate-500 w-12">{unit}</span>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Model Selection */}
      <div className="bg-white border border-slate-300 rounded-lg p-4">
        <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
          <span className="w-5 h-5 bg-blue-600 text-white rounded text-xs flex items-center justify-center">M</span>
          Analysis Model
        </h3>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="model"
              checked={input.options.model === 'PARABOLIC_HORIZONTAL_LOAD'}
              onChange={() => updateModel('PARABOLIC_HORIZONTAL_LOAD')}
              className="accent-blue-600"
            />
            <span className="text-sm text-slate-700">Parabolic (UDL per horiz. projection)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="model"
              checked={input.options.model === 'CATENARY_SELF_WEIGHT'}
              onChange={() => updateModel('CATENARY_SELF_WEIGHT')}
              className="accent-blue-600"
            />
            <span className="text-sm text-slate-700">Catenary (self-weight per cable length)</span>
          </label>
        </div>
      </div>

      {/* Geometry */}
      <div className="bg-white border border-slate-300 rounded-lg p-4">
        <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
          <span className="w-5 h-5 bg-emerald-600 text-white rounded text-xs flex items-center justify-center">G</span>
          Geometry
        </h3>
        <div className="grid grid-cols-1 gap-2">
          {numInput('Horizontal span (L)', input.geometry.L, v => updateGeometry('L', v), 'm', 1, undefined, 1)}
          {numInput('Left tower elevation (yL)', input.geometry.yL, v => updateGeometry('yL', v), 'm', undefined, undefined, 0.5)}
          {numInput('Right tower elevation (yR)', input.geometry.yR, v => updateGeometry('yR', v), 'm', undefined, undefined, 0.5)}
          {numInput('Left backstay length (La)', input.geometry.La, v => updateGeometry('La', v), 'm', 0.1, undefined, 1)}
          {numInput('Right backstay length (Ra)', input.geometry.Ra, v => updateGeometry('Ra', v), 'm', 0.1, undefined, 1)}
          {numInput('Left anchor angle (αL)', input.geometry.alphaL, v => updateGeometry('alphaL', v), 'deg', 0.1, 89, 1)}
          {numInput('Right anchor angle (αR)', input.geometry.alphaR, v => updateGeometry('alphaR', v), 'deg', 0.1, 89, 1)}
        </div>
      </div>

      {/* Cable Properties */}
      <div className="bg-white border border-slate-300 rounded-lg p-4">
        <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
          <span className="w-5 h-5 bg-amber-600 text-white rounded text-xs flex items-center justify-center">C</span>
          Cable Properties
        </h3>
        <div className="grid grid-cols-1 gap-2">
          {numInput('Unit weight w (horiz.)', input.cable.w, v => updateCable('w', v), 'kN/m', 0, undefined, 0.01)}
          {numInput('Unit weight γ (length)', input.cable.gamma, v => updateCable('gamma', v), 'kN/m', 0, undefined, 0.01)}
          {numInput('Horizontal tension (H)', input.H_input, v => updateH(v), 'kN', 0, undefined, 10)}
        </div>
      </div>

      {/* Point Loads */}
      <div className="bg-white border border-slate-300 rounded-lg p-4">
        <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
          <span className="w-5 h-5 bg-red-600 text-white rounded text-xs flex items-center justify-center">P</span>
          Point Loads
        </h3>
        {input.pointLoads.length === 0 && (
          <p className="text-xs text-slate-400 mb-2 italic">No point loads added yet.</p>
        )}
        {input.pointLoads.map((pl) => (
          <div key={pl.id} className="flex items-center gap-1.5 mb-2 bg-red-50 px-2 py-1.5 rounded border border-red-100 w-full min-w-0 overflow-hidden">
            <input
              type="text"
              value={pl.label}
              onChange={e => updatePointLoad(pl.id, 'label', e.target.value)}
              className="w-10 px-1 py-1 border border-slate-300 rounded text-[11px] font-semibold text-center flex-shrink-0"
              placeholder="Lbl"
            />
            <label className="text-[11px] text-slate-500 flex-shrink-0">x</label>
            <input
              type="number"
              value={pl.x}
              onChange={e => updatePointLoad(pl.id, 'x', parseFloat(e.target.value) || 0)}
              className="w-16 px-1 py-1 border border-slate-300 rounded text-[11px] text-right flex-shrink-0"
              step={1}
            />
            <span className="text-[11px] text-slate-500 flex-shrink-0">m</span>
            <label className="text-[11px] text-slate-500 flex-shrink-0">P</label>
            <input
              type="number"
              value={pl.P}
              onChange={e => updatePointLoad(pl.id, 'P', parseFloat(e.target.value) || 0)}
              className="w-16 px-1 py-1 border border-slate-300 rounded text-[11px] text-right flex-shrink-0"
              step={1}
              min={0}
            />
            <span className="text-[11px] text-slate-500 flex-shrink-0">kN</span>
            <button
              onClick={() => removePointLoad(pl.id)}
              className="w-5 h-5 flex items-center justify-center rounded bg-red-200 text-red-700 hover:bg-red-400 hover:text-white text-[10px] font-bold transition-colors flex-shrink-0 ml-auto"
              title="Remove load"
            >✕</button>
          </div>
        ))}
        <button
          onClick={addPointLoad}
          className="mt-1 px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded hover:bg-red-700 transition-colors"
        >
          + Add Point Load
        </button>
      </div>
    </div>
  );
};
