# Troubleshooting

## Pi does not show the bundle

1. Check `packages` in `~/.pi/agent/settings.json` contains exactly
   `/Users/martin-peter.lakatos/pi-bundle`.
2. Run `pi list`.
3. Restart Pi; a running process does not reload edited extensions.
4. Run the headless smoke from [DEVELOPMENT.md](DEVELOPMENT.md).

## Plan Mode did not start

- It starts automatically only in interactive parent sessions.
- Headless `pi -p`, RPC, and subagent children intentionally bypass it.
- Check `/extension-settings` → Plan Mode → auto-start.
- `/plan off` ends the current plan; `/plan` or `/plan deep` arms a new one.

## A plan cannot become ready

For Standard/Deep, inspect `/plan status` and `/subagents-fleet`. Readiness needs
one completed scout/context-builder and one schema-valid primary planner. A
failed planner has only one retry.

## Execution is blocked by dirty files

Run:

```bash
git status --short --untracked-files=all
```

Only the active `.pi/plans/<slug>.md` and `.state.json` pair may be dirty.
Commit, move, or otherwise resolve unrelated files yourself. Plan Mode never
stashes, resets, or cleans them.

## A worktree patch conflicts

The preflight leaves the main tree untouched. The orchestrator should launch
one fresh sequential worker for that todo against current main-tree state and
record the outcome with `plan_resolve_redispatch`. A second failure blocks the
plan; do not hand-merge automatically.

## Plan Mode says “Needs decision”

Inspect pending child requests with `subagent_supervisor({action:"pending"})`.
The parent asks the user through Ask User when needed, replies to the exact
request, then resumes `subagent_wait`.

## Review cannot complete

Review requires one completed foreground reviewer batch. Required findings must
receive the single corrective worker pass. After that, full validation must
pass; there is no second general review batch.

## Permission Gate did not prompt

It is intentionally denylist-based, not a general approval system. It prompts
for recognized destructive commands and edit/write outside the project. It does
not normally prompt for installs, pushes without force, mkdir, redirects, or
other reversible work. See source comments in
`extensions/permission-gate/index.ts` for known matcher limits.

## Ask User cannot open

The modal requires an interactive UI. Headless calls must return a safe text
result or block instead of waiting for a modal. Confirm the Ask User extension
is loaded before Plan Mode and Permission Gate in `package.json`.

## Full typecheck fails while focused checks pass

Use `npm run typecheck:plan` for the strict Plan Mode gate. `npm run typecheck`
also includes large vendored extensions and currently exposes their upstream
API/type drift. Do not suppress new errors in touched files; distinguish the
known vendored backlog from regressions introduced by a change.

## Memory is missing or too large

- Memory is per project at `.pi/MEMORY.md`.
- `/memory` shows it; `remember` creates/appends it.
- Check `/extension-settings` → Memory → enabled.
- Injection keeps the newest tail when the file exceeds roughly 8,000
  characters; periodically curate durable entries if it becomes noisy.
