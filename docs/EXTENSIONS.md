# Extension and resource catalog

The load order is defined by the `pi` section of `package.json`. Order matters
when extensions append system prompts or consume events emitted by another
extension.

## Active extensions

| Extension | Purpose | User surface | Default decision |
| --- | --- | --- | --- |
| Extension Settings | One global UI for registered extension settings | `/extension-settings` | Keep; settings are global and string-backed |
| Ask User | Structured single/multi-select and freeform prompt, rendered inline | `ask_user` tool | Default UI for owned questions and confirmations |
| Cancel Guard | Confirms interrupt keys before stopping a running agent | Red confirmation overlay | Always on in interactive TUI sessions |
| Powerbar | Footer/status composition | configured through `/extension-settings` | On |
| Pi Usage | Live provider quota data for Powerbar | Powerbar segments | On |
| Usage Extension | Historical token/cost reporting | `/usage` | On |
| Manage Todo List | Session execution progress | `manage_todo_list`, `/todos` | On |
| Welcome | Startup map and flow summary | Interactive startup message | Interactive parent sessions only |
| Claude Style | The working flow + behavior guidance, appended to every turn's system prompt | Automatic | On; see [FLOW.md](FLOW.md) |
| Permission Gate | Confirmation for destructive commands, outside-project writes, `curl`/web access, and vendored-code reads | Ask User inline prompt | On; deliberately not a general approval gate |

## Supporting resources

| Resource | Location | Purpose |
| --- | --- | --- |
| Ask User skill | `skills/ask-user/` | Decision handshake for ambiguity and consequential choices |
| Simplify skill | `skills/simplify/` | Pre-commit review/simplify pass over a step's diff |
| Init prompt | `prompts/init.md` | Analyze a project and propose an `AGENTS.md` |
| Bundle theme | `themes/dark.json` | Portable bundled dark theme |
| Local theme | `~/.pi/agent/themes/github-dark.json` | Theme selected by this machine's settings |

## Single-agent policy

The bundle runs as one agent, not an orchestrator with children: it reads and
explores inline, proposes the plan itself, implements each step inline,
validates after each step, then reviews inline. Only the parent agent owns
user interaction, todos, commits, and final acceptance — there is no subagent
tool or child-process delegation.

## Extension Settings registry

These are the settings currently exposed through `/extension-settings`:

| Extension | Keys |
| --- | --- |
| Permission Gate | `enabled` |
| Powerbar | `left`, `right`, `separator`, `placement`, `bar-style`, `bar-width` |

Powerbar defaults place `git-branch,tokens,context-usage` on the left and
`provider,model,sub-hourly,sub-weekly` on the right. The local machine
overrides separator, placement, bar style, and width; see
[LOCAL_SETUP.md](LOCAL_SETUP.md#active-extension-settings).

Core Pi model/thinking configuration lives in `~/.pi/agent/settings.json`.

## Removed or folded-in components

- `pi-add-dir`: removed because it did not fit the normal workflow.
- `pi-memory-md`: removed; project memory is an optional user-owned `.pi/MEMORY.md` file, consulted by the workflow without an extension.
- standalone `pi-simplify`: removed; the pre-commit simplify pass now lives in
  `skills/simplify/` as flow guidance.
- `pi-subagents`: removed (2026-07-19). The multi-agent orchestration
  (scout/planner/worker/reviewer, later a serial explorer/coder pair) proved
  unstable — dead-looped handoffs and flaky parallel/async runs.
- `pi-web-access`: removed (2026-07-20). Brainstorming and repository context
  are local-first; deliberate shell web access through `curl` is consent-gated.
- `plan-mode`: removed (2026-07-19). The phase/state machine, triage, ledger,
  gates, and `/plan` commands were replaced by the guidance flow in
  [FLOW.md](FLOW.md) plus the global Permission Gate rules — guidance over
  rules, gates only where content is genuinely dangerous.
- old Git package clones under `~/.pi/agent/git/...`: removed; Pi loads this
  local working copy directly.

See [UPSTREAM.md](../UPSTREAM.md) for versions, licenses, and compatibility
changes.
