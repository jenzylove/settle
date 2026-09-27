// The Settle app. One page, two data sources:
//   local   served by `settle ui`: edit the debate, start real runs, stream live
//   static  the hosted site: the recorded debate and a replay of real runs
import type { Stamped } from "../events.ts";
import type { Verdict } from "../verdict.ts";

interface Opt { id: string; name: string; description: string }
interface Debate {
  question: string;
  context?: string;
  options: Opt[];
  constraints: { max_p95_ms?: number; max_staleness_seconds?: number; tests_must_pass?: boolean };
  path?: string;
}
interface RunSummary {
  id: string;
  question: string;
  created_at?: string;
  status: "done" | "running";
  headline?: string;
  winner?: string | null;
}
interface Source {
  mode: "local" | "static";
  debate(): Promise<Debate>;
  save?(d: Debate): Promise<void>;
  runs(): Promise<RunSummary[]>;
  start?(): Promise<string>;
  watch(id: string, on: (e: Stamped) => void, speed: () => number): () => void;
  results(id: string): string;
}

const MODE = (document.body.dataset.mode ?? "local") as "local" | "static";
const REPO = "https://github.com/jenzylove/settle";

const json = async (url: string, init?: RequestInit) => {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error((await res.text()) || res.statusText);
  return res.json();
};

const local: Source = {
  mode: "local",
  debate: () => json("/api/debate"),
  save: (d) => json("/api/debate", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(d) }),
  runs: () => json("/api/runs"),
  start: async () => (await json("/api/run", { method: "POST" })).id,
  watch(id, on) {
    const es = new EventSource(`/api/events/${id}`);
    es.onmessage = (m) => on(JSON.parse(m.data));
    es.addEventListener("end", () => es.close());
    return () => es.close();
  },
  results: (id) => `/runs/${id}/`,
};

// Replays a recorded events.jsonl on its real timeline, sped up. Long quiet
// gaps are shortened so a nine minute run plays in about a minute and a half.
const hosted: Source = {
  mode: "static",
  debate: () => json("data/debate.json"),
  runs: () => json("data/runs.json"),
  watch(id, on, speed) {
    let stopped = false;
    (async () => {
      const text = await (await fetch(`../runs/${id}/events.jsonl`)).text();
      const events: Stamped[] = text.split("\n").filter(Boolean).map((l) => JSON.parse(l));
      for (let i = 0; i < events.length && !stopped; i++) {
        if (i > 0) {
          const gap = (events[i].t - events[i - 1].t) / speed();
          await new Promise((r) => setTimeout(r, Math.min(gap, 1400)));
        }
        if (!stopped) on(events[i]);
      }
    })();
    return () => (stopped = true);
  },
  results: (id) => `../runs/${id}/`,
};

const src = MODE === "static" ? hosted : local;
const app = document.getElementById("app")!;
const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
let cleanup: () => void = () => {};

function nav(active: string) {
  document.querySelectorAll<HTMLAnchorElement>(".nav a[data-route]").forEach((a) => a.classList.toggle("on", a.dataset.route === active));
}

// ---------- Debate ----------

async function debateView() {
  nav("debate");
  const d = await src.debate();
  const ro = src.mode === "static";
  const dis = ro ? "disabled" : "";
  const optRow = (o: Opt, i: number) => `
    <div class="opt-row" data-i="${i}" data-id="${esc(o.id)}">
      <span class="opt-n mono">${String.fromCharCode(65 + i)}</span>
      <input class="opt-name" value="${esc(o.name)}" placeholder="Option name" aria-label="Option name" ${dis}>
      <input class="opt-desc" value="${esc(o.description)}" placeholder="What Bob should build, in one sentence" aria-label="Option description" ${dis}>
      ${ro ? "" : `<button class="x" type="button" aria-label="Remove option">✕</button>`}
    </div>`;
  app.innerHTML = `
    <section class="debate">
      <p class="eyebrow">The question</p>
      <textarea id="q" class="q" rows="2" aria-label="Question" ${dis}>${esc(d.question)}</textarea>
      <textarea id="ctx" class="ctx" rows="3" aria-label="Context" placeholder="Context Bob should know" ${dis}>${esc(d.context ?? "")}</textarea>

      <div class="grid2">
        <div>
          <p class="eyebrow">Options Bob will build</p>
          <div id="opts">${d.options.map(optRow).join("")}</div>
          ${ro ? "" : `<button class="btn ghost small" id="add" type="button">Add option</button>`}
        </div>
        <div>
          <p class="eyebrow">Your limits</p>
          <label class="lim"><span>p95 latency at most</span><span><input id="p95" type="number" min="1" value="${d.constraints.max_p95_ms ?? ""}" ${dis}> ms</span></label>
          <label class="lim"><span>Results stale for at most</span><span><input id="stale" type="number" min="0" value="${d.constraints.max_staleness_seconds ?? ""}" ${dis}> s</span></label>
          <label class="lim"><span>Existing tests must pass</span><span><input id="tests" type="checkbox" ${d.constraints.tests_must_pass ? "checked" : ""} ${dis}></span></label>
        </div>
      </div>

      <div class="actions">
        ${
          ro
            ? `<a class="btn" href="#/runs">Watch a recorded run</a><span class="muted">Runs build real code, so they happen on your machine: <code>npx settle ui</code> in your repo. <a href="${REPO}">How to run it</a></span>`
            : `<button class="btn" id="run" type="button">Build every option with Bob</button><button class="btn ghost" id="save" type="button">Save</button><span class="muted" id="msg">${esc(d.path ?? "")}</span>`
        }
      </div>
    </section>`;
  if (ro) return;

  const read = (): Debate => ({
    question: (document.getElementById("q") as HTMLTextAreaElement).value.trim(),
    context: (document.getElementById("ctx") as HTMLTextAreaElement).value.trim(),
    options: [...document.querySelectorAll<HTMLElement>(".opt-row")].map((row) => {
      const name = (row.querySelector(".opt-name") as HTMLInputElement).value.trim();
      // Keep an existing option id so branches and past runs stay comparable.
      return {
        id: row.dataset.id || name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "option",
        name,
        description: (row.querySelector(".opt-desc") as HTMLInputElement).value.trim(),
      };
    }),
    constraints: {
      max_p95_ms: Number((document.getElementById("p95") as HTMLInputElement).value) || undefined,
      max_staleness_seconds: (document.getElementById("stale") as HTMLInputElement).value === "" ? undefined : Number((document.getElementById("stale") as HTMLInputElement).value),
      tests_must_pass: (document.getElementById("tests") as HTMLInputElement).checked,
    },
  });
  const msg = (t: string) => (document.getElementById("msg")!.textContent = t);
  const bindRemove = () =>
    document.querySelectorAll<HTMLButtonElement>(".opt-row .x").forEach((b) => (b.onclick = () => b.closest(".opt-row")!.remove()));
  bindRemove();
  document.getElementById("add")!.onclick = () => {
    const n = document.querySelectorAll(".opt-row").length;
    document.getElementById("opts")!.insertAdjacentHTML("beforeend", optRow({ id: "", name: "", description: "" }, n));
    bindRemove();
  };
  document.getElementById("save")!.onclick = async () => {
    try {
      await src.save!(read());
      msg("Saved to settle.yml");
    } catch (e) {
      msg((e as Error).message);
    }
  };
  document.getElementById("run")!.onclick = async (ev) => {
    const b = ev.currentTarget as HTMLButtonElement;
    b.disabled = true;
    try {
      await src.save!(read());
      const id = await src.start!();
      location.hash = `#/run/${id}`;
    } catch (e) {
      msg((e as Error).message);
      b.disabled = false;
    }
  };
}

// ---------- Runs ----------

async function runsView() {
  nav("runs");
  const runs = await src.runs();
  app.innerHTML = `
    <section class="runs">
      <p class="eyebrow">${src.mode === "static" ? "Recorded runs" : "Runs"}</p>
      ${
        runs.length === 0
          ? `<p class="muted">No runs yet.</p>`
          : `<div class="list">${runs
              .map(
                (r) => `<a class="run-row" href="#/run/${r.id}">
                  <span class="mono muted">${esc((r.created_at ?? r.id).slice(0, 16).replace("T", " "))}</span>
                  <span class="rq">${esc(r.question)}</span>
                  <span class="rv">${r.status === "running" ? "Running…" : esc(r.headline ?? "")}</span>
                  <span class="go">${src.mode === "static" ? "Replay" : "Open"} →</span>
                </a>`,
              )
              .join("")}</div>`
      }
    </section>`;
}

// ---------- Run ----------

interface Col {
  id: string;
  name: string;
  description: string;
  state: "waiting" | "building" | "built" | "failed" | "measuring" | "measured";
  feed: string[];
  calls: number;
  seconds?: number;
  cost?: number;
  error?: string;
  step?: string;
  m?: Extract<Stamped, { kind: "measured" }>;
}

function runView(id: string) {
  nav("runs");
  const speedOptions = [5, 10, 20];
  let speed = 10;
  const st: {
    question: string;
    phase: string;
    t0: number;
    now: number;
    cols: Map<string, Col>;
    base: Col;
    verdict?: Verdict;
  } = {
    question: "",
    phase: "starting",
    t0: 0,
    now: 0,
    cols: new Map(),
    base: { id: "baseline", name: "Today (no change)", description: "", state: "waiting", feed: [], calls: 0 },
  };

  app.innerHTML = `
    <section class="run">
      <div class="run-head">
        <p class="eyebrow">${src.mode === "static" ? "Replay of a real run" : "Live run"} <span class="mono">${esc(id)}</span></p>
        <h1 id="rq">&nbsp;</h1>
        <div class="phases" id="phases"></div>
        ${
          src.mode === "static"
            ? `<div class="speed">Speed ${speedOptions.map((s) => `<button type="button" data-s="${s}" class="${s === speed ? "on" : ""}">${s}×</button>`).join("")}</div>`
            : ""
        }
      </div>
      <div class="cols" id="cols"></div>
      <div class="measure" id="measure"></div>
      <div class="verdict-box" id="vbox" aria-live="polite"></div>
    </section>`;
  document.querySelectorAll<HTMLButtonElement>(".speed button").forEach(
    (b) =>
      (b.onclick = () => {
        speed = Number(b.dataset.s);
        document.querySelectorAll(".speed button").forEach((x) => x.classList.toggle("on", x === b));
      }),
  );

  const clock = (sec: number) => `${Math.floor(sec / 60)}m ${String(Math.floor(sec % 60)).padStart(2, "0")}s`;
  const ms = (n?: number) => (n === undefined ? "—" : n >= 1000 ? `${(n / 1000).toFixed(2)} s` : `${Math.round(n)} ms`);
  const stale = (c: Col) => {
    const f = c.m?.freshness;
    if (!f) return "—";
    if (f.timed_out) return `over ${f.max_seconds} s`;
    return f.max_seconds < 1 ? "instant" : `${f.max_seconds} s`;
  };
  const stepName: Record<string, string> = { install: "Installing", tests: "Running tests", start: "Starting app", load: "Load test", freshness: "Freshness probe" };

  function paint() {
    document.getElementById("rq")!.textContent = st.question || " ";
    const order = ["build", "measure", "done"];
    const at = order.indexOf(st.phase);
    document.getElementById("phases")!.innerHTML = ["Bob builds", "Measure", "Verdict"]
      .map((label, i) => {
        const cur = st.phase === "done" ? 2 : at;
        return `<span class="ph ${i < cur ? "past" : i === cur ? "now" : ""}">${label}</span>`;
      })
      .join(`<span class="ph-sep"></span>`);

    const elapsed = st.t0 ? (st.now - st.t0) / 1000 : 0;
    document.getElementById("cols")!.innerHTML = [...st.cols.values()]
      .map((c) => {
        const status =
          c.state === "building"
            ? `Building · ${clock(elapsed)}`
            : c.state === "failed"
              ? `Not built${c.error ? `: ${esc(c.error)}` : ""}`
              : c.state === "measuring"
                ? esc(stepName[c.step ?? ""] ?? "Measuring")
                : c.state === "measured"
                  ? "Measured"
                  : c.state === "built"
                    ? `Built in ${clock(c.seconds ?? 0)}`
                    : "Waiting";
        const winner = st.verdict?.winner === c.id;
        return `<article class="col ${c.state} ${winner ? "win" : ""}">
          <header>
            ${winner ? `<span class="tag">Pick</span>` : ""}
            <h3>${esc(c.name)}</h3>
            <p class="desc">${esc(c.description)}</p>
            <p class="status mono">${status}</p>
          </header>
          <ol class="feed">${c.feed.slice(-7).map((l, i, a) => `<li class="${i === a.length - 1 && c.state === "building" ? "latest" : ""}">${esc(l)}</li>`).join("")}</ol>
          <footer class="mono muted">${c.calls} Bob actions${c.cost !== undefined ? ` · ${c.cost} Bobcoins` : ""}</footer>
        </article>`;
      })
      .join("");

    const rows = [st.base, ...st.cols.values()];
    const measuredAny = rows.some((c) => c.m || c.state === "measuring");
    document.getElementById("measure")!.innerHTML = !measuredAny
      ? ""
      : `<p class="eyebrow">Same load test and freshness probe on every branch, one at a time</p>
        <table><thead><tr><th></th><th>p95 latency</th><th>Throughput</th><th>Staleness</th><th>Code changed</th><th>Tests</th></tr></thead><tbody>
        ${rows
          .map(
            (c) => `<tr class="${c.state === "measuring" ? "now" : ""} ${st.verdict?.winner === c.id ? "win" : ""}">
            <th>${esc(c.name)}</th>
            <td>${c.state === "measuring" && !c.m ? `<span class="muted">${esc(stepName[c.step ?? ""] ?? "")}…</span>` : ms(c.m?.load?.p95_ms)}</td>
            <td>${c.m?.load ? `${c.m.load.rps} req/s` : "—"}</td>
            <td>${stale(c)}</td>
            <td>${c.m?.lines ? `+${c.m.lines.added} −${c.m.lines.removed}` : "—"}</td>
            <td>${c.m?.tests ? (c.m.tests.ok ? "pass" : "fail") : "—"}</td>
          </tr>`,
          )
          .join("")}
        </tbody></table>`;

    document.getElementById("vbox")!.innerHTML = !st.verdict
      ? ""
      : `<p class="eyebrow">Verdict</p>
        <p class="vh">${esc(st.verdict.headline)}</p>
        <p class="muted">${esc(st.verdict.reason)}</p>
        <a class="btn" href="${src.results(id)}">Open the results and move the limits</a>`;
  }

  const on = (e: Stamped) => {
    st.now = Math.max(st.now, e.t);
    switch (e.kind) {
      case "start":
        st.question = e.question;
        st.t0 = e.t;
        for (const o of e.options) st.cols.set(o.id, { ...o, state: "waiting", feed: [], calls: 0 });
        break;
      case "phase":
        st.phase = e.phase;
        if (e.phase === "build") st.cols.forEach((c) => (c.state = "building"));
        break;
      case "bob": {
        const c = st.cols.get(e.option);
        if (c) {
          // Runs recorded before the label existed say "update todo list".
          c.feed.push(e.label === "update todo list" ? "Updated its plan" : e.label);
          c.calls++;
        }
        break;
      }
      case "built": {
        const c = st.cols.get(e.option);
        if (c) Object.assign(c, { state: e.ok ? "built" : "failed", seconds: e.seconds, cost: e.cost, error: e.error, calls: e.tool_calls ?? c.calls });
        break;
      }
      case "measure": {
        const c = e.option === "baseline" ? st.base : st.cols.get(e.option);
        if (c) Object.assign(c, { state: "measuring", step: e.step });
        break;
      }
      case "measured": {
        const c = e.option === "baseline" ? st.base : st.cols.get(e.option);
        if (c) Object.assign(c, { state: "measured", m: e });
        break;
      }
      case "verdict":
        st.verdict = e.verdict;
        break;
    }
    paint();
  };

  paint();
  const stop = src.watch(id, on, () => speed);
  // Live runs tick the build clock between events.
  const tick = setInterval(() => {
    if (src.mode === "local" && st.phase === "build") {
      st.now = Date.now();
      paint();
    }
  }, 1000);
  cleanup = () => {
    stop();
    clearInterval(tick);
  };
}

// ---------- Router ----------

async function route() {
  cleanup();
  cleanup = () => {};
  const h = location.hash || "#/";
  try {
    if (h.startsWith("#/run/")) runView(decodeURIComponent(h.slice(6)));
    else if (h === "#/runs") await runsView();
    else await debateView();
  } catch (e) {
    app.innerHTML = `<p class="muted">${esc((e as Error).message)}</p>`;
  }
  window.scrollTo(0, 0);
}
addEventListener("hashchange", route);
route();
