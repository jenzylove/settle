// The evidence board: what a team learns before estimating a feature.
import type { ProofFile, Experiment } from "./prove.ts";
import { PREMIUM_CSS, PREMIUM_FONTS } from "./app/landing-prove.ts";

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const LABEL: Record<string, string> = { proven: "Proven", blocked: "Blocked", unknown: "Unknown" };
const MEANS: Record<string, string> = {
  proven: "Safe to build on. Bob's experiment passed against today's code.",
  blocked: "A landmine. The experiment failed against today's code; this needs work before the feature.",
  unknown: "Not settled. Treat it as a risk in the estimate.",
};

// Minimal markdown for the plan: headings, numbered and bulleted lists, bold, code.
function md(text: string): string {
  const inline = (s: string) => esc(s).replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");
  const out: string[] = [];
  let list: "ol" | "ul" | null = null;
  const close = () => { if (list) { out.push(`</${list}>`); list = null; } };
  for (const raw of text.split("\n")) {
    const line = raw.trimEnd();
    const h = line.match(/^#{1,4}\s+(.*)$/);
    const ol = line.match(/^\s*\d+[.)]\s+(.*)$/);
    const ul = line.match(/^\s*[-*]\s+(.*)$/);
    if (h) { close(); out.push(`<h4>${inline(h[1])}</h4>`); }
    else if (ol) { if (list !== "ol") { close(); out.push("<ol>"); list = "ol"; } out.push(`<li>${inline(ol[1])}</li>`); }
    else if (ul) { if (list !== "ul") { close(); out.push("<ul>"); list = "ul"; } out.push(`<li>${inline(ul[1])}</li>`); }
    else if (line.trim() === "") close();
    else { close(); out.push(`<p>${inline(line)}</p>`); }
  }
  close();
  return out.join("\n");
}

// A short readable title: the assumption without code ticks or parentheticals.
function title(x: Experiment): string {
  const t = x.assumption.replace(/`/g, "").replace(/\s*\([^)]*\)/g, "").split(/(?<=\.)\s/)[0];
  return t.length > 110 ? t.slice(0, 107).replace(/\s+\S*$/, "") + "…" : t;
}

function card(x: Experiment, i: number): string {
  return `<article class="card ${x.status}">
  <div class="head">
    <span class="n">${String(i + 1).padStart(2, "0")}</span>
    <span class="badge ${x.status}">${LABEL[x.status]}</span>
  </div>
  <h3>${esc(title(x))}</h3>
  <p class="plainp">${esc(x.plain)}</p>
  <p class="tech">${esc(x.assumption)}</p>
  <p class="why"><b>Why it matters.</b> ${esc(x.why_risky)}</p>
  <p class="means">${MEANS[x.status]}</p>
  <div class="ev">
    <p class="evk">What Settle saw when it reran Bob's experiment</p>
    <pre>${esc(x.evidence)}</pre>
    ${x.bob_claim ? `<p class="claim">Bob's own read: <b>${esc(x.bob_claim)}</b>${x.bob_evidence ? `. ${esc(x.bob_evidence)}` : ""}</p>` : ""}
  </div>
  ${x.test_code ? `<details><summary>The experiment Bob wrote · ${esc(x.test_file)}</summary><pre class="code">${esc(x.test_code)}</pre></details>` : ""}
  <p class="meta">Branch <code>${esc(x.branch)}</code> · built by Bob in ${Math.floor(x.bob_seconds / 60)}m ${x.bob_seconds % 60}s${x.bob_cost !== undefined ? ` · ${x.bob_cost} Bobcoins` : ""}</p>
</article>`;
}

export function renderProof(d: ProofFile): string {
  const s = d.summary;
  const headline =
    s.blocked > 0
      ? `${s.blocked} of ${d.experiments.length} assumptions are false today. Fix ${s.blocked === 1 ? "it" : "them"} before you estimate.`
      : s.unknown > 0
        ? `No landmines found, but ${s.unknown} assumption${s.unknown === 1 ? "" : "s"} could not be settled.`
        : `Every assumption held. This feature is as easy as it looks.`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Settle Proof</title>
<meta name="description" content="${esc(d.request)}">
${PREMIUM_FONTS}
<style>${PREMIUM_CSS}
.eyebrow { font: 500 12px var(--mono); letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted); }
.muted { color: var(--muted); }
.meta-top { font-size: 13px; color: var(--muted); }
main { padding: 40px 0 96px; }
.req { font: 400 clamp(38px, 5.4vw, 70px)/1.04 var(--serif); letter-spacing: -0.015em; margin: 14px 0 18px; max-width: 22ch; }
.sub { color: var(--muted); max-width: 64ch; margin: 0 0 32px; }
.score { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
.score div { background: var(--card); border-radius: 22px; padding: 24px; box-shadow: 0 0 0 1px var(--line) inset; }
.score div.hot { background: var(--dark); color: #fff; box-shadow: none; }
.score div.hot span { color: #a9a9b0; }
.score strong { display: block; font: 400 64px/1 var(--serif); }
.score span { color: var(--muted); font-size: 14px; }
.headline { font: 400 clamp(26px, 3.2vw, 38px)/1.2 var(--serif); margin: 40px 0 8px; max-width: 30ch; }
.headline em { font-style: italic; color: #75757a; }
.cards { display: grid; gap: 16px; margin-top: 28px; }
.card { background: var(--card); border-radius: 26px; padding: 30px; box-shadow: 0 0 0 1px var(--line) inset; }
.head { display: flex; align-items: center; gap: 14px; margin-bottom: 14px; }
.n { font: 500 13px var(--mono); color: var(--faint); }
.badge { font: 600 11px var(--mono); letter-spacing: 0.1em; text-transform: uppercase; padding: 6px 12px; border-radius: 999px; background: var(--soft); }
.badge.blocked { background: var(--ink); color: #fff; }
.badge.proven { background: #dff5e7; color: #14532d; }
.badge.unknown { background: #e8e8ec; color: #52525b; }
.card h3 { font: 600 21px/1.35 var(--sans); letter-spacing: -0.01em; margin: 0 0 8px; max-width: 60ch; }
.tech { font: 12.5px/1.55 var(--mono); color: var(--muted); margin: 0 0 14px; max-width: 100ch; }
.plainp { margin: 0 0 14px; font-size: 16px; color: #3a3a3f; max-width: 80ch; }
.why, .means { margin: 0 0 8px; max-width: 80ch; }
.means { color: var(--muted); }
.ev { margin-top: 18px; background: var(--dark); color: #e6e6e8; border-radius: 18px; padding: 18px 20px; }
.evk { font: 500 10.5px var(--mono); letter-spacing: 0.12em; text-transform: uppercase; color: #7c7c83; margin: 0 0 8px; }
.ev pre { margin: 0; font: 13px/1.6 var(--mono); white-space: pre-wrap; word-break: break-word; color: #f1f1f3; }
.claim { font-size: 13.5px; color: #a9a9b0; margin: 12px 0 0; }
.claim b { color: #fff; }
details { margin-top: 16px; }
summary { cursor: pointer; font: 500 12px var(--mono); letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); }
pre.code { font: 12.5px/1.55 var(--mono); background: var(--soft); border-radius: 14px; padding: 16px; overflow: auto; max-height: 420px; white-space: pre; margin: 10px 0 0; }
.meta { font-size: 13px; color: var(--muted); margin: 16px 0 0; }
h2 { font: 400 clamp(32px, 4vw, 48px)/1.1 var(--serif); margin: 72px 0 16px; }
h2 em { font-style: italic; color: #75757a; }
.plan { background: var(--card); border-radius: 26px; padding: 12px 32px 28px; box-shadow: 0 0 0 1px var(--line) inset; max-width: 900px; }
.plan h4 { font: 600 18px var(--sans); margin: 24px 0 8px; }
.plan li { margin: 6px 0; }
.plan p, .plan li { color: #3a3a3f; }
.foot { padding: 40px 0; border-top: 1px solid var(--line); font-size: 13px; color: var(--muted); display: flex; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-top: 64px; }
@media (max-width: 720px) { .score { grid-template-columns: minmax(0, 1fr); } .card { padding: 22px; } .plan { padding: 8px 20px 22px; } }
</style>
</head>
<body>
<div class="wrap">
  <nav class="top"><a class="logo" href="../../">Settle</a><span class="meta-top">Proved ${esc(d.created_at.slice(0, 16).replace("T", " "))} UTC · base <code>${esc(d.base_commit.slice(0, 7))}</code></span></nav>
  <main>
    <p class="eyebrow">The feature request</p>
    <h1 class="req">${esc(d.request)}</h1>
    <p class="sub">Before anyone estimated it, IBM Bob named the assumptions most likely to make the estimate wrong, built a small experiment for each against the real code, and Settle reran every experiment itself.</p>
    <div class="score">
      <div><strong>${s.proven}</strong><span>proven, safe to build on</span></div>
      <div class="hot"><strong>${s.blocked}</strong><span>blocked, landmines found</span></div>
      <div><strong>${s.unknown}</strong><span>unknown, still a risk</span></div>
    </div>
    <p class="headline">${esc(headline)}</p>
    <div class="cards">
      ${d.experiments.map(card).join("\n")}
    </div>
    ${d.plan ? `<h2>The plan Bob wrote <em>from the evidence.</em></h2><div class="plan">${md(d.plan)}</div>` : ""}
    <div class="foot"><span>Settle · experiments built by IBM Bob, verified by Settle</span><span>Every experiment is on its own branch. Nothing was merged.</span></div>
  </main>
</div>
</body>
</html>`;
}
