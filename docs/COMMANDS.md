# Commands and tools

This is the short operational reference. Some vendored extensions expose more
advanced commands; follow their linked README when needed. The working flow is
guidance split across two session modes, described in [FLOW.md](FLOW.md);
there is no enforced state machine.

## Everyday commands

- **`/handoff [task-name]`** — Human-only session boundary: spawns a fresh Implement session seeded with the task name and a kickoff naming the approved plan's path. Without a task name it uses the session's task, or the lone plan under `.pi/plan/`; with several it asks which one. The Plan-side approval prompt (Proceed, handoff, or revise) prefills this command on Handoff
- **`/todos`** — Reveal workflow progress and toggle the independent local todo widget
- **`/help`** — Full reference: commands, shortcuts, and every active extension
- **`/extension-settings`** — Edit registered global extension settings
- **`/usage`** — Show historical token/cost usage (`/usage-refresh` forces a quota fetch)

## User-facing tools

- **`manage_todo_list`** (Progress Tracker) — Read/write local todos independently of the workflow phase
- **`save_plan`** (Agent Workflow) — Save the presented four-section plan to `.pi/plan/<task-name>.md` and name the session after it

## Shell and keyboard reminders

- `! <command>` runs a shell command directly.
- `Esc` cancels the current tool/UI action. While the agent is running, interrupt
  keys first open a red confirmation overlay: Enter confirms cancellation, while
  Esc or **Keep running** dismisses the overlay without stopping the agent.
- `Ctrl+C` clears/cancels; `Ctrl+D` exits from an empty prompt.
- The bundle intercepts no tool calls: agent-issued commands, writes, and `curl`
  run without a permission prompt.
