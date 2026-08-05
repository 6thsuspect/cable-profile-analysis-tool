// ============================================================
// Cable section catalogue
// ------------------------------------------------------------
// The figures below are INDICATIVE values generated from the usual
// construction constants (fill factor, breaking-force factor, spinning
// loss). They are good enough to size a temporary launching system, but
// the certified MBL / modulus from the manufacturer's test certificate
// must be substituted before issuing a design.
//
//   Am   = f · (π/4) d²            f = fill factor of the construction
//   MBL  = Am · Rm · ks / 1000     ks = spinning-loss / stranding factor
//   mass = Am · 7.85e-3 · kz       kz allows for the zinc coating & core
// ============================================================
import type { CableSection } from '../types';

interface Family {
  key: string;
  name: string;
  construction: string;
  fill: number;
  Rm: number;         // wire tensile grade (MPa)
  ks: number;         // stranding / spinning loss factor
  E: number;          // rope or strand modulus (MPa)
  kz: number;         // mass allowance factor over the metallic mass
  minBendRatio: number;
  diameters: number[];
  note: string;
}

const FAMILIES: Family[] = [
  {
    key: 'WR636',
    name: '6×36 IWRC wire rope',
    construction: '6×36 WS + IWRC, galvanised, grade 1770',
    fill: 0.560,
    Rm: 1770,
    ks: 0.835,
    E: 100_000,
    kz: 1.02,
    minBendRatio: 20,
    diameters: [16, 18, 20, 22, 24, 26, 28, 32, 36, 40, 44, 48],
    note: 'Flexible hauling / suspension rope. Lowest modulus — largest elastic sag growth.',
  },
  {
    key: 'WR619',
    name: '6×19 IWRC wire rope',
    construction: '6×19 S + IWRC, galvanised, grade 1770',
    fill: 0.545,
    Rm: 1770,
    ks: 0.860,
    E: 105_000,
    kz: 1.02,
    minBendRatio: 22,
    diameters: [16, 18, 20, 22, 24, 26, 28, 32, 36, 40],
    note: 'Stiffer than 6×36, better crushing resistance over saddles.',
  },
  {
    key: 'SS',
    name: 'Spiral strand',
    construction: '1×37 / 1×61 spiral strand, galvanised, grade 1570',
    fill: 0.780,
    Rm: 1570,
    ks: 0.900,
    E: 150_000,
    kz: 1.03,
    minBendRatio: 25,
    diameters: [20, 24, 28, 32, 36, 40, 44, 48, 52, 56, 60, 65, 70],
    note: 'Standard permanent stay / track cable. Prestretched modulus assumed.',
  },
  {
    key: 'FLC',
    name: 'Full-locked coil strand',
    construction: 'Full locked coil, galvanised, grade 1570',
    fill: 0.880,
    Rm: 1570,
    ks: 0.940,
    E: 160_000,
    kz: 1.02,
    minBendRatio: 30,
    diameters: [24, 28, 32, 36, 40, 45, 50, 55, 60, 65, 70, 80],
    note: 'Highest stiffness and fill. Preferred as a track rope for heavy launching.',
  },
];

/** 7-wire prestressing strand — catalogued explicitly, values are standard. */
const STRANDS: CableSection[] = [
  {
    id: 'PS-12.7',
    name: '7-wire strand 12.7 mm',
    construction: '7-wire low-relaxation strand, grade 1860',
    d: 12.7,
    Am: 98.7,
    E: 195_000,
    MBL: 183.7,
    mass: 0.775,
    minBendRatio: 60,
    note: 'Prestressing strand. Not suitable for running over sheaves.',
  },
  {
    id: 'PS-15.2',
    name: '7-wire strand 15.2 mm',
    construction: '7-wire low-relaxation strand, grade 1860',
    d: 15.24,
    Am: 140,
    E: 195_000,
    MBL: 260.7,
    mass: 1.102,
    minBendRatio: 60,
    note: 'Prestressing strand. Not suitable for running over sheaves.',
  },
];

function build(family: Family, d: number): CableSection {
  const Am = family.fill * (Math.PI / 4) * d * d;
  const MBL = (Am * family.Rm * family.ks) / 1000;
  const mass = Am * 7.85e-3 * family.kz;
  return {
    id: `${family.key}-${d}`,
    name: `${family.name} ⌀${d} mm`,
    construction: family.construction,
    d,
    Am: Math.round(Am * 10) / 10,
    E: family.E,
    MBL: Math.round(MBL * 10) / 10,
    mass: Math.round(mass * 1000) / 1000,
    minBendRatio: family.minBendRatio,
    note: family.note,
  };
}

export const CABLE_CATALOG: CableSection[] = [
  ...FAMILIES.flatMap(f => f.diameters.map(d => build(f, d))),
  ...STRANDS,
];

export const CABLE_FAMILIES = [
  ...FAMILIES.map(f => ({ key: f.key, name: f.name })),
  { key: 'PS', name: '7-wire prestressing strand' },
];

export function familyOf(section: CableSection): string {
  const dash = section.id.lastIndexOf('-');
  return dash > 0 ? section.id.slice(0, dash) : section.id;
}

export function findSection(id: string): CableSection | undefined {
  return CABLE_CATALOG.find(s => s.id === id);
}

export function defaultSection(): CableSection {
  return findSection('FLC-40') ?? CABLE_CATALOG[0];
}

/**
 * Cheapest section from the catalogue (by metallic area) that carries `T_required`
 * with the given factor of safety and efficiency. Used by the "suggest a section"
 * helper so the user is not left guessing after a FAIL.
 */
export function suggestSection(
  T_required: number,
  nCables: number,
  FoS: number,
  eta: number,
  familyKey?: string,
): CableSection | null {
  const needPerRope = (T_required * FoS) / Math.max(1, nCables) / Math.max(1e-6, eta);
  const pool = familyKey
    ? CABLE_CATALOG.filter(s => familyOf(s) === familyKey)
    : CABLE_CATALOG;
  const viable = pool.filter(s => s.MBL >= needPerRope).sort((a, b) => a.Am - b.Am);
  return viable[0] ?? null;
}
