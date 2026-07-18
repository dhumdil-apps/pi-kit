# Commands and tools

This is the short operational reference. Some vendored extensions expose more
advanced commands; follow their linked README when working outside the normal
Plan Mode flow.

## Everyday commands

| Command | Effect |
| --- | --- |
| `/plan` | Arm a new Quick plan, or show actions when a plan is ready |
| `/plan deep` | Arm mandatory deep orchestration for the next goal |
| `/plan execute` | Re-check readiness and cleanliness, then execute the approved plan |
| `/plan status` | Show phase, todo progress, and child-run count |
| `/plan save` | Persist the current ledger/state immediately |
| `/plan resume <slug>` | Select an existing `.pi/plans/<slug>.state.json` ledger |
| `/plan off` | End/disable the current plan workflow; normal tools are no longer gated by it |
| `/todos` | Show the parent todo widget/state |
| `/memory` | Show `.pi/MEMORY.md` for the current project |
| `/extension-settings` | Edit registered global extension settings |
| `/usage` | Show historical token/cost usage |
| `/subagents` | Open the subagent launcher/overview |
| `/subagents-fleet` | Inspect current foreground and async children |
| `/subagents-stop [run-id]` | Stop an active async run |
| `/subagents-doctor` | Diagnose subagent configuration/runtime issues |
| `/websearch` or `/search` | Start Web Access search |
| `/curator` | Inspect/change search curation workflow |

Advanced subagent commands such as `/run`, `/parallel`, `/chain`, model/profile
management, prompt workflows, and watchdog controls are documented in
[`extensions/pi-subagents/README.md`](../extensions/pi-subagents/README.md).

## User-facing tools

| Tool | Owner | Purpose |
| --- | --- | --- |
| `ask_user` | Ask User | Structured parent-owned question, choice, refinement, or confirmation |
| `remember` | Memory | Append a dated durable project memory |
| `manage_todo_list` | Todo List | Read/write parent todo progress |
| `subagent` | Pi Subagents | Launch, inspect, steer, resume, interrupt, or stop child runs |
| `subagent_wait` | Pi Subagents | Wait for one or all asynchronous/detached runs |
| `subagent_supervisor` | Pi Subagents | Inspect and answer exact child supervisor requests |
| `web_search` | Web Access | Search one or more evidence angles |
| `fetch_content` | Web Access | Fetch/extract URL, PDF, video, or repository content |
| `get_search_content` | Web Access | Recover stored result content from a prior search |

## Plan-owned internal tools

These tools are intended for the parent orchestrator, not manual routine use:

| Tool | Purpose |
| --- | --- |
| `plan_triage` | Record `trivial`, `standard`, or `deep` classification and reason |
| `plan_apply_patch` | Preflight and integrate a captured worker patch with three-way Git apply |
| `plan_resolve_redispatch` | Record the one allowed sequential retry after patch conflict |
| `plan_record_review_decision` | Persist required/optional/rejected review findings and rationale |

## Shell and keyboard reminders

- `! <command>` runs a shell command directly.
- `Esc` cancels the current tool/UI action.
- `Ctrl+C` clears/cancels; `Ctrl+D` exits from an empty prompt.
- Permission Gate confirmation applies to agent tool calls, not arbitrary shell
  commands you intentionally execute yourself.
