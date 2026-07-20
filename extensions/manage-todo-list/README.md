# Manage Todo List

Replicates GitHub Copilot's `manage_todo_list`: a single tool with read/write
operations, a read-only progress widget, and session persistence via tool
result details (state is reconstructed on session load/switch/fork).

## User surface

- `manage_todo_list` tool — the agent tracks plan steps here (one in progress
  at a time, per the claude-style flow).
- `/todos` command — toggle the progress widget.
- `/todos clear` — clear the list.

## Origin

Vendored from `tintinweb/pi-manage-todo-list` (commit `b75c449`, MIT) — see
[UPSTREAM.md](../../UPSTREAM.md).
