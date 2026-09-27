# Submission copy

## Project title

Settle

## Short description

When your team argues about how to build something, Settle builds each option with IBM Bob in parallel, measures them all the same way, and shows you which one fits your constraints.

## Long description (problem and solution, max 500 words)

**The problem.** Every engineering team makes design calls every week: cache or materialized view, queue or direct call, library A or library B. Today those calls are settled by whoever argues best, or by one engineer spending days on a throwaway version of one option. Most teams skip even that and guess, and a wrong call shows up months later, after other code is built on top of it.

The numbers that would end the argument (speed, data freshness, code added, tests passing) only exist once every option is actually built in the real codebase. That has always been too slow to do for every decision.

**The solution.** Settle makes building every option cheap. A tech lead writes the question, the options and the team's constraints in a short settle.yml file, or pastes a design doc into the Settle mode in Bob IDE and gets the file drafted for them. Then one command:

1. Gives every option its own git branch and worktree from the same commit.
2. Starts one IBM Bob Shell session per option, all in parallel. Each Bob builds a working, tested version of its option.
3. Runs the same load test (three times), freshness probe and test suite on every branch, one at a time.
4. Applies a transparent rule: an option qualifies if it meets every constraint, and the smallest change among qualifying options wins.
5. Writes a results page and a design doc appendix the team can paste straight into their review.

**Target users.** Tech leads who write design docs, and the reviewers who approve them. The review gets evidence instead of opinions.

**What the demo shows.** An orders API has a slow top customers endpoint: about 0.7 seconds at the 95th percentile under load. Bob builds three fixes in parallel (an in memory cache, a materialized view, an index with a query rewrite), each on its own branch with its own tests, in about two minutes. The measurements tell a story no opinion would: the cache is fastest (2 ms) but serves results up to a minute old; the index keeps data fresh but still takes 198 ms; the materialized view lands at 15 ms with results at most 5 seconds behind. With the team's limits (under 50 ms, at most 15 seconds stale) the materialized view wins. Drag the staleness limit to 90 seconds on the results page and the cache wins with less code; accept 500 ms and the index wins with the smallest change. The measurements never change; only the constraints do.

**It checks the builder too.** In one real run Bob edited an existing test file to make its option pass; Settle refused that option. Options that error, fail requests, skip the freshness probe or touch existing tests can never win.

**Why it is new.** Coding assistants answer "how would I build this". Settle answers "which should we build" by building all of them.

## IBM Bob usage statement (max 500 words)

IBM Bob is used in two places: as the engine inside the product, and in Bob IDE to build, test and harden it.

**Inside the product: Bob Shell builds every option in parallel.** For each option in settle.yml, Settle creates a git worktree and starts a headless Bob Shell session with a prompt built from the question, that option's description, the competing options it must not build, and strict rules: keep every route and response shape identical, never edit existing tests, add tests for your change, make sure the suite passes and exits. The sessions run at the same time, so three options take about as long as one. In the recorded run Bob built a TTL cache, a materialized view with a background refresher, and a covering partial index, each with its own tests, in about two minutes per option. Settle streams every Bob tool call (file reads, edits, test runs) into the live view, saves them so the hosted site can replay the run, and records each session's duration, tool calls and Bobcoin cost. A full run costs about two Bobcoins. Without Bob, Settle has nothing to compare.

**Bob IDE, in Agent mode and the Settle custom mode (task summaries in bob_sessions):**

1. **Tests, the Settle mode, and a fairness review.** Bob wrote the verdict and config test suite; wrote `.bob/custom_modes.yaml`, a project mode that turns a design question into a valid settle.yml and may edit nothing else; and reviewed the measurement harness, finding and fixing two real bugs: the next option could start before the previous server had exited, and a timed out freshness probe could leak into the next one.
2. **Building block tests and CI.** Bob wrote the tests for the load test, probe templates, dependency diff, test file detection and activity labels, plus the GitHub Actions workflow.
3. **Settle mode as the front door.** From a plain English description of the debate, the Settle mode drafted the settle.yml for the demo and asked for confirmation. It also nudged the cache's time to live to fit the staleness limit, a reminder that the team, not the assistant, owns the options.
4. **A trust review.** Asked to find any way a broken or tampering option could still win, Bob found four gaps and fixed them with tests: a renamed test file slipping past the integrity check, the site builder not protecting Settle's worktree folder, the dirty check exempting any file named settle.yml, and a run where every request failed dragging the median latency down.

Settle's orchestration, measurement harness, verdict rules and interface were written outside Bob; Bob built every compared option and did the testing, review and hardening work listed above. All Bob assisted changes are in the repository history.

watsonx.ai and watsonx Orchestrate were not used.

## Links

- Demo: https://settle-blush.vercel.app
- Repository: https://github.com/jenzylove/settle

## Tags

IBM Bob, Bob Shell, developer tools, design review, benchmarking, parallel agents, TypeScript
