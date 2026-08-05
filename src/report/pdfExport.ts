// ============================================================
// PDF calculation report
// ============================================================
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { AnalysisResult, CableInput, CaseResult } from '../types';

const RAD = 180 / Math.PI;
const PAGE_W = 210;
const MARGIN = 14;
const CONTENT_W = PAGE_W - 2 * MARGIN;

type Doc = jsPDF & { lastAutoTable: { finalY: number } };

const HEAD = [41, 65, 122] as [number, number, number];
const HEAD_ALT = [88, 28, 135] as [number, number, number];
const HEAD_OK = [21, 94, 60] as [number, number, number];

function f(v: number, dp = 2): string {
  return Number.isFinite(v) ? v.toFixed(dp) : '-';
}
function fInf(v: number, dp = 2): string {
  if (!Number.isFinite(v)) return 'inf';
  return v.toFixed(dp);
}

// ------------------------------------------------------------
// Profile figure
// ------------------------------------------------------------
function drawFigure(
  doc: jsPDF, input: CableInput, result: AnalysisResult, c: CaseResult, startY: number,
): number {
  const { geometry, site } = input;
  const L = geometry.L;
  const figX = MARGIN;
  const figY = startY;
  const figW = CONTENT_W;
  const figH = 76;

  doc.setDrawColor(120, 120, 120);
  doc.setLineWidth(0.3);
  doc.rect(figX, figY, figW, figH);

  const crestL = Math.max(0, Math.min(0.45 * L, site.crestLeftX));
  const crestR = Math.max(0.55 * L, Math.min(L, site.crestRightX));
  const bedX = Math.max(crestL + 0.01 * L, Math.min(crestR - 0.01 * L, site.bedX));
  const ground = [
    { x: 0, y: site.bankLeftLevel },
    { x: crestL, y: site.bankLeftLevel },
    { x: bedX, y: site.bedLevel },
    { x: crestR, y: site.bankRightLevel },
    { x: L, y: site.bankRightLevel },
  ];

  let minX = Math.min(c.leftTower.anchorX, 0);
  let maxX = Math.max(c.rightTower.anchorX, L);
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of c.profile) { minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); }
  for (const p of result.installed.profile) minY = Math.min(minY, p.y);
  for (const g of ground) { minY = Math.min(minY, g.y); maxY = Math.max(maxY, g.y); }
  minY = Math.min(minY, c.leftTower.anchorY, c.rightTower.anchorY, c.leftTower.baseY, c.rightTower.baseY);
  maxY = Math.max(maxY, geometry.yL, geometry.yR);
  const padX = (maxX - minX) * 0.06;
  const padY = Math.max(1, (maxY - minY) * 0.12);
  minX -= padX; maxX += padX; minY -= padY; maxY += padY;

  const sx = (x: number) => figX + 6 + ((x - minX) / (maxX - minX)) * (figW - 12);
  const sy = (y: number) => figY + figH - 6 - ((y - minY) / (maxY - minY)) * (figH - 12);

  // grid
  doc.setDrawColor(228, 228, 228);
  doc.setLineWidth(0.1);
  for (let i = 1; i < 6; i++) doc.line(figX + (figW * i) / 6, figY, figX + (figW * i) / 6, figY + figH);
  for (let i = 1; i < 4; i++) doc.line(figX, figY + (figH * i) / 4, figX + figW, figY + (figH * i) / 4);

  // ground
  doc.setDrawColor(120, 113, 108);
  doc.setLineWidth(0.6);
  for (let i = 1; i < ground.length; i++) {
    doc.line(sx(ground[i - 1].x), sy(ground[i - 1].y), sx(ground[i].x), sy(ground[i].y));
  }

  // flood level
  if (site.hflLevel > 0) {
    doc.setDrawColor(14, 165, 233);
    doc.setLineWidth(0.4);
    doc.setLineDashPattern([2, 1.2], 0);
    doc.line(sx(crestL), sy(site.hflLevel), sx(crestR), sy(site.hflLevel));
    doc.setLineDashPattern([], 0);
  }

  // towers
  doc.setDrawColor(51, 65, 85);
  doc.setLineWidth(1.6);
  doc.line(sx(0), sy(c.leftTower.baseY), sx(0), sy(geometry.yL));
  doc.line(sx(L), sy(c.rightTower.baseY), sx(L), sy(geometry.yR));

  // backstays
  doc.setDrawColor(234, 88, 12);
  doc.setLineWidth(0.7);
  doc.line(sx(0), sy(geometry.yL), sx(c.leftTower.anchorX), sy(c.leftTower.anchorY));
  doc.line(sx(L), sy(geometry.yR), sx(c.rightTower.anchorX), sy(c.rightTower.anchorY));
  doc.setFillColor(234, 88, 12);
  doc.rect(sx(c.leftTower.anchorX) - 1.6, sy(c.leftTower.anchorY) - 0.8, 3.2, 2, 'F');
  doc.rect(sx(c.rightTower.anchorX) - 1.6, sy(c.rightTower.anchorY) - 0.8, 3.2, 2, 'F');

  // chord
  doc.setDrawColor(150, 160, 175);
  doc.setLineWidth(0.25);
  doc.setLineDashPattern([1.2, 1], 0);
  doc.line(sx(0), sy(geometry.yL), sx(L), sy(geometry.yR));
  doc.setLineDashPattern([], 0);

  // installed profile
  doc.setDrawColor(100, 116, 139);
  doc.setLineWidth(0.45);
  doc.setLineDashPattern([2, 1.3], 0);
  for (let i = 1; i < result.installed.profile.length; i++) {
    const a = result.installed.profile[i - 1];
    const b = result.installed.profile[i];
    doc.line(sx(a.x), sy(a.y), sx(b.x), sy(b.y));
  }
  doc.setLineDashPattern([], 0);

  // loaded cable
  doc.setDrawColor(29, 78, 216);
  doc.setLineWidth(0.9);
  for (let i = 1; i < c.profile.length; i++) {
    doc.line(sx(c.profile[i - 1].x), sy(c.profile[i - 1].y), sx(c.profile[i].x), sy(c.profile[i].y));
  }

  // saddles
  doc.setFillColor(30, 58, 138);
  doc.circle(sx(0), sy(geometry.yL), 1.3, 'F');
  doc.circle(sx(L), sy(geometry.yR), 1.3, 'F');

  // point loads
  doc.setDrawColor(200, 40, 40);
  doc.setFillColor(200, 40, 40);
  doc.setLineWidth(0.6);
  doc.setFontSize(5.5);
  for (const p of c.profile.length > 0 ? c.pointLoadResults : []) {
    const px = sx(p.load.x);
    const py = sy(p.yp);
    doc.line(px, py - 8, px, py - 1);
    doc.triangle(px, py, px - 1.2, py - 2.6, px + 1.2, py - 2.6, 'F');
    doc.setTextColor(170, 30, 30);
    doc.text(`${p.load.label} ${f(p.load.P, 0)}kN`, px + 1.5, py - 8.5);
  }

  // sag dimension
  const chordAt = (x: number) => geometry.yL + ((geometry.yR - geometry.yL) / L) * x;
  const sagX = c.maxSagX;
  doc.setDrawColor(124, 58, 237);
  doc.setLineWidth(0.4);
  doc.setLineDashPattern([1, 0.8], 0);
  doc.line(sx(sagX), sy(chordAt(sagX)), sx(sagX), sy(chordAt(sagX) - c.maxSag));
  doc.setLineDashPattern([], 0);
  doc.setFontSize(6.5);
  doc.setTextColor(100, 45, 190);
  doc.text(`sag ${f(c.maxSag, 3)} m`, sx(sagX) + 2,
    (sy(chordAt(sagX)) + sy(chordAt(sagX) - c.maxSag)) / 2);

  // labels
  doc.setFontSize(6.5);
  doc.setTextColor(30, 60, 140);
  doc.text('Tower A', sx(0) - 5, sy(geometry.yL) - 3);
  doc.text('Tower B', sx(L) - 5, sy(geometry.yR) - 3);
  doc.setTextColor(200, 100, 30);
  doc.setFontSize(5.5);
  doc.text('Anchor A', sx(c.leftTower.anchorX) - 6, sy(c.leftTower.anchorY) + 4.5);
  doc.text('Anchor B', sx(c.rightTower.anchorX) - 3, sy(c.rightTower.anchorY) + 4.5);

  doc.setFontSize(8);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.text(`Figure 1 - Cable profile, ${c.label}`, figX + figW / 2, figY + figH + 5, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(90, 90, 90);
  doc.text(
    'Solid blue: loaded cable.  Dashed grey: installed (dead load) profile.  Orange: backstays.  ' +
    'Dashed blue: highest flood level.',
    figX + figW / 2, figY + figH + 9, { align: 'center' },
  );
  doc.setTextColor(0, 0, 0);

  return figY + figH + 14;
}

// ------------------------------------------------------------
export function exportReport(input: CableInput, result: AnalysisResult) {
  const doc = new jsPDF('p', 'mm', 'a4') as Doc;
  let y = 16;
  let section = 0;

  const page = (needed = 20) => {
    if (y + needed > 282) { doc.addPage(); y = 16; }
  };
  const heading = (text: string) => {
    section++;
    page(14);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(20, 40, 90);
    doc.text(`${section}. ${text}`, MARGIN, y);
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
    y += 6;
  };
  const para = (text: string, size = 8) => {
    page(10);
    doc.setFontSize(size);
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(text, CONTENT_W);
    doc.text(lines, MARGIN, y);
    y += lines.length * (size * 0.48) + 1.5;
  };
  const table = (
    head: string[][], body: (string | number)[][],
    fill: [number, number, number] = HEAD, colStyles?: Record<number, { halign: 'right' | 'left' }>,
  ) => {
    page(24);
    autoTable(doc, {
      startY: y,
      head,
      body,
      styles: { fontSize: 7, cellPadding: 1.2 },
      headStyles: { fillColor: fill, fontSize: 7 },
      margin: { left: MARGIN, right: MARGIN },
      columnStyles: colStyles,
    });
    y = doc.lastAutoTable.finalY + 5;
  };

  const gov = result.governingCase;
  const primary = result.primary;
  const inst = result.installed;
  const sec = input.cable.section;
  const eta = input.cable.etaTermination * input.cable.etaBend;

  // ── title ──
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.text('Cable Profile & Point-Load Analysis', PAGE_W / 2, y, { align: 'center' });
  y += 6;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Length-compatible elastic cable analysis for a temporary launching system',
    PAGE_W / 2, y, { align: 'center' });
  y += 5;
  doc.setFontSize(7.5);
  doc.setTextColor(90, 90, 90);
  doc.text(`Generated ${new Date().toLocaleString()}   |   ` +
    `${result.model === 'PARABOLIC_HORIZONTAL_LOAD' ? 'Elastic parabolic (segmental)' : 'Elastic catenary (exact)'} model`,
    PAGE_W / 2, y, { align: 'center' });
  doc.setTextColor(0, 0, 0);
  y += 7;

  // ── verdict box ──
  const failing = result.cases.flatMap(c => c.checks.filter(k => k.status === 'FAIL'));
  page(22);
  doc.setFillColor(...(failing.length > 0 ? [254, 226, 226] : [209, 250, 229]) as [number, number, number]);
  doc.setDrawColor(...(failing.length > 0 ? [220, 38, 38] : [5, 150, 105]) as [number, number, number]);
  doc.setLineWidth(0.4);
  doc.roundedRect(MARGIN, y, CONTENT_W, 18, 1.5, 1.5, 'FD');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...(failing.length > 0 ? [153, 27, 27] : [6, 95, 70]) as [number, number, number]);
  doc.text(
    failing.length > 0
      ? `${failing.length} limit state(s) exceeded`
      : 'All limit states satisfied',
    MARGIN + 4, y + 6,
  );
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(40, 40, 40);
  doc.text(
    `Governing case: ${gov.label} - ${gov.governingCheck?.label ?? 'n/a'} at ` +
    `${(gov.worstUtilization * 100).toFixed(1)} % utilisation.`,
    MARGIN + 4, y + 11,
  );
  if (result.breakPoint.available) {
    doc.text(
      `First limit state at ${f(result.breakPoint.lambdaAllowable, 2)} x the variable load ` +
      `(${f(result.breakPoint.allowableVariableLoad, 0)} kN); rope rupture at ` +
      `${f(result.breakPoint.lambdaUltimate, 2)} x (${f(result.breakPoint.ultimateVariableLoad, 0)} kN).`,
      MARGIN + 4, y + 15.5,
    );
  }
  doc.setTextColor(0, 0, 0);
  y += 23;

  // ── figure ──
  heading('Cable profile');
  y = drawFigure(doc, input, result, primary, y);

  // ── cable system ──
  heading('Cable system');
  table(
    [['Property', 'Symbol', 'Value', 'Unit']],
    [
      ['Section', '-', sec.name, '-'],
      ['Construction', '-', sec.construction, '-'],
      ['Nominal diameter', 'd', f(sec.d, 1), 'mm'],
      ['Metallic area, one rope', 'Am', f(sec.Am, 1), 'mm2'],
      ['Elastic modulus', 'E', f(sec.E, 0), 'MPa'],
      ['Number of parallel ropes', 'n', String(input.cable.nCables), '-'],
      ['Load-sharing factor', '-', f(input.cable.shareFactor, 2), '-'],
      ['Axial rigidity, one rope', 'EA', f(result.stiffness.EA_perRope, 0), 'kN'],
      ['Axial rigidity, system', 'EA', f(result.stiffness.EA, 0), 'kN'],
      ['Self weight, system', 'gamma', f(inst.gammaSelf, 4), 'kN/m of cable'],
      ['Minimum breaking load, one rope', 'MBL', f(sec.MBL, 1), 'kN'],
      ['Termination efficiency', 'eta_t', f(input.cable.etaTermination, 3), '-'],
      ['Bending efficiency', 'eta_b', f(input.cable.etaBend, 3), '-'],
      ['Effective MBL per rope', 'MBL.eta', f(sec.MBL * eta, 1), 'kN'],
      ['Required factor of safety (service)', 'FoS', f(input.cable.FoS, 2), '-'],
      ['Material factor (factored cases)', 'gamma_M', f(input.cable.gammaM, 2), '-'],
      ['Allowable per rope (service)', '-', f((sec.MBL * eta) / input.cable.FoS, 1), 'kN'],
      ['Saddle pitch diameter', 'D', f(input.cable.saddleDiameter, 0), 'mm'],
      ['Saddle D/d', '-', f(input.cable.saddleDiameter / sec.d, 1), `min ${sec.minBendRatio}`],
      ['Thermal expansion', 'alpha', (input.cable.alphaT * 1e6).toFixed(1), 'microstrain/degC'],
    ],
  );
  para(
    'Catalogue values for MBL, area and modulus are indicative figures derived from the usual ' +
    'construction constants. Substitute the certified values from the manufacturer test ' +
    'certificate before issuing a design.', 7,
  );

  // ── geometry & site ──
  heading('Geometry, crossing and supports');
  table(
    [['Parameter', 'Symbol', 'Value', 'Unit']],
    [
      ['Span, saddle to saddle', 'L', f(input.geometry.L, 2), 'm'],
      ['Left saddle level', 'yL', f(input.geometry.yL, 2), 'm'],
      ['Right saddle level', 'yR', f(input.geometry.yR, 2), 'm'],
      ['Left tower height', 'hL', f(input.towers.heightL, 2), 'm'],
      ['Right tower height', 'hR', f(input.towers.heightR, 2), 'm'],
      ['Left backstay length', 'La', f(input.geometry.La, 2), 'm'],
      ['Right backstay length', 'Ra', f(input.geometry.Ra, 2), 'm'],
      ['Left backstay from vertical', 'alphaL', f(input.geometry.alphaL, 2), 'deg'],
      ['Right backstay from vertical', 'alphaR', f(input.geometry.alphaR, 2), 'deg'],
      ['Saddle idealisation', '-', input.towers.saddleMode.replace(/_/g, ' ').toLowerCase(), '-'],
      ['Left bank level', '-', f(input.site.bankLeftLevel, 2), 'm'],
      ['Right bank level', '-', f(input.site.bankRightLevel, 2), 'm'],
      ['Bed level', '-', f(input.site.bedLevel, 2), 'm'],
      ['Bed position', '-', f(input.site.bedX, 2), 'm'],
      ['Clearance assessed between', '-',
        `${f(input.site.crestLeftX, 1)} and ${f(input.site.crestRightX, 1)}`, 'm'],
      ['Highest flood level', 'HFL', input.site.hflLevel > 0 ? f(input.site.hflLevel, 2) : 'not set', 'm'],
      ['Required clearance', '-', f(input.site.requiredClearance, 2), 'm'],
      ['Tower-top horizontal stiffness', 'k', input.cable.supportStiffness > 0
        ? f(input.cable.supportStiffness, 0) : 'rigid', 'kN/m'],
    ],
  );

  // ── loads ──
  heading('Loads');
  if (input.launching.enabled) {
    table(
      [['Launched unit', 'Value', 'Unit']],
      [
        ['Total weight', f(input.launching.totalWeight, 1), 'kN'],
        ['Length of the unit', f(input.launching.girderLength, 2), 'm'],
        ['Bogies riding on the cable', String(input.launching.nBogies), '-'],
        ['Bogie spacing', f(input.launching.bogieSpacing, 2), 'm'],
        ['Share on the leading bogie', f(input.launching.frontShare, 2), '-'],
        ['Leading bogie position analysed', f(input.launching.frontPosition, 2), 'm'],
        ['Dynamic amplification factor', f(input.launching.DAF, 2), '-'],
        ['Cable to soffit (slings + depth)', f(input.launching.hangDepth, 2), 'm'],
        ...result.launching.bogieLoads.map((p, i) =>
          [`Bogie B${i + 1} unfactored load`, f(p, 1), 'kN'] as (string | number)[]),
      ],
    );
  }
  if (input.pointLoads.length > 0) {
    table(
      [['Static point load', 'x (m)', 'P (kN)']],
      input.pointLoads.map(p => [p.label, f(p.x, 2), f(p.P, 2)]),
    );
  }
  if (input.uniformLoads.length > 0) {
    table(
      [['Distributed load', 'from (m)', 'to (m)', 'w (kN/m)']],
      input.uniformLoads.map(u => [u.label, f(u.xStart, 2), f(u.xEnd, 2), f(u.w, 3)]),
    );
  }
  if (input.wind.enabled) {
    table(
      [['Lateral wind (advisory)', 'Value', 'Unit']],
      [
        ['Design pressure', f(input.wind.pressure, 2), 'kN/m2'],
        ['Exposed height of the unit', f(input.wind.girderHeight, 2), 'm'],
        ['Drag coefficient', f(input.wind.dragCoefficient, 2), '-'],
        ['Swing angle at the analysed position', f(primary.windSwingAngle, 2), 'deg'],
        ['Tension amplification', f(primary.windAmplification, 4), '-'],
      ],
    );
  }

  // ── installed state ──
  heading('Installed state and the cut length');
  para(
    'The unstressed (cut) length L0 is the invariant of the whole analysis. It is established ' +
    'from the installed dead-load state and then held fixed, so every subsequent load case is ' +
    'solved for H from axial compatibility rather than being given H as an input. This is why ' +
    'the sag under load is bounded by the elastic stretch of the rope instead of growing without ' +
    'limit.',
  );
  table(
    [['Quantity', 'Value', 'Unit']],
    [
      ['Defined by', describeControl(inst.derivedFrom), '-'],
      ['Dead-load horizontal tension H0', f(inst.H0, 3), 'kN'],
      ['Dead-load sag', f(inst.sag0, 4), 'm'],
      ['Sag / span', inst.sag0 > 0 ? `1 / ${f(input.geometry.L / inst.sag0, 1)}` : '-', '-'],
      ['Deformed arc length', f(inst.arcLength0, 5), 'm'],
      ['Unstressed (cut) length L0', f(inst.L0, 5), 'm'],
      ['Elastic stretch at installation', f(inst.elasticElongation0 * 1000, 1), 'mm'],
      ['Installed stress', f(inst.stress0, 1), 'MPa'],
      ['Equivalent load per horizontal metre', f(inst.wSelf, 4), 'kN/m'],
    ],
    HEAD_OK,
  );

  // ── combination summary ──
  heading('Load combinations - summary');
  table(
    [['Combination', 'g_DL', 'g_LL', 'dT', 'H', 'sag', 'd.sag', 'T/rope', 'FoS', 'clear.', 'util']],
    result.cases.map(c => [
      c.label + (c.id === gov.id ? ' *' : ''),
      f(c.combination.gDL, 2),
      f(c.combination.gLL, 2),
      f(c.combination.dT, 0),
      f(c.H, 1),
      f(c.maxSag, 3),
      `${c.maxSag >= inst.sag0 ? '+' : ''}${f((c.maxSag - inst.sag0) * 1000, 0)}`,
      f(c.T_perRope, 1),
      f(c.FoS_actual, 2),
      f(c.minClearance, 2),
      `${(c.worstUtilization * 100).toFixed(0)}%`,
    ]),
    HEAD_ALT,
  );
  para(
    'Units: H, T in kN; sag, clearance in m; d.sag (growth from the installed profile) in mm; ' +
    'dT in degC. An asterisk marks the governing combination. Service combinations are checked ' +
    `against MBL.eta / FoS = ${f((sec.MBL * eta) / input.cable.FoS, 1)} kN per rope; factored ` +
    `combinations against MBL.eta / gamma_M = ${f((sec.MBL * eta) / input.cable.gammaM, 1)} kN.`, 7,
  );

  // ── governing case detail ──
  heading(`Governing case in detail - ${gov.label}`);
  table(
    [['Quantity', 'Value', 'Unit']],
    [
      ['Horizontal tension H', f(gov.H, 3), 'kN'],
      ['Maximum tension, system', f(gov.T_max, 2), 'kN'],
      ['Location of maximum tension', gov.T_maxDescription, '-'],
      ['Maximum tension per rope', f(gov.T_perRope, 2), 'kN'],
      ['Stress', f(gov.stress, 1), 'MPa'],
      ['Strain', (gov.strain * 1e6).toFixed(0), 'microstrain'],
      ['Actual factor of safety', f(gov.FoS_actual, 3), '-'],
      ['Left cable angle', f(gov.thetaLeft * RAD, 3), 'deg'],
      ['Right cable angle', f(gov.thetaRight * RAD, 3), 'deg'],
      ['Maximum sag below the chord', f(gov.maxSag, 4), 'm'],
      ['Position of maximum sag', f(gov.maxSagX, 2), 'm'],
      ['Sag growth from the installed profile', f((gov.maxSag - inst.sag0) * 1000, 1), 'mm'],
      ['Deformed arc length', f(gov.arcLength, 5), 'm'],
      ['Elastic stretch', f(gov.elasticElongation * 1000, 2), 'mm'],
      ['Thermal movement', f(gov.thermalElongation * 1000, 2), 'mm'],
      ['Tower-top give', f(gov.supportGive * 1000, 2), 'mm'],
      ['Compatibility residual', gov.residual.toExponential(2), 'm'],
      ['Factored dead load on the span', f(gov.totalDeadLoad, 2), 'kN'],
      ['Factored variable load', f(gov.totalVariableLoad, 2), 'kN'],
      ['Vertical equilibrium H(mR-mL)', f(gov.H * (gov.slopeRight - gov.slopeLeft), 3), 'kN'],
      ['Clearance to the cable', f(gov.minCableClearance, 3), 'm'],
      ['Governing clearance', f(gov.minClearance, 3), 'm'],
    ],
  );

  if (gov.pointLoadResults.length > 0) {
    table(
      [['Load', 'x (m)', 'P (kN)', 'y (m)', 'm left', 'm right', 'TL (kN)', 'TR (kN)', 'H.dm (kN)', 'err (kN)']],
      gov.pointLoadResults.map(p => [
        p.load.label, f(p.load.x, 2), f(p.load.P, 2), f(p.yp, 3),
        f(p.slopeLeft, 5), f(p.slopeRight, 5),
        f(p.T_left, 2), f(p.T_right, 2),
        f(p.equilibriumCheck, 3), p.equilibriumError.toExponential(1),
      ]),
    );
    para('H(mR - mL) must equal P at every load; the error column shows how well the ' +
      'kink equilibrium is satisfied.', 7);
  }

  // ── towers & anchors ──
  heading('Towers and anchors - governing case');
  for (const [tw, an, tag] of [
    [gov.leftTower, gov.leftAnchor, 'A (left)'],
    [gov.rightTower, gov.rightAnchor, 'B (right)'],
  ] as const) {
    table(
      [[`Tower / anchor ${tag}`, 'Value', 'Unit']],
      [
        ['Main cable angle', f(tw.thetaMain * RAD, 3), 'deg'],
        ['Main cable tension', f(tw.T_main, 2), 'kN'],
        ['Backstay angle from vertical', f(tw.alpha, 2), 'deg'],
        ['Backstay tension', f(tw.T_backstay, 2), 'kN'],
        ['Net horizontal thrust at the saddle', f(tw.Rx, 2), 'kN'],
        ['Net vertical at the saddle', f(tw.Ry, 2), 'kN'],
        ['Resultant on the saddle', f(tw.R, 2), 'kN'],
        ['Base axial', f(tw.axial, 2), 'kN'],
        ['Base shear', f(tw.shear, 2), 'kN'],
        ['Base moment', f(tw.baseMoment, 2), 'kNm'],
        ['Euler critical load', tw.eulerCritical > 0 ? f(tw.eulerCritical, 0) : 'not checked', 'kN'],
        ['Overturning FoS', tw.overturningFoS > 0 ? fInf(tw.overturningFoS, 2) : 'not checked', '-'],
        ['Anchor uplift demand', f(an.upliftDemand, 2), 'kN'],
        ['Anchor uplift resistance', f(an.upliftResistance, 2), 'kN'],
        ['Anchor uplift FoS', fInf(an.upliftFoS, 2), '-'],
        ['Anchor horizontal pull', f(an.slidingDemand, 2), 'kN'],
        ['Anchor sliding resistance', f(an.slidingResistance, 2), 'kN'],
        ['Anchor sliding FoS', fInf(an.slidingFoS, 2), '-'],
        ['Block weight needed for uplift', f(an.requiredWeightUplift, 0), 'kN'],
        ['Block weight needed for sliding', fInf(an.requiredWeightSliding, 0), 'kN'],
      ],
      HEAD_OK,
    );
  }

  // ── capacity checks ──
  heading('Capacity checks - governing case');
  table(
    [['Group', 'Check', 'Demand', 'Capacity', 'Unit', 'Util.', 'Result']],
    gov.checks.filter(c => c.status !== 'NOT_CHECKED').map(c => [
      c.group, c.label, f(c.demand, 2), fInf(c.capacity, 2), c.unit,
      `${(c.utilization * 100).toFixed(0)}%`,
      c.status === 'FAIL' ? 'FAIL' : c.status === 'WARNING' ? 'WATCH' : 'OK',
    ]),
    HEAD_ALT,
  );

  // ── break point ──
  heading('Break point');
  if (!result.breakPoint.available) {
    para(result.breakPoint.note);
  } else {
    const bp = result.breakPoint;
    para(bp.note);
    table(
      [['Quantity', 'Value', 'Unit']],
      [
        ['Variable load applied (lambda = 1)', f(bp.baseVariableLoad, 1), 'kN'],
        ['First limit state reached at', `${f(bp.lambdaAllowable, 3)} x`, '-'],
        ['Governing limit state', bp.lambdaAllowableCheck, '-'],
        ['Allowable variable load', f(bp.allowableVariableLoad, 1), 'kN'],
        ['Rope rupture reached at', `${f(bp.lambdaUltimate, 3)} x`, '-'],
        ['Variable load at rupture', f(bp.ultimateVariableLoad, 1), 'kN'],
        ['Rope tension at rupture', f(bp.T_atUltimate, 1), 'kN'],
        ['Sag at rupture', f(bp.sag_atUltimate, 3), 'm'],
      ],
      HEAD_ALT,
    );
    if (bp.firstLimitStates.length > 0) {
      table(
        [['Order', 'Load multiplier', 'Limit state']],
        bp.firstLimitStates.map((ls, i) => [
          String(i + 1),
          ls.lambda === 0 ? 'already exceeded' : `${f(ls.lambda, 3)} x`,
          ls.label,
        ]),
      );
    }
  }

  // ── stiffness ──
  heading('Stiffness');
  const st = result.stiffness;
  table(
    [['Quantity', 'Value', 'Unit']],
    [
      ['Axial rigidity, system', f(st.EA, 0), 'kN'],
      ['Dischinger equivalent modulus', f(st.E_dischinger, 0), 'MPa'],
      ['as a fraction of E', `${(st.E_ratio * 100).toFixed(1)}%`, '-'],
      ['Taut-string term H/L', f(st.geometricStiffness, 2), 'kN/m'],
      ['Vertical stiffness at the probe', fInf(st.verticalStiffness, 1), 'kN/m'],
      ['Probe position', f(st.probeX, 2), 'm'],
      ['Deflection per kN at the probe', f(st.deflectionPerKN, 3), 'mm/kN'],
      ['dH / dP', f(st.dH_dP, 3), 'kN/kN'],
      ['dSag / dP', f(st.dSag_dP, 3), 'mm/kN'],
      ['dSag / dT', f(st.dSag_dT, 3), 'mm/degC'],
      ['dH / dT', f(st.dH_dT, 3), 'kN/degC'],
    ],
  );

  // ── launching envelope ──
  if (result.launching.available) {
    heading('Launching envelope');
    para(result.launching.note);
    para(result.launching.feasible
      ? 'The launch can be completed within all limit states.'
      : `The launch cannot be completed as configured: ${result.launching.blockingReason}`);
    const worst = [
      ['Peak rope tension', result.launching.worstTension],
      ['Peak sag', result.launching.worstSag],
      ['Least clearance', result.launching.worstClearance],
    ] as const;
    table(
      [['Criterion', 'Nose position (m)', 'H (kN)', 'T/rope (kN)', 'sag (m)', 'clearance (m)']],
      worst.filter(([, p]) => p !== null).map(([name, p]) => [
        name, f(p!.frontPosition, 1), f(p!.H, 0), f(p!.T_perRope, 1),
        f(p!.maxSag, 3), f(p!.minClearance, 2),
      ]),
      HEAD_ALT,
    );
    table(
      [['Nose x (m)', 'H (kN)', 'T sys (kN)', 'T/rope (kN)', 'sag (m)', 'clear. (m)',
        'Tower A (kN)', 'Tower B (kN)', 'util']],
      result.launching.points.map(p => [
        f(p.frontPosition, 1), f(p.H, 0), f(p.T_max, 0), f(p.T_perRope, 1),
        f(p.maxSag, 3), f(p.minClearance, 2), f(p.towerA_R, 0), f(p.towerB_R, 0),
        `${(p.utilization * 100).toFixed(0)}%`,
      ]),
    );
  }

  // ── verification ──
  heading('Verification against closed-form solutions');
  para(
    'Each benchmark below has an answer that does not come from this program, so the results ' +
    'are reproducible by hand. The suite runs on fixed inputs, independent of the model above.',
  );
  table(
    [['Benchmark', 'Reference', 'Expected', 'Computed', 'Rel. error', 'Result']],
    result.verification.items.map(it => [
      it.name, it.reference, `${f(it.expected, 6)} ${it.unit}`, f(it.computed, 6),
      it.relativeError.toExponential(1), it.pass ? 'PASS' : 'FAIL',
    ]),
    result.verification.allPass ? HEAD_OK : [153, 27, 27],
  );

  // ── warnings ──
  if (result.warnings.length > 0) {
    heading('Warnings');
    for (const w of result.warnings) para(`- ${w}`, 7.5);
  }

  // ── assumptions ──
  heading('Assumptions and limitations');
  for (const a of [
    'Planar (two-dimensional) analysis. Lateral wind is treated as an in-plane equivalent; ' +
    'out-of-plane swing requires a three-dimensional check.',
    'The cable carries no bending stiffness and no compression.',
    'Small strain. In the parabolic model the elastic integral is referred to the deformed ' +
    'length, an O(strain) approximation of roughly 0.1 per cent. The elastic catenary has no ' +
    'such approximation.',
    'Saddle friction is not modelled. Real friction locks in a tension difference either side ' +
    'of the saddle.',
    'Ropes are assumed prestretched, so the catalogue modulus applies. Constructional stretch ' +
    'of a new rope is not included and must be added to the cut length.',
    'No creep, relaxation or fatigue assessment. Repeated launching cycles also require a ' +
    'bending fatigue check over the saddles.',
    'Load factors and factors of safety are user inputs with conventional defaults; they are ' +
    'not tied to any particular code and must be confirmed against the governing standard.',
    'Towers are treated as cantilever masts with the saddle load applied at the top. Foundation ' +
    'settlement and rotation are not modelled.',
  ]) para(`- ${a}`, 7.5);

  // ── calculation trail ──
  doc.addPage();
  y = 16;
  heading('Calculation trail');
  doc.setFont('courier', 'normal');
  doc.setFontSize(6.2);
  for (const line of result.calculationSteps) {
    const wrapped = doc.splitTextToSize(line, CONTENT_W);
    if (y + wrapped.length * 2.6 > 285) { doc.addPage(); y = 16; }
    doc.text(wrapped, MARGIN, y);
    y += wrapped.length * 2.6;
  }
  doc.setFont('helvetica', 'normal');

  // ── page numbers ──
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(6.5);
    doc.setTextColor(120, 120, 120);
    doc.text(`Cable Profile & Point-Load Analysis  -  page ${i} of ${pages}`,
      PAGE_W / 2, 291, { align: 'center' });
  }

  doc.save('cable-analysis-report.pdf');
}

function describeControl(mode: string): string {
  switch (mode) {
    case 'INSTALLED_SAG': return 'prescribed installed sag, cut length back-calculated';
    case 'INSTALLED_H': return 'prescribed installed tension, cut length back-calculated';
    case 'UNSTRESSED_LENGTH': return 'cut length prescribed directly';
    case 'RIGID_FIXED_H': return 'H prescribed for every case (rigid, non-physical)';
    default: return mode;
  }
}
