<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Delivery contract

For implementation or code-change tasks, finish with a reviewable GitHub change:

- Work in a dedicated Codex Worktree based on the latest `main`. Do not use a shared Local checkout for parallel work.
- Use a unique `codex/<short-task-name>` branch. If the Worktree starts on a detached `HEAD`, create the branch before committing.
- Never commit or push directly to `main`, and never reuse a branch after its pull request has been merged.
- Keep the change scoped to the task. Do not stage or commit unrelated existing changes in the checkout.
- Before declaring completion, run the appropriate project checks. For normal code changes, run at least `npm run lint`, `npm run typecheck`, and `npm test`; run build, RLS, or end-to-end checks when the change affects them.
- Commit with a concise, descriptive message.
- Push the task branch with `git push -u origin HEAD`.
- Open or update a pull request targeting `main` (use `gh pr create --base main --fill` for a new pull request) and include the change summary and checks run.
- Do not merge the pull request or deploy production directly from the task. Leave those actions to configured GitHub/Vercel automation unless the user explicitly requests otherwise.
- If pushing or opening the pull request fails because of authentication, network, conflicts, or missing tooling, report the exact blocker instead of claiming the task is complete.
- Never commit secrets, local environment files, credentials, or tokens.
