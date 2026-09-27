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
3. Runs the same load test, the same data freshness probe and the same test suite against every branch, one at a time so no option steals CPU from another.
4. Applies a transparent rule: an option qualifies if it meets every constraint, and the smallest change among qualifying options wins.
5. Writes a results page and a design doc appendix the team can paste straight into their review.

**Target users.** Tech leads who write design docs, and the reviewers who approve them. The review gets evidence instead of opinions.

**What the demo shows.** An orders API has a slow top customers endpoint: almost 2 seconds at the 95th percentile under load. Settle asks Bob to build three fixes in parallel: an in memory cache, a materialized view, and an index with a query rewrite. About two minutes later all three exist on their own branches, each with its own tests. The measurements tell a story no opinion would: the cache is fastest (7 ms) but serves results up to a minute old; the index keeps data fresh but still takes 236 ms; the materialized view lands at 47 ms with results at most 5 seconds behind. With the team's limits (under 50 ms, at most 15 seconds stale) the materialized view wins. Drag the staleness limit to 90 seconds on the results page and the cache wins with less code; accept 500 ms and the index wins with nine lines. The measurements never change, only the constraints do, which is exactly the conversation a design review should be having.

**Why it is new.** Coding assistants answer "how would I build this". Settle answers "which of these should we build" by building all of them at once. Parallel agents are what make comparing every option affordable.

## IBM Bob usage statement (max 500 words)

IBM Bob is used in two places: inside the product, and to build the product.

**Inside the product: Bob Shell builds every option in parallel.** Settle's core loop is parallel Bob work. For each option in settle.yml, Settle creates a git worktree and starts a headless Bob Shell session (`bob run --format json`) with a prompt built from the question, that option's description, the names of the competing options it must not build, and strict rules: keep every route and response shape identical, never edit existing tests, add tests for your change, run the test suite before finishing. The sessions run at the same time, so three options take about as long as one. In the recorded demo run Bob built a TTL cache module, a materialized view with a background refresher, and a covering partial index, each with new tests, in roughly two minutes per option. Settle captures each session's JSON summary (duration, tool calls, Bobcoin cost) and stores it with the run, so reviewers can see exactly what building each option cost. A full three option run costs about two Bobcoins.

**Building Settle: Bob IDE in Agent mode.** We used Bob IDE for one multi step Agent task on the Settle repository (task summary in bob_sessions):

1. **Verdict and config tests.** Bob read the verdict and config modules and wrote an 11 test suite covering the smallest change rule, staleness disqualification, the no qualifying option case, the constraint flip that changes the winner, and config validation.
2. **The Settle custom mode.** Bob wrote `.bob/custom_modes.yaml`, a project mode that turns a pasted design question or design doc section into a valid settle.yml, confirms the options and constraints with the user, and is restricted to editing settle.yml files only. This makes Bob IDE the front door to Settle.
3. **A fairness review of the measurement harness.** Asked to look for anything that would make the comparison unfair, Bob found two real problems and fixed them: the harness stopped one option's server without waiting for it to exit before starting the next (on Windows the old server could still answer the health check), and a timed out freshness probe could leak into the next probe and understate staleness. Both fixes are in src/measure.ts and src/cli.ts.

**Why Bob fits.** Settle depends on Bob working with full repository context: each session reads the existing server, database setup and tests before changing anything, which is why its options are real, production shaped implementations rather than snippets. Parallel headless sessions make comparing every option cost minutes and a few Bobcoins instead of days of engineering time.

watsonx.ai and watsonx Orchestrate were not used.

## Links

- Demo: https://settle-blush.vercel.app
- Repository: https://github.com/jenzylove/settle

## Tags

IBM Bob, Bob Shell, developer tools, design review, benchmarking, parallel agents, TypeScript
