# Settle

**When your team argues about how to build something, Settle builds each option and shows you the numbers.**

Live results from a real run: **https://settle-blush.vercel.app**

Teams make design calls every week. Cache or materialized view. Queue or direct call. Library A or library B. Today those calls are settled by whoever argues best, or by one engineer spending days on a throwaway version of one option. The numbers that would end the argument only exist once every option is actually built, in your codebase, on your data.

Settle gets you those numbers in minutes:

1. You write the question, the options and your constraints in `settle.yml`.
2. Settle gives every option its own git worktree and starts one **IBM Bob Shell** session per option, all in parallel. Each Bob builds a working version of its option.
3. The same load test and the same freshness probe run against every branch.
4. A rule based verdict picks the option that meets every constraint with the smallest change, and a results page shows why.

Nothing is merged. Every option stays on its own branch for review.

## The demo run

The question: *How do we make the top customers endpoint fast?* on a small orders API ([demo/orders-api](demo/orders-api)) that aggregates 200,000 orders on every call.

| | Today | Cache | Materialized view | Index and rewrite |
|---|---|---|---|---|
| p95 latency | 1.01 s | 3 ms | 7 ms | 409 ms |
| Throughput | 11 req/s | 4,955 req/s | 1,704 req/s | 24.5 req/s |
| Staleness (worst) | instant | 60.1 s | 10 s | instant |
| Code changed | | +45 −2 | +45 −13 | +10 −0 |
| Built by Bob in | | 2m 13s | 2m 22s | 2m 4s |

The fastest option is not automatically the right one. With the recorded limits (p95 at most 50 ms, results at most 15 s stale) the materialized view wins. Allow 90 seconds of staleness and the cache wins with less code. Accept 500 ms and the index wins with ten lines. The results page lets you move those limits and watch the pick change; the measurements never change.

## Run it

Requirements: Node 24, git, and [IBM Bob Shell](https://bob.ibm.com/docs/shell/getting-started/install-and-setup) with a `BOB_API_KEY` (Inference scope).

```bash
npm install
cd demo/orders-api && npm install
node ../../bin/settle.mjs run            # build every option with Bob, measure, decide
node ../../bin/settle.mjs run --baseline-only   # measure today's code only, no Bob calls
node ../../bin/settle.mjs report ../../runs/<id> --set max_staleness_seconds=90
```

Each run writes `runs/<id>/results.json`, `index.html` (the results page), `appendix.md` (paste into your design doc) and one log per Bob session.

## Settle mode (Bob IDE)

The repo ships a **Settle custom mode** at [`.bob/custom_modes.yaml`](.bob/custom_modes.yaml).
Open this workspace in Bob, pick **Settle** from the mode picker, and paste in a design question
or a section of a design doc. The mode will:

1. Ask one follow-up question at most (e.g. which endpoint to probe) if something essential is missing.
2. Write a `settle.yml` next to your app that is valid against the schema in [`src/config.ts`](src/config.ts).
3. List the options and constraints it chose and ask you to confirm or adjust them.
4. Tell you how to start the run from that folder.

The mode is scoped to this workspace and may **only edit `settle.yml` files** -- it cannot touch
application source, tests, or any other file. Use a normal Agent session if you need code changes.

```
# quick start
# 1. Open this repo in Bob
# 2. Switch to Settle mode (mode picker, top-right)
# 3. Paste your design question:
#      "GET /reports/monthly scans 500 k rows. Options: add an index, or
#       materialise into a summary table. p95 must be under 100 ms."
# 4. Confirm the generated settle.yml
# 5. cd <your-app> && node <path-to-settle>/bin/settle.mjs run
```

## settle.yml

```yaml
question: How do we make the top customers endpoint fast?
app:
  start: npm start            # must listen on $PORT
  test: npm test
load:
  request: { method: GET, path: /stats/top-customers?limit=10 }
  duration_seconds: 15
  concurrency: 8
freshness:                    # optional: how long until a write is visible
  write: { method: POST, path: /orders, body: { customer_id: "{{random 1 5000}}", amount_cents: "{{increasing}}" } }
  read: { method: GET, path: /stats/top-customers?limit=1 }
  read_field: 0.customer_id
  equals: customer_id
constraints:
  max_p95_ms: 50
  max_staleness_seconds: 15
  tests_must_pass: true
options:
  - { id: cache, name: Cache, description: Cache the response in memory with a 60 second TTL. }
  - { id: matview, name: Materialized view, description: Precompute the ranking and refresh it on a schedule. }
  - { id: index, name: Index and rewrite, description: Add the right index and rewrite the query. }
```

The full example is [demo/orders-api/settle.yml](demo/orders-api/settle.yml).

## How it works

| Part | File |
|---|---|
| Config parsing and validation | [src/config.ts](src/config.ts) |
| Worktrees, commits, diff stats | [src/git.ts](src/git.ts) |
| Bob Shell runner (headless, parallel) | [src/bob.ts](src/bob.ts) |
| Load test, freshness probe, tests, dependency diff | [src/measure.ts](src/measure.ts) |
| Verdict rules | [src/verdict.ts](src/verdict.ts) |
| Results page and appendix | [src/view.ts](src/view.ts), [src/report.ts](src/report.ts), [src/client.ts](src/client.ts) |
| Orchestration | [src/cli.ts](src/cli.ts) |

**Fair comparison.** Every option starts from the same commit. Options are measured one at a time so they never compete for CPU. The same seeded data, load and probe apply to every branch. Tests are counted apart from application code so an option is never penalised for being better tested.

**Repeatable verdict.** The verdict is rules, not a model call: an option qualifies if it meets every constraint, and the smallest change among qualifying options wins, ties going to lower p95. The results page runs the same verdict code in the browser.

**Honest failure.** If Bob cannot build an option, times out, or the app fails to start, the page says so instead of hiding the option.

## How IBM Bob is used

- **Inside the product:** every option is built by its own Bob Shell session (`bob run`, headless) in its own worktree, in parallel. Session stats (duration, tool calls, cost) are saved with each run.
- **Building Settle:** Bob IDE sessions wrote the verdict tests, the Settle custom mode and a fairness review of the harness. Session summaries are in [bob_sessions/](bob_sessions/).

## Limits

- Measurement ships for HTTP services. Other kinds of debate (background jobs, frontend bundles) need their own probe.
- Numbers are from the machine Settle runs on. They are for comparing options with each other, not for capacity planning.
- Settle runs locally, next to your code. There is no hosted service.

Built for the IBM Bob 2.0 Hackathon.
