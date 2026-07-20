# Status Bar

Persistent powerline-style status bar with left/right segments updated via
events. The core (`src/powerbar/`) listens for `powerbar:update` events,
maintains a segment store, and renders the bar; producer sub-extensions each
emit one segment:

| Producer | Segment |
| --- | --- |
| `src/powerbar-git/` | `git-branch` (+ dirty marker) |
| `src/powerbar-model/` | `model` (name + thinking level) |
| `src/powerbar-provider/` | `provider` |
| `src/powerbar-tokens/` | `tokens` |
| `src/powerbar-context/` | `context-usage` |
| `src/powerbar-sub/` | `sub-hourly`, `sub-weekly` (from `pi-usage` events) |
| `src/powerbar-os/` | `cpu`, `ram`, `disk`/SSD, `net` |

The Agent Workflow extension registers a transient `flash` segment. It renders
`⚡ flash` only while Flash mode is active and does not need a configured slot.

All Status Bar progress bars use the theme accent normally, changing to warning
and error at their configured usage thresholds. CPU, RAM, and SSD usage render
as one high-contrast, partial-height bar per metric and show a `0%` placeholder
until a sample is available. Context usage is labeled `ctx` and always uses
four bars; subscription hourly and weekly usage each use seven bars.

## User surface

Configured through `/extension-settings` → Status Bar (stored as `powerbar`): `left`, `right`,
`separator`, `placement`, `bar-style`, `bar-width`. Bundle defaults put
`git-branch,tokens,context-usage` left and `provider,model,sub-hourly,sub-weekly`
right.

## Origin

Vendored from `@juanibiapina/pi-powerbar` (npm 0.12.0, MIT) — see
[UPSTREAM.md](../../UPSTREAM.md).
