// Runs in the results page. The reader drags the limit lines on the decision
// map; the page re-decides with the same verdict code the CLI uses.
// Measurements never change; only the constraints do.
import type { RunFile } from "./engine.ts";
import { decide } from "./verdict.ts";
import { invX, invY, renderAppendix, renderMap, renderOptions, renderTable, renderTrust, renderVerdict, type MapScale } from "./view.ts";

const data: RunFile = JSON.parse(document.getElementById("run-data")!.textContent!);
const recorded = { ...data.constraints };
const map = document.getElementById("map")!;
const tip = document.getElementById("tip")!;
const reset = document.getElementById("reset")!;

const scale = (): MapScale => JSON.parse(map.querySelector("svg")!.dataset.scale!);

// Two significant figures reads like a limit a person would set.
const niceMs = (v: number) => {
  const p = 10 ** Math.max(0, Math.floor(Math.log10(v)) - 1);
  return Math.max(1, Math.round(v / p) * p);
};

function render(focus?: string) {
  data.verdict = decide(data.options, data.constraints);
  document.getElementById("verdict")!.innerHTML = renderVerdict(data);
  document.getElementById("table")!.innerHTML = renderTable(data);
  document.getElementById("options")!.innerHTML = renderOptions(data);
  document.getElementById("trust")!.innerHTML = renderTrust(data);
  document.getElementById("appendix")!.textContent = renderAppendix(data);
  map.querySelector("svg")!.outerHTML = renderMap(data);
  reset.hidden = JSON.stringify(recorded) === JSON.stringify(data.constraints);
  if (focus) map.querySelector<SVGGElement>(focus)?.focus();
}

function setLimit(axis: "x" | "y", value: number) {
  const s = scale();
  if (axis === "x") data.constraints.max_p95_ms = Math.min(niceMs(value), niceMs(10 ** s.lmax));
  else data.constraints.max_staleness_seconds = Math.max(0, Math.min(Math.round(value), s.smax));
}

let dragging: "x" | "y" | null = null;

function toView(e: PointerEvent) {
  const s = scale();
  const r = map.querySelector("svg")!.getBoundingClientRect();
  return { s, x: ((e.clientX - r.left) / r.width) * s.w, y: ((e.clientY - r.top) / r.height) * s.h };
}

map.addEventListener("pointerdown", (e) => {
  const t = e.target as Element;
  dragging = t.closest(".lim-x") ? "x" : t.closest(".lim-y") ? "y" : null;
  if (!dragging) return;
  map.setPointerCapture(e.pointerId);
  tip.hidden = true;
  e.preventDefault();
});

map.addEventListener("pointermove", (e) => {
  if (dragging) {
    const { s, x, y } = toView(e);
    setLimit(dragging, dragging === "x" ? invX(s, x) : invY(s, y));
    render();
    return;
  }
  const pt = (e.target as Element).closest<SVGGElement>(".pt");
  showTip(pt);
});

map.addEventListener("pointerup", () => (dragging = null));
map.addEventListener("pointercancel", () => (dragging = null));
map.addEventListener("pointerleave", () => !dragging && (tip.hidden = true));

function showTip(pt: SVGGElement | null) {
  if (!pt) {
    tip.hidden = true;
    return;
  }
  const [name, ...rest] = pt.dataset.tip!.split("|");
  const mk = pt.querySelector(".mk")!.getBoundingClientRect();
  const box = map.getBoundingClientRect();
  tip.innerHTML = `<b></b>${rest.map(() => "<span></span>").join("<br>")}`;
  tip.querySelector("b")!.textContent = name;
  tip.querySelectorAll("span").forEach((sp, i) => (sp.textContent = rest[i]));
  tip.style.left = `${mk.left + mk.width / 2 - box.left}px`;
  tip.style.top = `${mk.top - box.top}px`;
  tip.hidden = false;
}

map.addEventListener("focusin", (e) => {
  const pt = (e.target as Element).closest<SVGGElement>(".pt");
  if (pt) showTip(pt);
});
map.addEventListener("focusout", () => (tip.hidden = true));

// Keyboard: arrows move a focused limit line.
map.addEventListener("keydown", (e) => {
  const t = e.target as Element;
  const axis = t.closest(".lim-x") ? "x" : t.closest(".lim-y") ? "y" : null;
  if (!axis) return;
  const up = e.key === "ArrowUp" || e.key === "ArrowRight";
  const down = e.key === "ArrowDown" || e.key === "ArrowLeft";
  if (!up && !down) return;
  e.preventDefault();
  if (axis === "x") {
    const v = data.constraints.max_p95_ms ?? 50;
    setLimit("x", up ? v * 1.25 : v / 1.25);
  } else {
    const v = data.constraints.max_staleness_seconds ?? 15;
    setLimit("y", v + (up ? 1 : -1) * (e.shiftKey ? 10 : 1));
  }
  render(axis === "x" ? ".lim-x" : ".lim-y");
});

reset.addEventListener("click", () => {
  Object.assign(data.constraints, recorded);
  render();
});

document.getElementById("copy")!.addEventListener("click", async (e) => {
  const button = e.currentTarget as HTMLButtonElement;
  const text = document.getElementById("appendix")!.textContent ?? "";
  try {
    await navigator.clipboard.writeText(text);
    button.textContent = "Copied";
  } catch {
    button.textContent = "Select the text above to copy";
  }
  setTimeout(() => (button.textContent = "Copy appendix"), 1800);
});
