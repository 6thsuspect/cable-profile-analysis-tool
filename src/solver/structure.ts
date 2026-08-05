// ============================================================
// Tower / saddle / anchor equilibrium
// ------------------------------------------------------------
// Three saddle idealisations are offered because they give genuinely
// different tower designs and the old tool silently mixed two of them:
//
//   BALANCED_BACKSTAY  the backstay is stressed so its horizontal pull
//                      cancels the span thrust. Tower is (almost) pure
//                      compression — how a temporary launching mast is
//                      normally tuned.
//   ROLLER_SADDLE      frictionless saddle, so the tension is continuous
//                      through it: T_backstay = T_main. The horizontal
//                      components no longer cancel and the tower must
//                      carry the imbalance as shear + base moment.
//   CLAMPED_SADDLE     cable clamped at the tower head, backstay tension
//                      prescribed independently by the user.
// ============================================================
import type { AnchorConfig, AnchorResult, GeometryInput, TowerConfig, TowerResult } from '../types';
import { DEG } from './numeric';

const MIN_ALPHA_DEG = 0.5;

export function computeTower(
  side: 'left' | 'right',
  H: number,
  slopeMain: number,
  geometry: GeometryInput,
  towers: TowerConfig,
  warnings: string[],
): TowerResult {
  const isLeft = side === 'left';
  const alphaDegRaw = isLeft ? geometry.alphaL : geometry.alphaR;
  const alphaDeg = Math.max(MIN_ALPHA_DEG, Math.min(89.5, alphaDegRaw));
  if (alphaDegRaw < MIN_ALPHA_DEG) {
    warnings.push(
      `${isLeft ? 'Left' : 'Right'} backstay angle ${alphaDegRaw.toFixed(2)}° from vertical is too ` +
      `steep to develop horizontal restraint; clamped to ${MIN_ALPHA_DEG}° for the calculation.`,
    );
  }
  const alpha = alphaDeg * DEG;
  const sinA = Math.sin(alpha);
  const cosA = Math.cos(alpha);

  const thetaMain = Math.atan(slopeMain);
  const T_main = H * Math.sqrt(1 + slopeMain * slopeMain);

  let T_backstay: number;
  switch (towers.saddleMode) {
    case 'ROLLER_SADDLE':
      T_backstay = T_main;
      break;
    case 'CLAMPED_SADDLE':
      T_backstay = Math.max(0, isLeft ? towers.backstayTensionL : towers.backstayTensionR);
      break;
    case 'BALANCED_BACKSTAY':
    default:
      T_backstay = H / sinA;
      break;
  }

  const H_backstay = T_backstay * sinA;
  const V_backstay = T_backstay * cosA;

  // Force the cable applies to the saddle (x → right, y → up)
  const mainFx = isLeft ? H : -H;
  const mainFy = isLeft ? H * slopeMain : -H * slopeMain;
  // Backstay runs behind the tower and down to the anchor
  const backFx = isLeft ? -H_backstay : H_backstay;
  const backFy = -V_backstay;

  const Rx = mainFx + backFx;
  const Ry = mainFy + backFy;
  const R = Math.hypot(Rx, Ry);
  const thetaR = Math.atan2(Ry, Rx);

  const h = Math.max(0, isLeft ? towers.heightL : towers.heightR);
  const saddleY = isLeft ? geometry.yL : geometry.yR;
  const baseY = saddleY - h;

  const axial = towers.selfWeight + Math.max(0, -Ry);
  const shear = Math.abs(Rx);
  const baseMoment = shear * h;

  const eulerCritical =
    towers.EI > 0 && h > 0
      ? (Math.PI * Math.PI * towers.EI) / Math.pow(Math.max(0.1, towers.K) * h, 2)
      : 0;

  const stabilising = axial * (towers.baseWidth / 2);
  const overturningFoS =
    towers.baseWidth > 0 && baseMoment > 1e-9 ? stabilising / baseMoment : 0;

  const backstayLen = Math.max(0, isLeft ? geometry.La : geometry.Ra);
  const anchorX = (isLeft ? 0 : geometry.L) + (isLeft ? -1 : 1) * backstayLen * sinA;
  const anchorY = saddleY - backstayLen * cosA;

  return {
    side,
    saddleMode: towers.saddleMode,
    thetaMain,
    slopeMain,
    T_main,
    H_main: H,
    V_main: H * slopeMain,
    thetaBackstay: (90 - alphaDeg) * DEG,
    alpha: alphaDeg,
    T_backstay,
    H_backstay,
    V_backstay,
    Rx,
    Ry,
    R,
    thetaR,
    axial,
    shear,
    baseMoment,
    eulerCritical,
    overturningFoS,
    anchorX,
    anchorY,
    baseY,
  };
}

export function computeAnchor(
  tower: TowerResult,
  anchors: AnchorConfig,
): AnchorResult {
  const isLeft = tower.side === 'left';
  const weight = Math.max(0, isLeft ? anchors.weightL : anchors.weightR);
  const tieDown = Math.max(0, isLeft ? anchors.tieDownL : anchors.tieDownR);
  const passive = Math.max(0, isLeft ? anchors.passiveResistanceL : anchors.passiveResistanceR);
  const mu = Math.max(0, anchors.frictionCoefficient);

  // The backstay pulls the block up and towards the tower.
  const upliftDemand = tower.V_backstay;
  const slidingDemand = tower.H_backstay;

  const upliftResistance = weight + tieDown;
  const upliftFoS = upliftDemand > 1e-9 ? upliftResistance / upliftDemand : Infinity;

  // Whatever vertical capacity is left over after resisting uplift still presses
  // the block onto its founding level and generates friction.
  const netNormal = Math.max(0, weight + tieDown - upliftDemand);
  const slidingResistance = mu * netNormal + passive;
  const slidingFoS = slidingDemand > 1e-9 ? slidingResistance / slidingDemand : Infinity;

  const requiredWeightUplift = Math.max(0, anchors.requiredFoSUplift * upliftDemand - tieDown);
  const requiredWeightSliding =
    mu > 1e-9
      ? Math.max(0, (anchors.requiredFoSSliding * slidingDemand - passive) / mu + upliftDemand - tieDown)
      : Infinity;

  return {
    side: tower.side,
    upliftDemand,
    slidingDemand,
    weight,
    tieDown,
    upliftResistance,
    upliftFoS,
    slidingResistance,
    slidingFoS,
    requiredWeightUplift,
    requiredWeightSliding,
  };
}
