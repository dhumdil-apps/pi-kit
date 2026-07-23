# Progress Tracker

Replicates GitHub Copilot's `manage_todo_list` and combines its global workflow
phase with Agent Workflow's session mode. The phase persists through tool result
details reconstructed from the current session branch; Agent Workflow publishes
the mode. Both appear in an always-visible indicator above the editor; local
todos remain a separate widget and may track work in any phase.

## User surface

- `manage_todo_list` tool — `read`/`write` ordinary todos, or `phase` to select
  `goal`, `planning`, or `implementation` (one todo in progress at a time).
- Persistent workflow indicator — idle `goal` states show `<MODE>`; later
  phases show `<MODE> · <PHASE>`. Both are followed by the context readout
  `ctx █░░░ 84.0k / 1.0M`, refreshed at turn boundaries and colored
  accent / warning / error above 60% and 80% (this is the bundle's only context
  indicator — Status Bar no longer ships one). The bar carries the proportion,
  so the percentage is not printed. Active agent runs choose a
  concise mode-specific activity and randomly change it every 10 seconds
  without immediately repeating it, in the default blue accent color.
- `/todos` command — report the phase indicator location and toggle the
  independent local todo widget.
- `/todos clear` — clear and hide local todos without resetting the phase.

## Origin

Vendored from `tintinweb/pi-manage-todo-list` (commit `b75c449`, MIT) — see
[UPSTREAM.md](../../UPSTREAM.md).
