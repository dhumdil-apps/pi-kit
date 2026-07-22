# Agent Workflow

Appends the **GOAL → PLANNING → IMPLEMENTATION**
working agreement to every turn. It guides conversational question batches,
explicit plan approval, Flash mode, retrospective learning, and engineering
practice. Safety gates remain in `minimal-action-confirmation`.

[`docs/FLOW.md`](../../docs/FLOW.md) is the canonical human-readable behavior
contract; this extension's injected prompt is its operational mirror and the
source of operational detail. Project-level `AGENTS.md` files own
project-specific stack and repository conventions.

## User surface

- `/flash` — autonomous recommended-choice cruise control. Any ordinary user
  message cancels it; the status bar shows `⚡ flash` while active.
- `/forensic [raw]` — deep reconstructed review, optionally with bounded raw
  evidence.
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

The extension also injects bounded current-session evidence for the `/forensic`
command. That evidence measures session-lifetime tool-result text characters,
images, errors, per-tool totals, and the largest results only when reflection is
requested; there is no live hook or persistent metrics store. Material output
pressure receives one retrospective recommendation, while ordinary sessions stay
quiet. The agent, not the extension, maintains `.pi/MEMORY.md` according to the
workflow protocol with explicit user confirmation.

## Notes

- The stable workflow block stays near the start of extension load order for
  provider prefix-cache reuse; only Flash state is appended dynamically.
- The behavior contract is documented in [docs/FLOW.md](../../docs/FLOW.md);
  the injected prompt in `index.ts` carries the full operational detail.

## Origin

Bundle-local.
