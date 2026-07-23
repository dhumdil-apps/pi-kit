# Commands and tools

This is the short operational reference. Some vendored extensions expose more
advanced commands; follow their linked README when needed. The working flow is
guidance split across three session modes, described in [FLOW.md](FLOW.md);
there is no enforced state machine.

## Everyday commands

- **`/mode`** — Human-only session-mode command (Plan is the default). With no arguments it opens a picker: choose plan/implement/review (current is highlighted), then for implement/review choose **Continue in this session** or a **Fresh session**; both steps show live context usage. plan is always same-session
- **`/mode <plan|implement|review> [continue|fresh] [task-name]`** — Direct form (no picker) for headless runs and scripts. `continue` flips the injected flow **in the current session**; `fresh` opens a new session seeded with the task name and a kickoff carrying the plan and discovery paths (without a task name it uses the current task, or the single pending plan under `.pi/goal/`; with several it asks which one)
- **`/todos`** — Reveal workflow progress and toggle the independent local todo widget
- **`/help`** — Full reference: commands, shortcuts, and every active extension
- **`/extension-settings`** — Edit registered global extension settings
- **`/usage`** — Show historical token/cost usage (`/usage-refresh` forces a quota fetch)

## User-facing tools

- **`manage_todo_list`** (Progress Tracker) — Read/write local todos independently of the workflow phase
- **`manage_task`** (Agent Workflow) — Set/freeze task identity and create, update, transition, or resume a status-suffixed lifecycle plan

## Shell and keyboard reminders

- `! <command>` runs a shell command directly.
- `Esc` cancels the current tool/UI action. While the agent is running, interrupt
  keys first open a red confirmation overlay: Enter confirms cancellation, while
  Esc or **Keep running** dismisses the overlay without stopping the agent.
- Planning questions appear in the conversation and accept compact answers such
  as `1A 2C 3B`.
- `Ctrl+C` clears/cancels; `Ctrl+D` exits from an empty prompt.
- The bundle intercepts no tool calls: agent-issued commands, writes, and `curl`
  run without a permission prompt.
