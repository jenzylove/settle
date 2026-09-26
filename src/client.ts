// Runs in the results page. Re-decides the run with the same verdict code the
// CLI uses whenever the reader moves a constraint slider. Measurements never
// change; only the constraints do.
import type { RunFile } from "./engine.ts";
import { decide } from "./verdict.ts";
import { renderAppendix, renderOptions, renderTable, renderVerdict } from "./view.ts";

const data: RunFile = JSON.parse(document.getElementById("run-data")!.textContent!);
const recorded = { ...data.constraints };

function render() {
  data.verdict = decide(data.options, data.constraints);
  document.getElementById("verdict")!.innerHTML = renderVerdict(data);
  document.getElementById("table")!.innerHTML = renderTable(data);
  document.getElementById("options")!.innerHTML = renderOptions(data);
  document.getElementById("appendix")!.textContent = renderAppendix(data);
  const changed = JSON.stringify(recorded) !== JSON.stringify(data.constraints);
  document.getElementById("reset")!.hidden = !changed;
}

for (const input of document.querySelectorAll<HTMLInputElement>("input[type=range][data-key]")) {
  const key = input.dataset.key as "max_p95_ms" | "max_staleness_seconds";
  const steps = input.dataset.steps!.split(",").map(Number);
  const unit = key === "max_p95_ms" ? "ms" : "s";
  const out = document.querySelector<HTMLOutputElement>(`output[data-for="${key}"]`)!;
  input.addEventListener("input", () => {
    const value = steps[Number(input.value)];
    data.constraints[key] = value;
    out.textContent = `≤ ${value} ${unit}`;
    render();
  });
}

document.getElementById("reset")!.addEventListener("click", () => {
  Object.assign(data.constraints, recorded);
  for (const input of document.querySelectorAll<HTMLInputElement>("input[type=range][data-key]")) {
    const key = input.dataset.key as "max_p95_ms" | "max_staleness_seconds";
    const steps = input.dataset.steps!.split(",").map(Number);
    input.value = String(steps.indexOf(recorded[key]!));
    const unit = key === "max_p95_ms" ? "ms" : "s";
    document.querySelector<HTMLOutputElement>(`output[data-for="${key}"]`)!.textContent = `≤ ${recorded[key]} ${unit}`;
  }
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
