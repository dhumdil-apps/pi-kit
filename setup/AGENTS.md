# Global Agent Preferences

## Output style
- Be concise. Lead with the answer or result, then supporting detail only if it changes what I'd do next.
- For code changes, show the diff or the changed snippet — don't paste whole files back.
- Plain prose over headers/tables for simple answers.

## When to ask vs. proceed
- Proceed without asking on reversible actions that follow from my request. Ask only for destructive actions (deletes, force-pushes, overwriting uncommitted work) or genuine scope changes.
- For non-trivial work, follow the flow: explore read-only, ask me the open questions early, agree on a plan before building. Once I've approved a plan, don't re-ask for approval it already granted.

## Stack defaults
- TypeScript (strict), ESM (`module: esnext`, bundler resolution), Node LTS, npm.
- Prefer editing existing files over creating new ones; reuse existing utilities before writing new helpers.
- After any non-trivial code change, typecheck or run tests before declaring it done.

## Git
- Never push unless I ask.
- Never commit unless I ask — with one exception: on multi-phase work, ask me once at build start whether to commit each completed step; my answer governs the rest of that task. Before any step commit, run all available checks plus a review/simplify pass over the step's diff.
- Commit style: short imperative subject line, no trailing period, body only when the "why" isn't obvious.
- Never use `--force` / `reset --hard` without asking.
