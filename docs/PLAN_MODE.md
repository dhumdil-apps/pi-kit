# Orchestrated Plan Mode

Plan Mode is the default interactive workflow. The main Pi agent is always the
orchestrator and user-facing decision authority. Children return bounded,
structured evidence or implementation handoffs.

Headless/print runs and child subagent processes do not auto-start planning,
show Welcome, or run the spinner.

## Lifecycle

```text
awaiting-goal
  → triage
  → discovering → deciding → planning
  → ready
  → executing
  → reviewing
  → complete

Any recoverable failure may enter blocked.
```

The Powerbar shows the current phase, discovery or todo progress, pending child
decisions, and blocked state.

## Triage

Quick mode may choose `trivial` only when all of these are true:

- one known/localized file or equally narrow change;
- obvious acceptance criteria;
- no architectural, security, external-research, or ambiguous behavior choice.

A trivial task remains ledgered but explores and plans inline. Standard and Deep
tasks require at least one successful scout/context handoff and exactly one
accepted primary planner result. Deep always orchestrates and may add wider
research or oracle critique.

The primary planner must return schema-valid structured output containing goal,
assumptions, decisions, validation, risks, and ordered tasks with dependencies,
files, acceptance checks, and `parallelSafe`. One failed planner may be retried
once. Further opinions use `oracle` or `reviewer`.

## Approval and execution gate

Rendered prose alone cannot execute. The state must reach `ready`, and
`/plan execute` checks the evidence gate again.

In Git projects, execution requires a clean tree except for the exact active
ledger pair. Dirty tracked, staged, deleted, or untracked project files block
execution and are listed. Plan Mode never stashes or cleans automatically.

Active files are:

```text
.pi/plans/YYYYMMDD-HHmmss-SSS-<goal>.md
.pi/plans/YYYYMMDD-HHmmss-SSS-<goal>.state.json
```

The JSON file is the machine-readable source. Markdown is the human ledger.
Both are included in scoped checkpoint commits.

## Workers and worktrees

Sequential execution in the main worktree is the default. A todo completes only
after a fresh worker handoff, patch integration when applicable, and required
checks.

Parallel worktree execution additionally requires:

- `plan-mode.parallel-workers` is on;
- the Git cleanliness gate passes;
- every worker prompt identifies its slice as `todo N`;
- every slice is planner-marked `parallelSafe`;
- dependencies are complete;
- declared file ownership does not overlap;
- `allowedDirtyPaths` exactly matches the active ledger/state pair.

Captured patches are integrated sequentially. Plan Mode runs
`git apply --3way --check` before applying. A failed check leaves the main tree
untouched and permits one fresh sequential redispatch. It never hand-merges a
worktree conflict.

## Validation and commits

Per-slice validation runs available `lint` and `typecheck` package scripts plus
planner-specified targeted acceptance commands. A completed todo is committed
with only its implementation paths and updated ledger/state.

Before review, Plan Mode runs the available `lint`, `typecheck`, `test`, and
`build` scripts. Failure blocks review. After a corrective review pass, the full
suite runs once more.

Without Git, phases, ledger, agents, todos, and review continue. Worktrees and
automatic commits are disabled, and review scope comes from worker handoffs.

## Review

Every plan ends with `Review and simplify the changes`.

The parent launches one foreground parallel reviewer batch with fresh contexts
for at least correctness/regressions, validation/coverage, and
simplicity/maintainability. Security or UX angles are added when relevant.
Reviewers cannot edit.

The parent records required fixes, optional improvements, rejected feedback,
and rationale. Required fixes allow exactly one corrective worker pass. There
is no second general review batch.

## Persistence and recovery

The session contains a custom link to the active version-2 state file:

- startup/reload restores the linked plan;
- resume reopens it;
- fork creates a new timestamped child ledger, copies approved state, and
  records `parentPlan`;
- `/plan resume <slug>` is the manual override;
- valid version-1 state migrates; corrupt or newer unsupported state is warned
  about and left untouched.

## Settings

All values are global, per-user strings stored in
`~/.pi/agent/settings-extensions.json`.

| Setting | Default | Meaning |
| --- | --- | --- |
| `plan-mode.auto-start` | `on` | Start planning in interactive parent sessions |
| `plan-mode.default-effort` | `low` | Quick default; Deep is selected with `/plan deep` |
| `plan-mode.orchestration` | `on` | Require child evidence for non-trivial plans |
| `plan-mode.quick-triage` | `on` | Permit proven trivial tasks to remain inline |
| `plan-mode.max-discovery-agents` | `3` | Cap scouts/research/context builders |
| `plan-mode.parallel-workers` | `on` | Permit eligible isolated workers |
| `plan-mode.review-fix-rounds` | `1` | Fixed corrective-pass limit |
