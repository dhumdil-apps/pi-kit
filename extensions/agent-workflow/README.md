# Agent Workflow

Injects one of **two session-mode flows** — Plan (default) or Implement — plus
shared tone/engineering/state/learning guidance into every turn. The flow is
three steps: understand the goal and explore, present a four-section plan
ending in **Proceed, handoff, or revise?**, then execute the approved plan and
summarize. Standing rule in every mode: never commit, stash, or push. The flows
are guidance only; nothing here is enforced.

[`docs/FLOW.md`](../../docs/FLOW.md) is the canonical human-readable behavior
contract; this extension's injected prompt is its operational mirror and the
source of operational detail. Project-level `AGENTS.md` files own
project-specific stack and repository conventions.

## User surface

- `save_plan` — the single tool (`task.ts`). The agent calls it after
  presenting the plan; it normalizes the task name, names the session, and
  writes `.pi/plan/<task-name>.md` with the same four sections shown in chat:
  Current state, Desired state, Approach, Quirks. Re-saving after a revision
  overwrites the same file. The agent never deletes plan files; legacy
  `.pi/goal/` files are ignored and preserved.
- **The approval prompt** (`index.ts`) — a successful `save_plan` arms it, and
  it appears when the turn settles, as a native `ctx.ui.select`: *Proceed,
  handoff, or revise?* The context load picks the recommendation (lean →
  Proceed, loaded → Handoff — the same thresholds that colour the `ctx`
  readout). Proceed switches to Implement in place (`mode.ts`) and kicks off
  execution immediately; Handoff prefills `/handoff <task-name>` (only a
  command handler can spawn a session); Revise or dismissing changes nothing.
  Headless sessions get a displayed message naming the command instead.
- `/handoff [task-name]` — the only registered command (`handoff.ts`). Spawns a
  fresh Implement session seeded with the mode marker and task name before its
  first turn, plus a kickoff naming the plan path; executing from a handoff is
  auto-approved. Because `.pi/plan/` accumulates, resolution never assumes a
  single file: explicit name, then session name, then a lone remaining file —
  several files mean it asks.

The mode survives reload/fork via a hidden branch marker, re-derived before
every turn — that is also how a handoff-seeded session knows its mode before
its first turn (`mode.ts` publishes it so Progress Tracker can render it).

The agent, not the extension, maintains `.pi/MEMORY.md`: it proposes updates at
close-out and applies them only after the user confirms.

## Notes

- The workflow block stays near the start of extension load order for provider
  prefix-cache reuse; within a session the injected prompt is stable (it only
  changes when the mode switches).
- The behavior contract is documented in [docs/FLOW.md](../../docs/FLOW.md);
  the injected prompt in `index.ts` carries the full operational detail.

## Origin

Bundle-local.
