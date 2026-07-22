# Agent Workflow

Appends the **GOAL (VISION) → PLANNING (DISCOVER) → IMPLEMENTATION (SHAPE → POLISH)**
working agreement to every turn. It guides conversational question batches,
explicit plan approval, Flash mode, retrospective learning, and engineering
practice. Safety gates remain in `minimal-action-confirmation`.

## User surface

- `/flash` — autonomous recommended-choice cruise control. Any ordinary user
  message cancels it; the status bar shows `⚡ flash` while active.
- `/retro` — compact current-session review.
- `/forensic [raw]` — deep reconstructed review, optionally with bounded raw
  evidence.
- `/improvements` — list and revalidate deferred improvement records.
- `manage_task` — set a concise `SI-<ticket>-<summary>` identity after
  exploration, refine it during Planning, save the approved plan and freeze the
  name, or persist/resume one compact cross-session handoff. Saved names are
  branch-ready; the tool never changes Git branches.

Approved repository plans are created once at `.pi/plans/<task-name>.md` and
are never overwritten. Frozen task identity is recovered from session history
or the matching plan on resume.

Optional handoffs live at `.pi/handoffs/<task-name>.md`. A checkpoint records
only status, the last completed plan step, the next action, remaining checks,
and one open decision; it is written only when pausing, blocked, or complete and
never mirrors local todos. `manage_task` with `operation=resume` returns the
immutable plan plus an active/blocked handoff and requires comparison with the
current request, Git state, diff, and validation evidence. Completed handoffs
remain local for diagnosis but are not returned as active resume state.

The extension also injects bounded current-session evidence for the reflection
commands. That evidence measures session-lifetime tool-result text characters,
images, errors, per-tool totals, and the largest results only when reflection is
requested; there is no live hook or persistent metrics store. Material output
pressure receives one retrospective recommendation, while ordinary sessions stay
quiet. The agent, not the extension, maintains `.pi/MEMORY.md` and
`.pi/improvements/` according to the workflow protocol.

## Notes

- The stable workflow block stays near the start of extension load order for
  provider prefix-cache reuse; only Flash state is appended dynamically.
- The full behavior is documented in [docs/FLOW.md](../../docs/FLOW.md).

## Origin

Bundle-local.
