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
| Subagents (scout/planner/researcher/reviewer/worker/etc.) | `pi-subagents` (Nico Bailon) | npm `0.35.0` |
| Web Access (search/fetch/PDF/YouTube extraction) | `pi-web-access` (Nico Bailon) | npm `0.13.0` |
| Simplify review logic (vendored into `plan-mode/review/`) | `pi-simplify` (Matt Devy) | npm `0.2.3` |

`pi-subagents` and `pi-simplify` declare MIT in their npm manifests but their
tarballs contain no separate license file; their MIT notices in `LICENSES/`
are reconstructed from that declaration plus the package's stated author.

`pi-web-access`'s demo video/screenshot assets were dropped from the vendored
copy — not needed at runtime.

Removed from the bundle (2026-07-18): `pi-add-dir` (unused), `pi-memory-md`
(replaced by the bundle-local `extensions/memory` — a minimal `.pi/MEMORY.md`
per project; this also removed the `nodejieba`/`node-pre-gyp` vulnerable `tar`
install-time exposure), and the standalone `pi-simplify` extension (its
`git-diff.ts`/`prompt-builder.ts` now live in `extensions/plan-mode/review/`
and run as the mandatory final review phase of plan execution).

## Local compatibility changes

- Powerbar imports the vendored Extension Settings module by relative path.
- Manage Todo List imports the current `@earendil-works/pi-*` package scope in place of its legacy `@mariozechner/pi-*` scope.
- Headless and RPC compatibility safeguards keep `plan-mode`, Welcome, and Ask User from hijacking or blocking non-interactive and child processes.
- `plan-mode` is now a bundle-owned version-2 persistent orchestration state machine with triage, structured subagent handoffs, session-linked ledgers, scoped checkpoints, exact Plan-ledger dirty exceptions for worktrees, patch integration, validation, and a mandatory one-batch review/one-fix-pass workflow.
- Pi Subagents accepts an exact matching `.pi/plans/*.md`/`.state.json` pair through `allowedDirtyPaths` while still rejecting all other dirty worktree state.
- Plan-owned role policy adds `contact_supervisor`, removes reviewer edit/write authority, and uses local per-user thinking overrides.
- `permission-gate` is scoped to destructive commands only (denylist), with an on/off toggle in extension-settings.
