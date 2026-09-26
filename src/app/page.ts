import { BASE_CSS, FONTS } from "./style.ts";

const APP_CSS = `
main { padding: 48px 0 96px; }
textarea, input { font: inherit; color: var(--fg); background: transparent; border: 0; border-bottom: 1px solid var(--line); border-radius: 0; padding: 10px 0; width: 100%; resize: vertical; }
textarea:disabled, input:disabled { color: var(--fg); -webkit-text-fill-color: var(--fg); opacity: 1; border-bottom-color: transparent; resize: none; }
.q { resize: none; font: 800 clamp(30px, 4.6vw, 56px)/1.06 var(--sans); letter-spacing: -0.035em; margin: 14px 0 6px; }
.ctx { color: var(--muted); font-size: 17px; max-width: 80ch; }
.grid2 { display: grid; grid-template-columns: 1.6fr 1fr; gap: 56px; margin-top: 48px; }
.grid2 .eyebrow { margin-bottom: 8px; }
.opt-row { display: grid; grid-template-columns: 28px 200px 1fr 28px; gap: 16px; align-items: center; border-bottom: 1px solid var(--line); }
.opt-row input { border-bottom: 0; }
.opt-name { font-weight: 600; }
.opt-n { color: var(--muted); }
.x { background: none; border: 0; color: var(--muted); cursor: pointer; font-size: 14px; }
.btn.small { padding: 10px 14px; font-size: 13px; margin-top: 16px; }
.lim { display: flex; justify-content: space-between; align-items: center; gap: 16px; border-bottom: 1px solid var(--line); padding: 8px 0; }
.lim input[type=number] { width: 80px; text-align: right; font-family: var(--mono); border-bottom: 0; }
.lim input[type=checkbox] { width: 18px; height: 18px; accent-color: var(--fg); }
.actions { display: flex; gap: 16px; align-items: center; flex-wrap: wrap; margin-top: 48px; padding-top: 28px; border-top: 1px solid var(--line); }
.actions .muted { font-size: 14px; }

.list { border-top: 1px solid var(--line); margin-top: 14px; }
.run-row { display: grid; grid-template-columns: 170px 1fr 1.2fr 80px; gap: 20px; padding: 20px 0; border-bottom: 1px solid var(--line); text-decoration: none; align-items: baseline; }
.run-row:hover { background: var(--soft); }
.rq { font-weight: 600; }
.rv { color: var(--muted); }
.go { text-align: right; font-weight: 600; }

.run-head { padding-bottom: 28px; border-bottom: 1px solid var(--line); }
.run-head h1 { font: 800 clamp(28px, 4vw, 48px)/1.06 var(--sans); letter-spacing: -0.035em; margin: 14px 0 22px; max-width: 22ch; }
.phases { display: flex; align-items: center; gap: 14px; font: 500 13px var(--mono); letter-spacing: 0.06em; text-transform: uppercase; color: var(--faint); }
.ph.now { color: var(--fg); font-weight: 600; }
.ph.past { color: var(--muted); }
.ph-sep { width: 40px; height: 1px; background: var(--line); }
.speed { margin-top: 18px; font: 500 12px var(--mono); color: var(--muted); display: flex; gap: 8px; align-items: center; }
.speed button { font: inherit; background: none; border: 1px solid var(--line); color: var(--muted); padding: 4px 8px; cursor: pointer; }
.speed button.on { color: var(--fg); border-color: var(--fg); }

.cols { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); border-bottom: 1px solid var(--line); }
.col { padding: 28px 24px 22px; border-right: 1px solid var(--line); display: flex; flex-direction: column; min-height: 420px; }
.col:first-child { padding-left: 0; }
.col:last-child { border-right: 0; padding-right: 0; }
.col h3 { margin: 0 0 6px; font-size: 22px; letter-spacing: -0.02em; }
.col .desc { margin: 0 0 14px; color: var(--muted); font-size: 14px; min-height: 42px; }
.col .status { font-size: 13px; margin: 0 0 16px; color: var(--muted); }
.col.building .status { color: var(--fg); }
.col.win h3 { text-decoration: underline; text-underline-offset: 6px; text-decoration-thickness: 2px; }
.feed { list-style: none; padding: 0; margin: 0; flex: 1; font: 13px/1.5 var(--mono); color: var(--muted); border-top: 1px solid var(--line); }
.feed li { padding: 7px 0; border-bottom: 1px solid var(--line); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.feed li.latest { color: var(--fg); }
.feed li.latest::before { content: "›"; margin-right: 8px; }
.col footer { margin-top: 14px; font-size: 12px; }
.tag { display: inline-block; font: 600 10px/1 var(--mono); letter-spacing: 0.12em; text-transform: uppercase; border: 1px solid var(--strong); padding: 4px 6px; margin-bottom: 10px; }

.measure { padding-top: 32px; overflow-x: auto; }
.measure table { width: 100%; min-width: 680px; border-collapse: collapse; margin-top: 12px; }
.measure th, .measure td { text-align: left; padding: 14px 12px; border-bottom: 1px solid var(--line); font: 500 14px/1.4 var(--mono); }
.measure thead th { font: 500 12px var(--mono); color: var(--muted); letter-spacing: 0.04em; border-bottom: 2px solid var(--strong); }
.measure tbody th { font: 600 15px var(--sans); }
.measure tr.now { background: var(--soft); }
.measure tr.win td, .measure tr.win th { font-weight: 700; }
.verdict-box { padding-top: 40px; }
.verdict-box .vh { font: 700 clamp(24px, 3vw, 36px)/1.15 var(--sans); letter-spacing: -0.02em; margin: 10px 0; }
.verdict-box .muted { max-width: 90ch; margin: 0 0 24px; }
.foot { padding: 40px 0; border-top: 1px solid var(--line); font-size: 13px; color: var(--muted); display: flex; justify-content: space-between; gap: 16px; flex-wrap: wrap; }

@media (max-width: 820px) {
  .grid2 { grid-template-columns: 1fr; gap: 32px; }
  .opt-row { grid-template-columns: 22px 1fr 22px; }
  .opt-row .opt-desc { grid-column: 2 / 4; }
  .run-row { grid-template-columns: 1fr; gap: 4px; }
  .go { text-align: left; }
  .col { border-right: 0; border-bottom: 1px solid var(--line); padding: 24px 0; min-height: 0; }
}
`;

export function appPage({ mode, script, home = "#/" }: { mode: "local" | "static"; script: string; home?: string }): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Settle App</title>
<meta name="description" content="Settle builds every option of a design debate with IBM Bob and shows you the numbers.">
${FONTS}
<style>${BASE_CSS}${APP_CSS}</style>
</head>
<body data-mode="${mode}">
<div class="wrap">
  <header class="bar">
    <a class="brand" href="${home}">Settle</a>
    <nav class="nav">
      <a href="#/" data-route="debate">Debate</a>
      <a href="#/runs" data-route="runs">Runs</a>
      ${mode === "static" ? `<a href="https://github.com/jenzylove/settle">GitHub</a>` : `<span class="muted mono">local</span>`}
    </nav>
  </header>
  <main id="app"></main>
  <footer class="foot"><span>Settle · options built with IBM Bob</span><span>${mode === "static" ? "Recorded runs from a real machine. Run your own with <code>settle ui</code>." : "Running on this machine."}</span></footer>
</div>
<script>${script}</script>
</body>
</html>`;
}
