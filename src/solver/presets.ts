// ============================================================
// Default input and worked scenarios
// ------------------------------------------------------------
// The default is a real temporary-works problem: a 900 kN precast girder
// being drawn across a ravine on an eight-rope locked-coil track cable strung
// between two 15 m masts, with the cable erected to an 8 m installed sag.
// ============================================================
import type { CableInput, LoadCombination } from '../types';
import { DEFAULT_COMBINATIONS } from './CableSolver';
import { findSection } from './cableLibrary';

function combos(): LoadCombination[] {
  return DEFAULT_COMBINATIONS.map(c => ({ ...c }));
}

export function defaultInput(): CableInput {
  const section = findSection('FLC-45')!;
  return {
    geometry: {
      yL: 65, yR: 63, L: 120,
      La: 26, Ra: 26,
      alphaL: 68, alphaR: 68,
    },
    site: {
      bedLevel: 20,
      bedX: 58,
      bankLeftLevel: 50,
      bankRightLevel: 48,
      crestLeftX: 12,
      crestRightX: 108,
      requiredClearance: 5,
      hflLevel: 26,
    },
    towers: {
      heightL: 15, heightR: 15,
      saddleMode: 'BALANCED_BACKSTAY',
      backstayTensionL: 0, backstayTensionR: 0,
      selfWeight: 250,
      axialCapacity: 4000,
      momentCapacity: 1500,
      EI: 180_000,
      K: 1.0,
      baseWidth: 4,
      requiredFoSOverturn: 1.5,
    },
    anchors: {
      weightL: 1500, weightR: 1500,
      tieDownL: 2500, tieDownR: 2500,
      frictionCoefficient: 0.55,
      passiveResistanceL: 6000, passiveResistanceR: 6000,
      requiredFoSUplift: 1.5,
      requiredFoSSliding: 1.5,
    },
    cable: {
      section,
      nCables: 8,
      shareFactor: 1.05,
      useCatalogWeight: true,
      wSelfOverride: 0,
      etaTermination: 0.90,
      etaBend: 0.95,
      saddleDiameter: 1500,
      FoS: 3.0,
      gammaM: 1.5,
      alphaT: 1.2e-5,
      supportStiffness: 0,
    },
    pointLoads: [],
    uniformLoads: [],
    launching: {
      enabled: true,
      totalWeight: 900,
      girderLength: 30,
      nBogies: 2,
      bogieSpacing: 24,
      frontPosition: 72,
      frontShare: 0.5,
      DAF: 1.15,
      hangDepth: 3.0,
      sweepSteps: 40,
    },
    wind: {
      enabled: true,
      pressure: 0.6,
      girderHeight: 2.5,
      dragCoefficient: 1.5,
    },
    combinations: combos(),
    options: {
      model: 'PARABOLIC_HORIZONTAL_LOAD',
      stateControl: 'INSTALLED_SAG',
      installedSag: 8,
      installedH: 150,
      unstressedLength: 121.5,
      diagramSamples: 240,
      tolerance: 1e-10,
      maxIterations: 120,
      runBreakPointSearch: true,
      runLaunchEnvelope: true,
      primaryCaseId: 'SLS-LAUNCH',
    },
    H_input: 500,
  };
}

export interface Preset {
  id: string;
  label: string;
  description: string;
  build: () => CableInput;
}

export const PRESETS: Preset[] = [
  {
    id: 'launch',
    label: 'Girder launch (default)',
    description:
      '900 kN girder on two bogies crossing a 120 m ravine on 8 × ⌀45 locked-coil ' +
      'ropes erected to 8 m sag. Break-point and launching envelope both live.',
    build: defaultInput,
  },
  {
    id: 'single-load',
    label: 'Single midspan load',
    description:
      'Teaching case: one static point load at midspan, launching off, so the ' +
      'break-point search reports the maximum midspan payload directly.',
    build: () => {
      const base = defaultInput();
      return {
        ...base,
        launching: { ...base.launching, enabled: false },
        wind: { ...base.wind, enabled: false },
        pointLoads: [{ id: 'PL1', x: 60, P: 600, label: 'P1' }],
        options: { ...base.options, primaryCaseId: 'SLS-LAUNCH' },
      };
    },
  },
  {
    id: 'asymmetric',
    label: 'Asymmetric saddles',
    description:
      'Saddle levels 20 m apart across a 180 m crossing — shows how the ' +
      'up-hill tower takes the larger tension and vertical reaction.',
    build: () => {
      const base = defaultInput();
      return {
        ...base,
        geometry: { ...base.geometry, L: 180, yL: 80, yR: 60, La: 30, Ra: 30 },
        site: {
          ...base.site, bedX: 90, bankLeftLevel: 60, bankRightLevel: 40,
          bedLevel: 14, hflLevel: 20, crestLeftX: 18, crestRightX: 162,
        },
        towers: { ...base.towers, heightL: 20, heightR: 20, EI: 450_000, axialCapacity: 6000 },
        anchors: {
          ...base.anchors, weightL: 2000, weightR: 2000,
          tieDownL: 3500, tieDownR: 3500,
          passiveResistanceL: 9000, passiveResistanceR: 9000,
        },
        cable: { ...base.cable, nCables: 10 },
        launching: { ...base.launching, frontPosition: 108, totalWeight: 900 },
        options: { ...base.options, installedSag: 11 },
      };
    },
  },
  {
    id: 'catenary',
    label: 'Deep-sag catenary',
    description:
      'Sag/span of about 1/8, where the parabolic approximation breaks down and ' +
      'the exact elastic catenary is required.',
    build: () => {
      const base = defaultInput();
      return {
        ...base,
        cable: { ...base.cable, nCables: 4 },
        launching: { ...base.launching, enabled: false },
        wind: { ...base.wind, enabled: false },
        pointLoads: [{ id: 'PL1', x: 60, P: 250, label: 'P1' }],
        options: {
          ...base.options,
          model: 'CATENARY_SELF_WEIGHT',
          installedSag: 15,
        },
      };
    },
  },
  {
    id: 'overloaded',
    label: 'Overloaded — shows the break point',
    description:
      'The same crossing with only two ropes and a 1200 kN unit. Several limit ' +
      'states are exceeded, so the report names the first one to go.',
    build: () => {
      const base = defaultInput();
      return {
        ...base,
        cable: { ...base.cable, nCables: 2 },
        launching: { ...base.launching, totalWeight: 1200, frontPosition: 66 },
      };
    },
  },
  {
    id: 'legacy',
    label: 'Rigid prescribed-H (legacy)',
    description:
      'Reproduces the original behaviour: H is imposed on every case and axial ' +
      'compatibility is ignored, so sag grows without limit as load is added. ' +
      'Kept only for checking hand calculations.',
    build: () => {
      const base = defaultInput();
      return {
        ...base,
        options: { ...base.options, stateControl: 'RIGID_FIXED_H' },
        H_input: 2500,
      };
    },
  },
];
