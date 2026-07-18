# pi-bundle

A single, vendored [Pi](https://pi.dev) package maintained by `dhumdil-apps`.
It includes the active extensions and the Ask User skill previously installed as
separate packages.

## Documentation

Start with the [documentation index](docs/README.md), then use the focused guide:

- [Extension and resource catalog](docs/EXTENSIONS.md)
- [Orchestrated Plan Mode](docs/PLAN_MODE.md)
- [Commands and tools](docs/COMMANDS.md)
- [Local Pi setup](docs/LOCAL_SETUP.md)
- [Development and maintenance](docs/DEVELOPMENT.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)
- [Vendored upstream inventory](UPSTREAM.md)

## Features

- **plan-mode** — auto-starts a persistent, auditable workflow in every interactive parent session. Quick mode triages truly trivial changes to an inline plan; standard and deep work require fresh discovery plus one schema-valid planner handoff before approval. Execution delegates worker slices, checkpoints accepted todos, validates the project, and ends with a mandatory reviewer batch plus at most one corrective pass. `/plan deep|off|execute|resume|status`.
- **permission-gate** — ask-user confirmation only for destructive commands (`rm -rf`, `git reset --hard`, `sudo`, …) and writes outside the project.
- **memory** — minimal per-project `.pi/MEMORY.md`, injected each turn; `remember` tool + `/memory`.
- **manage-todo-list**, **subagents**, **web-access**, **powerbar** (+ live quota via **pi-usage**), **usage-extension** (`/usage` history), **ask-user** modal + skill, **claude-style** prompt, **welcome** banner, bundled `dark` theme, and `/init` prompt. This machine selects its separate local `github-dark` theme.

## Install (local path)

This is a working copy loaded directly by Pi. In `~/.pi/agent/settings.json`:

```json
"packages": ["/Users/martin-peter.lakatos/pi-bundle"]
```

Edits apply on the next Pi start — no `pi install`/`pi update` needed. GitHub
(`git@github.com:dhumdil-apps/pi-bundle.git`) is the backup remote; push after
meaningful changes.

For a one-off test without changing settings:

```bash
pi -ne -e /absolute/path/to/pi-bundle
```

## Development

Edit the source under `extensions/` or `skills/`. Keep upstream provenance in
[`UPSTREAM.md`](UPSTREAM.md) when importing updates.

Focused Plan Mode tests and typecheck:

```bash
npm test
npm run typecheck:plan
```

`npm run typecheck` checks every vendored extension. It currently also reports
upstream type/API drift in pi-subagents and pi-web-access; keep the focused gate
green while those upstream errors are retired.

## Orchestrated Plan lifecycle

Plan files are timestamped under `.pi/plans/` as a readable Markdown ledger and
a version-2 JSON state file. The current ledger is linked to the Pi session, so
startup/reload/resume restores it and a fork creates a child ledger with a
`parentPlan` link. Extension Settings are global per-user and string-backed.

The phases are `triage → discovering → deciding → planning → ready → executing
→ reviewing → complete`, with `blocked` preserving recoverable state. Deep mode
always orchestrates. Standard work cannot become ready without a successful
scout/context handoff and exactly one accepted primary planner result.

Execution requires a clean Git tree except for the active ledger/state pair.
Parallel workers are optional and only eligible for clean, dependency-ready,
non-overlapping tasks marked `parallelSafe`; captured patches are preflighted
with `git apply --3way --check` and never hand-merged. In a non-Git directory,
plans, agents, todos, and review continue while worktrees and automatic commits
are disabled and the degraded mode is recorded.

Useful settings in `/extension-settings`: `plan-mode.orchestration`,
`plan-mode.quick-triage`, `plan-mode.max-discovery-agents`,
`plan-mode.parallel-workers`, and the fixed one-pass
`plan-mode.review-fix-rounds`. Web Access defaults to `auto-summary` in
`~/.pi/web-search.json`.

For the authoritative workflow contract, including orchestration enforcement,
worktree rules, review, persistence, and recovery, see
[docs/PLAN_MODE.md](docs/PLAN_MODE.md).
