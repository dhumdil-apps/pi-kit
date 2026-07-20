# Commands and tools

This is the short operational reference. Some vendored extensions expose more
advanced commands; follow their linked README when needed. There is no plan
mode and no `/plan` command — the working flow is guidance, described in
[FLOW.md](FLOW.md).

## Everyday commands

| Command | Effect |
| --- | --- |
| `/todos` | Show the todo widget/state |
| `/extension-settings` | Edit registered global extension settings |
| `/usage` | Show historical token/cost usage |

## User-facing tools

| Tool | Owner | Purpose |
| --- | --- | --- |
| `ask_user` | Ask User | Structured question, choice, refinement, or confirmation (inline) |
| `manage_todo_list` | Todo List | Read/write todo progress |

## Shell and keyboard reminders

- `! <command>` runs a shell command directly.
- `Esc` cancels the current tool/UI action. While the agent is running, interrupt
  keys first open a red confirmation overlay: Enter confirms cancellation, while
  Esc or **Keep running** dismisses the overlay without stopping the agent.
- Cancelling an `ask_user` prompt uses the same pattern: Enter confirms; Esc or
  **Keep answering** returns to the question without discarding the current input.
- `Ctrl+C` clears/cancels; `Ctrl+D` exits from an empty prompt.
- Permission Gate confirmation applies to agent tool calls, not arbitrary shell
  commands you intentionally execute yourself.
- Agent-issued `curl` calls require Permission Gate confirmation every time and
  are blocked in headless sessions.
