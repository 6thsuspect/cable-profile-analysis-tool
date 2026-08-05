// ============================================================
// Cable Profile & Point-Load Analysis Tool — Type Definitions
// ------------------------------------------------------------
// Units (SI, structural convention):
//   length      m      (section dimensions in mm)
//   force       kN
//   stress      MPa = N/mm²
//   area        mm²
//   temperature °C
//   angle       rad internally, deg at the UI boundary
// Sign convention: x → right, y → up, P → downward positive.
// ============================================================

/** Cable shape model. */
export type AnalysisModel = 'PARABOLIC_HORIZONTAL_LOAD' | 'CATENARY_SELF_WEIGHT';

/**
 * How the *installed* state of the cable is defined. This is what fixes the
 * unstressed (cut) length L0 — the invariant that makes every later load case
 * physically bounded.
 */
export type StateControlMode =
  | 'INSTALLED_SAG'      // target dead-load sag is known → back-solve L0
  | 'INSTALLED_H'        // target dead-load horizontal tension is known → back-solve L0
  | 'UNSTRESSED_LENGTH'  // cut length given directly
  | 'RIGID_FIXED_H';     // legacy/rigid: H imposed on every case, no compatibility

/** Idealisation of the cable–tower interface. */
export type SaddleMode =
  | 'BALANCED_BACKSTAY'  // backstay pretensioned so horizontal thrust cancels
  | 'ROLLER_SADDLE'      // frictionless saddle: T continuous, tower takes the imbalance
  | 'CLAMPED_SADDLE';    // cable clamped, backstay tension prescribed by user

// ------------------------------------------------------------
// Cable section & system
// ------------------------------------------------------------

/** A single rope / strand as catalogued. */
export interface CableSection {
  id: string;
  name: string;
  construction: string;
  d: number;             // nominal diameter (mm)
  Am: number;            // effective metallic area (mm²)
  E: number;             // elastic modulus (MPa)
  MBL: number;           // minimum breaking load, one rope (kN)
  mass: number;          // mass per metre, one rope (kg/m)
  minBendRatio: number;  // recommended minimum saddle D / rope d
  note?: string;
}

/** The complete cable system: n parallel ropes plus strength bookkeeping. */
export interface CableSystem {
  section: CableSection;
  nCables: number;            // number of parallel ropes sharing the load
  shareFactor: number;        // 1.00 = perfect sharing; >1 accounts for uneven sharing
  useCatalogWeight: boolean;
  wSelfOverride: number;      // kN/m per rope, per unit cable length (if override)
  etaTermination: number;     // termination efficiency 0..1
  etaBend: number;            // saddle bending efficiency 0..1
  saddleDiameter: number;     // saddle / sheave pitch diameter (mm)
  FoS: number;                // required factor of safety against MBL (unfactored loads)
  gammaM: number;             // material factor used instead of FoS at ULS
  alphaT: number;             // coefficient of thermal expansion (1/°C)
  supportStiffness: number;   // horizontal stiffness of each tower top (kN/m), 0 = rigid
}

// ------------------------------------------------------------
// Geometry, site, towers, anchors
// ------------------------------------------------------------

export interface GeometryInput {
  yL: number;        // left saddle elevation (m)
  yR: number;        // right saddle elevation (m)
  L: number;         // saddle-to-saddle horizontal span (m)
  La: number;        // left backstay length (m)
  Ra: number;        // right backstay length (m)
  alphaL: number;    // left backstay angle from vertical (deg)
  alphaR: number;    // right backstay angle from vertical (deg)
}

/** The ravine / crossing the cable spans. */
export interface SiteConfig {
  bedLevel: number;          // lowest ground level in the crossing (m)
  bedX: number;              // horizontal position of the deepest point (m from left saddle)
  bankLeftLevel: number;     // ground level at the left tower base (m)
  bankRightLevel: number;    // ground level at the right tower base (m)
  crestLeftX: number;        // x where the ground starts to fall away (m)
  crestRightX: number;       // x where the ground returns to bank level (m)
  requiredClearance: number; // minimum clearance the loaded cable must keep above ground (m)
  hflLevel: number;          // highest flood level, 0 to ignore (m)
}

export interface TowerConfig {
  heightL: number;         // left saddle height above tower base (m)
  heightR: number;         // right saddle height above tower base (m)
  saddleMode: SaddleMode;
  backstayTensionL: number; // prescribed backstay tension, CLAMPED_SADDLE only (kN)
  backstayTensionR: number;
  selfWeight: number;      // tower self weight, each (kN)
  axialCapacity: number;   // design axial capacity, each (kN), 0 = not checked
  momentCapacity: number;  // design moment capacity at base, each (kNm), 0 = not checked
  EI: number;              // flexural rigidity for buckling (kNm²), 0 = not checked
  K: number;               // effective length factor
  baseWidth: number;       // base width across the span direction (m), for overturning
  requiredFoSOverturn: number;
}

export interface AnchorConfig {
  weightL: number;          // deadman block weight, left (kN)
  weightR: number;
  tieDownL: number;         // rock / ground anchor tension capacity, left (kN)
  tieDownR: number;
  frictionCoefficient: number;
  passiveResistanceL: number; // additional sliding resistance, left (kN)
  passiveResistanceR: number;
  requiredFoSUplift: number;
  requiredFoSSliding: number;
}

// ------------------------------------------------------------
// Loads
// ------------------------------------------------------------

export interface PointLoad {
  id: string;
  x: number;      // horizontal coordinate from left saddle (m)
  P: number;      // magnitude (kN), positive downward
  label: string;
}

/** Superimposed load spread over part (or all) of the span. */
export interface UniformLoad {
  id: string;
  label: string;
  xStart: number;   // m
  xEnd: number;     // m
  w: number;        // kN/m per horizontal projection
}

/**
 * Incremental launching of a girder / slab across the crossing, carried by
 * bogies that ride on the cable. This is the load pattern the tool exists for.
 */
export interface LaunchingConfig {
  enabled: boolean;
  totalWeight: number;   // total weight of the launched unit (kN)
  girderLength: number;  // length of the launched unit (m)
  nBogies: number;       // number of bogies riding on the cable (1..4)
  bogieSpacing: number;  // centre-to-centre bogie spacing (m)
  frontPosition: number; // current position of the leading bogie (m from left saddle)
  frontShare: number;    // fraction of weight on the leading bogie (0..1); rest split evenly
  DAF: number;           // dynamic amplification factor for winching / start-stop
  hangDepth: number;     // cable to the underside of the launched unit — slings + girder depth (m)
  sweepSteps: number;    // positions evaluated for the launching envelope
}

/** Advisory lateral wind action on the suspended unit. */
export interface WindConfig {
  enabled: boolean;
  pressure: number;      // design wind pressure (kN/m²)
  girderHeight: number;  // exposed height of the launched unit (m)
  dragCoefficient: number;
}

// ------------------------------------------------------------
// Load combinations
// ------------------------------------------------------------

export interface LoadCombination {
  id: string;
  label: string;
  gDL: number;      // factor on self weight + permanent superimposed load
  gLL: number;      // factor on point loads / launching loads
  useDAF: boolean;  // apply the launching DAF to variable load
  dT: number;       // temperature change from the installed state (°C)
  wind: boolean;    // include the advisory wind amplification
  limitState: 'SLS' | 'ULS' | 'INSTALL';
  enabled: boolean;
}

// ------------------------------------------------------------
// Options
// ------------------------------------------------------------

export interface AnalysisOptions {
  model: AnalysisModel;
  stateControl: StateControlMode;
  installedSag: number;       // target dead-load sag (m)
  installedH: number;         // target dead-load H (kN)
  unstressedLength: number;   // cut length at reference temperature (m)
  diagramSamples: number;
  tolerance: number;
  maxIterations: number;
  runBreakPointSearch: boolean;
  runLaunchEnvelope: boolean;
  primaryCaseId: string;      // combination shown in the diagrams
}

/** Complete input state. */
export interface CableInput {
  geometry: GeometryInput;
  site: SiteConfig;
  towers: TowerConfig;
  anchors: AnchorConfig;
  cable: CableSystem;
  pointLoads: PointLoad[];
  uniformLoads: UniformLoad[];
  launching: LaunchingConfig;
  wind: WindConfig;
  combinations: LoadCombination[];
  options: AnalysisOptions;
  H_input: number;            // prescribed H for RIGID_FIXED_H (kN)
}

// ------------------------------------------------------------
// Solver output primitives
// ------------------------------------------------------------

export interface ProfilePoint {
  x: number;
  y: number;
  slope: number;
  theta: number;    // rad
  T: number;        // total tension in the system at this point (kN)
  V: number;        // vertical component (kN)
  ground: number;   // ground level below this point (m)
  clearance: number;// y − ground (m)
}

export interface PointLoadResult {
  load: PointLoad;
  yp: number;
  slopeLeft: number;
  slopeRight: number;
  thetaLeft: number;
  thetaRight: number;
  T_left: number;
  T_right: number;
  slopeDiscontinuity: number;
  equilibriumCheck: number;   // H·(mR−mL), must equal P
  equilibriumError: number;   // |H·(mR−mL) − P|
  deflectionFromInstalled: number; // downward movement vs the installed profile (m)
}

export interface TowerResult {
  side: 'left' | 'right';
  saddleMode: SaddleMode;
  // main cable
  thetaMain: number;
  slopeMain: number;
  T_main: number;
  H_main: number;
  V_main: number;
  // backstay
  thetaBackstay: number;     // rad from horizontal
  alpha: number;             // deg from vertical
  T_backstay: number;
  H_backstay: number;
  V_backstay: number;
  // net action on the tower
  Rx: number;                // net horizontal thrust at the saddle (kN)
  Ry: number;                // net vertical at the saddle (kN, downward negative)
  R: number;
  thetaR: number;
  axial: number;             // design axial compression at the base (kN)
  shear: number;             // design base shear (kN)
  baseMoment: number;        // design base moment (kNm)
  eulerCritical: number;     // Euler buckling load (kN), 0 if EI not given
  overturningFoS: number;    // 0 if not checkable
  // geometry
  anchorX: number;
  anchorY: number;
  baseY: number;
}

export interface AnchorResult {
  side: 'left' | 'right';
  upliftDemand: number;      // vertical pull on the block (kN)
  slidingDemand: number;     // horizontal pull on the block (kN)
  weight: number;
  tieDown: number;           // rock / ground anchor capacity mobilised (kN)
  upliftResistance: number;
  upliftFoS: number;
  slidingResistance: number;
  slidingFoS: number;
  requiredWeightUplift: number;  // block weight needed to satisfy the uplift FoS (kN)
  requiredWeightSliding: number; // block weight needed to satisfy the sliding FoS (kN)
}

export type CheckStatus = 'OK' | 'WARNING' | 'FAIL' | 'NOT_CHECKED';

export interface CapacityCheck {
  id: string;
  group: 'Cable' | 'Backstay' | 'Tower' | 'Anchor' | 'Geometry' | 'Serviceability';
  label: string;
  demand: number;
  capacity: number;
  unit: string;
  utilization: number;   // demand / capacity
  status: CheckStatus;
  note: string;
  /** Model-validity or detailing guidance — never governs and never "fails". */
  advisory: boolean;
}

/** Result of one load combination. */
export interface CaseResult {
  id: string;
  label: string;
  combination: LoadCombination;
  converged: boolean;
  iterations: number;
  residual: number;

  H: number;                 // horizontal tension of the whole cable system (kN)
  model: AnalysisModel;

  profile: ProfilePoint[];
  slopeLeft: number;
  slopeRight: number;
  thetaLeft: number;
  thetaRight: number;

  pointLoadResults: PointLoadResult[];
  leftTower: TowerResult;
  rightTower: TowerResult;
  leftAnchor: AnchorResult;
  rightAnchor: AnchorResult;

  maxSag: number;            // vertical sag below the chord (m)
  maxSagX: number;
  sagRatio: number;
  lowestPointY: number;
  lowestPointX: number;

  arcLength: number;         // deformed cable length (m)
  elasticElongation: number; // total elastic stretch (m)
  thermalElongation: number; // (m)
  supportGive: number;       // extra length released by flexible tower tops (m)

  // strength quantities
  T_max: number;             // system tension (kN)
  T_maxX: number;
  T_maxDescription: string;
  T_perRope: number;         // per-rope tension including the sharing factor (kN)
  stress: number;            // MPa
  strain: number;            // dimensionless
  utilizationMBL: number;    // T_perRope / (MBL·η)
  FoS_actual: number;

  /** Governing clearance: cable to controlling level, less the hang depth under the unit (m). */
  minClearance: number;
  minClearanceX: number;
  /** Clearance to the cable itself, ignoring anything suspended from it (m). */
  minCableClearance: number;
  /** Horizontal extent of the launched unit on the span, if any. */
  unitFootprint: { from: number; to: number } | null;

  windSwingAngle: number;    // deg, 0 if wind disabled
  windAmplification: number; // ≥1

  checks: CapacityCheck[];
  governingCheck: CapacityCheck | null;
  worstUtilization: number;

  totalVariableLoad: number; // sum of factored variable load carried (kN)
  totalDeadLoad: number;     // factored self weight + permanent UDL (kN)

  warnings: string[];
  calculationSteps: string[];
}

/** Installed / reference state used to define the cut length. */
export interface InstalledState {
  H0: number;
  sag0: number;
  L0: number;                // unstressed length at reference temperature (m)
  arcLength0: number;
  elasticElongation0: number;
  strain0: number;
  stress0: number;
  wSelf: number;             // system self weight per horizontal metre (kN/m)
  gammaSelf: number;         // system self weight per cable metre (kN/m)
  profile: ProfilePoint[];
  cuttingLength: number;     // L0 corrected for the reference temperature (m)
  derivedFrom: StateControlMode;
}

export interface BreakPointReport {
  available: boolean;
  lambdaAllowable: number;   // variable-load multiplier that first reaches an allowable limit
  lambdaAllowableCheck: string;
  lambdaUltimate: number;    // multiplier at which the cable reaches MBL·η
  ultimateCheck: string;
  baseVariableLoad: number;  // kN of variable load at λ = 1
  allowableVariableLoad: number;
  ultimateVariableLoad: number;
  reserveRatio: number;      // λ_allowable
  T_atUltimate: number;
  sag_atUltimate: number;
  firstLimitStates: { lambda: number; check: string; label: string }[];
  note: string;
}

export interface StiffnessReport {
  EA: number;                // axial rigidity of the system (kN)
  EA_perRope: number;
  E_dischinger: number;      // equivalent (secant) modulus allowing for sag change (MPa)
  E_ratio: number;           // E_dischinger / E
  verticalStiffness: number; // dP/dδ at the probe point (kN/m)
  probeX: number;
  deflectionPerKN: number;   // mm per kN at the probe point
  dH_dP: number;             // change in H per unit variable load (kN/kN)
  dSag_dP: number;           // mm of extra sag per kN of variable load
  dSag_dT: number;           // mm of sag change per °C
  dH_dT: number;             // kN of H change per °C
  geometricStiffness: number;// H / L, the taut-string term (kN/m)
}

export interface LaunchEnvelopePoint {
  frontPosition: number;
  H: number;
  T_max: number;
  T_perRope: number;
  maxSag: number;
  minClearance: number;
  towerA_R: number;
  towerB_R: number;
  utilization: number;
  bogieX: number[];
  bogieY: number[];
  converged: boolean;
}

export interface LaunchReport {
  available: boolean;
  points: LaunchEnvelopePoint[];
  worstTension: LaunchEnvelopePoint | null;
  worstSag: LaunchEnvelopePoint | null;
  worstClearance: LaunchEnvelopePoint | null;
  totalBogieLoad: number;
  bogieLoads: number[];
  note: string;
  feasible: boolean;
  blockingReason: string;
}

export interface VerificationItem {
  name: string;
  reference: string;
  expected: number;
  computed: number;
  unit: string;
  relativeError: number;
  tolerance: number;
  pass: boolean;
}

export interface VerificationReport {
  items: VerificationItem[];
  allPass: boolean;
}

/** Complete analysis output. */
export interface AnalysisResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  calculationSteps: string[];

  installed: InstalledState;
  cases: CaseResult[];
  primary: CaseResult;
  governingCase: CaseResult;

  breakPoint: BreakPointReport;
  stiffness: StiffnessReport;
  launching: LaunchReport;
  verification: VerificationReport;

  // convenience mirrors of the primary case (keeps the diagrams simple)
  H: number;
  model: AnalysisModel;
  profile: ProfilePoint[];
  slopeLeft: number;
  slopeRight: number;
  thetaLeft: number;
  thetaRight: number;
  pointLoadResults: PointLoadResult[];
  leftTower: TowerResult;
  rightTower: TowerResult;
  maxSag: number;
  sagRatio: number;
  cableLength: number;
  maxForces: {
    maxTension: number;
    maxTensionLocation: number;
    maxTensionDescription: string;
    towerA_H: number;
    towerA_V: number;
    towerA_R: number;
    towerB_H: number;
    towerB_V: number;
    towerB_R: number;
  };
}
