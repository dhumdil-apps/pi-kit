# Vendored upstream sources

This repository vendors the following MIT-licensed Pi resources. Original license
texts are preserved in [`LICENSES/`](LICENSES/). `pi-usage` declares MIT in its
npm manifest but its tarball contains no separate license file; its MIT notice is
included here from that declaration.

| Component | Upstream | Snapshot |
| --- | --- | --- |
| Extension Settings | `@juanibiapina/pi-extension-settings` | npm `0.8.0` |
| Ask User extension and skill | `pi-ask-user` | npm `0.13.0` |
| Powerbar | `@juanibiapina/pi-powerbar` | npm `0.12.0` |
| Pi Usage (Powerbar dependency) | `@juanibiapina/pi-usage` | npm `0.1.0` |
| Usage Extension | `@tmustier/pi-usage-extension` | npm `0.9.1` |
| Manage Todo List | `tintinweb/pi-manage-todo-list` | commit `b75c449aa85ce328e9a8b632f62bf642aed40359` |
| Web Access (search/fetch/PDF/YouTube extraction) | `pi-web-access` (Nico Bailon) | npm `0.13.0` |
| Simplify review logic (vendored into `plan-mode/review/`) | `pi-simplify` (Matt Devy) | npm `0.2.3` |

`pi-simplify` declares MIT in its npm manifest but its tarball contains no
separate license file; its MIT notice in `LICENSES/` is reconstructed from
that declaration plus the package's stated author.

`pi-web-access`'s demo video/screenshot assets were dropped from the vendored
copy — not needed at runtime.

Removed from the bundle (2026-07-18): `pi-add-dir` (unused), `pi-memory-md`
(replaced by the bundle-local `extensions/memory` — a minimal `.pi/MEMORY.md`
per project; this also removed the `nodejieba`/`node-pre-gyp` vulnerable `tar`
install-time exposure), and the standalone `pi-simplify` extension (its
`git-diff.ts`/`prompt-builder.ts` now live in `extensions/plan-mode/review/`
and run as the mandatory final review phase of plan execution).

Removed from the bundle (2026-07-19): `pi-subagents` (Nico Bailon, npm
`0.35.0`, MIT declared in its manifest with no separate license file in the
tarball) — the scout/planner/researcher/reviewer/worker multi-agent
orchestration proved unstable (dead-looped handoffs, flaky parallel/async
runs) even after a first redesign to a serial explorer/coder pair. Plan Mode
now runs single-agent end to end; see `docs/PLAN_MODE.md`.

## Local compatibility changes

- Powerbar imports the vendored Extension Settings module by relative path.
- Manage Todo List imports the current `@earendil-works/pi-*` package scope in place of its legacy `@mariozechner/pi-*` scope.
- Headless and RPC compatibility safeguards keep `plan-mode`, Welcome, and Ask User from hijacking or blocking non-interactive and child processes.
- `plan-mode` is a bundle-owned version-2 persistent state machine with triage, session-linked ledgers, scoped checkpoints, exact Plan-ledger dirty exceptions, validation, and a mandatory one-fix-pass review workflow — run single-agent, with no subagent handoffs.
- `permission-gate` is scoped to destructive commands only (denylist), with an on/off toggle in extension-settings.
