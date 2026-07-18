# Troubleshooting

## Pi does not show the bundle

1. Check `packages` in `~/.pi/agent/settings.json` contains exactly
   `/Users/martin-peter.lakatos/pi-bundle`.
2. Run `pi list`.
3. Restart Pi; a running process does not reload edited extensions.
4. Run the headless smoke from [DEVELOPMENT.md](DEVELOPMENT.md).

## Plan Mode did not start

- It starts automatically only in interactive parent sessions.
- Headless `pi -p` and RPC intentionally bypass it.
- Check `/extension-settings` → Plan Mode → auto-start.
- `/plan off` ends the current plan; `/plan` or `/plan deep` arms a new one.

## A plan cannot become ready

Inspect `/plan status`. The plan draft written in the agent's response must
contain a Goal section, a numbered task list under a "Plan:" heading, and a
Validation section, then end with `<!-- plan-ready -->`. There is no subagent
handoff to wait on — the agent writes the draft directly.

## Execution is blocked by dirty files

Run:

```bash
git status --short --untracked-files=all
```

Only the active `.pi/plans/<slug>.md` and `.state.json` pair may be dirty.
Commit, move, or otherwise resolve unrelated files yourself. Plan Mode never
stashes, resets, or cleans them.

## Review cannot complete

Review is a single-agent phase: reread the diff against the plan's goal and
validation, classify findings with `plan_record_review_decision`, fix required
findings inline, then re-run full validation before completing the review
todo.

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
also includes large vendored extensions (`pi-web-access`) and currently exposes
their upstream API/type drift. Do not suppress new errors in touched files;
distinguish the known vendored backlog from regressions introduced by a
change.

## Memory is missing or too large

- Memory is per project at `.pi/MEMORY.md`.
- `/memory` shows it; `remember` creates/appends it.
- Check `/extension-settings` → Memory → enabled.
- Injection keeps the newest tail when the file exceeds roughly 8,000
  characters; periodically curate durable entries if it becomes noisy.
