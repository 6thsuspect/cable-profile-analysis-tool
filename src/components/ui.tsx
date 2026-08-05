// ============================================================
// Shared presentational primitives
// ============================================================
import React, { useState } from 'react';
import type { CheckStatus } from '../types';

export const RAD = 180 / Math.PI;

export const num = (v: number, dp = 2) =>
  Number.isFinite(v) ? v.toFixed(dp) : '—';

export const numOrInf = (v: number, dp = 2) =>
  !Number.isFinite(v) ? '∞' : v.toFixed(dp);

/** Collapsible panel with a coloured header. */
export const Card: React.FC<{
  title: string;
  icon?: string;
  color?: string;
  subtitle?: string;
  defaultOpen?: boolean;
  right?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, icon, color = 'bg-slate-700', subtitle, defaultOpen = true, right, children }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white border border-slate-300 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center gap-2 px-3 py-2 text-white text-sm font-semibold ${color} hover:brightness-110 transition`}
      >
        {icon && <span>{icon}</span>}
        <span className="flex-1 text-left">
          {title}
          {subtitle && <span className="ml-2 font-normal opacity-70 text-xs">{subtitle}</span>}
        </span>
        {right}
        <span className="text-xs opacity-80">{open ? '▼' : '▶'}</span>
      </button>
      {open && <div>{children}</div>}
    </div>
  );
};

/** Label / value / unit row. */
export const Row: React.FC<{
  label: string;
  value: React.ReactNode;
  unit?: string;
  highlight?: boolean;
  note?: string;
}> = ({ label, value, unit, highlight, note }) => (
  <div className={`px-3 py-1.5 text-sm ${highlight ? 'bg-blue-50' : ''}`}>
    <div className="flex items-baseline">
      <span className="text-slate-600 flex-1 pr-2">{label}</span>
      <span className="font-mono font-medium text-slate-800 tabular-nums">{value}</span>
      {unit !== undefined && <span className="text-slate-400 ml-1.5 w-14 text-xs">{unit}</span>}
    </div>
    {note && <div className="text-[10px] text-slate-400 mt-0.5 pr-16 leading-snug">{note}</div>}
  </div>
);

export const SubHeader: React.FC<{ children: React.ReactNode; color?: string }> = ({
  children, color = 'bg-slate-100 text-slate-600',
}) => (
  <div className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${color}`}>
    {children}
  </div>
);

const STATUS_STYLE: Record<CheckStatus, string> = {
  OK: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  WARNING: 'bg-amber-100 text-amber-800 border-amber-300',
  FAIL: 'bg-red-100 text-red-800 border-red-300',
  NOT_CHECKED: 'bg-slate-100 text-slate-500 border-slate-300',
};

const STATUS_TEXT: Record<CheckStatus, string> = {
  OK: 'OK',
  WARNING: 'WATCH',
  FAIL: 'FAIL',
  NOT_CHECKED: 'n/a',
};

export const StatusBadge: React.FC<{ status: CheckStatus; className?: string }> = ({
  status, className = '',
}) => (
  <span
    className={`inline-block px-1.5 py-0.5 rounded border text-[10px] font-bold leading-none ${STATUS_STYLE[status]} ${className}`}
  >
    {STATUS_TEXT[status]}
  </span>
);

/** Horizontal utilisation bar; turns amber above 85 % and red above 100 %. */
export const UtilBar: React.FC<{ utilization: number; width?: number }> = ({
  utilization, width = 70,
}) => {
  if (!Number.isFinite(utilization)) {
    return <span className="text-[10px] text-slate-400">—</span>;
  }
  const pct = Math.max(0, Math.min(1, utilization));
  const over = utilization > 1;
  const colour = over ? 'bg-red-500' : utilization > 0.85 ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-block h-2 rounded-sm bg-slate-200 overflow-hidden relative"
        style={{ width }}
      >
        <span className={`absolute left-0 top-0 h-full ${colour}`} style={{ width: `${pct * 100}%` }} />
        {over && <span className="absolute right-0 top-0 h-full w-1 bg-red-700" />}
      </span>
      <span className={`font-mono text-[10px] tabular-nums w-11 text-right ${over ? 'text-red-700 font-bold' : 'text-slate-600'}`}>
        {(utilization * 100).toFixed(0)}%
      </span>
    </span>
  );
};

/** Numeric input with a label and a unit. */
export const NumField: React.FC<{
  label: string;
  value: number;
  onChange: (v: number) => void;
  unit?: string;
  step?: number;
  min?: number;
  max?: number;
  hint?: string;
  labelWidth?: string;
  disabled?: boolean;
}> = ({ label, value, onChange, unit, step = 1, min, max, hint, labelWidth = 'w-44', disabled }) => (
  <div className="flex items-center gap-2" title={hint}>
    <label className={`text-xs font-medium text-slate-600 ${labelWidth} flex-shrink-0 leading-tight`}>
      {label}
    </label>
    <input
      type="number"
      value={Number.isFinite(value) ? value : 0}
      onChange={e => {
        const v = parseFloat(e.target.value);
        onChange(Number.isFinite(v) ? v : 0);
      }}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      className="w-24 px-2 py-1 border border-slate-300 rounded text-sm text-right tabular-nums focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none disabled:bg-slate-100 disabled:text-slate-400"
    />
    <span className="text-[11px] text-slate-500 w-14 flex-shrink-0">{unit}</span>
  </div>
);

export const SelectField: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  hint?: string;
  labelWidth?: string;
}> = ({ label, value, onChange, options, hint, labelWidth = 'w-44' }) => (
  <div className="flex items-center gap-2" title={hint}>
    <label className={`text-xs font-medium text-slate-600 ${labelWidth} flex-shrink-0 leading-tight`}>
      {label}
    </label>
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="flex-1 min-w-0 px-2 py-1 border border-slate-300 rounded text-xs focus:ring-2 focus:ring-blue-400 outline-none"
    >
      {options.map(o => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  </div>
);

export const CheckboxField: React.FC<{
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
}> = ({ label, checked, onChange, hint }) => (
  <label className="flex items-center gap-2 cursor-pointer" title={hint}>
    <input
      type="checkbox"
      checked={checked}
      onChange={e => onChange(e.target.checked)}
      className="accent-blue-600"
    />
    <span className="text-xs text-slate-700">{label}</span>
  </label>
);

/** Big headline figure for the summary strip. */
export const Stat: React.FC<{
  label: string;
  value: string;
  unit?: string;
  tone?: 'neutral' | 'good' | 'warn' | 'bad';
  note?: string;
}> = ({ label, value, unit, tone = 'neutral', note }) => {
  const tones = {
    neutral: 'text-slate-900',
    good: 'text-emerald-700',
    warn: 'text-amber-700',
    bad: 'text-red-700',
  };
  return (
    <div className="px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-slate-500 leading-tight">{label}</div>
      <div className={`font-mono font-semibold text-lg leading-tight tabular-nums ${tones[tone]}`}>
        {value}
        {unit && <span className="text-xs font-normal text-slate-500 ml-1">{unit}</span>}
      </div>
      {note && <div className="text-[10px] text-slate-400 leading-tight mt-0.5">{note}</div>}
    </div>
  );
};

export function niceStep(rough: number): number {
  if (!(rough > 0)) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(rough)));
  const frac = rough / pow;
  if (frac <= 1) return pow;
  if (frac <= 2) return 2 * pow;
  if (frac <= 5) return 5 * pow;
  return 10 * pow;
}
