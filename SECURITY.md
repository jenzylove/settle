# Security

## What Settle runs

Settle runs code on your machine: IBM Bob Shell sessions that edit your repository in separate git worktrees, then your app's install, test and start commands in each worktree. Only run Settle on repositories and debates you trust, exactly as you would run their test suites.

Settle never merges anything. Every option stays on its own `settle/<run>/<option>` branch until you choose what to do with it.

## Secrets

- `BOB_API_KEY` is read from the environment and passed only to Bob Shell. Settle never writes it to disk or to run output.
- Run folders (`runs/<id>/`) contain Bob session logs with the prompt and Bob's output. Review them before publishing a run.
- The repository keeps the hackathon template's `.gitignore` and `.bobignore` patterns so credentials stay out of commits and out of Bob's context.

## Reporting a problem

Open an issue on GitHub, or for anything sensitive, contact the maintainer through their GitHub profile rather than a public issue.
