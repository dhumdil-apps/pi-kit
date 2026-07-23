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
- **Progress Tracker** — Global workflow route, context-usage readout, plus separate local todo widget (`manage_todo_list`, `/todos`)
- **Session Dashboard** — Pi-glyph welcome, 30-day per-model spend chart, and project-context line
- **Agent Workflow** — Conversational workflow, plan persistence, and durable learning (`manage_task`, `/mode`; see [FLOW.md](FLOW.md))

## Supporting resources

- **Init prompt** (`prompts/init.md`) — Analyze a project and propose an `AGENTS.md`
- **Bundled themes** (`themes/dark.json`, `themes/github-dark.json`) — Portable bundled themes (`"theme": "github-dark"`)

## Single-agent policy

The bundle runs as one agent, not an orchestrator with children: there is no
subagent tool and no child-process delegation, and the one agent owns user
interaction, todos, commits, and final acceptance. The Plan / Implement /
Review split (see [FLOW.md](FLOW.md)) does not change this — each mode is the
same single agent in its own session, with the disk (lifecycle plan +
`discovery.md`) as the handoff.

## Extension Preferences registry

These are the settings currently exposed through `/extension-settings`:

- **Status Bar** — `left`, `right`, `separator`, `placement`, `bar-style`, `bar-width`

Status Bar defaults place
`git-branch,session-name,agent-stats,tokens,cpu,ram,disk,net` on
the left and `provider,model,sub-hourly,sub-weekly` on the right. Context usage
lives in the Progress Tracker indicator above the editor, not in the powerbar. Unnamed
sessions receive `<short-desc>` (or `<ticket>-<short-desc>` when a ticket is supplied). Global extension values are configured via `/extension-settings`.

Core Pi model/thinking configuration lives in `~/.pi/agent/settings.json`.

## Deliberately absent

- **No skills.** The review procedure lives inside the Review mode flow and the
  simplification checklist at the end of the Implement mode flow, so neither
  depends on the model remembering to invoke anything.
- **No permission gate.** Tool calls are never intercepted; destructive-action
  consent is conversational (see [FLOW.md](FLOW.md)).
- **No managed autonomous mode.** To run Pi unsupervised, start raw Pi with
  `pi --no-extensions` — which drops all bundle guidance.
- **No subagents and no state machine.** Single-agent by policy, guidance over
  rules; `/mode` is a human-only mode selector, not a phase machine.
- **No context segment in the status bar.** Context usage lives in the Progress
  Tracker indicator above the editor, with token counts spelled out.

[UPSTREAM.md](../UPSTREAM.md) records what was vendored, what was removed and
when, plus versions and licenses.
