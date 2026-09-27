import type { RunFile } from "../engine.ts";
import { esc } from "../view.ts";
import { BASE_CSS, FONTS } from "./style.ts";

const CSS = `
.hero { text-align: center; padding: 104px 0 88px; }
.hero h1 { font: 800 clamp(44px, 8vw, 104px)/0.98 var(--sans); letter-spacing: -0.05em; margin: 22px auto 26px; max-width: 12ch; }
.hero .sub { color: var(--muted); font-size: clamp(17px, 2vw, 21px); max-width: 58ch; margin: 0 auto 36px; }
.ctas { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
.by { margin-top: 22px; font: 500 12px var(--mono); letter-spacing: 0.1em; text-transform: uppercase; color: var(--faint); }
section.band { border-top: 1px solid var(--line); padding: 64px 0; display: grid; grid-template-columns: 240px 1fr; gap: 40px; }
section.band > .eyebrow { padding-top: 8px; }
section.band > div { min-width: 0; }
.stat strong { overflow-wrap: anywhere; }
.band h2 { font: 700 clamp(26px, 3.4vw, 40px)/1.1 var(--sans); letter-spacing: -0.03em; margin: 0 0 28px; max-width: 24ch; }
.rows { border-top: 1px solid var(--line); }
.row { display: grid; grid-template-columns: 200px 1fr; gap: 32px; padding: 20px 0; border-bottom: 1px solid var(--line); }
.row b { font-weight: 600; }
.row span { color: var(--muted); }
.steps { counter-reset: s; border-top: 1px solid var(--line); }
.step { display: grid; grid-template-columns: 56px 200px 1fr; gap: 24px; padding: 22px 0; border-bottom: 1px solid var(--line); }
.step::before { counter-increment: s; content: "0" counter(s); font: 500 14px var(--mono); color: var(--muted); padding-top: 3px; }
.step b { font-weight: 600; }
.step span { color: var(--muted); }
.stats { display: grid; grid-template-columns: repeat(3, 1fr); border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); margin-bottom: 32px; }
.stat { padding: 26px 24px 26px 0; }
.stat + .stat { border-left: 1px solid var(--line); padding-left: 24px; }
.stat strong { display: block; font: 800 clamp(34px, 5vw, 56px)/1 var(--sans); letter-spacing: -0.04em; margin-bottom: 10px; }
.stat span { color: var(--muted); font-size: 14px; }
.mini { width: 100%; border-collapse: collapse; }
.mini th, .mini td { text-align: left; padding: 14px 10px 14px 0; border-bottom: 1px solid var(--line); font: 500 14px var(--mono); }
.mini thead th { color: var(--muted); font-size: 12px; border-bottom: 2px solid var(--strong); }
.mini tbody th { font: 600 15px var(--sans); }
.mini tr.win td, .mini tr.win th { font-weight: 800; }
.tablewrap { overflow-x: auto; }
pre.code { font: 14px/1.7 var(--mono); background: var(--soft); padding: 22px 24px; overflow-x: auto; margin: 0 0 16px; }
.links { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 28px; }
footer.end { border-top: 1px solid var(--line); padding: 72px 0 40px; }
footer.end .big { font: 800 clamp(32px, 5vw, 64px)/1 var(--sans); letter-spacing: -0.04em; margin: 0 0 28px; }
footer.end .fine { display: flex; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-top: 56px; font-size: 13px; color: var(--muted); }
@media (max-width: 820px) {
  section.band { grid-template-columns: 1fr; gap: 16px; padding: 48px 0; }
  .row, .step { grid-template-columns: 1fr; gap: 4px; }
  .step::before { padding: 0; }
  .stats { grid-template-columns: 1fr; }
  .stat + .stat { border-left: 0; border-top: 1px solid var(--line); padding-left: 0; }
}
`;

const ms = (n?: number) => (n === undefined ? "—" : n >= 1000 ? `${(n / 1000).toFixed(2)} s` : `${Math.round(n)} ms`);

export function landingPage(run: RunFile, runId: string): string {
  const winner = run.options.find((o) => o.id === run.verdict.winner);
  const built = run.options.filter((o) => o.built);
  const slowest = Math.max(...built.map((o) => o.bob?.duration_seconds ?? 0));
  const all = [run.baseline, ...run.options];
  const stale = (o: (typeof all)[number]) =>
    !o.freshness ? "—" : o.freshness.timed_out ? `over ${o.freshness.max_seconds} s` : o.freshness.max_seconds < 1 ? "instant" : `${o.freshness.max_seconds} s`;
  const speedup = winner?.load && run.baseline.load ? Math.round(run.baseline.load.p95_ms / winner.load.p95_ms) : null;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Settle</title>
<meta name="description" content="When your team argues about how to build something, Settle builds each option with IBM Bob and shows you the numbers.">
${FONTS}
<style>${BASE_CSS}${CSS}</style>
</head>
<body>
<div class="wrap">
  <header class="bar">
    <a class="brand" href="./">Settle</a>
    <nav class="nav">
      <a href="#how">How it works</a>
      <a href="app/#/run/${esc(runId)}">Watch a run</a>
      <a href="https://github.com/jenzylove/settle">GitHub</a>
    </nav>
  </header>

  <section class="hero">
    <p class="eyebrow">For design reviews</p>
    <h1>Build every option. Then decide.</h1>
    <p class="sub">When your team argues about how to build something, Settle has IBM Bob build every option at once, measures them all the same way, and shows you which one fits your limits.</p>
    <div class="ctas">
      <a class="btn" href="app/#/run/${esc(runId)}">Watch a real run</a>
      <a class="btn ghost" href="runs/${esc(runId)}/">See the results</a>
    </div>
    <p class="by">Built with IBM Bob</p>
  </section>

  <section class="band">
    <p class="eyebrow">The argument</p>
    <div>
      <h2>Cache or materialized view? Queue or direct call? Every team argues. Nobody builds every option.</h2>
      <div class="rows">
        <div class="row"><b>Opinion</b><span>The most senior voice decides, and nobody can check it.</span></div>
        <div class="row"><b>One spike</b><span>An engineer spends days building one option. The others are never built, so there is nothing to compare.</span></div>
        <div class="row"><b>A guess</b><span>Most teams skip even that. A wrong guess shows up months later, under everything built on top of it.</span></div>
      </div>
    </div>
  </section>

  <section class="band" id="how">
    <p class="eyebrow">How it works</p>
    <div>
      <h2>One file, one command, every option built and measured.</h2>
      <div class="steps">
        <div class="step"><b>Write the debate</b><span>The question, the options and your limits in <code>settle.yml</code>. Or paste your design doc into the Settle mode in Bob IDE.</span></div>
        <div class="step"><b>Bob builds each option</b><span>Every option gets its own branch and its own IBM Bob Shell session, all running at once. Each Bob reads your code, builds its option and adds tests.</span></div>
        <div class="step"><b>Same yardstick</b><span>One load test, one freshness probe and your test suite run on every branch, one at a time so nothing competes for the CPU.</span></div>
        <div class="step"><b>A plain verdict</b><span>Meet every limit. Among the options that do, the smallest change wins. Move a limit on the results page and watch the pick change.</span></div>
      </div>
    </div>
  </section>

  <section class="band">
    <p class="eyebrow">A real run</p>
    <div>
      <h2>${esc(run.question)}</h2>
      <div class="stats">
        <div class="stat"><strong>${built.length} of ${run.options.length}</strong><span>options built by Bob in parallel, in ${Math.floor(slowest / 60)}m ${slowest % 60}s</span></div>
        <div class="stat"><strong>${speedup ? `${speedup}×` : "—"}</strong><span>faster at p95 with the picked option</span></div>
        <div class="stat"><strong>${esc(winner?.name ?? "No pick")}</strong><span>${esc(run.verdict.headline)}</span></div>
      </div>
      <div class="tablewrap">
        <table class="mini">
          <thead><tr><th></th><th>p95 latency</th><th>Staleness</th><th>Code changed</th></tr></thead>
          <tbody>
            ${all
              .map(
                (o) => `<tr class="${o.id === run.verdict.winner ? "win" : ""}"><th>${esc(o.name)}</th><td>${ms(o.load?.p95_ms)}</td><td>${stale(o)}</td><td>${o.diff && o.id !== "baseline" ? `+${o.diff.added} −${o.diff.removed}` : "—"}</td></tr>`,
              )
              .join("")}
          </tbody>
        </table>
      </div>
      <div class="links">
        <a class="btn" href="app/#/run/${esc(runId)}">Watch Bob build it</a>
        <a class="btn ghost" href="runs/${esc(runId)}/">Open the results</a>
        <a class="btn ghost" href="app/#/runs">All recorded runs</a>
      </div>
    </div>
  </section>

  <section class="band">
    <p class="eyebrow">Run it</p>
    <div>
      <h2>On your code, with your Bob.</h2>
      <pre class="code">npm install -g ./settle          # from a clone of the repo
cd your-app                      # a git repo with settle.yml
export BOB_API_KEY=...           # IBM Bob Shell, Inference scope
settle ui                        # edit the debate, press Build, watch it live
settle run                       # or straight from the terminal</pre>
      <p class="muted">Settle runs next to your code. Numbers come from your machine and your data.</p>
    </div>
  </section>

  <footer class="end">
    <p class="big">Stop arguing.<br>Build them all.</p>
    <a class="btn" href="app/#/run/${esc(runId)}">Watch a real run</a>
    <div class="fine"><span>Settle · built with IBM Bob for the IBM Bob 2.0 Hackathon</span><span><a href="https://github.com/jenzylove/settle">github.com/jenzylove/settle</a></span></div>
  </footer>
</div>
</body>
</html>`;
}
