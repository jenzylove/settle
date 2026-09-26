# Settle: PRD

**Hackathon:** IBM Bob 2.0 (lablab.ai). Submissions close **27 Sep 2026, 15:00 UTC**.
**Locked:** 26 Sep 2026, 22:10 UTC.

## 1. One liner

When your team argues about how to build something, Settle builds each option and shows you the numbers.

## 2. Problem

Teams make design calls every week: cache or materialized view, queue or direct call, library A or library B. Today those calls are settled in one of three ways:

1. **Opinion.** The most senior or loudest person wins.
2. **A spike.** One engineer spends days building a throwaway version of one option. The other options are never built, so there is nothing to compare against.
3. **A guess.** Most teams skip the spike entirely.

A wrong call is expensive because it is discovered late, after other code is built on top of it. The information that would have settled the argument (how fast, how much code, how many files, what new dependencies, does it stay correct) only exists once each option is actually built in the real codebase.

## 3. Target user

Tech leads and senior engineers who write design docs or run design reviews, on teams of roughly 5 to 50 engineers. Secondary: the reviewers of those design docs, who get evidence instead of arguments.

## 4. What Settle is

A command line tool plus a results page.

1. The user writes the question and the options in a short `settle.yml` in their repo (or pastes the design doc text and Settle drafts the file).
2. Settle creates one git worktree and branch per option.
3. For each option, in parallel, Settle starts one **IBM Bob Shell** session that builds a minimal working version of that option in that worktree.
4. When every build finishes, Settle runs the **same** measurement script against every branch.
5. Settle writes `results.json` and renders a results page: the options side by side with real numbers, a short verdict, and a design doc appendix ready to paste.

Nothing is merged. Branches are kept so the reviewer can read each option's diff.

## 5. Why it is not a chat answer

A chat assistant gives an opinion about which option is better in general. Settle gives measurements of each option **in this codebase, on this data**. The numbers come from code that was actually built and run.

## 6. The demo debate

A small orders API (Node, TypeScript) with a slow endpoint: `GET /stats/top-customers` aggregates about 200,000 orders and takes roughly a second.

The question: **"How do we make the top customers endpoint fast?"**

| Option | Summary |
|---|---|
| A. Cache | Cache the response in memory with a 60 second TTL |
| B. Materialized view | Precompute the aggregate in a Postgres materialized view, refresh on a schedule |
| C. Index and rewrite | Add the right index and rewrite the query |

Measured for each option:

| Metric | How |
|---|---|
| Median and p95 latency | 30 second load test against the endpoint |
| Throughput | Requests per second from the same load test |
| Staleness | Write new orders during the load test, count responses that do not reflect them |
| Code size | Lines added and removed (`git diff --numstat`) |
| Files touched | `git diff --name-only` |
| New dependencies | Diff of `package.json` |
| Tests | Existing test suite pass count |
| Build cost | Bob session stats from Bob Shell JSON output (time, tool calls) |

The point of the demo: the fastest option is not the right answer once staleness and code size are on the table. The verdict weighs the numbers against the constraints written in `settle.yml` (for example "results may be at most 5 seconds stale").

Database: PGlite (Postgres compiled to WebAssembly, runs in process). It supports indexes and materialized views, needs no Docker, and runs the same on any machine.

## 7. Architecture

```
settle.yml ──> settle CLI (Node, TypeScript)
                 ├─ worktree per option (git worktree add)
                 ├─ Bob Shell per option, in parallel
                 │    bob run --accept-license --format json  (prompt built from settle.yml)
                 ├─ measure: same script on every branch
                 ├─ results.json
                 └─ report: static HTML page + appendix.md
```

**Components**

| Part | Path | Notes |
|---|---|---|
| CLI and orchestrator | `src/` | `settle run`, `settle measure`, `settle report` |
| Bob runner | `src/bob.ts` | Spawns Bob Shell, captures JSON summary, enforces `--max-turns` and a time limit |
| Measurement harness | `src/measure/` | Load test, staleness probe, diff stats, dependency diff, test run |
| Verdict | `src/verdict.ts` | Rule based scoring against the constraints in `settle.yml`; no model call, so it is repeatable |
| Results page | `web/` | Static page, reads `results.json`; deployed to Vercel as the demo URL |
| Demo repo | `demo/orders-api/` | The debate target, seeded data, tests |
| Bob custom mode | `.bob/` | A "Settle" mode so the whole flow can start from inside Bob IDE |

**Bobcoin budget.** 40 Bobcoins per participant, not topped up. A full demo run is three Bob Shell builds. Plan: one rehearsal run and one recorded run, results cached in `runs/` so the page and video never need a fresh run. Every Bob call carries `--max-turns`.

## 8. The front door

**Command line:**

```
$ settle run
Question  How do we make the top customers endpoint fast?
Options   A cache · B materialized view · C index and rewrite

  A cache                building ████████░░  Bob: 14 tool calls
  B materialized view    building ██████░░░░  Bob: 11 tool calls
  C index and rewrite    done     ██████████  Bob: 6 tool calls

Measuring 3 branches…
Report  runs/2026-09-27T08-12/index.html
```

**Results page** (monotone, full width, no boxed cards, hairline dividers):

1. The question in large type at the top.
2. Three columns, one per option. Each column: the headline numbers (median latency, staleness, lines changed, new dependencies), then a link to the diff.
3. The verdict line below: which option fits the stated constraints and why, in two sentences.
4. "Copy appendix" button that copies the design doc appendix as Markdown.

## 9. Scope

**In:**
- `settle.yml` format and parser
- Parallel worktrees and Bob Shell runs
- Measurement harness for HTTP endpoints (latency, throughput, staleness) plus diff, dependency and test stats
- Rule based verdict
- Results page and appendix
- Demo repo and one recorded run
- Bob custom mode

**Out (stated honestly in the submission):**
- Measurement for non HTTP debates (background jobs, frontend bundles). The harness is pluggable, only HTTP ships.
- Running in CI or on pull requests.
- Hosted service. Settle runs locally where the code is.

## 10. Success criteria

1. `settle run` on the demo repo produces three working branches built by Bob Shell, measured by one script, with no manual edits.
2. The results page shows real numbers from that run.
3. A second run gives numbers within 15 percent of the first (repeatable).
4. The verdict changes when the constraint in `settle.yml` changes (for example allow 60 seconds of staleness and the cache wins).
5. The video shows the full loop in under 3 minutes.

## 11. How Bob is used

| Where | What Bob does | Evidence |
|---|---|---|
| Building Settle | Bob IDE sessions build the orchestrator, harness and results page | IDE task session summary screenshots in `bob-sessions/` |
| Inside the product | Bob Shell builds each competing option in parallel | JSON session stats saved per run in `runs/` |
| Starting a run | The Settle custom mode in Bob IDE drafts `settle.yml` from a design doc and starts the run | Mode definition in `.bob/` |

## 12. Submission deliverables

| Item | Owner | Due (UTC) |
|---|---|---|
| Public repo with Bob session screenshots | Build: Claude and user · Screenshots: user | 27 Sep 12:00 |
| Demo URL (results page on Vercel) | Claude | 27 Sep 10:00 |
| Video, 3 min max, at least 90 s of product, narrated | Claude | 27 Sep 12:30 |
| Slides | Claude | 27 Sep 12:30 |
| Cover image | Claude | 27 Sep 12:30 |
| Long description, 500 words max | Claude | 27 Sep 12:30 |
| Bob usage statement, 500 words max | Claude | 27 Sep 12:30 |
| Submit on lablab | User | 27 Sep 14:00 |

## 13. Timeline (UTC)

| Phase | Done by | Output |
|---|---|---|
| 0. PRD, repo, Bob Shell installed and logged in | 26 Sep 23:00 | This file, repo, `bob` works |
| 1. Demo repo: orders API, seed, tests, slow endpoint | 27 Sep 01:00 | `demo/orders-api` passing tests |
| 2. Measurement harness, run by hand on the base branch | 27 Sep 03:00 | Baseline numbers |
| 3. Orchestrator: worktrees, parallel Bob Shell, results.json | 27 Sep 05:30 | First full run |
| 4. Verdict, results page, appendix, custom mode | 27 Sep 08:00 | Page renders a real run |
| 5. Recorded run, Vercel deploy, QA pass | 27 Sep 10:00 | Live demo URL |
| 6. Video, slides, cover, statements | 27 Sep 12:30 | All assets |
| 7. User: IDE screenshots final check, repo public, submit | 27 Sep 14:00 | Submitted, one hour of buffer |

Note: Proof of Exploit (Midnight Korea) also closes 27 Sep 15:00 UTC. Its remaining steps (repo public, submit) belong in the same window.

## 14. Risks

| Risk | Mitigation |
|---|---|
| Bob Shell build fails or wanders | Tight prompt from `settle.yml`, `--max-turns`, a time limit, and the failure shown as a result ("option could not be built") instead of hidden |
| Bobcoins run out | Cached runs, one rehearsal only, small demo repo |
| Numbers noisy | Warmup, fixed seed data, fixed load, median of three short runs |
| Demo looks staged | Show `settle.yml` on screen, flip one constraint live and show the verdict change |
| IDE screenshots missing | User runs the IDE sessions listed in the build plan and saves each summary as it happens |
