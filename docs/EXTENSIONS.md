# Extension and resource catalog

The load order is defined by the `pi` section of `package.json`. Order matters
when extensions append system prompts or consume events emitted by another
extension.

## Active extensions

| Extension | Purpose | User surface | Default decision |
| --- | --- | --- | --- |
| Extension Settings | One global UI for registered extension settings | `/extension-settings` | Keep; settings are global and string-backed |
| Ask User | Structured single/multi-select and freeform modal | `ask_user` tool | Default UI for owned questions and confirmations |
| Memory | Small per-project durable log | `remember`, `/memory`, `.pi/MEMORY.md` | On; decisions, learnings, preferences only |
| Powerbar | Footer/status composition | configured through `/extension-settings` | On; includes Plan Mode phase/progress |
| Pi Usage | Live provider quota data for Powerbar | Powerbar segments | On |
| Usage Extension | Historical token/cost reporting | `/usage` | On |
| Manage Todo List | Parent-session execution progress | `manage_todo_list`, `/todos` | On; parent orchestrator owns plan todos |
| Plan Mode | Default persistent orchestration workflow | `/plan ...`, Plan tools, Powerbar | Auto-starts in interactive parent sessions |
| Welcome | Startup map and active-plan summary | Interactive startup message | Interactive parent sessions only |
| Claude Style | Compact behavior/system-prompt additions | Automatic | On; concise, verifiable, minimally invasive work |
| Permission Gate | Confirmation for destructive commands and outside-project writes | Ask User modal | On; deliberately not a general approval gate |
| Pi Web Access | Search, fetch, extraction, cited synthesis | `web_search`, `fetch_content`, `get_search_content`, `/websearch`, `/curator` | On; local workflow defaults to `auto-summary` |

## Supporting resources

| Resource | Location | Purpose |
| --- | --- | --- |
| Ask User skill | `skills/ask-user/` | Decision handshake for ambiguity and consequential choices |
| Web Access skills | `extensions/pi-web-access/skills/` | Research and content workflows |
| Init prompt | `prompts/init.md` | Analyze a project and propose an `AGENTS.md` |
| Bundle theme | `themes/dark.json` | Portable bundled dark theme |
| Local theme | `~/.pi/agent/themes/github-dark.json` | Theme selected by this machine's settings |

## Single-agent policy

Plan Mode runs as one agent, not an orchestrator with children: it reads and
explores inline, writes the plan draft itself, implements each step inline,
validates after each step, then reviews inline. Only the parent agent owns
user interaction, plan state, todos, commits, and final acceptance — there is
no subagent tool or child-process delegation.

## Extension Settings registry

These are the settings currently exposed through `/extension-settings`:

| Extension | Keys |
| --- | --- |
| Plan Mode | `auto-start`, `default-effort`, `orchestration`, `quick-triage` |
| Permission Gate | `enabled` |
| Memory | `enabled` |
| Powerbar | `left`, `right`, `separator`, `placement`, `bar-style`, `bar-width` |

Powerbar defaults place `git-branch,tokens,context-usage` on the left and
`provider,model,sub-hourly,sub-weekly` on the right. Plan Mode's segment is
force-added while relevant even if it is not in those lists. The local machine
overrides separator, placement, bar style, and width; see
[LOCAL_SETUP.md](LOCAL_SETUP.md#active-extension-settings).

Web Access configuration is separate at `~/.pi/web-search.json`; core Pi
model/thinking configuration lives in `~/.pi/agent/settings.json`.

## Removed or folded-in components

- `pi-add-dir`: removed because it did not fit the normal workflow.
- `pi-memory-md`: replaced by the small bundle-owned Memory extension.
- standalone `pi-simplify`: removed; scoped review/simplification is part of the
  mandatory Plan Mode review phase.
- `pi-subagents`: removed (2026-07-19). The multi-agent orchestration
  (scout/planner/worker/reviewer, later a serial explorer/coder pair) proved
  unstable — dead-looped handoffs and flaky parallel/async runs. Plan Mode now
  runs single-agent end to end; see "Single-agent policy" above.
- old Git package clones under `~/.pi/agent/git/...`: removed; Pi loads this
  local working copy directly.

See [UPSTREAM.md](../UPSTREAM.md) for versions, licenses, and compatibility
changes.
