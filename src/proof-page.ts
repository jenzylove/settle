// The evidence board: what a team learns before estimating a feature.
import type { ProofFile, Experiment } from "./prove.ts";
import { BASE_CSS, FONTS } from "./app/style.ts";

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

function card(x: Experiment, i: number): string {
  return `<article class="card ${x.status}">
  <div class="head">
    <span class="n">${String(i + 1).padStart(2, "0")}</span>
    <span class="badge ${x.status}">${LABEL[x.status]}</span>
  </div>
  <h3>${esc(x.plain || x.assumption)}</h3>
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
${FONTS}
<style>${BASE_CSS}
main { padding: 56px 0 96px; }
.req { font: 800 clamp(30px, 4.6vw, 54px)/1.06 var(--sans); letter-spacing: -0.035em; margin: 14px 0 18px; max-width: 24ch; }
.sub { color: var(--muted); max-width: 70ch; margin: 0 0 36px; }
.score { display: grid; grid-template-columns: repeat(3, 1fr); border-top: 2px solid var(--strong); border-bottom: 1px solid var(--line); }
.score div { padding: 22px 20px 22px 0; }
.score div + div { border-left: 1px solid var(--line); padding-left: 20px; }
.score strong { display: block; font: 800 56px/1 var(--sans); letter-spacing: -0.04em; }
.score span { color: var(--muted); font-size: 14px; }
.headline { font: 700 clamp(22px, 2.8vw, 32px)/1.2 var(--sans); letter-spacing: -0.02em; margin: 34px 0 8px; max-width: 34ch; }
.cards { display: grid; gap: 0; margin-top: 28px; border-top: 1px solid var(--line); }
.card { padding: 30px 0; border-bottom: 1px solid var(--line); display: grid; grid-template-columns: 1fr; }
.head { display: flex; align-items: center; gap: 14px; margin-bottom: 12px; }
.n { font: 500 13px var(--mono); color: var(--muted); }
.badge { font: 700 12px var(--mono); letter-spacing: 0.1em; text-transform: uppercase; padding: 5px 9px; border: 1.5px solid var(--fg); }
.badge.proven { background: transparent; }
.badge.blocked { background: var(--fg); color: var(--bg); }
.badge.unknown { border-style: dashed; color: var(--muted); border-color: var(--muted); }
.card h3 { font: 700 24px/1.25 var(--sans); letter-spacing: -0.02em; margin: 0 0 6px; max-width: 46ch; }
.tech { font: 13px/1.5 var(--mono); color: var(--muted); margin: 0 0 14px; max-width: 90ch; }
.why, .means { margin: 0 0 8px; max-width: 80ch; }
.means { color: var(--muted); }
.ev { margin-top: 14px; border-left: 3px solid var(--fg); padding: 4px 0 4px 18px; }
.card.proven .ev { border-left-color: var(--line); }
.evk { font: 500 12px var(--mono); letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); margin: 0 0 6px; }
.ev pre { margin: 0; font: 13px/1.55 var(--mono); white-space: pre-wrap; word-break: break-word; }
.claim { font-size: 14px; color: var(--muted); margin: 10px 0 0; }
details { margin-top: 16px; }
summary { cursor: pointer; font: 500 12px var(--mono); letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); }
pre.code { font: 12.5px/1.55 var(--mono); background: var(--soft); padding: 16px; overflow: auto; max-height: 420px; white-space: pre; margin: 10px 0 0; }
.meta { font-size: 13px; color: var(--muted); margin: 14px 0 0; }
h2 { font: 500 12px/1 var(--mono); letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted); margin: 64px 0 12px; }
.plan { border-top: 1px solid var(--line); padding-top: 12px; max-width: 80ch; }
.plan h4 { font: 700 18px var(--sans); margin: 22px 0 8px; }
.plan li { margin: 6px 0; }
.foot { padding: 40px 0; border-top: 1px solid var(--line); font-size: 13px; color: var(--muted); display: flex; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-top: 56px; }
@media (max-width: 720px) { .score { grid-template-columns: 1fr; } .score div + div { border-left: 0; border-top: 1px solid var(--line); padding-left: 0; } }
</style>
</head>
<body>
<div class="wrap">
  <header class="bar"><a class="brand" href="../../">Settle</a><span class="muted">Proved ${esc(d.created_at.slice(0, 16).replace("T", " "))} UTC · base <code>${esc(d.base_commit.slice(0, 7))}</code></span></header>
  <main>
    <p class="eyebrow">The feature request</p>
    <h1 class="req">${esc(d.request)}</h1>
    <p class="sub">Before anyone estimated it, IBM Bob named the assumptions most likely to make the estimate wrong, built a small experiment for each against the real code, and Settle reran every experiment itself.</p>
    <div class="score">
      <div><strong>${s.proven}</strong><span>proven, safe to build on</span></div>
      <div><strong>${s.blocked}</strong><span>blocked, landmines found</span></div>
      <div><strong>${s.unknown}</strong><span>unknown, still a risk</span></div>
    </div>
    <p class="headline">${esc(headline)}</p>
    <div class="cards">
      ${d.experiments.map(card).join("\n")}
    </div>
    ${d.plan ? `<h2>The plan Bob wrote from the evidence</h2><div class="plan">${md(d.plan)}</div>` : ""}
    <div class="foot"><span>Settle · experiments built by IBM Bob, verified by Settle</span><span>Every experiment is on its own branch. Nothing was merged.</span></div>
  </main>
</div>
</body>
</html>`;
}
