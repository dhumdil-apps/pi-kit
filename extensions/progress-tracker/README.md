# Progress Tracker

Replicates GitHub Copilot's `manage_todo_list` and adds a workflow phase ribbon.
The ribbon and ordinary todos are independent and persist through tool result
details reconstructed from the current session branch. Its visible labels are
`GOAL → MEASURE TWICE → CUT ONCE`; the longer phase meanings remain workflow
guidance rather than repeated UI subtitles.

## User surface

- `manage_todo_list` tool — `read`/`write` ordinary todos, or `phase` to select
  `goal`, `measure`, or `cut` (one todo in progress at a time).
- `/todos` command — toggle the progress widget.
- `/todos clear` — clear ordinary todos without hiding or resetting the phase.

## Origin

Vendored from `tintinweb/pi-manage-todo-list` (commit `b75c449`, MIT) — see
[UPSTREAM.md](../../UPSTREAM.md).
