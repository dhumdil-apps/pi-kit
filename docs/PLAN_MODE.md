# Plan Mode

Plan Mode is the default interactive workflow. It runs as a single agent —
there is no subagent tool and no child-process delegation. The agent is the
architect throughout: it explores, writes the plan, implements, validates, and
reviews, all inline in the same session.

Headless/print runs do not auto-start planning, show Welcome, or run the
spinner.

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

The Powerbar shows the current phase, todo progress, and blocked state.

## Triage

Quick mode may choose `trivial` only when all of these are true:

- one known/localized file or equally narrow change;
- obvious acceptance criteria;
- no architectural, security, external-research, or ambiguous behavior choice.

A trivial task remains ledgered but explores and plans inline. Standard and
Deep tasks read the relevant code inline (targeted reads, not broad
filesystem-wide searches) before writing the plan.

The agent writes the plan draft directly in its response: a Goal section, a
"Plan:" heading with a numbered task list, a Validation section, and a Risks
section, ending with `<!-- plan-ready -->`. There is no separate planner
handoff or structured-output schema to satisfy.

## Approval and execution gate

Rendered prose alone cannot execute. The state must reach `ready`, and
`/plan execute` checks the gate again: the plan draft must contain a Goal
section, a numbered task list, and a Validation section.

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

## Execution

Sequential execution in the main worktree. The agent implements each todo
itself, validates it, and only then updates the parent todo list — there is no
worker handoff, no worktree isolation, and no patch integration step.

## Validation and commits

Per-slice validation runs available `lint` and `typecheck` package scripts plus
plan-specified targeted acceptance commands. A completed todo is committed
with only its implementation paths and updated ledger/state.

Before review, Plan Mode runs the available `lint`, `typecheck`, `test`, and
`build` scripts. Failure blocks review. After a corrective review pass, the
full suite runs once more.

Without Git, phases, ledger, todos, and review continue. Automatic commits are
disabled.

## Review

Every plan ends with `Review and simplify the changes`.

The agent rereads the diff against the plan's goal and validation sections
inline, classifies findings as required, optional, or rejected with
`plan_record_review_decision`, and fixes required findings itself. There is no
reviewer subagent batch — one corrective fix pass, then full validation reruns.

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
| `plan-mode.orchestration` | `on` | Enforce the plan-ready gate before execution |
| `plan-mode.quick-triage` | `on` | Permit proven trivial tasks to remain inline |
