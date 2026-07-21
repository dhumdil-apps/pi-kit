# Progress Tracker

Replicates GitHub Copilot's `manage_todo_list` and adds a separate global
workflow route. Both states persist through tool result details reconstructed
from the current session branch. The global route displays `GOAL`, `MEASURE
TWICE`, and `CUT ONCE` vertically: `✓` marks completed phases, `◉` the current
phase, and `○` upcoming phases. It appears after the first submitted prompt,
or when `/todos` is requested. Local todos are a separate widget and may track
work in any phase.

## User surface

- `manage_todo_list` tool — `read`/`write` ordinary todos, or `phase` to select
  `goal`, `measure`, or `cut` (one todo in progress at a time).
- `/todos` command — reveal global workflow progress and toggle the independent
  local todo widget.
- `/todos clear` — clear and hide local todos without resetting the phase.

## Origin

Vendored from `tintinweb/pi-manage-todo-list` (commit `b75c449`, MIT) — see
[UPSTREAM.md](../../UPSTREAM.md).
