# Agent Workflow

Appends the **GOAL → PLANNING → IMPLEMENTATION**
working agreement to every turn. It guides conversational question batches,
explicit plan approval, durable-learning policy, and engineering practice.
Safety gates remain in `minimal-action-confirmation`.

[`docs/FLOW.md`](../../docs/FLOW.md) is the canonical human-readable behavior
contract; this extension's injected prompt is its operational mirror and the
source of operational detail. Project-level `AGENTS.md` files own
project-specific stack and repository conventions.

## User surface

- `manage_task` — set a concise `SI-<ticket>-<summary>` identity after
  exploration, refine it during Planning, then create, transition, update, or
  resume its lifecycle plan. Saved names are branch-ready; the tool never changes
  Git branches.

Lifecycle plans use `.pi/goal/<task-name>.<status>.md`: `todo` waits for its
next slice, `active` records the one approved slice underway, and `done` means
the full checklist and final validation completed. The mutable plan is the
cross-session source of truth; local todos cover only the current slice. Resume
always requires comparison with current intent, Git state, diff, and validation,
then fresh approval for one committable slice. Legacy unsuffixed plans and
`.pi/handoffs/` files are ignored and preserved.

The agent, not the extension, maintains `.pi/MEMORY.md` according to the workflow
protocol with explicit user confirmation. For a deep manual session
retrospective, see [docs/RECIPES.md](../../docs/RECIPES.md).

## Notes

- The stable workflow block stays near the start of extension load order for
  provider prefix-cache reuse and is injected verbatim on every turn.
- The behavior contract is documented in [docs/FLOW.md](../../docs/FLOW.md);
  the injected prompt in `index.ts` carries the full operational detail.

## Origin

Bundle-local.
