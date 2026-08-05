// ============================================================
// Cable Profile & Point-Load Analysis Tool — Type Definitions
// ============================================================

/** Analysis model selection */
export type AnalysisModel = 'PARABOLIC_HORIZONTAL_LOAD' | 'CATENARY_SELF_WEIGHT';

/** A single point load applied to the cable */
export interface PointLoad {
  id: string;
  x: number;       // horizontal coordinate from left tower (m)
  P: number;       // magnitude (kN), positive downward
  label: string;   // optional label
}

/** Geometry input parameters */
export interface GeometryInput {
  yL: number;       // left tower elevation (m)
  yR: number;       // right tower elevation (m)
  L: number;        // tower-to-tower horizontal span (m)
  La: number;       // left backstay length (m)
  Ra: number;       // right backstay length (m)
  alphaL: number;   // left anchor angle with vertical (deg)
  alphaR: number;   // right anchor angle with vertical (deg)
}

/** Cable properties */
export interface CableProperties {
  w: number;        // unit weight per horizontal projection (kN/m)
  gamma: number;    // unit weight per actual cable length (kN/m)
}

/** Analysis options */
export interface AnalysisOptions {
  model: AnalysisModel;
  diagramSamples: number;
  tolerance: number;
  maxIterations: number;
}

/** Complete input state */
export interface CableInput {
  geometry: GeometryInput;
  cable: CableProperties;
  pointLoads: PointLoad[];
  options: AnalysisOptions;
  H_input: number;  // user-prescribed horizontal tension (kN), or 0 to solve
}

/** A point on the cable profile for plotting */
export interface ProfilePoint {
  x: number;
  y: number;
  slope: number;
  theta: number;    // radians
  T: number;        // tension at this point
  V: number;        // vertical force component
}

/** Results at a point-load location */
export interface PointLoadResult {
  load: PointLoad;
  yp: number;              // cable elevation at load point
  slopeLeft: number;       // slope immediately left of load
  slopeRight: number;      // slope immediately right of load
  thetaLeft: number;       // angle (rad) immediately left
  thetaRight: number;      // angle (rad) immediately right
  T_left: number;          // tension immediately left
  T_right: number;         // tension immediately right
  slopeDiscontinuity: number;  // mR - mL
  equilibriumCheck: number;    // H*(mR-mL) should equal P
}

/** Tower/pulley results */
export interface TowerResult {
  side: 'left' | 'right';
  // Main cable at tower
  thetaMain: number;       // angle of main cable at tower (rad)
  slopeMain: number;       // slope of main cable at tower
  T_main: number;          // tension in main cable at tower
  H_main: number;          // horizontal component
  V_main: number;          // vertical component
  // Backstay
  thetaBackstay: number;   // angle of backstay (rad)
  T_backstay: number;      // backstay tension
  H_backstay: number;
  V_backstay: number;
  // Resultant force on tower/pulley
  Rx: number;
  Ry: number;
  R: number;
  thetaR: number;          // direction of resultant (rad)
  // Anchor position
  anchorX: number;
  anchorY: number;
}

/** Complete analysis results */
export interface AnalysisResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  calculationSteps: string[];

  // Solved parameters
  H: number;               // horizontal tension component (kN)
  model: AnalysisModel;

  // Profile
  profile: ProfilePoint[];

  // Endpoint slopes
  slopeLeft: number;
  slopeRight: number;
  thetaLeft: number;       // rad
  thetaRight: number;      // rad

  // Point-load results
  pointLoadResults: PointLoadResult[];

  // Tower results
  leftTower: TowerResult;
  rightTower: TowerResult;

  // Sag
  maxSag: number;
  sagRatio: number;        // sag / L

  // Cable length approximation
  cableLength: number;

  // Maximum forces summary
  maxForces: {
    maxTension: number;          // maximum cable tension (kN)
    maxTensionLocation: number;  // x coordinate of max tension
    maxTensionDescription: string;
    
    // Tower A (left)
    towerA_H: number;            // horizontal force at tower A
    towerA_V: number;            // vertical force at tower A
    towerA_R: number;            // resultant force at tower A
    
    // Tower B (right)  
    towerB_H: number;            // horizontal force at tower B
    towerB_V: number;            // vertical force at tower B
    towerB_R: number;            // resultant force at tower B
  };
}
