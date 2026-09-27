# Settle

**Find the landmines before you estimate.**

Live, with a real proof: **https://settle-blush.vercel.app**

A "two day" feature turns into two weeks because of something nobody knew was in the code. Engineers estimate by reading the repo; the surprises only show up once someone builds it.

Settle moves the surprises to the start. You give it one sentence, the feature you are about to estimate:

1. **Bob finds the risks.** IBM Bob reads the code the feature would touch and names the assumptions it silently depends on, the ones that cost days if they are wrong.
2. **Bob runs experiments.** One Bob Shell session per assumption, all at once, each in its own git worktree, writes the smallest test that proves or disproves that assumption against today's code.
3. **Settle checks the work.** Settle reruns every experiment itself instead of trusting Bob's word: a passing experiment is **proven**, a failing one is **blocked** (with the exact error or wrong value), anything that could not run or touched existing files is **unknown**.
4. **Bob writes the plan** from what was actually found: what we now know, the landmines to fix first, the build order, and how the findings change the estimate.

Nothing is merged. Every experiment stays on its own branch.

## Why not just ask an AI

An AI can guess what might go wrong. Settle shows you, with a failing test against your real code, and it does not take the builder's word for it: every experiment is rerun independently, and experiments may only add files: one that changes any existing file is not trusted.

## Run it

Requirements: Node 24, git, and [IBM Bob Shell](https://bob.ibm.com/docs/shell/getting-started/install-and-setup) with a `BOB_API_KEY` (Inference scope).

```bash
npm install
cd demo/orders-api && npm install
node ../../bin/settle.mjs prove        # reads prove.yml
```

`prove.yml`:

```yaml
request: Let customers pay in their own currency (USD, EUR, JPY and IDR), and keep the top customers ranking correct.
context: Orders are stored in a single currency today.
experiment:
  command: node --import tsx --test {file}
assumptions: 3
```

Each proof writes `runs/prove-<time>/proof.json`, `index.html` (the evidence board), `events.jsonl` and one log per Bob session.

## How it works

| Part | File |
|---|---|
| The prove pipeline: plan, parallel experiments, independent rerun, plan | [src/prove.ts](src/prove.ts) |
| Evidence board page | [src/proof-page.ts](src/proof-page.ts) |
| Landing page | [src/app/landing-prove.ts](src/app/landing-prove.ts) |
| Bob Shell runner (headless, parallel, streams tool calls) | [src/bob.ts](src/bob.ts) |
| Worktrees, commits, test file detection | [src/git.ts](src/git.ts) |
| Process control with time limits | [src/measure.ts](src/measure.ts) |
| Command line | [src/cli.ts](src/cli.ts) |

Settle also includes `settle run`, which builds competing designs for the same change and measures them with one load test (the engine `settle prove` grew out of). Its results are at [/compare/](https://settle-blush.vercel.app/compare/).

## How IBM Bob is used

- **Inside the product:** Bob Shell names the risky assumptions, builds every experiment in parallel (one headless session per assumption, each in its own worktree), and writes the final plan. Session logs and costs are saved with each proof.
- **Building Settle:** Bob IDE tasks wrote test suites and CI, the Settle custom mode, and two reviews of the harness and verdict that found and fixed six real bugs. Session summaries are in [bob_sessions/](bob_sessions/).

## Tests

`npm test` runs 73 tests, including end to end runs of `settle prove` (proven, blocked, and an experiment that edits an existing file being distrusted even though Bob claimed it held) and of the comparison pipeline, both on a fixture app with a stand in for Bob Shell. GitHub Actions runs typecheck and tests on every push.

## Limits

- Experiments run against the code as it is today; Settle proves or disproves assumptions, it does not build the feature.
- A failing experiment is reported as blocked. If Bob's experiment itself is wrong, that shows up as a false landmine, which is why every card shows the rerun output, Bob's own read and the test code for the team to check.
- Bob chooses the assumptions. The plan is only as good as the risks it names, so the evidence board shows each one for the team to challenge.
- Settle runs locally, next to your code. There is no hosted service.

Built for the IBM Bob 2.0 Hackathon. MIT license.
