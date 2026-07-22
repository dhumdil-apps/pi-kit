# Status Bar

Persistent powerline-style status bar with left/right segments updated via
events. The core (`src/powerbar/`) listens for `powerbar:update` events,
maintains a segment store, and renders three semantic rows with independent
left/right alignment: identity, session/context, and system/quota. Producer
sub-extensions each emit one or more segments:

- **`src/powerbar-session/`** — `session-name` (mandatory ticket ID + short feature description)
- **`src/powerbar-git/`** — `git-branch` (+ dirty marker)
- **`src/powerbar-model/`** — `model` (name + thinking level)
- **`src/powerbar-provider/`** — `provider`
- **`src/powerbar-tokens/`** — `tokens`, `agent-stats`
- **`src/powerbar-context/`** — `context-usage`
- **`src/powerbar-sub/`** — `sub-hourly`, `sub-weekly` (from Usage Monitor events)
- **`src/powerbar-os/`** — `cpu`, `ram`, `disk`/SSD, `net`

The Agent Workflow extension registers a transient `flash` segment. It renders
`⚡ flash` only while Flash mode is active and does not need a configured slot.
Workflow phase is deliberately outside Status Bar; Progress Tracker renders it
as a persistent phase-aware working indicator above the editor.

All Status Bar progress bars use the theme accent normally, changing to warning
and error at their configured usage thresholds. CPU, RAM, and SSD usage render
as one high-contrast, partial-height bar per metric and show a `0%` placeholder
until a sample is available. Context usage is labeled `ctx` and always uses
four bars; subscription hourly and weekly usage each use seven bars.

## User surface

Configured through `/extension-settings` → Status Bar (stored as `powerbar`): `left`, `right`,
`separator`, `placement`, `bar-style`, `bar-width`. Bundle defaults put
`session-name,git-branch,agent-stats,context-usage,tokens,cpu,ram,disk,net` left and
`provider,model,sub-hourly,sub-weekly` right. The resulting rows are: session
name then git/provider/model; active-branch message counts, context usage, then
token/cost usage on the left; then CPU/RAM/SSD/network and hourly/weekly
subscription usage.

Agent Workflow owns task naming through `manage_task`: after exploration it
sets a concise `SI-<ticket>-<summary>` session name, may refine it during
Planning, and freezes it when the approved plan is saved. This producer only
displays the current name immediately before the git branch and follows
session-name changes and resumes.

## Origin

Vendored from `@juanibiapina/pi-powerbar` (npm 0.12.0, MIT) — see
[UPSTREAM.md](../../UPSTREAM.md).
