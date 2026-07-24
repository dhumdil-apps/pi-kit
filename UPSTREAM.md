# Vendored upstream sources

This repository vendors the MIT-licensed Pi resources listed below. Every
notice they require is consolidated under [Upstream license
notices](#upstream-license-notices).

## Vendored components

- **Extension Settings** (`@juanibiapina/pi-extension-settings`) — npm `0.8.0`
- **Powerbar** (`@juanibiapina/pi-powerbar`) — npm `0.12.0`
- **Pi Usage** (Powerbar dependency, `@juanibiapina/pi-usage`) — npm `0.1.0`
- **Usage Extension** (`@tmustier/pi-usage-extension`) — npm `0.9.1`
- **Manage Todo List** (`tintinweb/pi-manage-todo-list`) — commit `b75c449aa85ce328e9a8b632f62bf642aed40359`
- **pi-simplify** (Matt Devy) — npm `0.2.3`. The extension itself is gone, but
  text derived from it is now the inline simplification pass in the Implement
  mode flow (`extensions/agent-workflow/index.ts`), so the notice still applies.

## Local compatibility changes

- Powerbar imports the vendored Extension Settings module by relative path.
- Powerbar's `context-usage` producer was dropped (2026-07-23) together with its
  entry in the default left segments; the context readout now lives in the
  Progress Tracker indicator above the editor.
- Manage Todo List imports the current `@earendil-works/pi-*` package scope in
  place of its legacy `@mariozechner/pi-*` scope.
- Headless safeguards keep Session Dashboard from hijacking non-interactive
  processes.

## Removed (do not re-add)

- 2026-07-18 `pi-add-dir` — unused.
- 2026-07-18 `pi-memory-md` — superseded by an optional user-owned
  `.pi/MEMORY.md`; removing it also dropped the `nodejieba` / `node-pre-gyp`
  vulnerable `tar` install-time exposure.
- 2026-07-18 `pi-simplify` (the standalone extension) — its focused cleanup
  logic lived in `skills/simplify/` until 2026-07-23 and is now inline in the
  Implement mode flow.
- 2026-07-19 `pi-subagents` (Nico Bailon, npm `0.35.0`) — the
  scout/planner/researcher/reviewer/worker orchestration dead-looped handoffs
  and ran flaky in parallel/async, even after a redesign to a serial
  explorer/coder pair. Plan Mode went with it; the bundle is single-agent, see
  [FLOW.md](docs/FLOW.md).
- 2026-07-20 `pi-web-access` (Nico Bailon, npm `0.13.0`) — the bundle works from
  local reasoning and repository context; `curl` remains available and ungated.
- 2026-07-20 `pi-ask-user` (npm `0.13.0`) — discovery and plan approval use
  ordinary conversational turns.
- 2026-07-22 `/flash` cruise-control mode with its `⚡ flash` status segment, and
  `/forensic` with its bounded session-evidence packet (both bundle-local) — run
  `pi --no-extensions` instead; the deep retrospective is a plain request.
- 2026-07-23 `minimal-action-confirmation` (bundle-local) — the denylist
  permission gate, its confirmation log, and its `permission-gate` setting. The
  bundle runs ungated, with destructive-action consent handled conversationally.
- 2026-07-23 `skills/review` and `skills/simplify`, and with them the
  `pi.skills` manifest entry — the bundle is skill-free, so neither procedure
  depends on the model choosing to invoke a skill.

## Upstream license notices

Every vendored component is MIT-licensed. The copyright notices below are
covered by the single shared permission notice that follows.

- Copyright (c) 2026 Juan Ibiapina — `@juanibiapina/pi-powerbar`,
  `@juanibiapina/pi-extension-settings`, `@juanibiapina/pi-usage`
- Copyright (c) 2026 Thomas Mustier — `@tmustier/pi-usage-extension`
- Copyright (c) 2026 tintinweb — `tintinweb/pi-manage-todo-list`
- Copyright (c) 2026 Matt Devy — `pi-simplify`

```
Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
