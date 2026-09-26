# Bob IDE sessions

The submission needs screenshots of Bob IDE task session summaries. Run each session below in Bob IDE with the `settle` folder open, in Agent mode. When a session finishes, screenshot its task summary and save it to `bob_sessions/` as a PNG named like `settle_task01_verdict_tests_summary.png`.

To get the summary: in the Bob chat panel select **Tasks**, open the task, then click the **task header**. The consumption summary appears; screenshot that.

Keep each session to one prompt. Bobcoins are limited (40 per person).

## Session 1: tests for the verdict and config

```
Read src/verdict.ts and src/config.ts. Add a test file test/verdict.test.ts using node:test and node:assert/strict (run with `npm test`). Cover:
1. The smallest change wins when several options meet every constraint.
2. An option that misses staleness is never picked, even if it is fastest.
3. When no option qualifies, the verdict says so and names the closest option.
4. Changing max_staleness_seconds from 10 to 60 changes the winner in a scenario where the cache is smallest but stale.
5. parseConfig rejects fewer than two options, duplicate ids, and ids with spaces.
Run npm test and make sure everything passes. Do not change src/ unless a test exposes a real bug; if it does, explain the bug in your summary.
```

## Session 2: the Settle custom mode

```
Create a Bob custom mode for this repo called "Settle" (slug: settle) in the project's .bob folder, using the format Bob expects for project modes. The mode's job: when a user pastes a design question or a design doc section, it writes a valid settle.yml next to the app (see demo/orders-api/settle.yml and src/config.ts for the exact schema), asks the user to confirm the options and constraints, then tells them to run `npx settle run` from that folder. It must never edit application code itself. Include a short README section explaining how to use the mode.
```

## Session 3: review the harness

```
Review src/measure.ts and src/cli.ts as a skeptical senior engineer. Look for anything that would make the comparison unfair between options (for example one option measured while another is still running, warm caches carried over, port reuse, processes left alive on Windows). Fix real problems with minimal changes, run `npm run typecheck`, and summarise what you changed and why.
```

## Session 4: tests for the building blocks and CI

```
Add tests that prove Settle's building blocks work, without calling Bob or the network:
1. test/measure.test.ts: renderBody ({{random A B}} stays in range, {{increasing}} grows per probe, other values untouched), readPath (nested objects and array indexes, missing paths return undefined), newDependencies (detects added deps and devDeps, ignores removed ones, handles a null base), and isTestFile from src/git.ts (test/, tests/, __tests__/, .test.ts, .spec.js count; src/server.ts does not).
2. test/events.test.ts: describeTool from src/events.ts turns read_file, write_file, apply_diff and execute_command calls into short labels, makes paths relative to the workspace (Windows and POSIX paths), and truncates long commands.
3. test/loadtest.test.ts: start a tiny node:http server on port 0 that answers in about 5 ms, run loadTest from src/measure.ts against it for 2 seconds at concurrency 4 with 0 warmup, and assert requests > 0, errors = 0 and p50 <= p95 <= p99.
4. .github/workflows/test.yml: on push and pull request, Node 24 on ubuntu-latest, npm ci at the root, npm run typecheck, npm test.
Use node:test and node:assert/strict. Run npm test and npm run typecheck until both pass. Do not change src/ unless a test exposes a real bug; if it does, explain it in your summary.
```
