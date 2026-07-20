# Agent Workflow

Appends the **GOAL (VISION) → MEASURE (DISCOVER) → CUT (SHAPE → POLISH)**
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

The extension also injects bounded current-session evidence for the reflection
commands. The agent, not the extension, maintains `.pi/MEMORY.md` and
`.pi/improvements/` according to the workflow protocol.

## Notes

- The stable workflow block stays near the start of extension load order for
  provider prefix-cache reuse; only Flash state is appended dynamically.
- The full behavior is documented in [docs/FLOW.md](../../docs/FLOW.md).

## Origin

Bundle-local.
