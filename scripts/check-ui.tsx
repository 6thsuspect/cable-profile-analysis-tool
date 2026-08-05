// ============================================================
// Head-less render smoke test.
//   npm run check:ui
// Server-renders every panel for every preset and every load case, and
// generates the PDF report for each preset. Fails if anything throws or if
// "NaN"/"undefined" reaches the output.
// ============================================================
import { renderToStaticMarkup } from 'react-dom/server';
import { solveCable } from '../src/solver/CableSolver';
import { PRESETS } from '../src/solver/presets';
import { exportReport } from '../src/report/pdfExport';
import { InputPanel } from '../src/components/InputPanel';
import { CableDiagram } from '../src/components/CableDiagram';
import { CapacityPanel } from '../src/components/CapacityPanel';
import { LaunchingPanel } from '../src/components/LaunchingPanel';
import { CasesPanel } from '../src/components/CasesPanel';
import { ForceDiagram } from '../src/components/ForceDiagram';
import { ResultsPanel } from '../src/components/ResultsPanel';
import { EquationsRef } from '../src/components/EquationsRef';
import { PointLoadSlider } from '../src/components/PointLoadSlider';
import App from '../src/App';

let fails = 0;
const noop = () => {};

console.log(check('App (default tab)', () => renderToStaticMarkup(<App />)));

for (const preset of PRESETS) {
  const input = preset.build();
  const r = solveCable(input);
  for (const c of r.cases) {
    const panels: [string, () => string][] = [
      ['CableDiagram', () => renderToStaticMarkup(<CableDiagram input={input} result={r} caseResult={c} />)],
      ['CapacityPanel', () => renderToStaticMarkup(<CapacityPanel input={input} result={r} caseResult={c} />)],
      ['ForceDiagram', () => renderToStaticMarkup(<ForceDiagram caseResult={c} />)],
      ['CasesPanel', () => renderToStaticMarkup(<CasesPanel input={input} result={r} selectedId={c.id} onSelect={noop} />)],
    ];
    for (const [name, fn] of panels) {
      const msg = check(`${preset.id} / ${c.id} / ${name}`, fn);
      if (msg.startsWith('FAIL')) console.log(msg);
    }
  }
  for (const [name, fn] of [
    ['InputPanel', () => renderToStaticMarkup(<InputPanel input={input} onChange={noop} />)],
    ['LaunchingPanel', () => renderToStaticMarkup(<LaunchingPanel input={input} result={r} onSetFrontPosition={noop} />)],
    ['ResultsPanel', () => renderToStaticMarkup(<ResultsPanel result={r} />)],
    ['EquationsRef', () => renderToStaticMarkup(<EquationsRef model={input.options.model} verification={r.verification} />)],
    ['PointLoadSlider', () => renderToStaticMarkup(<PointLoadSlider input={input} onSetPointLoadX={noop} onSetPointLoadP={noop} onSetFrontPosition={noop} />)],
  ] as [string, () => string][]) {
    const msg = check(`${preset.id} / ${name}`, fn);
    if (msg.startsWith('FAIL')) console.log(msg);
  }
  try {
    exportReport(input, r);
    console.log(`  ${preset.id}: ${r.cases.length} cases, all panels rendered, PDF generated`);
  } catch (e) {
    fails++;
    console.log(`FAIL ${preset.id} / PDF: ${(e as Error).message}`);
  }
}

function check(label: string, fn: () => string): string {
  try {
    const html = fn();
    if (html.includes('NaN') || html.includes('undefined')) {
      fails++;
      const i = Math.max(html.indexOf('NaN'), html.indexOf('undefined'));
      return `FAIL ${label}: suspicious output near "${html.slice(Math.max(0, i - 90), i + 40)}"`;
    }
    return `ok   ${label} (${html.length} chars)`;
  } catch (e) {
    fails++;
    return `FAIL ${label}: ${(e as Error).message}`;
  }
}

console.log(fails === 0 ? '\nALL PANELS RENDER CLEANLY\n' : `\n${fails} RENDER PROBLEM(S)\n`);
process.exit(fails === 0 ? 0 : 1);
