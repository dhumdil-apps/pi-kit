# Progress Tracker

Replicates GitHub Copilot's `manage_todo_list` and adds a global workflow
phase. Both states persist through tool result details reconstructed from the
current session branch. The phase appears in an always-visible indicator above
the editor; local todos remain a separate widget and may track work in any
phase.

## User surface

- `manage_todo_list` tool — `read`/`write` ordinary todos, or `phase` to select
  `goal`, `planning`, or `implementation` (one todo in progress at a time).
- Persistent phase indicator — idle states show `GOAL`, `PLANNING`, or
  `IMPLEMENTATION`; active agent runs animate working messages in the default
  blue accent color.
- `/todos` command — report the phase indicator location and toggle the
  independent local todo widget.
- `/todos clear` — clear and hide local todos without resetting the phase.

## Origin

Vendored from `tintinweb/pi-manage-todo-list` (commit `b75c449`, MIT) — see
[UPSTREAM.md](../../UPSTREAM.md).
