# Agent Workflow

Injects one of **three session-mode flows** — Plan (default), Implement, or
Review — plus shared tone/engineering/state/learning guidance into every turn.
Motto: measure twice, cut once — plan in one session, implement in a fresh one,
review with fresh eyes. The human drives every switch through one command,
`/mode` (the model cannot); Progress Tracker shows the current mode above the
editor. The flows are guidance only; nothing here is enforced.

[`docs/FLOW.md`](../../docs/FLOW.md) is the canonical human-readable behavior
contract; this extension's injected prompt is its operational mirror and the
source of operational detail. Project-level `AGENTS.md` files own
project-specific stack and repository conventions.

## User surface

- `/mode` — the single human-only mode command (`index.ts`, `mode-picker.ts`).
  With no arguments it opens a picker: step 1 chooses plan/implement/review
  (the active mode is highlighted and marked *current*); for implement and
  review, step 2 chooses **Continue in this session** or a **Fresh session**.
  Both steps show the live context readout, so a filling context nudges toward
  fresh. plan has no step 2 — it is always the same-session default.
- `/mode <plan|implement|review> [continue|fresh] [task-name]` — the direct
  form for muscle memory, headless runs, and scripts (no picker). `continue`
  switches mode in place (`mode.ts`) — persisted across reload/fork via a
  hidden branch marker that also records boundary-vs-in-place, so in-place
  modes carry a short caveat in their flow. `fresh` crosses a session boundary
  (`handoff.ts`): it resolves the task (explicit name, the current task, or the
  single pending plan under `.pi/goal/`; several plans mean it asks) and spawns
  a session seeded with the mode marker and task name plus a kickoff message
  carrying the plan and discovery paths. The seeded marker is why mode is
  re-derived from the branch before every turn: the new session's extension
  instance loads before the marker exists. Only a command handler can spawn a
  session, so `fresh` is reachable only through `/mode`.
- After a plan is saved, the input is prefilled with `/mode implement`: one
  Enter opens the continue-vs-fresh picker, so the plan → implement boundary
  flows without retyping.
- `manage_task` — set a concise task identity after exploration, refine it
  during planning, then create, transition, update, or resume its lifecycle
  plan. Saved names are branch-ready; the tool never changes Git branches.

Lifecycle plans use `.pi/goal/<task-name>.<status>.md`: `todo` waits for its
next slice, `active` records the one approved slice underway, and `done` means
the full checklist and final validation completed. The mutable plan is the
cross-session source of truth; local todos cover only the current slice. A
sibling `.pi/goal/<task-name>.discovery.md` exploration handoff (written by
Plan mode, read by Implement/Review) is a prompt convention, not tool-managed
state — a hint that current evidence always beats. Resume always requires
comparison with current intent, Git state, diff, and validation, then fresh
approval for one committable slice. Legacy unsuffixed plans and
`.pi/handoffs/` files are ignored and preserved.

The agent, not the extension, maintains `.pi/MEMORY.md` according to the workflow
protocol with explicit user confirmation. For a deep manual session
retrospective, see [docs/FLOW.md](../../docs/FLOW.md#reflection-and-durable-learning).

## Notes

- The workflow block stays near the start of extension load order for provider
  prefix-cache reuse; within a session the injected prompt is stable (it only
  changes when the human switches mode).
- The behavior contract is documented in [docs/FLOW.md](../../docs/FLOW.md);
  the injected prompt in `index.ts` carries the full operational detail.
- `mode.ts` publishes the restored mode on session events so Progress Tracker
  can render it after rebuilding its own state.

## Origin

Bundle-local.
