# Powerbar

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

## User surface

Configured through `/extension-settings` → powerbar: `left`, `right`,
`separator`, `placement`, `bar-style`, `bar-width`. Bundle defaults put
`git-branch,tokens,context-usage` left and `provider,model,sub-hourly,sub-weekly`
right.

## Origin

Vendored from `@juanibiapina/pi-powerbar` (npm 0.12.0, MIT) — see
[UPSTREAM.md](../../UPSTREAM.md).
