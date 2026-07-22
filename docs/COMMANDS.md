# Commands and tools

This is the short operational reference. Some vendored extensions expose more
advanced commands; follow their linked README when needed. There is no plan
mode and no `/plan` command — the working flow is guidance, described in
[FLOW.md](FLOW.md).

## Everyday commands

| Command | Effect |
| --- | --- |
| `/todos` | Reveal workflow progress and toggle the independent local todo widget |
| `/extension-settings` | Edit registered global extension settings |
| `/usage` | Show historical token/cost usage |
| `/flash` | Activate autonomous recommended-choice cruise control until completion or the next ordinary user message |
| `/forensic [raw]` | Deep reconstructed session review; `raw` includes bounded annotated evidence |
| `/review` | Run the risk-adaptive correctness pipeline, fix supported in-scope findings, invoke simplify once, and revalidate the relevant diff |
| `/simplify` | Remove unnecessary complexity and development residue without changing approved behavior |

## User-facing tools

| Tool | Owner | Purpose |
| --- | --- | --- |
| `manage_todo_list` | Progress Tracker | Read/write local todos independently of the workflow phase |
| `manage_task` | Agent Workflow | Set/freeze task identity and create, update, transition, or resume a status-suffixed lifecycle plan |

## Shell and keyboard reminders

- `! <command>` runs a shell command directly.
- `Esc` cancels the current tool/UI action. While the agent is running, interrupt
  keys first open a red confirmation overlay: Enter confirms cancellation, while
  Esc or **Keep running** dismisses the overlay without stopping the agent.
- Planning questions appear in the conversation and accept compact answers such
  as `1A 2C 3B`; safety confirmations continue to use Pi's built-in dialog.
- `Ctrl+C` clears/cancels; `Ctrl+D` exits from an empty prompt.
- Minimal Action Confirmation applies to agent tool calls, not arbitrary shell
  commands you intentionally execute yourself.
- Agent-issued `curl` calls require Minimal Action Confirmation every time and
  are blocked in headless sessions.
