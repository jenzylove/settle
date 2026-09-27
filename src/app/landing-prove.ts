import type { ProofFile } from "../prove.ts";
import { keyEvidence } from "../proof-page.ts";

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export const PREMIUM_FONTS = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">`;

export const PREMIUM_CSS = `
:root { --bg: #f4f4f3; --card: #ffffff; --soft: #ececea; --ink: #0d0d0e; --muted: #6d6d72; --faint: #a3a3a8; --line: #e2e2df; --dark: #111113; --dark2: #1b1b1e; --dline: #2b2b2f;
  --serif: "Instrument Serif", Georgia, serif; --sans: "Inter", ui-sans-serif, system-ui, sans-serif; --mono: "JetBrains Mono", ui-monospace, monospace; }
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--ink); font: 16px/1.6 var(--sans); -webkit-font-smoothing: antialiased; }
a { color: inherit; }
code { font-family: var(--mono); font-size: 0.88em; }
.wrap { max-width: 1160px; margin: 0 auto; padding: 0 16px; }
.pill-btn { display: inline-flex; align-items: center; gap: 10px; background: var(--ink); color: #fff; text-decoration: none; font: 600 14px var(--sans); padding: 12px 14px 12px 20px; border-radius: 999px; border: 0; cursor: pointer; }
.pill-btn .arr { display: inline-grid; place-items: center; width: 24px; height: 24px; border-radius: 50%; background: rgba(255,255,255,.16); font-size: 12px; }
.pill-btn.light { background: #fff; color: var(--ink); box-shadow: 0 0 0 1px var(--line) inset; }
.pill-btn.light .arr { background: var(--soft); }
.tag { display: inline-block; font: 500 12px var(--sans); padding: 5px 12px; border-radius: 999px; background: #fff; box-shadow: 0 0 0 1px var(--line) inset; color: var(--ink); }
nav.top { display: flex; justify-content: space-between; align-items: center; padding: 22px 0; }
.logo { font: italic 400 30px var(--serif); text-decoration: none; letter-spacing: -0.01em; }
.links { display: flex; gap: 26px; align-items: center; font-size: 14px; }
.links a { text-decoration: none; color: var(--muted); }
.links a:hover { color: var(--ink); }
.links a.pill-btn { color: #fff; }
.st { justify-self: start; display: inline-block; font: 600 11px var(--mono); letter-spacing: 0.08em; text-transform: uppercase; padding: 5px 10px; border-radius: 999px; background: #fff; color: var(--ink); }
.st.proven { background: #dff5e7; color: #14532d; }
.st.unknown { background: #e8e8ec; color: #52525b; }
@media (max-width: 760px) { .links a:not(.pill-btn) { display: none; } }
`;

const CSS = `
.hero-shell { background: radial-gradient(120% 90% at 50% 0%, #ffffff 0%, #f1f1ef 55%, #e4e4e1 100%); border-radius: 0 0 36px 36px; padding-bottom: 64px; }
.hero { text-align: center; padding: 64px 0 40px; }
.hero h1 { font: 400 clamp(48px, 8.4vw, 108px)/1.0 var(--serif); letter-spacing: -0.02em; margin: 20px auto 26px; max-width: 13.5ch; }
.hero h1 em { font-style: italic; color: #75757a; }
.chip { display: inline-flex; align-items: center; justify-content: center; vertical-align: middle; height: 0.62em; padding: 0 0.32em; border-radius: 999px; margin: -0.16em 0.04em 0; box-shadow: 0 10px 24px rgba(0,0,0,.18), inset 0 0 0 3px rgba(255,255,255,.8); }
.chip span { font: 600 0.2em/1 var(--mono); letter-spacing: 0.08em; font-style: normal; }
.chip.light { background: #fff; color: #0d0d0e; }
.chip.light s { text-decoration-thickness: 0.12em; color: #8a8a90; }
.chip.dark { background: #0d0d0e; color: #fff; }
.chip.blue { background: linear-gradient(135deg, #3a64ff, #1b3fd6); color: #fff; }
.hero p.sub { color: var(--muted); max-width: 52ch; margin: 0 auto 30px; }
.hero .ctas { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; }
.frame { margin: 16px auto 0; max-width: 980px; background: var(--dark); border-radius: 30px; padding: 14px; box-shadow: 0 50px 90px -40px rgba(0,0,0,.55); }
.screen { background: var(--dark2); border-radius: 20px; padding: 26px 28px 12px; color: #eaeaea; text-align: left; }
.screen .bar2 { display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; font: 500 12px var(--mono); color: #8e8e94; margin-bottom: 16px; }
.screen .q { font: 400 clamp(22px, 2.8vw, 32px)/1.2 var(--serif); margin: 0 0 18px; color: #fff; }
.srow { display: grid; grid-template-columns: 100px minmax(0, 1fr); gap: 18px; padding: 14px 0; border-top: 1px solid var(--dline); align-items: start; }
.srow b { display: block; font: 600 15px var(--sans); color: #fff; margin-bottom: 4px; }
.srow code { font: 12.5px/1.5 var(--mono); color: #a9a9b0; white-space: pre-wrap; word-break: break-word; }
.strip { display: flex; justify-content: center; gap: 36px; flex-wrap: wrap; padding: 28px 0 0; color: var(--muted); font-size: 14px; }
.strip span::before { content: ""; display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: var(--ink); margin-right: 10px; vertical-align: 2px; }
section.sec { padding: 96px 0 0; }
.shead { display: flex; justify-content: space-between; align-items: end; gap: 24px; flex-wrap: wrap; margin-bottom: 34px; }
.shead h2 { font: 400 clamp(36px, 4.8vw, 58px)/1.04 var(--serif); letter-spacing: -0.015em; margin: 14px 0 0; max-width: 17ch; }
.shead h2 em { font-style: italic; color: #75757a; }
.shead p { color: var(--muted); max-width: 38ch; margin: 0; font-size: 15px; }
.grid3 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
.grid4 { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; }
.card { background: var(--card); border-radius: 22px; padding: 26px; min-height: 230px; display: flex; flex-direction: column; box-shadow: 0 0 0 1px var(--line) inset; }
.card .num { font: 500 12px var(--mono); color: var(--faint); margin-bottom: 18px; }
.ico { width: 40px; height: 40px; border-radius: 50%; background: var(--ink); color: #fff; display: grid; place-items: center; margin-bottom: 18px; }
.ico svg { width: 18px; height: 18px; }
.card h3 { font: 600 18px var(--sans); letter-spacing: -0.01em; margin: 0 0 8px; }
.card p { color: var(--muted); margin: 0; font-size: 14.5px; }
.card.dark { background: var(--dark); color: #fff; box-shadow: none; }
.card.dark p { color: #a9a9b0; }
.card.dark .ico { background: #fff; color: var(--ink); }
.card .art { margin-top: auto; padding-top: 22px; }
.art-est { display: flex; gap: 8px; align-items: end; height: 56px; }
.art-est i { flex: 1; background: var(--soft); border-radius: 6px; }
.art-slip { font: 400 40px var(--serif); color: #b8b8bc; }
.art-slip b { color: var(--ink); font-weight: 400; font-style: italic; }
.proof-sec { margin-top: 96px; background: var(--dark); color: #fff; border-radius: 36px; padding: 72px 0; }
.proof-sec .shead h2 em { color: #9d9da3; }
.proof-sec .shead p { color: #a9a9b0; }
.proof-sec .tag { background: #1b1b1e; color: #d8d8dc; box-shadow: 0 0 0 1px var(--dline) inset; }
.req { font: 400 clamp(24px, 3vw, 36px)/1.2 var(--serif); margin: 0 0 28px; max-width: 30ch; }
.pgrid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
.pcard { background: var(--dark2); border-radius: 22px; padding: 24px; box-shadow: 0 0 0 1px var(--dline) inset; display: flex; flex-direction: column; gap: 14px; }
.pcard h3 { font: 600 17px/1.35 var(--sans); margin: 0; }
.pcard p { color: #a9a9b0; font-size: 14px; margin: 0; }
.pcard .evi { margin-top: auto; background: #0b0b0c; border-radius: 14px; padding: 14px; font: 12.5px/1.55 var(--mono); color: #e3e3e6; white-space: pre-wrap; word-break: break-word; }
.pcard .evi::before { content: "Settle's rerun"; display: block; font: 500 10.5px var(--mono); letter-spacing: 0.1em; text-transform: uppercase; color: #7c7c83; margin-bottom: 6px; }
.proof-cta { margin-top: 30px; }
.proof-cta .pill-btn { background: #fff; color: var(--ink); }
.proof-cta .pill-btn .arr { background: var(--soft); }
.vs { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
.vs .card { min-height: 0; }
.vs .quote { font: 400 28px/1.25 var(--serif); margin: 6px 0 14px; color: var(--ink); }
.vs .card.dark .quote { font: 13.5px/1.6 var(--mono); color: #e3e3e6; background: #1b1b1e; border-radius: 12px; padding: 14px; }
.steps-run { background: var(--card); border-radius: 22px; box-shadow: 0 0 0 1px var(--line) inset; padding: 26px; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr); gap: 28px; align-items: center; }
.steps-run h3 { font: 600 20px var(--sans); margin: 0 0 10px; }
.steps-run p { color: var(--muted); margin: 0; }
.steps-run pre { margin: 0; background: var(--dark); color: #e6e6e8; border-radius: 16px; padding: 20px 22px; font: 13.5px/1.75 var(--mono); overflow-x: auto; }
.steps-run pre .c { color: #7d7d84; }
.faq { max-width: 820px; }
.faq details { background: var(--card); border-radius: 16px; box-shadow: 0 0 0 1px var(--line) inset; margin-bottom: 10px; }
.faq summary { list-style: none; cursor: pointer; padding: 20px 24px; font: 500 15.5px var(--sans); display: flex; justify-content: space-between; gap: 16px; }
.faq summary::-webkit-details-marker { display: none; }
.faq summary::after { content: "+"; font: 400 22px/1 var(--sans); color: var(--muted); }
.faq details[open] summary::after { content: "–"; }
.faq details p { margin: 0; padding: 0 24px 22px; color: var(--muted); font-size: 15px; }
.cta-big { margin-top: 96px; color: #fff; border-radius: 36px; padding: 88px 24px; text-align: center; background: radial-gradient(80% 120% at 50% 0%, #2a2a31 0%, #111113 62%); }
.cta-big h2 { font: 400 clamp(42px, 6.4vw, 80px)/1.0 var(--serif); margin: 0 0 16px; }
.cta-big h2 em { font-style: italic; color: #9d9da3; }
.cta-big p { color: #a9a9b0; margin: 0 auto 30px; max-width: 46ch; }
.cta-big .pill-btn { background: #fff; color: var(--ink); }
.cta-big .pill-btn .arr { background: var(--soft); }
footer.foot { padding: 64px 0 0; }
.fcols { display: flex; justify-content: space-between; gap: 32px; flex-wrap: wrap; font-size: 14px; color: var(--muted); }
.fcols b { display: block; color: var(--ink); font-weight: 600; margin-bottom: 10px; }
.fcols a { display: block; text-decoration: none; margin: 6px 0; }
.wordmark { font: italic 400 clamp(110px, 27vw, 340px)/0.82 var(--serif); letter-spacing: -0.03em; margin: 48px 0 0; text-align: center; overflow: hidden; }
.fine { display: flex; justify-content: space-between; gap: 16px; flex-wrap: wrap; font-size: 12.5px; color: var(--faint); padding: 18px 0 28px; border-top: 1px solid var(--line); }
@media (max-width: 900px) { .grid4 { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 760px) {
  .grid3, .grid4, .pgrid, .vs, .steps-run { grid-template-columns: minmax(0, 1fr); }
  .srow { grid-template-columns: minmax(0, 1fr); gap: 8px; }
  .card { min-height: 0; }
}
`;

const icon = {
  search: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4-4"/></svg>`,
  flask: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3"/><path d="M7.5 15h9"/></svg>`,
  shield: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 3l7 3v6c0 4.5-3 7.6-7 9-4-1.4-7-4.5-7-9V6z"/><path d="M9 12l2 2 4-4" stroke-linecap="round"/></svg>`,
  map: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M9 4l6 2 5-2v14l-5 2-6-2-5 2V6z"/><path d="M9 4v14M15 6v14"/></svg>`,
};

type X = ProofFile["experiments"][number];
const clip = (t: string, n: number) => (t.length > n ? t.slice(0, n - 1) + "…" : t);
const evidenceLine = (s: string) => clip(evidenceLineRaw(s), 150);
const evidenceLineRaw = (s: string) =>
  s.split("\n").map((l) => l.trim()).find((l) => /error|Assert|expected|got|Actual|columns/i.test(l)) ?? s.split("\n").find((l) => l.trim()) ?? "";
const shortAssumption = (x: X) => {
  // Readable titles: drop code ticks and parenthetical detail, keep one sentence.
  const t = x.assumption.replace(/`/g, "").replace(/\s*\([^)]*\)/g, "").split(/(?<=\.)\s/)[0];
  return t.length > 96 ? t.slice(0, 93).replace(/\s+\S*$/, "") + "…" : t;
};

export function landingProve(p: ProofFile, all: ProofFile[] = [p]): string {
  const tryUrl = `try/`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Settle</title>
<meta name="description" content="Find the landmines before you estimate. Settle has IBM Bob test the risky assumptions behind a feature against your real code.">
${PREMIUM_FONTS}
<style>${PREMIUM_CSS}${CSS}${ACCENT_CSS}</style>
</head>
<body>
<div class="hero-shell">
  <div class="wrap">
    <nav class="top">
      <a class="logo" href="./">Settle</a>
      <div class="links"><a href="#how">How it works</a><a href="#use">Use it in your repo</a><a href="#faq">FAQ</a><a class="pill-btn blue" href="${tryUrl}">Try it <span class="arr">↗</span></a></div>
    </nav>
    <section class="hero">
      <span class="tag dotted">Built with IBM Bob</span>
      <h1>Find the <em>landmines</em> <span class="chip dark" title="Settle's badge for something the feature needs that is not true in the code today"><span>BLOCKED</span></span> before you <em>estimate</em> <span class="chip light" title="The estimate that would have been wrong"><span><s>2 days</s></span></span></h1>
      <p class="sub">A "two day" feature becomes two weeks because of something nobody knew was in the code. Before your team commits to a date, Settle has IBM Bob check the risky parts against your real code, and shows you what will get in the way.</p>
      <div class="ctas">
        <a class="pill-btn blue" href="${tryUrl}">Try it <span class="arr">↗</span></a>
        <a class="pill-btn light" href="#use">Use it in your repo <span class="arr">↓</span></a>
      </div>
    </section>
    <div class="strip"><span>About four minutes per feature</span><span>Runs on your code, on your machine</span><span>Every result rerun by Settle</span><span>Nothing is merged</span></div>
  </div>
</div>

<div class="wrap">
  <section class="sec">
    <div class="shead">
      <div><span class="tag dotted">The problem</span><h2>Estimating a feature is <em>guesswork.</em></h2></div>
      <p>The problems are only found by building, so they are found after the date is promised.</p>
    </div>
    <div class="grid3">
      <div class="card lift"><span class="num">/01</span><h3>Estimate</h3><p>A manager asks for a feature. Engineers read the code and guess: "about two days."</p><div class="art"><div class="art-est"><i style="height:40%"></i><i style="height:55%"></i><i style="height:35%"></i><i style="height:60%"></i></div></div></div>
      <div class="card lift"><span class="num">/02</span><h3>Build</h3><p>Days in, something in the code gets in the way that nobody knew was there.</p><div class="art"><div class="art-est"><i style="height:40%"></i><i style="height:55%"></i><i class="hot" style="height:100%"></i><i style="height:60%"></i></div></div></div>
      <div class="card lift"><span class="num">/03</span><h3>Slip</h3><p>The date moves, and the team trusts its next estimate a little less.</p><div class="art"><div class="art-slip"><s>2 days</s> <b>2 weeks</b></div></div></div>
    </div>
  </section>

  <section class="sec" id="how">
    <div class="shead">
      <div><span class="tag dotted">How it works</span><h2>Bob investigates. <em>Settle checks.</em></h2></div>
      <p>A spike your team would spend days on, done against your real code in about four minutes.</p>
    </div>
    <div class="flow">
      <div class="fstep"><span class="fnum">1</span><div><h3>Name the feature</h3><p>The thing you are about to estimate, like "let customers delete their account".</p></div></div>
      <div class="fstep"><span class="fnum">2</span><div><h3>Bob finds what it depends on</h3><p>Bob reads the code the feature touches and lists what must be true for it to be as easy as it looks.</p></div></div>
      <div class="fstep"><span class="fnum">3</span><div><h3>Bob tests each one, at once</h3><p>One Bob per item, each in its own copy of your repo, writes a real test against today's code.</p></div></div>
      <div class="fstep hot"><span class="fnum">4</span><div><h3>Settle checks Bob's work</h3><p>Every test is rerun by Settle, never taken on Bob's word. Tests may only add files, never change yours.</p></div></div>
      <div class="fstep"><span class="fnum">5</span><div><h3>You get the answer and a plan</h3><p>What is safe, what will get in the way and why, and a plan with the problems first.</p></div></div>
    </div>
  </section>
</div>

<section class="proof-sec" id="try">
  <div class="wrap">
    <div class="shead">
      <div><span class="tag">Try it</span><h2>Pick a feature. <em>Watch Bob check it.</em></h2></div>
      <p>Real recorded runs of Settle on a small demo online store. Pick what a manager just asked for and see what would have gone wrong.</p>
    </div>
    <div class="tgrid">
      ${all
        .map(
          (x) => `<a class="topt" href="${tryUrl}?run=${esc(x.id)}"><small>Feature request</small><b>"${esc(x.request)}"</b><span class="res">${x.summary.blocked ? `${x.summary.blocked} landmine${x.summary.blocked === 1 ? "" : "s"} found` : "No landmines"} <span class="go">Watch it run ↗</span></span></a>`,
        )
        .join("")}
    </div>
  </div>
</section>

<div class="wrap">
  <section class="sec" id="use">
    <div class="shead">
      <div><span class="tag dotted">Use it in your repo</span><h2>Add it to your team's <em>planning.</em></h2></div>
      <p>Settle runs next to your code with your IBM Bob. Nothing is merged; every test stays on its own branch.</p>
    </div>
    <div class="use">
      <div class="ustep"><span class="unum">1</span><div><h3>Install</h3><p>Node 24, git, and IBM Bob Shell with an API key.</p><pre>git clone https://github.com/jenzylove/settle
cd settle && npm install && npm link
export BOB_API_KEY=...   <span class="c"># Bob Shell, Inference scope</span></pre></div></div>
      <div class="ustep"><span class="unum">2</span><div><h3>Name the feature</h3><p>A <code>prove.yml</code> in the app you are estimating.</p><pre>request: Let customers delete their account.
context: Customers want a "delete my account" button.
experiment:
  command: node --import tsx --test {file}</pre></div></div>
      <div class="ustep"><span class="unum">3</span><div><h3>Run it</h3><p>About four minutes later you get the results page and the plan.</p><pre>settle prove
<span class="c"># runs/prove-.../index.html   results page</span>
<span class="c"># runs/prove-.../proof.json   for your tools</span></pre></div></div>
      <div class="ustep"><span class="unum">4</span><div><h3>Or run it on every feature ticket</h3><p>An example GitHub Actions job that proves a feature when a ticket is labelled estimate.</p><pre>on:
  issues: { types: [labeled] }
jobs:
  prove:
    if: github.event.label.name == 'estimate'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      <span class="c"># install IBM Bob Shell per bob.ibm.com/docs/shell</span>
      - run: git clone https://github.com/jenzylove/settle ../settle && npm --prefix ../settle ci
      - run: echo "request: \${{ github.event.issue.title }}" > prove.yml && node ../settle/bin/settle.mjs prove
        env: { BOB_API_KEY: \${{ secrets.BOB_API_KEY }} }</pre></div></div>
    </div>
  </section>

  <section class="sec">
    <div class="shead">
      <div><span class="tag dotted">Why not just ask an AI</span><h2>A guess, or a <em>failing test.</em></h2></div>
      <p>An AI can tell you what might go wrong. Settle shows you what does, in your code, today.</p>
    </div>
    <div class="vs">
      <div class="card"><h3>Asking an AI</h3><p class="quote">"Deleting accounts might affect existing orders."</p><p>Maybe. How, and how badly? Nobody knows until someone builds it.</p></div>
      <div class="card dark"><h3>Settle</h3><p class="quote">${esc(p.experiments.find((x) => x.status === "blocked") ? keyEvidence(p.experiments.find((x) => x.status === "blocked")!) : "")}</p><p>A real test against real code, rerun by Settle, on a branch you can open.</p></div>
    </div>
  </section>

  <section class="sec faq" id="faq">
    <div class="shead"><div><span class="tag dotted">FAQ</span><h2>Questions, <em>answered.</em></h2></div></div>
    <details><summary>Is this a chatbot?</summary><p>No. You name a feature and Settle runs experiments on your code. What you get back is tests that passed or failed, the exact errors, and a plan written from them.</p></details>
    <details><summary>Can I run it on my code from this website?</summary><p>No, and that is on purpose: Settle has to run next to your code, with your Bob. The Try it page replays real runs on our demo store so you can see exactly what you would get.</p></details>
    <details><summary>Why trust what Bob found?</summary><p>You don't have to. Settle reruns every test itself, and any test that changes an existing file is marked untrusted. Each finding shows the rerun output, Bob's own read, and the test code.</p></details>
    <details><summary>Does it change my code?</summary><p>No. Experiments run in separate git worktrees and may only add files. Nothing is merged.</p></details>
    <details><summary>What does it cost?</summary><p>About four minutes and about three Bobcoins per feature: one Bob session to find the risks, one per risk, and one to write the plan.</p></details>
  </section>

  <section class="cta-big">
    <h2>Know <em>before</em> you estimate.</h2>
    <p>Pick a feature request and watch Settle find what would have gone wrong.</p>
    <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap"><a class="pill-btn blue" href="${tryUrl}">Try it <span class="arr">↗</span></a><a class="pill-btn" href="#use">Use it in your repo <span class="arr">↓</span></a></div>
  </section>

  <footer class="foot">
    <div class="fcols">
      <div style="max-width:320px"><b>Settle</b>Find the landmines before you estimate. Tests built by IBM Bob, checked by Settle.</div>
      <div><b>Product</b><a href="${tryUrl}">Try it</a><a href="#how">How it works</a><a href="#use">Use it in your repo</a></div>
      <div><b>Project</b><a href="https://github.com/jenzylove/settle">GitHub</a><a href="#faq">FAQ</a><a href="compare/">Design comparison</a></div>
    </div>
    <div class="wordmark">settle</div>
    <div class="fine"><span>Built for the IBM Bob 2.0 Hackathon</span><span>MIT license</span></div>
  </footer>
</div>
</body>
</html>`;
}

const ACCENT_CSS = `
:root { --accent: #2f5bff; --accent-soft: #e8edff; }
.pill-btn.blue { background: var(--accent); }
.tag.dotted::before { content: ""; display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: var(--accent); margin-right: 8px; vertical-align: 2px; }
.shead h2 em, .cta-big h2 em { color: var(--accent); }
.strip span::before { background: var(--accent); }
.art-est i.hot { background: var(--accent); }
.art-slip b { color: var(--accent); }
.card.lift { transition: transform .25s ease, box-shadow .25s ease; }
.card.lift:hover { transform: translateY(-4px); box-shadow: 0 0 0 1px #cfd6ff inset, 0 18px 40px -24px rgba(47,91,255,.45); }
.flow { display: grid; gap: 0; border-radius: 26px; background: var(--card); box-shadow: 0 0 0 1px var(--line) inset; overflow: hidden; }
.fstep { display: grid; grid-template-columns: 56px minmax(0, 1fr); gap: 18px; padding: 22px 26px; border-top: 1px solid var(--line); transition: background .25s ease; }
.fstep:first-child { border-top: 0; }
.fstep:hover { background: #fafaff; }
.fstep h3 { margin: 0 0 4px; font: 600 17px var(--sans); }
.fstep p { margin: 0; color: var(--muted); font-size: 15px; }
.fnum { width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center; background: var(--soft); font: 600 15px var(--sans); }
.fstep.hot { background: var(--accent-soft); }
.fstep.hot .fnum { background: var(--accent); color: #fff; }
.tgrid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px; }
.topt { display: flex; flex-direction: column; gap: 10px; text-decoration: none; background: var(--dark2); border-radius: 24px; padding: 26px; box-shadow: 0 0 0 1px var(--dline) inset; transition: transform .25s ease, box-shadow .25s ease; }
.topt:hover { transform: translateY(-4px); box-shadow: 0 0 0 1.5px var(--accent) inset, 0 24px 50px -30px rgba(47,91,255,.6); }
.topt small { font: 500 11px var(--mono); letter-spacing: .1em; text-transform: uppercase; color: #7c7c83; }
.topt b { font: 400 30px/1.2 var(--serif); color: #fff; }
.topt .res { display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-top: auto; padding-top: 10px; font: 600 13px var(--sans); color: #c9d4ff; }
.topt .go { color: #fff; background: var(--accent); padding: 6px 12px; border-radius: 999px; }
.use { display: grid; gap: 12px; }
.ustep { display: grid; grid-template-columns: 56px minmax(0, 1fr); gap: 18px; background: var(--card); border-radius: 22px; padding: 24px 26px; box-shadow: 0 0 0 1px var(--line) inset; }
.unum { width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center; background: var(--accent); color: #fff; font: 600 15px var(--sans); }
.ustep h3 { margin: 0 0 4px; font: 600 17px var(--sans); }
.ustep p { margin: 0 0 12px; color: var(--muted); font-size: 15px; }
.ustep pre { margin: 0; background: var(--dark); color: #e6e6e8; border-radius: 14px; padding: 16px 18px; font: 13px/1.7 var(--mono); overflow-x: auto; }
.ustep pre .c { color: #7d7d84; }
@media (max-width: 760px) { .fstep, .ustep { grid-template-columns: minmax(0, 1fr); gap: 10px; padding: 20px; } }
`;
