import type { ProofFile } from "../prove.ts";
import { BASE_CSS, FONTS } from "./style.ts";

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const CSS = `
.hero { text-align: center; padding: 104px 0 72px; }
.hero h1 { font: 800 clamp(42px, 7.4vw, 96px)/0.98 var(--sans); letter-spacing: -0.05em; margin: 22px auto 26px; max-width: 13ch; }
.hero .sub { color: var(--muted); font-size: clamp(17px, 2vw, 21px); max-width: 60ch; margin: 0 auto 34px; }
.ctas { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
.by { margin-top: 22px; font: 500 12px var(--mono); letter-spacing: 0.1em; text-transform: uppercase; color: var(--faint); }
section.band { border-top: 1px solid var(--line); padding: 64px 0; display: grid; grid-template-columns: 240px minmax(0, 1fr); gap: 40px; }
section.band > .eyebrow { padding-top: 8px; }
.band h2 { font: 700 clamp(26px, 3.4vw, 40px)/1.1 var(--sans); letter-spacing: -0.03em; margin: 0 0 26px; max-width: 26ch; }
.story { font-size: 19px; line-height: 1.6; max-width: 62ch; margin: 0 0 18px; }
.steps { counter-reset: s; border-top: 1px solid var(--line); }
.step { display: grid; grid-template-columns: 56px 220px 1fr; gap: 24px; padding: 22px 0; border-bottom: 1px solid var(--line); }
.step::before { counter-increment: s; content: "0" counter(s); font: 500 14px var(--mono); color: var(--muted); padding-top: 3px; }
.step b { font-weight: 600; }
.step span { color: var(--muted); }
.req { font: 700 clamp(22px, 2.6vw, 30px)/1.25 var(--sans); letter-spacing: -0.02em; margin: 0 0 22px; max-width: 34ch; }
.board { border-top: 2px solid var(--strong); }
.item { display: grid; grid-template-columns: 110px minmax(0, 1fr); gap: 24px; padding: 20px 0; border-bottom: 1px solid var(--line); align-items: start; }
.badge { justify-self: start; font: 700 12px var(--mono); letter-spacing: 0.1em; text-transform: uppercase; padding: 5px 9px; border: 1.5px solid var(--fg); }
.badge.blocked { background: var(--fg); color: var(--bg); }
.badge.unknown { border-style: dashed; color: var(--muted); border-color: var(--muted); }
.item h3 { margin: 0 0 6px; font-size: 19px; letter-spacing: -0.01em; }
.item p { margin: 0; color: var(--muted); font-size: 15px; }
.item pre { margin: 10px 0 0; font: 12.5px/1.5 var(--mono); white-space: pre-wrap; word-break: break-word; color: var(--fg); border-left: 3px solid var(--fg); padding-left: 14px; }
.links { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 28px; }
.not { border-top: 1px solid var(--line); }
.not div { display: grid; grid-template-columns: 220px 1fr; gap: 24px; padding: 18px 0; border-bottom: 1px solid var(--line); }
.not b { font-weight: 600; }
.not span { color: var(--muted); }
pre.code { font: 14px/1.7 var(--mono); background: var(--soft); padding: 22px 24px; overflow-x: auto; margin: 0 0 16px; }
footer.end { border-top: 1px solid var(--line); padding: 72px 0 40px; }
footer.end .big { font: 800 clamp(32px, 5vw, 64px)/1 var(--sans); letter-spacing: -0.04em; margin: 0 0 28px; }
footer.end .fine { display: flex; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-top: 56px; font-size: 13px; color: var(--muted); }
@media (max-width: 820px) {
  section.band { grid-template-columns: minmax(0, 1fr); gap: 16px; padding: 48px 0; }
  .step, .not div, .item { grid-template-columns: 1fr; gap: 6px; }
}
`;

export function landingProve(p: ProofFile): string {
  const firstLine = (s: string) => s.split("\n").find((l) => l.trim()) ?? "";
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Settle</title>
<meta name="description" content="Before you estimate a feature, Settle has IBM Bob test the assumptions most likely to make your estimate wrong, against your real code.">
${FONTS}
<style>${BASE_CSS}${CSS}</style>
</head>
<body>
<div class="wrap">
  <header class="bar">
    <a class="brand" href="./">Settle</a>
    <nav class="nav"><a href="#how">How it works</a><a href="runs/${esc(p.id)}/">See a real proof</a><a href="https://github.com/jenzylove/settle">GitHub</a></nav>
  </header>

  <section class="hero">
    <p class="eyebrow">For teams about to estimate a feature</p>
    <h1>Find the landmines before you estimate.</h1>
    <p class="sub">A "two day" feature turns into two weeks because of something nobody knew was in the code. Settle has IBM Bob test the risky parts against your real code first, and shows you what is proven, what is blocked, and why.</p>
    <div class="ctas">
      <a class="btn" href="runs/${esc(p.id)}/">See a real proof</a>
      <a class="btn ghost" href="#how">How it works</a>
    </div>
    <p class="by">Built with IBM Bob</p>
  </section>

  <section class="band">
    <p class="eyebrow">A real example</p>
    <div>
      <p class="req">"${esc(p.request)}"</p>
      <p class="story">Before anyone estimated this, Bob picked the ${p.experiments.length} assumptions most likely to blow up the estimate, wrote a small experiment for each, and Settle ran every experiment against the real code.</p>
      <div class="board">
        ${p.experiments
          .map(
            (x) => `<div class="item"><span class="badge ${x.status}">${x.status}</span><div><h3>${esc(x.plain || x.assumption)}</h3><p>${esc(x.why_risky)}</p>${x.status === "blocked" ? `<pre>${esc(firstLine(x.evidence))}</pre>` : ""}</div></div>`,
          )
          .join("")}
      </div>
      <div class="links"><a class="btn" href="runs/${esc(p.id)}/">Open the full evidence and plan</a></div>
    </div>
  </section>

  <section class="band" id="how">
    <p class="eyebrow">How you use it</p>
    <div>
      <h2>One sentence in, evidence out. On your code, on your machine.</h2>
      <div class="steps">
        <div class="step"><b>Write the feature</b><span>One sentence in <code>prove.yml</code>, like "let customers pay in their own currency".</span></div>
        <div class="step"><b>Bob finds the risks</b><span>Bob reads your code and names the assumptions the feature silently depends on, the ones that cost days if they are wrong.</span></div>
        <div class="step"><b>Bob runs experiments</b><span>One Bob per assumption, all at once, each in its own copy of your repo, writes the smallest test that proves or disproves it.</span></div>
        <div class="step"><b>Settle checks the work</b><span>Settle reruns every experiment itself instead of trusting Bob's word, then Bob writes the plan from what was actually found.</span></div>
      </div>
    </div>
  </section>

  <section class="band">
    <p class="eyebrow">Why not just ask an AI</p>
    <div>
      <h2>An AI can guess what might go wrong. Settle shows you, with a failing test.</h2>
      <div class="not">
        <div><b>A guess</b><span>"Mixed currencies might affect your ranking." Maybe. How much? Nobody knows until someone builds it.</span></div>
        <div><b>Evidence</b><span>A real test against your real code, the exact error or wrong number it produced, and the branch you can open.</span></div>
        <div><b>A checked result</b><span>Bob builds the experiments; Settle reruns them. Experiments may only add files; one that changes any existing file is not trusted.</span></div>
      </div>
    </div>
  </section>

  <section class="band">
    <p class="eyebrow">Run it</p>
    <div>
      <h2>On your repo, with your Bob.</h2>
      <pre class="code">cd your-app                   # a git repo
echo 'request: Add team accounts' > prove.yml
export BOB_API_KEY=...        # IBM Bob Shell, Inference scope
settle prove                  # risks, experiments, evidence, plan</pre>
      <p class="muted">Settle runs next to your code. Nothing is merged; every experiment stays on its own branch.</p>
    </div>
  </section>

  <footer class="end">
    <p class="big">Know before you estimate.</p>
    <a class="btn" href="runs/${esc(p.id)}/">See a real proof</a>
    <div class="fine"><span>Settle · built with IBM Bob for the IBM Bob 2.0 Hackathon</span><span><a href="https://github.com/jenzylove/settle">github.com/jenzylove/settle</a></span></div>
  </footer>
</div>
</body>
</html>`;
}
