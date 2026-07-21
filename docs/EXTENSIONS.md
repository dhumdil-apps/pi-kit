# Extension and resource catalog

The load order is defined by the `pi` section of `package.json`. Order matters
when extensions append system prompts or consume events emitted by another
extension.

## Active extensions

| Extension | Purpose | User surface | Default decision |
| --- | --- | --- | --- |
| Extension Preferences | One global UI for registered extension settings | `/extension-settings` | Keep; settings are global and string-backed |
| Interrupt Confirmation | Confirms interrupt keys before stopping a running agent | Red confirmation overlay | Always on in interactive TUI sessions |
| Status Bar | Footer/status composition | configured through `/extension-settings` | On |
| Usage Monitor | Live provider quota data for Status Bar | Status Bar segments | On |
| Usage History | Historical token/cost reporting | `/usage` | On |
| Progress Tracker | Global workflow route plus separate local todo widget | `manage_todo_list`, `/todos` | On |
| Session Dashboard | Startup ruler, project/spend panel, and resource map | Interactive startup message | Interactive parent sessions only |
| Agent Workflow | Conversational workflow, Flash mode, and session learning | `/flash`, `/retro`, `/forensic`, `/improvements` | On; see [FLOW.md](FLOW.md) |
| Minimal Action Confirmation | Confirmation for destructive commands, outside-project writes, `curl`/web access, and vendored-code reads | Built-in Pi dialog | On; deliberately not a general approval gate |

## Supporting resources

| Resource | Location | Purpose |
| --- | --- | --- |
| Simplify skill | `skills/simplify/` | Pre-commit review/simplify pass over a step's diff |
| Init prompt | `prompts/init.md` | Analyze a project and propose an `AGENTS.md` |
| Bundled themes | `themes/dark.json`, `themes/github-dark.json` | Portable bundled themes; registered by the bundle, so `"theme": "github-dark"` works with no machine-local copy |

## Single-agent policy

The bundle runs as one agent, not an orchestrator with children: it reads and
explores inline, proposes the plan itself, implements each step inline,
validates after each step, then reviews inline. Only the parent agent owns
user interaction, todos, commits, and final acceptance — there is no subagent
tool or child-process delegation.

## Extension Preferences registry

These are the settings currently exposed through `/extension-settings`:

| Extension | Keys |
| --- | --- |
| Minimal Action Confirmation | `enabled` |
| Status Bar | `left`, `right`, `separator`, `placement`, `bar-style`, `bar-width` |

Status Bar defaults place `git-branch,tokens,context-usage` on the left and
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
  [FLOW.md](FLOW.md) plus the global Minimal Action Confirmation rules — guidance over
  rules, gates only where content is genuinely dangerous.
- `interactive-prompt` and `skills/ask-user`: removed (2026-07-20).
  Planning is conversational; only safety confirmations use Pi's built-in dialog.
- old Git package clones under `~/.pi/agent/git/...`: removed; Pi loads this
  local working copy directly.

See [UPSTREAM.md](../UPSTREAM.md) for versions, licenses, and compatibility
changes.
