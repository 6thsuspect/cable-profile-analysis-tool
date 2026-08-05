// ============================================================
// PDF Report Generation using jsPDF
// ============================================================
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { CableInput, AnalysisResult } from '../types';

const RAD = 180 / Math.PI;

// Draw cable profile diagram directly on PDF
function drawCableProfileFigure(
  doc: jsPDF,
  input: CableInput,
  result: AnalysisResult,
  startY: number
): number {
  const { geometry } = input;
  const { profile, leftTower, rightTower, maxSag } = result;

  // Figure dimensions in mm
  const figX = 14;
  const figY = startY;
  const figW = 182; // page width - margins
  const figH = 70;

  // Draw border
  doc.setDrawColor(100, 100, 100);
  doc.setLineWidth(0.3);
  doc.rect(figX, figY, figW, figH);

  // Calculate bounds
  let minX = Math.min(leftTower.anchorX, 0);
  let maxX = Math.max(rightTower.anchorX, geometry.L);
  let minY = Infinity;
  let maxY = -Infinity;

  for (const pt of profile) {
    if (pt.y < minY) minY = pt.y;
    if (pt.y > maxY) maxY = pt.y;
  }

  minY = Math.min(minY, leftTower.anchorY, rightTower.anchorY) - 2;
  maxY = Math.max(maxY, geometry.yL, geometry.yR) + 2;

  const padX = (maxX - minX) * 0.08;
  const padY = (maxY - minY) * 0.15;
  minX -= padX; maxX += padX;
  minY -= padY; maxY += padY;

  // Scale functions
  const scaleX = (x: number) => figX + 5 + ((x - minX) / (maxX - minX)) * (figW - 10);
  const scaleY = (yVal: number) => figY + figH - 5 - ((yVal - minY) / (maxY - minY)) * (figH - 10);

  // Find max sag point
  const chordSlope = (geometry.yR - geometry.yL) / geometry.L;
  let maxSagPt = profile[0];
  let maxSagVal = 0;
  for (const pt of profile) {
    const chordY = geometry.yL + chordSlope * pt.x;
    const sag = chordY - pt.y;
    if (sag > maxSagVal) {
      maxSagVal = sag;
      maxSagPt = pt;
    }
  }

  // Draw grid lines
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.1);
  for (let i = 1; i < 5; i++) {
    const gx = figX + (figW * i) / 5;
    doc.line(gx, figY, gx, figY + figH);
  }
  for (let i = 1; i < 4; i++) {
    const gy = figY + (figH * i) / 4;
    doc.line(figX, gy, figX + figW, gy);
  }

  // Draw towers
  doc.setDrawColor(60, 60, 80);
  doc.setLineWidth(1.5);
  // Left tower
  doc.line(scaleX(0), scaleY(minY + padY * 0.5), scaleX(0), scaleY(geometry.yL));
  // Right tower
  doc.line(scaleX(geometry.L), scaleY(minY + padY * 0.5), scaleX(geometry.L), scaleY(geometry.yR));

  // Draw backstays (dashed)
  doc.setDrawColor(230, 120, 50);
  doc.setLineWidth(0.8);
  doc.setLineDashPattern([2, 1], 0);
  doc.line(scaleX(0), scaleY(geometry.yL), scaleX(leftTower.anchorX), scaleY(leftTower.anchorY));
  doc.line(scaleX(geometry.L), scaleY(geometry.yR), scaleX(rightTower.anchorX), scaleY(rightTower.anchorY));
  doc.setLineDashPattern([], 0);

  // Draw anchor points
  doc.setFillColor(230, 120, 50);
  doc.circle(scaleX(leftTower.anchorX), scaleY(leftTower.anchorY), 1.2, 'F');
  doc.circle(scaleX(rightTower.anchorX), scaleY(rightTower.anchorY), 1.2, 'F');

  // Draw chord line (dashed)
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.3);
  doc.setLineDashPattern([1.5, 1], 0);
  doc.line(scaleX(0), scaleY(geometry.yL), scaleX(geometry.L), scaleY(geometry.yR));
  doc.setLineDashPattern([], 0);

  // Draw main cable
  doc.setDrawColor(30, 80, 180);
  doc.setLineWidth(1);
  for (let i = 1; i < profile.length; i++) {
    doc.line(
      scaleX(profile[i - 1].x), scaleY(profile[i - 1].y),
      scaleX(profile[i].x), scaleY(profile[i].y)
    );
  }

  // Draw tower pulleys
  doc.setFillColor(30, 60, 140);
  doc.circle(scaleX(0), scaleY(geometry.yL), 1.5, 'F');
  doc.circle(scaleX(geometry.L), scaleY(geometry.yR), 1.5, 'F');

  // Draw point loads
  doc.setDrawColor(200, 40, 40);
  doc.setFillColor(200, 40, 40);
  doc.setLineWidth(0.8);
  for (const plr of result.pointLoadResults) {
    const px = scaleX(plr.load.x);
    const py = scaleY(plr.yp);
    // Arrow line
    doc.line(px, py - 8, px, py);
    // Arrow head
    doc.triangle(px, py, px - 1.5, py - 3, px + 1.5, py - 3, 'F');
    // Label
    doc.setFontSize(6);
    doc.setTextColor(180, 30, 30);
    doc.text(`${plr.load.label}`, px + 2, py - 6);
  }

  // Draw max sag point and annotation
  const sagX = scaleX(maxSagPt.x);
  const sagY = scaleY(maxSagPt.y);
  const chordYAtSag = geometry.yL + chordSlope * maxSagPt.x;
  const chordYScaled = scaleY(chordYAtSag);

  // Sag measurement line
  doc.setDrawColor(130, 80, 200);
  doc.setLineWidth(0.5);
  doc.setLineDashPattern([1, 0.5], 0);
  doc.line(sagX, chordYScaled, sagX, sagY);
  doc.setLineDashPattern([], 0);

  // Max sag point marker
  doc.setFillColor(130, 80, 200);
  doc.circle(sagX, sagY, 1.5, 'F');

  // Sag annotation
  doc.setFontSize(7);
  doc.setTextColor(100, 60, 160);
  doc.text(`Max Sag = ${maxSag.toFixed(2)} m`, sagX + 3, (chordYScaled + sagY) / 2 + 1);
  doc.text(`at x = ${maxSagPt.x.toFixed(1)} m`, sagX + 3, (chordYScaled + sagY) / 2 + 4);

  // Labels
  doc.setFontSize(7);
  doc.setTextColor(30, 60, 140);
  doc.text('Tower A', scaleX(0) - 5, scaleY(geometry.yL) - 4);
  doc.text('Tower B', scaleX(geometry.L) - 5, scaleY(geometry.yR) - 4);

  doc.setTextColor(200, 100, 30);
  doc.setFontSize(6);
  doc.text('Anchor A', scaleX(leftTower.anchorX) - 8, scaleY(leftTower.anchorY) + 4);
  doc.text('Anchor B', scaleX(rightTower.anchorX) + 1, scaleY(rightTower.anchorY) + 4);

  // Figure title
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.text('Cable Profile with Maximum Sag Point', figX + figW / 2, figY + figH + 5, { align: 'center' });

  // Legend
  doc.setFontSize(6);
  doc.setFont('helvetica', 'normal');
  const legendY = figY + figH + 9;
  
  // Cable
  doc.setDrawColor(30, 80, 180);
  doc.setLineWidth(1);
  doc.line(figX + 10, legendY, figX + 20, legendY);
  doc.setTextColor(30, 80, 180);
  doc.text('Main Cable', figX + 22, legendY + 1);

  // Backstay
  doc.setDrawColor(230, 120, 50);
  doc.setLineWidth(0.8);
  doc.setLineDashPattern([2, 1], 0);
  doc.line(figX + 50, legendY, figX + 60, legendY);
  doc.setLineDashPattern([], 0);
  doc.setTextColor(200, 100, 30);
  doc.text('Backstay', figX + 62, legendY + 1);

  // Max Sag
  doc.setFillColor(130, 80, 200);
  doc.circle(figX + 95, legendY, 1, 'F');
  doc.setTextColor(100, 60, 160);
  doc.text('Max Sag Point', figX + 98, legendY + 1);

  // Point Load
  if (result.pointLoadResults.length > 0) {
    doc.setFillColor(200, 40, 40);
    doc.triangle(figX + 140, legendY + 1, figX + 138.5, legendY - 2, figX + 141.5, legendY - 2, 'F');
    doc.setTextColor(180, 30, 30);
    doc.text('Point Load', figX + 144, legendY + 1);
  }

  doc.setTextColor(0, 0, 0);

  return figY + figH + 15; // Return next Y position
}

export function exportReport(input: CableInput, result: AnalysisResult) {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageW = 210;
  let y = 15;

  const addTitle = (text: string) => {
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(text, pageW / 2, y, { align: 'center' });
    y += 10;
  };

  const addSubtitle = (text: string) => {
    if (y > 270) { doc.addPage(); y = 15; }
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(text, 14, y);
    y += 7;
  };

  const addText = (text: string) => {
    if (y > 275) { doc.addPage(); y = 15; }
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(text, pageW - 28);
    doc.text(lines, 14, y);
    y += lines.length * 4.5;
  };

  // Title
  addTitle('Cable Profile & Point-Load Analysis Report');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated: ${new Date().toLocaleString()}`, pageW / 2, y, { align: 'center' });
  y += 8;

  doc.text(`Model: ${result.model === 'PARABOLIC_HORIZONTAL_LOAD' ? 'Parabolic (UDL per horizontal projection)' : 'Catenary (self-weight per cable length)'}`, 14, y);
  y += 8;

  // Cable Profile Figure
  addSubtitle('1. Cable Profile Diagram');
  y = drawCableProfileFigure(doc, input, result, y);
  y += 5;

  // Input Parameters
  addSubtitle('2. Input Parameters');

  autoTable(doc, {
    startY: y,
    head: [['Parameter', 'Symbol', 'Value', 'Unit']],
    body: [
      ['Left tower elevation', 'yL', input.geometry.yL.toFixed(2), 'm'],
      ['Right tower elevation', 'yR', input.geometry.yR.toFixed(2), 'm'],
      ['Horizontal span', 'L', input.geometry.L.toFixed(2), 'm'],
      ['Left backstay length', 'La', input.geometry.La.toFixed(2), 'm'],
      ['Right backstay length', 'Ra', input.geometry.Ra.toFixed(2), 'm'],
      ['Left anchor angle', 'aL', input.geometry.alphaL.toFixed(2), 'deg'],
      ['Right anchor angle', 'aR', input.geometry.alphaR.toFixed(2), 'deg'],
      ['Cable unit weight (horiz)', 'w', input.cable.w.toFixed(4), 'kN/m'],
      ['Cable unit weight (length)', 'gamma', input.cable.gamma.toFixed(4), 'kN/m'],
      ['Horizontal tension', 'H', (input.H_input > 0 ? input.H_input : result.H).toFixed(2), 'kN'],
    ],
    styles: { fontSize: 8 },
    headStyles: { fillColor: [41, 65, 122] },
    margin: { left: 14, right: 14 },
  });
  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  // Point Loads
  if (input.pointLoads.length > 0) {
    addSubtitle('3. Point Loads');
    autoTable(doc, {
      startY: y,
      head: [['Label', 'x (m)', 'P (kN)']],
      body: input.pointLoads.map(pl => [pl.label, pl.x.toFixed(2), pl.P.toFixed(2)]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [41, 65, 122] },
      margin: { left: 14, right: 14 },
    });
    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  }

  // Results Summary
  addSubtitle('4. Results Summary');
  autoTable(doc, {
    startY: y,
    head: [['Parameter', 'Value', 'Unit']],
    body: [
      ['Horizontal tension H', result.H.toFixed(2), 'kN'],
      ['Left cable angle (theta L)', (result.thetaLeft * RAD).toFixed(2), 'deg'],
      ['Right cable angle (theta R)', (result.thetaRight * RAD).toFixed(2), 'deg'],
      ['Max sag', result.maxSag.toFixed(4), 'm'],
      ['Sag / Span ratio', `1/${(1 / result.sagRatio).toFixed(1)}`, '-'],
      ['Cable length', result.cableLength.toFixed(4), 'm'],
    ],
    styles: { fontSize: 8 },
    headStyles: { fillColor: [41, 65, 122] },
    margin: { left: 14, right: 14 },
  });
  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  // Maximum Forces Summary
  addSubtitle('5. Maximum Forces Summary');
  autoTable(doc, {
    startY: y,
    head: [['Parameter', 'Value', 'Unit']],
    body: [
      ['Max Cable Tension', result.maxForces.maxTension.toFixed(2), 'kN'],
      ['Location', result.maxForces.maxTensionDescription, '-'],
      ['x coordinate', result.maxForces.maxTensionLocation.toFixed(2), 'm'],
      ['Tower A - Horizontal (H)', result.maxForces.towerA_H.toFixed(2), 'kN'],
      ['Tower A - Vertical (V)', result.maxForces.towerA_V.toFixed(2), 'kN'],
      ['Tower A - Resultant (R)', result.maxForces.towerA_R.toFixed(2), 'kN'],
      ['Tower B - Horizontal (H)', result.maxForces.towerB_H.toFixed(2), 'kN'],
      ['Tower B - Vertical (V)', result.maxForces.towerB_V.toFixed(2), 'kN'],
      ['Tower B - Resultant (R)', result.maxForces.towerB_R.toFixed(2), 'kN'],
    ],
    styles: { fontSize: 8 },
    headStyles: { fillColor: [128, 90, 213] },
    margin: { left: 14, right: 14 },
  });
  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  // Point Load Results
  if (result.pointLoadResults.length > 0) {
    addSubtitle('6. Point-Load Results');
    for (const plr of result.pointLoadResults) {
      if (y > 250) { doc.addPage(); y = 15; }
      autoTable(doc, {
        startY: y,
        head: [[`Load "${plr.load.label}" at x = ${plr.load.x.toFixed(2)} m, P = ${plr.load.P.toFixed(2)} kN`, '', '']],
        body: [
          ['Cable elevation yp', plr.yp.toFixed(4), 'm'],
          ['Slope left of load', plr.slopeLeft.toFixed(6), '-'],
          ['Slope right of load', plr.slopeRight.toFixed(6), '-'],
          ['Angle left (theta L)', (plr.thetaLeft * RAD).toFixed(2), 'deg'],
          ['Angle right (theta R)', (plr.thetaRight * RAD).toFixed(2), 'deg'],
          ['Tension left TL', plr.T_left.toFixed(2), 'kN'],
          ['Tension right TR', plr.T_right.toFixed(2), 'kN'],
          ['Equilibrium check H*(mR-mL)', plr.equilibriumCheck.toFixed(2), 'kN'],
        ],
        styles: { fontSize: 8 },
        headStyles: { fillColor: [100, 100, 160] },
        margin: { left: 14, right: 14 },
      });
      y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 5;
    }
    y += 3;
  }

  // Tower Results
  addSubtitle('7. Tower / Pulley Results');
  for (const tw of [result.leftTower, result.rightTower]) {
    if (y > 250) { doc.addPage(); y = 15; }
    autoTable(doc, {
      startY: y,
      head: [[`${tw.side === 'left' ? 'Left' : 'Right'} Tower`, '', '']],
      body: [
        ['Main cable angle', (tw.thetaMain * RAD).toFixed(2), 'deg'],
        ['Main cable tension T', tw.T_main.toFixed(2), 'kN'],
        ['Main cable H', tw.H_main.toFixed(2), 'kN'],
        ['Main cable V', tw.V_main.toFixed(2), 'kN'],
        ['Backstay tension T', tw.T_backstay.toFixed(2), 'kN'],
        ['Backstay H', tw.H_backstay.toFixed(2), 'kN'],
        ['Backstay V', tw.V_backstay.toFixed(2), 'kN'],
        ['Resultant R', tw.R.toFixed(2), 'kN'],
        ['Resultant direction', (tw.thetaR * RAD).toFixed(2), 'deg'],
      ],
      styles: { fontSize: 8 },
      headStyles: { fillColor: [41, 122, 65] },
      margin: { left: 14, right: 14 },
    });
    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 5;
  }

  // Calculation Steps
  if (y > 250) { doc.addPage(); y = 15; }
  addSubtitle('8. Calculation Steps');
  for (const step of result.calculationSteps) {
    addText(step);
  }

  // Warnings
  if (result.warnings.length > 0) {
    if (y > 250) { doc.addPage(); y = 15; }
    addSubtitle('9. Warnings');
    for (const w of result.warnings) {
      addText(`WARNING: ${w}`);
    }
  }

  doc.save('cable-analysis-report.pdf');
}
