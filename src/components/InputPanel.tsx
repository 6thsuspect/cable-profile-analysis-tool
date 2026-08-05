// ============================================================
// Input Panel — geometry, site, cable system, loads, capacities
// ============================================================
import React, { useCallback, useMemo } from 'react';
import type {
  AnalysisModel, CableInput, PointLoad, SaddleMode, StateControlMode, UniformLoad,
} from '../types';
import { CABLE_CATALOG, CABLE_FAMILIES, familyOf } from '../solver/cableLibrary';
import { Card, CheckboxField, NumField, Row, SelectField, num } from './ui';

interface Props {
  input: CableInput;
  onChange: (input: CableInput) => void;
}

let loadCounter = 1;
let udlCounter = 1;

const STATE_MODES: { value: StateControlMode; label: string }[] = [
  { value: 'INSTALLED_SAG', label: 'Installed sag (erection target)' },
  { value: 'INSTALLED_H', label: 'Installed tension H₀' },
  { value: 'UNSTRESSED_LENGTH', label: 'Cut length L₀' },
  { value: 'RIGID_FIXED_H', label: 'Rigid — H fixed for all cases (legacy)' },
];

const SADDLE_MODES: { value: SaddleMode; label: string }[] = [
  { value: 'BALANCED_BACKSTAY', label: 'Balanced backstay (thrust cancelled)' },
  { value: 'ROLLER_SADDLE', label: 'Roller saddle (T continuous)' },
  { value: 'CLAMPED_SADDLE', label: 'Clamped — backstay T prescribed' },
];

export const InputPanel: React.FC<Props> = ({ input, onChange }) => {
  const set = useCallback(
    <K extends keyof CableInput>(key: K, value: CableInput[K]) =>
      onChange({ ...input, [key]: value }),
    [input, onChange],
  );

  const geo = useCallback((k: keyof CableInput['geometry'], v: number) =>
    set('geometry', { ...input.geometry, [k]: v }), [input.geometry, set]);
  const site = useCallback((k: keyof CableInput['site'], v: number) =>
    set('site', { ...input.site, [k]: v }), [input.site, set]);
  const tow = useCallback((k: keyof CableInput['towers'], v: number | SaddleMode) =>
    set('towers', { ...input.towers, [k]: v }), [input.towers, set]);
  const anc = useCallback((k: keyof CableInput['anchors'], v: number) =>
    set('anchors', { ...input.anchors, [k]: v }), [input.anchors, set]);
  const cab = useCallback((k: keyof CableInput['cable'], v: number | boolean) =>
    set('cable', { ...input.cable, [k]: v }), [input.cable, set]);
  const lau = useCallback((k: keyof CableInput['launching'], v: number | boolean) =>
    set('launching', { ...input.launching, [k]: v }), [input.launching, set]);
  const win = useCallback((k: keyof CableInput['wind'], v: number | boolean) =>
    set('wind', { ...input.wind, [k]: v }), [input.wind, set]);
  const opt = useCallback((k: keyof CableInput['options'], v: number | string | boolean) =>
    set('options', { ...input.options, [k]: v }), [input.options, set]);

  // ---- cable catalogue navigation
  const family = familyOf(input.cable.section);
  const inFamily = useMemo(
    () => CABLE_CATALOG.filter(s => familyOf(s) === family),
    [family],
  );

  const changeFamily = useCallback((key: string) => {
    const pool = CABLE_CATALOG.filter(s => familyOf(s) === key);
    if (pool.length === 0) return;
    // keep the closest diameter when switching family
    const target = input.cable.section.d;
    const best = pool.reduce((a, b) =>
      Math.abs(b.d - target) < Math.abs(a.d - target) ? b : a);
    cab('section', best as never);
  }, [cab, input.cable.section.d]);

  const changeSection = useCallback((id: string) => {
    const s = CABLE_CATALOG.find(x => x.id === id);
    if (s) cab('section', s as never);
  }, [cab]);

  // ---- point loads
  const addPointLoad = () => {
    const pl: PointLoad = {
      id: `PL${loadCounter++}`,
      x: Math.round(input.geometry.L / 2),
      P: 100,
      label: `P${input.pointLoads.length + 1}`,
    };
    set('pointLoads', [...input.pointLoads, pl]);
  };
  const updatePointLoad = (id: string, k: keyof PointLoad, v: string | number) =>
    set('pointLoads', input.pointLoads.map(p => (p.id === id ? { ...p, [k]: v } : p)));
  const removePointLoad = (id: string) =>
    set('pointLoads', input.pointLoads.filter(p => p.id !== id));

  // ---- uniform loads
  const addUdl = () => {
    const u: UniformLoad = {
      id: `UDL${udlCounter++}`,
      label: `w${input.uniformLoads.length + 1}`,
      xStart: 0,
      xEnd: input.geometry.L,
      w: 1,
    };
    set('uniformLoads', [...input.uniformLoads, u]);
  };
  const updateUdl = (id: string, k: keyof UniformLoad, v: string | number) =>
    set('uniformLoads', input.uniformLoads.map(u => (u.id === id ? { ...u, [k]: v } : u)));
  const removeUdl = (id: string) =>
    set('uniformLoads', input.uniformLoads.filter(u => u.id !== id));

  const toggleCombination = (id: string, enabled: boolean) =>
    set('combinations', input.combinations.map(c => (c.id === id ? { ...c, enabled } : c)));
  const updateCombination = (id: string, k: 'gDL' | 'gLL' | 'dT', v: number) =>
    set('combinations', input.combinations.map(c => (c.id === id ? { ...c, [k]: v } : c)));

  const sec = input.cable.section;
  const n = Math.max(1, input.cable.nCables);
  const eta = input.cable.etaTermination * input.cable.etaBend;
  const EA = (sec.E * sec.Am) / 1000;
  const ddRatio = input.cable.saddleDiameter / sec.d;
  const rigid = input.options.stateControl === 'RIGID_FIXED_H';

  return (
    <div className="space-y-2">
      {/* ───────── Model & cable state ───────── */}
      <Card title="Analysis Model & Cable State" icon="M" color="bg-blue-700">
        <div className="p-3 space-y-2">
          <SelectField
            label="Shape model"
            value={input.options.model}
            onChange={v => opt('model', v as AnalysisModel)}
            options={[
              { value: 'PARABOLIC_HORIZONTAL_LOAD', label: 'Elastic parabolic (segmental)' },
              { value: 'CATENARY_SELF_WEIGHT', label: 'Elastic catenary (exact)' },
            ]}
            hint="The catenary is exact at any sag; the parabolic form is faster and accurate below about 1/10 sag."
          />
          <SelectField
            label="Cable state defined by"
            value={input.options.stateControl}
            onChange={v => opt('stateControl', v as StateControlMode)}
            options={STATE_MODES}
            hint="This is what fixes the unstressed cut length L₀ — the invariant that keeps sag bounded under load."
          />
          {input.options.stateControl === 'INSTALLED_SAG' && (
            <NumField label="Installed sag (dead load)" value={input.options.installedSag}
              onChange={v => opt('installedSag', v)} unit="m" step={0.25} min={0.01} />
          )}
          {input.options.stateControl === 'INSTALLED_H' && (
            <NumField label="Installed tension H₀" value={input.options.installedH}
              onChange={v => opt('installedH', v)} unit="kN" step={10} min={0.1} />
          )}
          {input.options.stateControl === 'UNSTRESSED_LENGTH' && (
            <NumField label="Cut length L₀" value={input.options.unstressedLength}
              onChange={v => opt('unstressedLength', v)} unit="m" step={0.05} />
          )}
          {rigid && (
            <>
              <NumField label="Prescribed H (all cases)" value={input.H_input}
                onChange={v => set('H_input', v)} unit="kN" step={50} min={1} />
              <div className="text-[10px] text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1.5 leading-snug">
                <strong>Non-physical mode.</strong> H is imposed on every load case, so axial
                compatibility is not enforced and sag grows without limit as load is added.
                Kept only for reproducing hand calculations.
              </div>
            </>
          )}
          <NumField label="Tower-top stiffness" value={input.cable.supportStiffness}
            onChange={v => cab('supportStiffness', v)} unit="kN/m" step={1000} min={0}
            hint="Horizontal stiffness of each saddle. 0 = rigid supports." />
          <NumField label="Thermal expansion α" value={input.cable.alphaT * 1e6}
            onChange={v => cab('alphaT', v * 1e-6)} unit="µε/°C" step={0.5} min={0} />
        </div>
      </Card>

      {/* ───────── Cable system ───────── */}
      <Card title="Cable System" icon="C" color="bg-amber-600"
        subtitle={`${n} × ⌀${sec.d} mm`}>
        <div className="p-3 space-y-2">
          <SelectField label="Construction" value={family} onChange={changeFamily}
            options={CABLE_FAMILIES.map(f => ({ value: f.key, label: f.name }))} />
          <SelectField label="Section" value={sec.id} onChange={changeSection}
            options={inFamily.map(s => ({
              value: s.id,
              label: `⌀${s.d} mm — MBL ${s.MBL.toFixed(0)} kN, ${s.Am.toFixed(0)} mm²`,
            }))} />
          <NumField label="Number of parallel ropes" value={input.cable.nCables}
            onChange={v => cab('nCables', Math.max(1, Math.round(v)))} unit="—" step={1} min={1} />
          <NumField label="Load-sharing factor" value={input.cable.shareFactor}
            onChange={v => cab('shareFactor', v)} unit="—" step={0.01} min={1}
            hint="Allows for uneven sharing between ropes. 1.00 = perfect sharing." />
          <NumField label="Required factor of safety" value={input.cable.FoS}
            onChange={v => cab('FoS', v)} unit="—" step={0.1} min={1.05}
            hint="Applied to MBL for unfactored (service) load cases." />
          <NumField label="Material factor γ_M (ULS)" value={input.cable.gammaM}
            onChange={v => cab('gammaM', v)} unit="—" step={0.05} min={1}
            hint="Used instead of the FoS for factored combinations, so load factors and the FoS do not multiply." />
          <NumField label="Termination efficiency" value={input.cable.etaTermination}
            onChange={v => cab('etaTermination', v)} unit="—" step={0.01} min={0.1} max={1}
            hint="Swaged ≈ 0.95–1.00, spliced eye ≈ 0.85–0.90, wedge socket ≈ 0.80." />
          <NumField label="Bending efficiency η_bend" value={input.cable.etaBend}
            onChange={v => cab('etaBend', v)} unit="—" step={0.01} min={0.1} max={1}
            hint="Strength loss where the rope passes over the saddle. Reduce it if D/d is below the recommended value." />
          <NumField label="Saddle pitch diameter D" value={input.cable.saddleDiameter}
            onChange={v => cab('saddleDiameter', v)} unit="mm" step={50} min={0} />
          <CheckboxField label="Take the self weight from the catalogue"
            checked={input.cable.useCatalogWeight}
            onChange={v => cab('useCatalogWeight', v)} />
          {!input.cable.useCatalogWeight && (
            <NumField label="Self weight per rope" value={input.cable.wSelfOverride}
              onChange={v => cab('wSelfOverride', v)} unit="kN/m" step={0.01} min={0} />
          )}
        </div>
        <div className="border-t border-slate-200 bg-slate-50 divide-y divide-slate-100">
          <Row label="Construction" value={sec.construction} />
          <Row label="Metallic area, one rope" value={num(sec.Am, 1)} unit="mm²" />
          <Row label="EA, one rope" value={num(EA, 0)} unit="kN" />
          <Row label="EA, system" value={num(EA * n, 0)} unit="kN" highlight />
          <Row label="MBL, one rope" value={num(sec.MBL, 1)} unit="kN" />
          <Row label="Efficiency η = η_term · η_bend" value={num(eta, 3)} unit="—" />
          <Row label="Effective MBL per rope" value={num(sec.MBL * eta, 1)} unit="kN" highlight />
          <Row label="Allowable per rope (service)"
            value={num((sec.MBL * eta) / Math.max(1.05, input.cable.FoS), 1)} unit="kN" highlight />
          <Row label="System allowable (service)"
            value={num(((sec.MBL * eta) / Math.max(1.05, input.cable.FoS)) * n / Math.max(1, input.cable.shareFactor), 1)}
            unit="kN" />
          <Row label="Saddle D/d" value={num(ddRatio, 1)} unit="—"
            note={ddRatio < sec.minBendRatio
              ? `Below the recommended ${sec.minBendRatio} for this construction — reduce η_bend.`
              : `Recommended minimum ${sec.minBendRatio}.`} />
        </div>
      </Card>

      {/* ───────── Geometry ───────── */}
      <Card title="Geometry" icon="G" color="bg-emerald-700">
        <div className="p-3 space-y-2">
          <NumField label="Span, saddle to saddle (L)" value={input.geometry.L}
            onChange={v => geo('L', v)} unit="m" step={5} min={1} />
          <NumField label="Left saddle level (yL)" value={input.geometry.yL}
            onChange={v => geo('yL', v)} unit="m" step={0.5} />
          <NumField label="Right saddle level (yR)" value={input.geometry.yR}
            onChange={v => geo('yR', v)} unit="m" step={0.5} />
          <NumField label="Left backstay length (La)" value={input.geometry.La}
            onChange={v => geo('La', v)} unit="m" step={1} min={0.1} />
          <NumField label="Right backstay length (Ra)" value={input.geometry.Ra}
            onChange={v => geo('Ra', v)} unit="m" step={1} min={0.1} />
          <NumField label="Left backstay from vertical (αL)" value={input.geometry.alphaL}
            onChange={v => geo('alphaL', v)} unit="deg" step={1} min={0.5} max={89}
            hint="A steep backstay needs a very large force to hold H back: T = H / sin α." />
          <NumField label="Right backstay from vertical (αR)" value={input.geometry.alphaR}
            onChange={v => geo('alphaR', v)} unit="deg" step={1} min={0.5} max={89} />
        </div>
      </Card>

      {/* ───────── Site ───────── */}
      <Card title="Crossing / Site" icon="S" color="bg-teal-700" defaultOpen={false}>
        <div className="p-3 space-y-2">
          <NumField label="Left bank level" value={input.site.bankLeftLevel}
            onChange={v => site('bankLeftLevel', v)} unit="m" step={0.5} />
          <NumField label="Right bank level" value={input.site.bankRightLevel}
            onChange={v => site('bankRightLevel', v)} unit="m" step={0.5} />
          <NumField label="Bed level (deepest point)" value={input.site.bedLevel}
            onChange={v => site('bedLevel', v)} unit="m" step={0.5} />
          <NumField label="Bed position from left" value={input.site.bedX}
            onChange={v => site('bedX', v)} unit="m" step={1} />
          <NumField label="Left crest position" value={input.site.crestLeftX}
            onChange={v => site('crestLeftX', v)} unit="m" step={1} min={0}
            hint="Where the ground starts to fall away. Clearance is only assessed between the two crests." />
          <NumField label="Right crest position" value={input.site.crestRightX}
            onChange={v => site('crestRightX', v)} unit="m" step={1} />
          <NumField label="Highest flood level (HFL)" value={input.site.hflLevel}
            onChange={v => site('hflLevel', v)} unit="m" step={0.5} min={0}
            hint="0 to ignore. Where HFL is above the bed it becomes the controlling level." />
          <NumField label="Required clearance" value={input.site.requiredClearance}
            onChange={v => site('requiredClearance', v)} unit="m" step={0.5} min={0} />
        </div>
      </Card>

      {/* ───────── Launching ───────── */}
      <Card title="Incremental Launching" icon="L" color="bg-red-700"
        subtitle={input.launching.enabled ? `${num(input.launching.totalWeight, 0)} kN unit` : 'off'}>
        <div className="p-3 space-y-2">
          <CheckboxField label="Launched unit rides on the cable"
            checked={input.launching.enabled} onChange={v => lau('enabled', v)} />
          {input.launching.enabled && (
            <>
              <NumField label="Total weight of the unit" value={input.launching.totalWeight}
                onChange={v => lau('totalWeight', v)} unit="kN" step={25} min={0} />
              <NumField label="Length of the unit" value={input.launching.girderLength}
                onChange={v => lau('girderLength', v)} unit="m" step={1} min={0} />
              <NumField label="Number of bogies on the cable" value={input.launching.nBogies}
                onChange={v => lau('nBogies', Math.max(1, Math.min(6, Math.round(v))))}
                unit="—" step={1} min={1} max={6} />
              <NumField label="Bogie spacing" value={input.launching.bogieSpacing}
                onChange={v => lau('bogieSpacing', v)} unit="m" step={0.5} min={0}
                hint="0 spreads the bogies evenly over the length of the unit." />
              <NumField label="Share on the leading bogie" value={input.launching.frontShare}
                onChange={v => lau('frontShare', v)} unit="—" step={0.05} min={0.05} max={0.95} />
              <NumField label="Leading bogie position" value={input.launching.frontPosition}
                onChange={v => lau('frontPosition', v)} unit="m" step={1} />
              <NumField label="Dynamic amplification (DAF)" value={input.launching.DAF}
                onChange={v => lau('DAF', v)} unit="—" step={0.05} min={1}
                hint="Winching start/stop and rope-slip shock. 1.10–1.25 is usual for slow, controlled launching." />
              <NumField label="Cable to soffit (slings + depth)" value={input.launching.hangDepth}
                onChange={v => lau('hangDepth', v)} unit="m" step={0.25} min={0}
                hint="Deducted from the clearance, but only over the stretch the unit occupies." />
              <NumField label="Envelope sweep steps" value={input.launching.sweepSteps}
                onChange={v => lau('sweepSteps', Math.round(v))} unit="—" step={5} min={5} max={200} />
            </>
          )}
        </div>
      </Card>

      {/* ───────── Static point loads ───────── */}
      <Card title="Static Point Loads" icon="P" color="bg-rose-700"
        subtitle={`${input.pointLoads.length}`} defaultOpen={input.pointLoads.length > 0}>
        <div className="p-3">
          {input.pointLoads.length === 0 && (
            <p className="text-xs text-slate-400 mb-2 italic">
              None. These are treated as variable load, alongside any launching load.
            </p>
          )}
          {input.pointLoads.map(pl => (
            <div key={pl.id} className="flex items-center gap-1.5 mb-1.5 bg-rose-50 px-2 py-1.5 rounded border border-rose-100">
              <input type="text" value={pl.label}
                onChange={e => updatePointLoad(pl.id, 'label', e.target.value)}
                className="w-11 px-1 py-1 border border-slate-300 rounded text-[11px] font-semibold text-center" />
              <label className="text-[11px] text-slate-500">x</label>
              <input type="number" value={pl.x} step={1}
                onChange={e => updatePointLoad(pl.id, 'x', parseFloat(e.target.value) || 0)}
                className="w-16 px-1 py-1 border border-slate-300 rounded text-[11px] text-right tabular-nums" />
              <span className="text-[11px] text-slate-500">m</span>
              <label className="text-[11px] text-slate-500">P</label>
              <input type="number" value={pl.P} step={10} min={0}
                onChange={e => updatePointLoad(pl.id, 'P', parseFloat(e.target.value) || 0)}
                className="w-[68px] px-1 py-1 border border-slate-300 rounded text-[11px] text-right tabular-nums" />
              <span className="text-[11px] text-slate-500">kN</span>
              <button onClick={() => removePointLoad(pl.id)}
                className="w-5 h-5 flex items-center justify-center rounded bg-rose-200 text-rose-700 hover:bg-rose-500 hover:text-white text-[10px] font-bold ml-auto">✕</button>
            </div>
          ))}
          <button onClick={addPointLoad}
            className="mt-1 px-3 py-1.5 bg-rose-700 text-white text-xs font-medium rounded hover:bg-rose-800">
            + Add point load
          </button>
        </div>
      </Card>

      {/* ───────── Superimposed UDL ───────── */}
      <Card title="Superimposed Distributed Load" icon="w" color="bg-orange-700"
        subtitle={`${input.uniformLoads.length}`} defaultOpen={input.uniformLoads.length > 0}>
        <div className="p-3">
          {input.uniformLoads.length === 0 && (
            <p className="text-xs text-slate-400 mb-2 italic">
              None. Use this for walkways, ice, hanging services — treated as permanent load.
            </p>
          )}
          {input.uniformLoads.map(u => (
            <div key={u.id} className="flex items-center gap-1.5 mb-1.5 bg-orange-50 px-2 py-1.5 rounded border border-orange-100">
              <input type="text" value={u.label}
                onChange={e => updateUdl(u.id, 'label', e.target.value)}
                className="w-11 px-1 py-1 border border-slate-300 rounded text-[11px] font-semibold text-center" />
              <input type="number" value={u.xStart} step={1}
                onChange={e => updateUdl(u.id, 'xStart', parseFloat(e.target.value) || 0)}
                className="w-14 px-1 py-1 border border-slate-300 rounded text-[11px] text-right tabular-nums" />
              <span className="text-[11px] text-slate-500">→</span>
              <input type="number" value={u.xEnd} step={1}
                onChange={e => updateUdl(u.id, 'xEnd', parseFloat(e.target.value) || 0)}
                className="w-14 px-1 py-1 border border-slate-300 rounded text-[11px] text-right tabular-nums" />
              <span className="text-[11px] text-slate-500">m</span>
              <input type="number" value={u.w} step={0.1}
                onChange={e => updateUdl(u.id, 'w', parseFloat(e.target.value) || 0)}
                className="w-16 px-1 py-1 border border-slate-300 rounded text-[11px] text-right tabular-nums" />
              <span className="text-[11px] text-slate-500">kN/m</span>
              <button onClick={() => removeUdl(u.id)}
                className="w-5 h-5 flex items-center justify-center rounded bg-orange-200 text-orange-700 hover:bg-orange-500 hover:text-white text-[10px] font-bold ml-auto">✕</button>
            </div>
          ))}
          <button onClick={addUdl}
            className="mt-1 px-3 py-1.5 bg-orange-700 text-white text-xs font-medium rounded hover:bg-orange-800">
            + Add distributed load
          </button>
        </div>
      </Card>

      {/* ───────── Towers ───────── */}
      <Card title="Towers / Masts" icon="T" color="bg-indigo-700" defaultOpen={false}>
        <div className="p-3 space-y-2">
          <SelectField label="Saddle idealisation" value={input.towers.saddleMode}
            onChange={v => tow('saddleMode', v as SaddleMode)} options={SADDLE_MODES}
            hint="Balanced = tuned backstay, tower in pure compression. Roller = tension continuous, tower takes the thrust as bending." />
          {input.towers.saddleMode === 'CLAMPED_SADDLE' && (
            <>
              <NumField label="Left backstay tension" value={input.towers.backstayTensionL}
                onChange={v => tow('backstayTensionL', v)} unit="kN" step={50} min={0} />
              <NumField label="Right backstay tension" value={input.towers.backstayTensionR}
                onChange={v => tow('backstayTensionR', v)} unit="kN" step={50} min={0} />
            </>
          )}
          <NumField label="Left tower height" value={input.towers.heightL}
            onChange={v => tow('heightL', v)} unit="m" step={0.5} min={0} />
          <NumField label="Right tower height" value={input.towers.heightR}
            onChange={v => tow('heightR', v)} unit="m" step={0.5} min={0} />
          <NumField label="Tower self weight (each)" value={input.towers.selfWeight}
            onChange={v => tow('selfWeight', v)} unit="kN" step={10} min={0} />
          <NumField label="Axial capacity (each)" value={input.towers.axialCapacity}
            onChange={v => tow('axialCapacity', v)} unit="kN" step={100} min={0}
            hint="0 to skip the check." />
          <NumField label="Base moment capacity" value={input.towers.momentCapacity}
            onChange={v => tow('momentCapacity', v)} unit="kNm" step={100} min={0} />
          <NumField label="Flexural rigidity EI" value={input.towers.EI}
            onChange={v => tow('EI', v)} unit="kNm²" step={10000} min={0}
            hint="Used for the Euler buckling check. 0 to skip." />
          <NumField label="Effective length factor K" value={input.towers.K}
            onChange={v => tow('K', v)} unit="—" step={0.05} min={0.1} />
          <NumField label="Base width" value={input.towers.baseWidth}
            onChange={v => tow('baseWidth', v)} unit="m" step={0.5} min={0} />
          <NumField label="Required FoS, overturning" value={input.towers.requiredFoSOverturn}
            onChange={v => tow('requiredFoSOverturn', v)} unit="—" step={0.1} min={1} />
        </div>
      </Card>

      {/* ───────── Anchors ───────── */}
      <Card title="Backstay Anchors" icon="A" color="bg-orange-800" defaultOpen={false}>
        <div className="p-3 space-y-2">
          <NumField label="Block weight, left" value={input.anchors.weightL}
            onChange={v => anc('weightL', v)} unit="kN" step={50} min={0} />
          <NumField label="Block weight, right" value={input.anchors.weightR}
            onChange={v => anc('weightR', v)} unit="kN" step={50} min={0} />
          <NumField label="Tie-down capacity, left" value={input.anchors.tieDownL}
            onChange={v => anc('tieDownL', v)} unit="kN" step={100} min={0}
            hint="Rock or ground anchors resisting uplift." />
          <NumField label="Tie-down capacity, right" value={input.anchors.tieDownR}
            onChange={v => anc('tieDownR', v)} unit="kN" step={100} min={0} />
          <NumField label="Friction coefficient μ" value={input.anchors.frictionCoefficient}
            onChange={v => anc('frictionCoefficient', v)} unit="—" step={0.05} min={0} />
          <NumField label="Extra restraint, left" value={input.anchors.passiveResistanceL}
            onChange={v => anc('passiveResistanceL', v)} unit="kN" step={100} min={0}
            hint="Shear keys, rock sockets, passive earth pressure." />
          <NumField label="Extra restraint, right" value={input.anchors.passiveResistanceR}
            onChange={v => anc('passiveResistanceR', v)} unit="kN" step={100} min={0} />
          <NumField label="Required FoS, uplift" value={input.anchors.requiredFoSUplift}
            onChange={v => anc('requiredFoSUplift', v)} unit="—" step={0.1} min={1} />
          <NumField label="Required FoS, sliding" value={input.anchors.requiredFoSSliding}
            onChange={v => anc('requiredFoSSliding', v)} unit="—" step={0.1} min={1} />
        </div>
      </Card>

      {/* ───────── Wind ───────── */}
      <Card title="Lateral Wind (advisory)" icon="W" color="bg-sky-700" defaultOpen={false}>
        <div className="p-3 space-y-2">
          <CheckboxField label="Include lateral wind on the suspended unit"
            checked={input.wind.enabled} onChange={v => win('enabled', v)} />
          <NumField label="Design wind pressure" value={input.wind.pressure}
            onChange={v => win('pressure', v)} unit="kN/m²" step={0.1} min={0} />
          <NumField label="Exposed height of the unit" value={input.wind.girderHeight}
            onChange={v => win('girderHeight', v)} unit="m" step={0.25} min={0} />
          <NumField label="Drag coefficient" value={input.wind.dragCoefficient}
            onChange={v => win('dragCoefficient', v)} unit="—" step={0.1} min={0} />
          <p className="text-[10px] text-slate-500 leading-snug">
            Modelled in-plane: the cable is taken to carry the resultant of the vertical
            load and the lateral force, which amplifies the tension by 1/cos φ and swings
            the unit through φ. Out-of-plane displacement needs a three-dimensional check.
          </p>
        </div>
      </Card>

      {/* ───────── Combinations ───────── */}
      <Card title="Load Combinations" icon="Σ" color="bg-violet-700" defaultOpen={false}>
        <div className="p-3 space-y-2">
          {input.combinations.map(c => (
            <div key={c.id} className="border border-slate-200 rounded px-2 py-1.5">
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={c.enabled}
                  onChange={e => toggleCombination(c.id, e.target.checked)}
                  className="accent-violet-600" />
                <span className="text-xs font-medium text-slate-700 flex-1">{c.label}</span>
                <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                  c.limitState === 'ULS' ? 'bg-violet-100 text-violet-800'
                    : c.limitState === 'INSTALL' ? 'bg-slate-200 text-slate-700'
                      : 'bg-blue-100 text-blue-800'}`}>
                  {c.limitState}
                </span>
              </div>
              {c.enabled && (
                <div className="flex items-center gap-2 mt-1 pl-6 flex-wrap">
                  <label className="text-[10px] text-slate-500">γ_DL</label>
                  <input type="number" value={c.gDL} step={0.05} min={0}
                    onChange={e => updateCombination(c.id, 'gDL', parseFloat(e.target.value) || 0)}
                    className="w-14 px-1 py-0.5 border border-slate-300 rounded text-[10px] text-right tabular-nums" />
                  <label className="text-[10px] text-slate-500">γ_LL</label>
                  <input type="number" value={c.gLL} step={0.05} min={0}
                    onChange={e => updateCombination(c.id, 'gLL', parseFloat(e.target.value) || 0)}
                    className="w-14 px-1 py-0.5 border border-slate-300 rounded text-[10px] text-right tabular-nums" />
                  <label className="text-[10px] text-slate-500">ΔT</label>
                  <input type="number" value={c.dT} step={5}
                    onChange={e => updateCombination(c.id, 'dT', parseFloat(e.target.value) || 0)}
                    className="w-14 px-1 py-0.5 border border-slate-300 rounded text-[10px] text-right tabular-nums" />
                  <span className="text-[10px] text-slate-400">°C</span>
                  {c.useDAF && <span className="text-[9px] text-slate-500">DAF</span>}
                  {c.wind && <span className="text-[9px] text-sky-600">wind</span>}
                </div>
              )}
            </div>
          ))}
          <p className="text-[10px] text-slate-500 leading-snug">
            Service combinations are checked against MBL·η / FoS. Factored (ULS) combinations
            are checked against MBL·η / γ_M instead, so the load factors and the factor of
            safety do not multiply. Confirm both against the governing code for your project.
          </p>
        </div>
      </Card>

      {/* ───────── Solver options ───────── */}
      <Card title="Solver Options" icon="⚙" color="bg-slate-700" defaultOpen={false}>
        <div className="p-3 space-y-2">
          <CheckboxField label="Run the break-point search"
            checked={input.options.runBreakPointSearch}
            onChange={v => opt('runBreakPointSearch', v)} />
          <CheckboxField label="Run the launching envelope"
            checked={input.options.runLaunchEnvelope}
            onChange={v => opt('runLaunchEnvelope', v)} />
          <NumField label="Diagram samples" value={input.options.diagramSamples}
            onChange={v => opt('diagramSamples', Math.round(v))} unit="—" step={20} min={40} max={2000} />
          <NumField label="Max iterations" value={input.options.maxIterations}
            onChange={v => opt('maxIterations', Math.round(v))} unit="—" step={10} min={10} />
        </div>
      </Card>
    </div>
  );
};
