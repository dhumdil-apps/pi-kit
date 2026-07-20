# Commands and tools

This is the short operational reference. Some vendored extensions expose more
advanced commands; follow their linked README when needed. There is no plan
mode and no `/plan` command — the working flow is guidance, described in
[FLOW.md](FLOW.md).

## Everyday commands

| Command | Effect |
| --- | --- |
| `/todos` | Show the todo widget/state |
| `/memory` | Show `.pi/MEMORY.md` for the current project |
| `/extension-settings` | Edit registered global extension settings |
| `/usage` | Show historical token/cost usage |
| `/websearch` or `/search` | Start Web Access search |
| `/curator` | Inspect/change search curation workflow |

## User-facing tools

| Tool | Owner | Purpose |
| --- | --- | --- |
| `ask_user` | Ask User | Structured question, choice, refinement, or confirmation (inline) |
| `remember` | Memory | Append a dated durable project memory |
| `manage_todo_list` | Todo List | Read/write todo progress |
| `web_search` | Web Access | Search one or more evidence angles (gated: asks per call) |
| `fetch_content` | Web Access | Fetch/extract URL, PDF, video, or repository content (gated: asks per call) |
| `get_search_content` | Web Access | Recover stored result content from a prior search (gated: asks per call) |

## Shell and keyboard reminders

- `! <command>` runs a shell command directly.
- `Esc` cancels the current tool/UI action.
- `Ctrl+C` clears/cancels; `Ctrl+D` exits from an empty prompt.
- Permission Gate confirmation applies to agent tool calls, not arbitrary shell
  commands you intentionally execute yourself.
