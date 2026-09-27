// Try it: pick a feature request, watch a real recorded Settle run unfold
// step by step, then open its results. Replays the run's own event log.
import type { ProofFile } from "../prove.ts";
import { PREMIUM_CSS, PREMIUM_FONTS } from "./landing-prove.ts";
import { findingTitle, keyEvidence } from "../proof-page.ts";

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function tryPage(proofs: ProofFile[]): string {
  const data = proofs.map((p) => ({
    id: p.id,
    request: p.request,
    summary: p.summary,
    findings: Object.fromEntries(p.experiments.map((x) => [x.id, { title: findingTitle(x), status: x.status, proof: keyEvidence(x) }])),
  }));
  const safe = JSON.stringify(data).replace(/</g, "\\u003c");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Try Settle</title>
<meta name="description" content="Pick a feature request and watch Settle have IBM Bob test the risky parts against real code.">
${PREMIUM_FONTS}
<style>${PREMIUM_CSS}
:root { --accent: #2f5bff; --accent-soft: #e8edff; }
.pill-btn.blue { background: var(--accent); }
main { padding: 16px 0 96px; }
.head { text-align: center; padding: 40px 0 28px; }
.head h1 { font: 400 clamp(40px, 6vw, 72px)/1.02 var(--serif); margin: 14px auto 12px; max-width: 16ch; }
.head h1 em { font-style: italic; color: var(--accent); }
.head p { color: var(--muted); max-width: 54ch; margin: 0 auto; }
.pick { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 14px; margin: 24px 0 8px; }
.opt { text-align: left; font: inherit; color: inherit; background: var(--card); border: 0; border-radius: 22px; padding: 22px 24px; box-shadow: 0 0 0 1px var(--line) inset; cursor: pointer; transition: box-shadow .2s ease, transform .2s ease; }
.opt:hover { transform: translateY(-2px); box-shadow: 0 0 0 1px #cfd6ff inset, 0 14px 30px -20px rgba(47,91,255,.4); }
.opt.on { box-shadow: 0 0 0 2px var(--accent) inset; }
.opt small { font: 500 12px var(--mono); color: var(--faint); letter-spacing: .06em; text-transform: uppercase; }
.opt b { display: block; font: 400 26px/1.2 var(--serif); margin: 8px 0 0; }
.stage { margin-top: 28px; background: var(--dark); color: #eee; border-radius: 30px; padding: 30px; min-height: 420px; box-shadow: 0 40px 80px -40px rgba(0,0,0,.5); }
.steps { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 22px; }
.sp { font: 500 12.5px var(--sans); padding: 7px 14px; border-radius: 999px; background: #1d1d21; color: #8d8d94; transition: all .3s ease; }
.sp.now { background: var(--accent); color: #fff; }
.sp.done { background: #26262b; color: #d6d6db; }
.said { font: 400 clamp(22px, 2.6vw, 30px)/1.25 var(--serif); color: #fff; margin: 0 0 20px; min-height: 1.3em; }
.ticker { font: 13px/1.6 var(--mono); color: #9a9aa2; min-height: 22px; margin-bottom: 18px; }
.ticker b { color: #fff; font-weight: 500; }
.rows { display: grid; gap: 10px; }
.row { display: grid; grid-template-columns: 14px minmax(0, 1fr) auto; gap: 14px; align-items: start; background: #18181b; border-radius: 18px; padding: 16px 18px; box-shadow: 0 0 0 1px #26262b inset; animation: rise .45s ease both; }
.row .dot { width: 12px; height: 12px; border-radius: 50%; margin-top: 5px; background: #4b4b52; }
.row.busy .dot { background: #fff; animation: pulse 1s ease infinite; }
.row.blocked .dot { background: var(--accent); box-shadow: 0 0 0 5px rgba(47,91,255,.25); }
.row.proven .dot { background: #22c55e; box-shadow: 0 0 0 5px rgba(34,197,94,.2); }
.row .t { font: 600 15px/1.45 var(--sans); color: #fff; }
.row .p { font: 12.5px/1.5 var(--mono); color: #b7b7bf; margin-top: 6px; }
.row .s { font: 600 11px var(--mono); letter-spacing: .08em; text-transform: uppercase; padding: 5px 10px; border-radius: 999px; background: #26262b; color: #bdbdc4; white-space: nowrap; }
.row.blocked .s { background: var(--accent); color: #fff; }
.row.proven .s { background: #1f3b2b; color: #bff0cf; }
.done-box { display: none; margin-top: 22px; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
.done-box.show { display: flex; animation: rise .5s ease both; }
.done-box p { margin: 0; font: 400 26px/1.2 var(--serif); color: #fff; }
.done-box .pill-btn.light { box-shadow: none; }
.note { text-align: center; color: var(--faint); font-size: 13px; margin-top: 14px; }
@keyframes rise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
@keyframes pulse { 50% { opacity: .35; } }
@media (max-width: 760px) { .stage { padding: 20px; } .row { grid-template-columns: 14px minmax(0, 1fr); } .row .s { grid-column: 2; justify-self: start; } }
</style>
</head>
<body>
<div class="wrap">
  <nav class="top">
    <a class="logo" href="../">Settle</a>
    <div class="links"><a href="../#use">Use it in your repo</a><a class="pill-btn blue" href="../#use">Install <span class="arr">↗</span></a></div>
  </nav>
  <main>
    <section class="head">
      <span class="tag">Try it</span>
      <h1>Pick a feature. Watch Bob <em>check it.</em></h1>
      <p>Each one is a real recorded run of Settle on our demo online store. Pick the request a manager just asked for, and see what would have gone wrong.</p>
    </section>
    <div class="pick" id="pick"></div>
    <section class="stage" aria-live="polite">
      <div class="steps" id="steps"></div>
      <p class="said" id="said">&nbsp;</p>
      <div class="ticker" id="ticker">&nbsp;</div>
      <div class="rows" id="rows"></div>
      <div class="done-box" id="done"><p id="donetext"></p><div style="display:flex;gap:10px;flex-wrap:wrap"><a class="pill-btn light" id="again" href="#">Watch again <span class="arr">↻</span></a><a class="pill-btn blue" id="open" href="#">See the full results <span class="arr">↗</span></a></div></div>
    </section>
    <p class="note">Replayed from the run's own log, sped up. On your repo it takes about four minutes.</p>
  </main>
</div>
<script type="application/json" id="data">${safe}</script>
<script>
(function () {
  var proofs = JSON.parse(document.getElementById("data").textContent);
  var pick = document.getElementById("pick"), stepsEl = document.getElementById("steps"), said = document.getElementById("said"),
      ticker = document.getElementById("ticker"), rows = document.getElementById("rows"), done = document.getElementById("done");
  var STEPS = ["Bob reads the code", "Bob names the risks", "Bob runs experiments", "Settle checks the work", "Results"];
  var token = 0;
  function setStep(n) {
    stepsEl.innerHTML = STEPS.map(function (s, i) { return '<span class="sp ' + (i < n ? "done" : i === n ? "now" : "") + '">' + s + "</span>"; }).join("");
  }
  function row(id, title) {
    var r = document.createElement("div");
    r.className = "row"; r.id = "r-" + id;
    r.innerHTML = '<span class="dot"></span><div><div class="t"></div><div class="p"></div></div><span class="s">Waiting</span>';
    r.querySelector(".t").textContent = title;
    rows.appendChild(r);
    return r;
  }
  function label(l) { return l === "update todo list" ? "Updated its plan" : l; }
  function play(p) {
    var my = ++token;
    [].forEach.call(pick.children, function (b) { b.classList.toggle("on", b.dataset.id === p.id); });
    rows.innerHTML = ""; done.classList.remove("show"); ticker.innerHTML = "&nbsp;";
    said.textContent = '"' + p.request + '"'; setStep(0);
    fetch("../runs/" + p.id + "/events.jsonl").then(function (r) { return r.text(); }).then(function (text) {
      var ev = text.split("\\n").filter(Boolean).map(function (l) { return JSON.parse(l); });
      var i = 1;
      (function next() {
        if (my !== token) return;
        if (i >= ev.length) return;
        var e = ev[i], prev = ev[i - 1];
        if (e.kind === "phase") {
          if (e.phase === "plan") setStep(0);
          if (e.phase === "experiments") { setStep(2); [].forEach.call(rows.children, function (r) { r.classList.add("busy"); r.querySelector(".s").textContent = "Testing"; }); }
          if (e.phase === "verify") { setStep(3); ticker.innerHTML = "Settle is rerunning every experiment itself, not taking Bob's word for it."; }
          if (e.phase === "write-plan") { ticker.innerHTML = "Bob is writing the plan from what the tests found."; }
          if (e.phase === "done") {
            setStep(4);
            ticker.innerHTML = "&nbsp;";
            var s = p.summary;
            document.getElementById("donetext").textContent = s.blocked ? s.blocked + " landmine" + (s.blocked === 1 ? "" : "s") + " found before anyone estimated." : "No landmines. As easy as it looks.";
            document.getElementById("open").href = "../runs/" + p.id + "/";
            done.classList.add("show");
          }
        } else if (e.kind === "assumptions") {
          setStep(1);
          e.assumptions.forEach(function (a) { row(a.id, (p.findings[a.id] || {}).title || a.plain || a.assumption); });
        } else if (e.kind === "bob") {
          var who = e.step === "plan" ? "Bob" : e.step === "write-plan" ? "Bob (plan)" : "Bob, test " + ([].indexOf.call(rows.children, document.getElementById("r-" + e.step)) + 1);
          ticker.innerHTML = "<b>" + who + "</b> · " + label(e.label).replace(/[<>&]/g, "");
        } else if (e.kind === "verified") {
          var r = document.getElementById("r-" + e.id), f = p.findings[e.id] || {};
          if (r) {
            r.classList.remove("busy"); r.classList.add(e.status);
            r.querySelector(".s").textContent = e.status === "blocked" ? "Landmine" : e.status === "proven" ? "Safe" : "Unsure";
            r.querySelector(".p").textContent = f.proof || "";
          }
        }
        i++;
        var gap = (e.t - prev.t) / 25;
        setTimeout(next, Math.max(60, Math.min(gap, e.kind === "verified" ? 1100 : 700)));
      })();
    });
  }
  proofs.forEach(function (p, i) {
    var b = document.createElement("button");
    b.className = "opt"; b.dataset.id = p.id;
    b.innerHTML = "<small>Request " + (i + 1) + "</small><b></b>";
    b.querySelector("b").textContent = '"' + p.request + '"';
    b.onclick = function () { play(p); };
    pick.appendChild(b);
  });
  document.getElementById("again").onclick = function (e) { e.preventDefault(); var on = pick.querySelector(".on"); play(proofs.find(function (p) { return p.id === on.dataset.id; })); };
  var want = new URLSearchParams(location.search).get("run");
  play(proofs.find(function (p) { return p.id === want; }) || proofs[0]);
})();
</script>
</body>
</html>`;
}
