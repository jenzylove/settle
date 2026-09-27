import { buildSync } from "esbuild";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { RunFile } from "./engine.ts";
import { esc, renderAppendix, renderMap, renderOptions, renderTable, renderVerdict } from "./view.ts";

export { renderAppendix };

let clientJs: string | undefined;

// The page re-decides in the browser with the exact verdict code the CLI
// uses, bundled from src/client.ts at render time.
function client(): string {
  if (clientJs) return clientJs;
  const out = buildSync({
    entryPoints: [join(dirname(fileURLToPath(import.meta.url)), "client.ts")],
    bundle: true,
    format: "iife",
    target: "es2020",
    minify: true,
    write: false,
  });
  clientJs = out.outputFiles[0].text;
  return clientJs;
}

// Keeps the embedded JSON from closing the script element early.
const safeJson = (value: unknown) => JSON.stringify(value).replace(/</g, "\\u003c");

export function renderReport(data: RunFile): string {
  const built = data.options.filter((o) => o.built).length;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Settle Results</title>
<meta name="description" content="${esc(data.question)}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
:root {
  --bg: #ffffff; --fg: #0b0b0c; --muted: #6b6b70; --line: #e4e4e7; --soft: #f5f5f6; --faint: #a1a1a6; --strong: #0b0b0c;
  --sans: "Inter Tight", ui-sans-serif, system-ui, sans-serif; --mono: "JetBrains Mono", ui-monospace, monospace;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) { --bg: #0b0b0c; --fg: #f4f4f5; --muted: #9a9aa2; --line: #26262b; --soft: #141417; --faint: #5c5c62; --strong: #f4f4f5; }
}
:root[data-theme="dark"] { --bg: #0b0b0c; --fg: #f4f4f5; --muted: #9a9aa2; --line: #26262b; --soft: #141417; --faint: #5c5c62; --strong: #f4f4f5; }
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--fg); font: 16px/1.55 var(--sans); -webkit-font-smoothing: antialiased; }
.wrap { max-width: 1180px; margin: 0 auto; padding: 0 16px; }
header.bar { display: flex; justify-content: space-between; align-items: center; padding: 20px 0; border-bottom: 1px solid var(--line); font-size: 14px; }
.tagline { margin-left: 10px; }
@media (max-width: 720px) { .tagline { display: none; } }
.brand { font-weight: 800; letter-spacing: -0.02em; font-size: 18px; }
.muted { color: var(--muted); }
.hero { text-align: center; padding: 72px 0 40px; }
.eyebrow { font: 500 12px/1 var(--mono); letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted); }
h1 { font-size: clamp(32px, 5.4vw, 64px); line-height: 1.04; letter-spacing: -0.035em; font-weight: 800; margin: 18px auto 18px; max-width: 16ch; }
.sub { color: var(--muted); max-width: 60ch; margin: 0 auto; }
.verdict { border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); padding: 36px 0; display: grid; grid-template-columns: 200px 1fr; gap: 24px; }
.verdict .k { font: 500 12px/1.4 var(--mono); letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted); padding-top: 8px; }
.verdict p { margin: 0; color: var(--muted); max-width: 80ch; }
.verdict .h { font-size: clamp(22px, 3vw, 32px); font-weight: 700; letter-spacing: -0.02em; line-height: 1.15; margin: 0 0 10px; color: var(--fg); }
.tablewrap { overflow-x: auto; margin: 40px 0 8px; }
table { border-collapse: collapse; width: 100%; min-width: 720px; }
th, td { text-align: left; padding: 16px 14px; border-bottom: 1px solid var(--line); vertical-align: top; }
thead th { border-bottom: 2px solid var(--strong); font-weight: 600; font-size: 15px; padding-top: 0; }
thead th.win { border-bottom-width: 4px; }
tbody th { font-weight: 500; width: 210px; }
.rl { display: block; }
.rn { display: block; font: 400 12px/1.4 var(--mono); color: var(--muted); margin-top: 2px; }
td { font: 500 15px/1.4 var(--mono); white-space: nowrap; }
td.base { color: var(--muted); }
td.win { font-weight: 600; background: var(--soft); }
th.win { background: var(--soft); }
.mk { display: inline-block; margin-left: 8px; font-family: var(--sans); font-weight: 800; }
.mk.no { color: var(--muted); }
.tag { display: inline-block; font: 600 10px/1 var(--mono); letter-spacing: 0.12em; text-transform: uppercase; border: 1px solid var(--strong); padding: 4px 6px; margin-right: 8px; vertical-align: 2px; }
.oname { white-space: nowrap; }
.legend { font: 400 12px/1.5 var(--mono); color: var(--muted); }
h2 { font-size: 13px; font: 500 12px/1 var(--mono); letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted); margin: 64px 0 8px; }
.opts { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 0 32px; border-top: 1px solid var(--line); }
.opt { padding: 24px 0; border-bottom: 1px solid var(--line); }
.opt h3 { margin: 0 0 8px; font-size: 20px; letter-spacing: -0.01em; }
.opt p { margin: 0 0 10px; color: var(--muted); }
.opt .err { color: var(--fg); font-weight: 600; }
.meta { font-size: 13px; }
code { font-family: var(--mono); font-size: 0.86em; }
.files { list-style: none; padding: 0; margin: 0; font-size: 13px; color: var(--muted); }
.appx { position: relative; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }
.appx pre { margin: 0; padding: 24px 0; overflow-x: auto; font: 13px/1.6 var(--mono); color: var(--muted); white-space: pre; }
button { font: 600 14px/1 var(--sans); background: var(--fg); color: var(--bg); border: 0; padding: 12px 18px; cursor: pointer; margin-top: 16px; }
button:focus-visible { outline: 2px solid var(--fg); outline-offset: 3px; }
footer { padding: 56px 0 40px; font-size: 13px; color: var(--muted); display: flex; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
@media (max-width: 720px) {
  .verdict { grid-template-columns: 1fr; gap: 8px; }
  .hero { padding: 48px 0 28px; }
}
button.ghost { background: transparent; color: var(--fg); border: 1px solid var(--line); margin: 0; padding: 8px 12px; font-size: 13px; }
.mapsec { padding: 36px 0 12px; border-bottom: 1px solid var(--line); }
.maphead { display: flex; justify-content: space-between; align-items: flex-end; gap: 24px; flex-wrap: wrap; margin-bottom: 8px; }
.maphead .k { font: 500 12px/1.4 var(--mono); letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted); margin: 0 0 8px; }
.mapnote { margin: 0; color: var(--muted); max-width: 70ch; }
.map { position: relative; touch-action: none; user-select: none; -webkit-user-select: none; }
.map svg { width: 100%; height: auto; display: block; overflow: visible; }
.map .zone { fill: var(--soft); }
.map .gl { stroke: var(--line); stroke-width: 1; }
.map .ax { stroke: var(--strong); stroke-width: 1.5; }
.map .tk { font: 500 13px var(--mono); fill: var(--muted); }
.map .at { font: 500 12px var(--mono); fill: var(--muted); letter-spacing: 0.04em; }
.map .ll { stroke: var(--fg); stroke-width: 2; stroke-dasharray: 6 5; }
.map .drag { fill: transparent; }
.map .lim-x .drag, .map .lim-x .knob { cursor: ew-resize; }
.map .lim-y .drag, .map .lim-y .knob { cursor: ns-resize; }
.map .knob { fill: var(--fg); }
.map .kt { font: 600 12px var(--mono); fill: var(--bg); pointer-events: none; }
.map g:focus { outline: none; }
.map .lim-x:focus-visible .knob, .map .lim-y:focus-visible .knob { stroke: var(--muted); stroke-width: 4; }
.map .pt:focus-visible .mk { stroke-width: 4; }
.map .hit { fill: transparent; }
.map .ld { stroke: var(--faint); stroke-width: 1; }
.map .mk { stroke: var(--fg); stroke-width: 2; fill: var(--bg); }
.map .pt.win .mk { fill: var(--fg); }
.map .pt.no .mk { stroke: var(--faint); }
.map .pt.base .mk { stroke: var(--faint); stroke-dasharray: 3 3; }
.map .pl { font: 700 17px var(--sans); fill: var(--fg); letter-spacing: -0.01em; }
.map .pt.no .pl, .map .pt.base .pl { fill: var(--muted); font-weight: 600; }
.map .pv { font: 500 12px var(--mono); fill: var(--muted); }
.tip { position: absolute; pointer-events: none; background: var(--fg); color: var(--bg); font: 500 12px/1.5 var(--mono); padding: 8px 10px; white-space: nowrap; transform: translate(-50%, calc(-100% - 14px)); }
.tip b { font: 700 13px var(--sans); display: block; }
.opts { grid-template-columns: 1fr !important; }
.opt { display: grid; grid-template-columns: 300px minmax(0, 1fr); column-gap: 40px; align-items: start; }
.opt > * { grid-column: 1; min-width: 0; }
.opt > .codebox { grid-column: 2; grid-row: 1 / span 12; }
.codebox summary { cursor: pointer; font: 500 12px var(--mono); letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); padding: 4px 0 10px; }
.codebox[open] summary { color: var(--fg); }
pre.code { margin: 0; font: 12.5px/1.6 var(--mono); overflow: auto; max-height: 460px; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); padding: 12px 0; white-space: pre; }
pre.code .cf { display: block; font-weight: 600; color: var(--fg); padding: 10px 0 4px; }
pre.code .ch { display: block; color: var(--faint); }
pre.code .ca { display: block; background: var(--soft); color: var(--fg); }
pre.code .cd { display: block; color: var(--faint); text-decoration: line-through; }
pre.code .cc { display: block; color: var(--muted); }
@media (max-width: 820px) { .opt { grid-template-columns: 1fr; } .opt > .codebox { grid-column: 1; grid-row: auto; } .map .pv { display: none; } }
</style>
</head>
<body>
<div class="wrap">
  <header class="bar">
    <span><span class="brand">Settle</span> <span class="muted tagline">builds every option with IBM Bob, then measures them</span></span>
    <span class="muted">${esc(data.created_at.slice(0, 16).replace("T", " "))} UTC · base <code>${esc(data.base_commit.slice(0, 7))}</code></span>
  </header>

  <section class="hero">
    <div class="eyebrow">The question</div>
    <h1>${esc(data.question)}</h1>
    <p class="sub">${built} of ${data.options.length} options built by IBM Bob in parallel, each in its own branch, then measured with the same ${data.load.duration_seconds} second load test at concurrency ${data.load.concurrency}.</p>
  </section>

  <section class="verdict" id="verdict" aria-live="polite">
${renderVerdict(data)}
  </section>

  <section class="mapsec">
    <div class="maphead">
      <div>
        <p class="k">Decision map</p>
        <p class="mapnote">Each dot is one option Bob built. Drag the two lines to set your limits. Anything in the shaded corner is good enough, and the smallest change in there wins.</p>
      </div>
      <div class="readout"><button type="button" class="ghost" id="reset" hidden>Back to recorded limits</button></div>
    </div>
    <div class="map" id="map">
${renderMap(data)}
      <div class="tip" id="tip" hidden></div>
    </div>
  </section>

  <div class="tablewrap" id="table">
${renderTable(data)}
  </div>
  <p class="legend">✓ meets the constraint · ✕ misses it · first column is today's code, for reference</p>

  <h2>The options</h2>
  <div class="opts" id="options">
${renderOptions(data)}
  </div>

  <h2>Design doc appendix</h2>
  <div class="appx"><pre id="appendix">${esc(renderAppendix(data))}</pre></div>
  <button id="copy" type="button">Copy appendix</button>

  <footer>
    <span>Settle · options built with IBM Bob</span>
    <span>Numbers from this machine, this data, this run.</span>
  </footer>
</div>
<script type="application/json" id="run-data">${safeJson(data)}</script>
<script>${client()}</script>
</body>
</html>
`;
}
