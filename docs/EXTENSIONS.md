# Extension and resource catalog

The load order is defined by the `pi` section of `package.json`. Order matters
when extensions append system prompts or consume events emitted by another
extension.

## Active extensions

- **Extension Preferences** — One global UI for registered extension settings (`/extension-settings`)
- **Interrupt Confirmation** — Confirms interrupt keys before stopping a running agent (Red confirmation overlay)
- **Status Bar** — Footer/status composition (Configured through `/extension-settings`)
- **Usage Monitor** — Live provider quota data for Status Bar
- **Usage History** — Historical token/cost reporting (`/usage`)
- **Progress Tracker** — Global workflow route plus separate local todo widget (`manage_todo_list`, `/todos`)
- **Session Dashboard** — Pi-glyph welcome, This-Week spend chart, and project-context line
- **Agent Workflow** — Conversational workflow, plan persistence, and durable learning (`manage_task`; see [FLOW.md](FLOW.md))

## Supporting resources

- **Init prompt** (`prompts/init.md`) — Analyze a project and propose an `AGENTS.md`
- **Bundled themes** (`themes/dark.json`, `themes/github-dark.json`) — Portable bundled themes (`"theme": "github-dark"`)

## Single-agent policy

The bundle runs as one agent, not an orchestrator with children: it reads and
explores inline, proposes the plan itself, implements each step inline,
validates after each step, then reviews inline. Only the parent agent owns
user interaction, todos, commits, and final acceptance — there is no subagent
tool or child-process delegation.

The Plan / Implement / Review session-mode split (2026-07-23, see
[FLOW.md](FLOW.md)) does not change this: each mode is still the one agent in
one session, with the disk (lifecycle plan + `discovery.md`) as the handoff.
Delegating phases to child processes was considered and rejected — the
single-agent policy stands (see the earlier `pi-subagents` removal below).

## Extension Preferences registry

These are the settings currently exposed through `/extension-settings`:

- **Status Bar** — `left`, `right`, `separator`, `placement`, `bar-style`, `bar-width`

Status Bar defaults place
`git-branch,session-name,agent-stats,context-usage,tokens,cpu,ram,disk,net` on
the left and `provider,model,sub-hourly,sub-weekly` on the right. Unnamed
sessions receive `<short-desc>` (or `<ticket>-<short-desc>` when a ticket is supplied). Global extension values are configured via `/extension-settings`.

Core Pi model/thinking configuration lives in `~/.pi/agent/settings.json`.

## Removed or folded-in components

- `skills/review` and `skills/simplify`: removed (2026-07-23). The bundle is
  fully skill-free — the review procedure now lives minimized inside the Review
  mode flow (always injected in `/review` sessions, so there is no invocation
  step to forget), and the simplification checklist lives inline at the end of
  the Implement mode flow, run once by the author on the slice diff.
- `pi-add-dir`: removed because it did not fit the normal workflow.
- `pi-memory-md`: removed; project memory is an optional user-owned `.pi/MEMORY.md` file, consulted by the workflow without an extension.
- standalone `pi-simplify`: removed; its focused cleanup logic lived on in
  `skills/simplify/` until 2026-07-23 and is now the inline simplification pass
  in the Implement mode flow.
- `pi-subagents`: removed (2026-07-19). The multi-agent orchestration
  (scout/planner/worker/reviewer, later a serial explorer/coder pair) proved
  unstable — dead-looped handoffs and flaky parallel/async runs.
- `pi-web-access`: removed (2026-07-20). Brainstorming and repository context
  are local-first; shell web access through `curl` remains available and ungated.
- `plan-mode`: removed (2026-07-19). The phase/state machine, triage, ledger,
  gates, and its `/plan` commands were replaced by the guidance flow in
  [FLOW.md](FLOW.md) — guidance over rules. (The current `/plan`
  command is unrelated: a human-only session-mode selector, not a state machine.)
- `interactive-prompt` and `skills/ask-user`: removed (2026-07-20).
  Planning is conversational.
- `minimal-action-confirmation`: removed (2026-07-23). The denylist permission
  gate, its `.pi/confirmations/` log, and its `permission-gate` setting are gone;
  the bundle runs ungated and relies on conversational consent before destructive
  actions. A static red `yolo` tag on status-bar row 2 marks this permanently.
- `/flash`: removed (2026-07-22). The managed "cruise control" autonomous mode
  and its `⚡ flash` status segment are gone. To run Pi unsupervised, start raw Pi
  with `pi --no-extensions` — which drops all bundle guidance.
- `/forensic`: removed (2026-07-22). The deep session retrospective is now a manual
  request; see [RECIPES.md](RECIPES.md#deep-session-retrospective). The bounded
  session-evidence packet it injected is gone with it.
- old Git package clones under `~/.pi/agent/git/...`: removed; Pi loads this
  local working copy directly.

See [UPSTREAM.md](../UPSTREAM.md) for versions, licenses, and compatibility
changes.
