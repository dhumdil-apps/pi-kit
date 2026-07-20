# Memory

Minimal per-project durable memory: one `.pi/MEMORY.md` file per project.

## Behavior

- When the file exists and is non-empty, its content is appended to the system
  prompt every turn (truncated to the newest ~8k characters).
- The `remember` tool appends dated entries, optionally categorized as
  `decision`, `learning`, `preference`, or `guidance`.
- `permission-gate` writes through the exported `rememberEntry`/`memoryPath`
  helpers to capture user guidance from gate denials.

## User surface

- `remember` tool — append an entry.
- `/memory` command — show the file.
- Toggle via `/extension-settings` → memory → `enabled`.

## Origin

Bundle-local; minimal replacement for the removed `pi-memory-md` — see
[UPSTREAM.md](../../UPSTREAM.md).
