# Submission copy

## Project title

Settle

## Short description

Find the landmines before you estimate. Settle has IBM Bob test the risky assumptions behind a feature against your real code, in parallel, and shows what is proven, what is blocked, and the evidence.

## Long description (problem and solution, max 500 words)

**The problem.** A product manager asks for a feature: multi currency, team accounts, single sign on. Engineers read the code and estimate "about two days". Three days in, they hit something nobody knew was there: a column that cannot hold the new values, a query that silently gives wrong answers, a cache shared across customers. The estimate was not wrong because the engineers were careless. It was wrong because the risky parts were only discovered by building them.

**The solution.** Settle moves those discoveries to the start. You give it one sentence, the feature you are about to estimate, and it runs against your real repository:

1. **Bob finds the risks.** IBM Bob reads the code the feature would touch and names the assumptions the feature silently depends on, phrased as what must be true for the feature to be as easy as it looks.
2. **Bob runs experiments.** One Bob Shell session per assumption, all at once, each in its own git worktree, writes the smallest test that proves or disproves that assumption against today's code.
3. **Settle checks the work.** Settle reruns every experiment itself instead of trusting Bob's word. Passing means proven. Failing means blocked, with the exact error or wrong value. Anything that could not run, or that edited existing code or tests, is unknown.
4. **Bob writes the plan** from what was actually found: what we now know, the landmines to fix first, the build order, and how the findings change the estimate.

The result is an evidence board a whole team can read: plain words for the product manager, the failing test and the branch for the engineers.

**Target users.** Engineering teams during planning and estimation: tech leads, engineers, and the product managers who need an honest size before committing to a date.

**What the demo shows.** The request: "Let customers pay in their own currency (USD, EUR, JPY and IDR), and keep the top customers ranking correct." In about five minutes, Bob names three assumptions (revenue totals can hold large amounts, orders can record a currency, and the ranking compares revenue fairly across currencies), builds an experiment for each in parallel, and Settle reruns them. The evidence board shows which assumptions fail against today's code and why, with the real error output, then Bob's plan puts those landmines first.

**Why it is new.** An AI can guess what might go wrong with a feature. Settle proves it, with experiments against the real code, verified independently of the agent that wrote them. Earlier planning tools predict risks from text; Settle turns each risk into a runnable test before anyone commits to an estimate.

## IBM Bob usage statement (max 500 words)

IBM Bob is used in two places: as the engine inside the product, and in Bob IDE to build, test and harden it.

**Inside the product: Bob Shell does the investigating.** Settle runs three kinds of headless Bob Shell session. First, one session reads the code the feature would touch and writes the risky assumptions as structured JSON. Second, one session per assumption runs in parallel, each in its own git worktree, and writes the smallest experiment that proves or disproves its assumption against the real database setup, queries and handlers, with strict rules: do not mock what is being tested, do not change application code to make the assumption true, do not touch existing files. Third, a session writes the implementation plan from the verified results. Settle streams every Bob tool call, saves each session's log and Bobcoin cost with the proof, and reruns every experiment itself, so the verdict never rests on the agent's own claim. A full proof costs about three Bobcoins and takes about five minutes.

**Bob IDE, in Agent mode and the Settle custom mode (task summaries in bob_sessions):**

1. **Tests, the Settle mode, and a fairness review.** Bob wrote verdict and config tests, wrote `.bob/custom_modes.yaml` (a project mode that drafts Settle's configuration from a plain English description and may edit nothing else), and reviewed the measurement harness, finding and fixing two real bugs.
2. **Building block tests and CI.** Bob wrote tests for the process runner, templates, file detection and activity labels, plus the GitHub Actions workflow.
3. **Settle mode as the front door.** From a plain English description, the Settle mode drafted a configuration and asked for confirmation.
4. **A trust review.** Asked to find any way a broken or tampering result could still be trusted, Bob found four gaps and fixed them with tests.

Settle grew out of an earlier mode of the same engine that builds competing designs and measures them; in one of those real runs Bob edited an existing test to make its option pass, and Settle's integrity check refused it. That lesson is why `settle prove` reruns every experiment independently and distrusts any experiment that touches existing files.

Settle's orchestration, verification, pages and command line were written outside Bob; Bob does all of the investigating inside the product and did the testing, review and hardening work listed above. All Bob assisted changes are in the repository history.

watsonx.ai and watsonx Orchestrate were not used.

## Links

- Demo: https://settle-blush.vercel.app
- Repository: https://github.com/jenzylove/settle

## Tags

IBM Bob, Bob Shell, developer tools, estimation, planning, risk, experiments, TypeScript
