// The results dashboard: one clear answer first, three findings you can open,
// the raw evidence tucked away for engineers, the next steps as a checklist.
import type { ProofFile, Experiment } from "./prove.ts";
import { PREMIUM_CSS, PREMIUM_FONTS } from "./app/landing-prove.ts";

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const firstSentence = (s: string) => (s.match(/^.*?[.!?](\s|$)/)?.[0] ?? s).trim();

// The line of test output that says what went wrong, in one line.
export function keyEvidence(x: Experiment): string {
  const lines = x.evidence.split("\n").map((l) => l.trim()).filter(Boolean);
  const hit = lines.find((l) => /^error:|AssertionError|Expected|expected|got |Actual|out of range|violates|constraint/i.test(l)) ?? lines[0] ?? "";
  const clean = hit.replace(/^AssertionError \[ERR_ASSERTION\]:\s*/, "").replace(/^Assumption BROKEN:\s*/i, "");
  return clean.length > 160 ? clean.slice(0, 157) + "…" : clean;
}

export function findingTitle(x: Experiment): string {
  const t = firstSentence(x.plain || x.assumption).replace(/`/g, "");
  return t.length > 120 ? t.slice(0, 117).replace(/\s+\S*$/, "") + "…" : t;
}

const LABEL: Record<string, string> = { proven: "Safe", blocked: "Blocker", unknown: "Unsure" };

// Plan steps: the numbered items under the "Plan" heading, else all numbered items.
function planSteps(md: string): string[] {
  const lines = md.split("\n");
  const start = lines.findIndex((l) => /^#+\s*.*plan/i.test(l) && !/implementation plan/i.test(l));
  const scope = start >= 0 ? lines.slice(start + 1) : lines;
  const steps: string[] = [];
  for (const l of scope) {
    if (start >= 0 && /^#+\s/.test(l) && steps.length) break;
    const m = l.match(/^\s*\d+[.)]\s+(.*)$/);
    if (m) steps.push(m[1].replace(/\*\*/g, "").replace(/`/g, ""));
  }
  return steps.slice(0, 8);
}

function inline(s: string) {
  return esc(s);
}

function finding(x: Experiment, i: number): string {
  return `<details class="f ${x.status}" style="--d:${i * 90}ms">
  <summary>
    <span class="dot"></span>
    <span class="flabel">${LABEL[x.status]}</span>
    <span class="ftitle">${esc(findingTitle(x))}</span>
    <span class="chev" aria-hidden="true"></span>
  </summary>
  <div class="fbody">
    <div class="fgrid">
      <div>
        <p class="k">Why it matters</p>
        <p>${esc(x.why_risky)}</p>
      </div>
      <div>
        <p class="k">What Bob's test found</p>
        <p class="proofline">${esc(keyEvidence(x))}</p>
        <p class="small">Settle reran the test itself and got the same result${x.bob_claim ? ` Bob reported (${esc(x.bob_claim)})` : ""}.</p>
      </div>
    </div>
    <div class="more">
      ${x.test_code ? `<details class="sub"><summary>See the test Bob wrote</summary><pre class="code">${esc(x.test_code)}</pre></details>` : ""}
      <details class="sub"><summary>See the full test output</summary><pre class="code">${esc(x.evidence)}</pre></details>
      <p class="small">Branch <code>${esc(x.branch)}</code> · built by Bob in ${Math.floor(x.bob_seconds / 60)}m ${x.bob_seconds % 60}s</p>
    </div>
  </div>
</details>`;
}

export function renderProof(d: ProofFile): string {
  const s = d.summary;
  const n = d.experiments.length;
  const answer =
    s.blocked > 0 ? `Harder than it looks.` : s.unknown > 0 ? `Probably fine, with open questions.` : `As easy as it looks.`;
  const sub =
    s.blocked > 0
      ? `Bob tested ${n} things this feature depends on. ${s.blocked} of them ${s.blocked === 1 ? "is" : "are"} not true in the code today. Fix ${s.blocked === 1 ? "it" : "them"} first, then estimate.`
      : s.unknown > 0
        ? `Bob tested ${n} things this feature depends on. None failed, but ${s.unknown} could not be settled.`
        : `Bob tested ${n} things this feature depends on, and every one held against the real code.`;
  const steps = planSteps(d.plan);
  const totalSecs = d.experiments.reduce((m, x) => Math.max(m, x.bob_seconds), 0) + d.plan_seconds + 60;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Settle Results</title>
<meta name="description" content="${esc(d.request)}">
${PREMIUM_FONTS}
<style>${PREMIUM_CSS}
:root { --accent: #2f5bff; --accent-soft: #e8edff; }
main { padding: 24px 0 96px; }
.top-actions { display: flex; gap: 10px; align-items: center; }
.pill-btn.blue { background: var(--accent); }
.hero2 { background: radial-gradient(120% 120% at 0% 0%, #ffffff 0%, #f1f1ef 60%, #e9e9e6 100%); border-radius: 32px; padding: 44px 44px 40px; box-shadow: 0 0 0 1px var(--line) inset; animation: rise .6s ease both; }
.req-tag { display: inline-flex; align-items: center; gap: 8px; font: 500 12px var(--sans); padding: 6px 12px; border-radius: 999px; background: #fff; box-shadow: 0 0 0 1px var(--line) inset; }
.req-tag::before { content: ""; width: 7px; height: 7px; border-radius: 50%; background: var(--accent); }
.req2 { font: 400 clamp(30px, 4vw, 48px)/1.1 var(--serif); margin: 18px 0 30px; max-width: 26ch; }
.answer { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 28px; align-items: center; padding-top: 28px; border-top: 1px solid var(--line); }
.big { font: 400 clamp(84px, 11vw, 140px)/0.85 var(--serif); color: var(--accent); }
.answer h1 { font: 400 clamp(30px, 3.6vw, 44px)/1.1 var(--serif); margin: 0 0 8px; }
.answer h1 em { font-style: italic; color: var(--accent); }
.answer p { color: var(--muted); margin: 0; max-width: 56ch; }
.chips { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 16px; }
.cchip { display: inline-flex; align-items: center; gap: 8px; font: 600 13px var(--sans); padding: 7px 14px; border-radius: 999px; background: #fff; box-shadow: 0 0 0 1px var(--line) inset; }
.cchip i { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
.cchip.blocked i, .f.blocked .dot { background: var(--accent); }
.cchip.proven i, .f.proven .dot { background: #22a55b; }
.cchip.unknown i, .f.unknown .dot { background: #b0b0b6; }
h2.sec2 { font: 400 clamp(28px, 3vw, 38px)/1.1 var(--serif); margin: 56px 0 6px; }
h2.sec2 em { font-style: italic; color: var(--accent); }
.lead { color: var(--muted); margin: 0 0 20px; }
.f { background: var(--card); border-radius: 22px; box-shadow: 0 0 0 1px var(--line) inset; margin-bottom: 12px; transition: box-shadow .25s ease, transform .25s ease; animation: rise .55s ease both; animation-delay: var(--d); }
.f:hover { box-shadow: 0 0 0 1px #cfd6ff inset, 0 12px 30px -18px rgba(47,91,255,.35); transform: translateY(-1px); }
.f[open] { box-shadow: 0 0 0 1.5px var(--accent) inset; }
.f > summary { list-style: none; cursor: pointer; display: grid; grid-template-columns: 12px 96px minmax(0, 1fr) 24px; gap: 16px; align-items: center; padding: 22px 24px; }
.f > summary::-webkit-details-marker { display: none; }
.dot { width: 12px; height: 12px; border-radius: 50%; box-shadow: 0 0 0 5px var(--accent-soft); }
.f.proven .dot { box-shadow: 0 0 0 5px #dcf5e6; }
.f.unknown .dot { box-shadow: 0 0 0 5px #ececef; }
.flabel { font: 600 12px var(--mono); letter-spacing: 0.06em; text-transform: uppercase; color: var(--accent); }
.f.proven .flabel { color: #15803d; }
.f.unknown .flabel { color: #6b6b72; }
.ftitle { font: 600 17px/1.4 var(--sans); }
.chev { width: 24px; height: 24px; border-radius: 50%; background: var(--soft); position: relative; transition: transform .25s ease, background .25s ease; }
.chev::before { content: ""; position: absolute; left: 8px; top: 7px; width: 6px; height: 6px; border-right: 2px solid var(--ink); border-bottom: 2px solid var(--ink); transform: rotate(45deg); }
.f[open] .chev { transform: rotate(180deg); background: var(--accent-soft); }
.fbody { padding: 0 24px 24px 152px; animation: fade .35s ease both; }
.fgrid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 28px; }
.k { font: 600 12px var(--mono); letter-spacing: 0.06em; text-transform: uppercase; color: var(--faint); margin: 0 0 8px; }
.fbody p { margin: 0 0 8px; color: #3a3a3f; font-size: 15px; }
.proofline { font: 500 13.5px/1.55 var(--mono) !important; background: var(--dark); color: #f1f1f3 !important; padding: 14px 16px; border-radius: 14px; }
.small { font-size: 13px !important; color: var(--muted) !important; }
.more { margin-top: 16px; border-top: 1px solid var(--line); padding-top: 14px; }
.sub > summary { cursor: pointer; font: 500 13px var(--sans); color: var(--accent); margin: 6px 0; }
pre.code { font: 12.5px/1.55 var(--mono); background: var(--soft); border-radius: 14px; padding: 16px; overflow: auto; max-height: 380px; white-space: pre; margin: 8px 0 12px; }
.steps2 { counter-reset: st; display: grid; gap: 10px; }
.step2 { counter-increment: st; display: grid; grid-template-columns: 36px minmax(0, 1fr); gap: 14px; align-items: start; background: var(--card); border-radius: 18px; padding: 16px 18px; box-shadow: 0 0 0 1px var(--line) inset; animation: rise .5s ease both; animation-delay: var(--d); }
.step2::before { content: counter(st); width: 30px; height: 30px; border-radius: 50%; background: var(--accent); color: #fff; display: grid; place-items: center; font: 600 13px var(--sans); }
.step2 span { font-size: 15px; color: #2b2b30; padding-top: 4px; }
.cta-row { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 44px; }
.meta2 { margin-top: 56px; padding-top: 16px; border-top: 1px solid var(--line); font-size: 12.5px; color: var(--faint); display: flex; gap: 16px; flex-wrap: wrap; justify-content: space-between; }
@keyframes rise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
@keyframes fade { from { opacity: 0; } to { opacity: 1; } }
@media (max-width: 760px) {
  .hero2 { padding: 28px 22px; }
  .answer { grid-template-columns: minmax(0, 1fr); gap: 10px; }
  .f > summary { grid-template-columns: 12px minmax(0, 1fr) 24px; }
  .flabel { display: none; }
  .fbody { padding: 0 20px 20px; }
  .fgrid { grid-template-columns: minmax(0, 1fr); }
}
</style>
</head>
<body>
<div class="wrap">
  <nav class="top">
    <a class="logo" href="../../">Settle</a>
    <div class="top-actions"><a class="pill-btn light" href="../../try/">Try another <span class="arr">↻</span></a><a class="pill-btn blue" href="../../#use">Use it in your repo <span class="arr">↗</span></a></div>
  </nav>
  <main>
    <section class="hero2">
      <span class="req-tag">Feature request</span>
      <p class="req2">"${esc(d.request)}"</p>
      <div class="answer">
        <div class="big">${s.blocked || s.proven}</div>
        <div>
          <h1>${s.blocked > 0 ? `${s.blocked} blocker${s.blocked === 1 ? "" : "s"}. <em>${esc(answer)}</em>` : `<em>${esc(answer)}</em>`}</h1>
          <p>${esc(sub)}</p>
          <div class="chips">
            <span class="cchip blocked"><i></i>${s.blocked} blocker${s.blocked === 1 ? "" : "s"}</span>
            <span class="cchip proven"><i></i>${s.proven} safe</span>
            <span class="cchip unknown"><i></i>${s.unknown} unsure</span>
          </div>
        </div>
      </div>
    </section>

    <h2 class="sec2">What Bob <em>checked</em></h2>
    <p class="lead">Each one is something the feature needs to be true. Open it to see why it matters and the proof.</p>
    ${d.experiments.map(finding).join("\n")}

    ${steps.length ? `<h2 class="sec2">What to do <em>next</em></h2><p class="lead">Bob's plan, written from what the tests actually found. Blockers first.</p><div class="steps2">${steps.map((t, i) => `<div class="step2" style="--d:${i * 70}ms"><span>${inline(t)}</span></div>`).join("")}</div>` : ""}

    <div class="cta-row">
      <a class="pill-btn blue" href="../../#use">Run this on your repo <span class="arr">↗</span></a>
      <a class="pill-btn light" href="../../try/">Try another request <span class="arr">↻</span></a>
    </div>

    <div class="meta2"><span>A real recorded run · about ${Math.round(totalSecs / 60)} minutes · every experiment on its own branch, nothing merged</span><span>base ${esc(d.base_commit.slice(0, 7))}</span></div>
  </main>
</div>
</body>
</html>`;
}
