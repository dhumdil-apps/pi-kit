# Vendored upstream sources

This repository vendors the following MIT-licensed Pi resources. Original license
texts are preserved in [`LICENSES/`](LICENSES/). `pi-usage` declares MIT in its
npm manifest but its tarball contains no separate license file; its MIT notice is
included here from that declaration.

| Component | Upstream | Snapshot |
| --- | --- | --- |
| Extension Settings | `@juanibiapina/pi-extension-settings` | npm `0.8.0` |
| Powerbar | `@juanibiapina/pi-powerbar` | npm `0.12.0` |
| Pi Usage (Powerbar dependency) | `@juanibiapina/pi-usage` | npm `0.1.0` |
| Usage Extension | `@tmustier/pi-usage-extension` | npm `0.9.1` |
| Manage Todo List | `tintinweb/pi-manage-todo-list` | commit `b75c449aa85ce328e9a8b632f62bf642aed40359` |
| Simplify review logic (vendored into `skills/simplify/`) | `pi-simplify` (Matt Devy) | npm `0.2.3` |

`pi-simplify` declares MIT in its npm manifest but its tarball contains no
separate license file; its MIT notice in `LICENSES/` is reconstructed from
that declaration plus the package's stated author.

Removed from the bundle (2026-07-18): `pi-add-dir` (unused), `pi-memory-md`
(replaced briefly by a bundle-local extension, then removed in favor of an
optional user-owned `.pi/MEMORY.md`; this also removed the `nodejieba`/
`node-pre-gyp` vulnerable `tar` install-time exposure), and the standalone `pi-simplify` extension (its
focused cleanup logic now lives in `skills/simplify/`; the broader bundle-local
`review` skill invokes that pass once).

Removed from the bundle (2026-07-19): `pi-subagents` (Nico Bailon, npm
`0.35.0`, MIT declared in its manifest with no separate license file in the
tarball) — the scout/planner/researcher/reviewer/worker multi-agent
orchestration proved unstable (dead-looped handoffs, flaky parallel/async
runs) even after a first redesign to a serial explorer/coder pair. Plan Mode
itself was removed on 2026-07-19; the bundle now runs single-agent with a
guidance flow — see `docs/FLOW.md`.

Removed from the bundle (2026-07-20): `pi-web-access` (Nico Bailon, npm
`0.13.0`, MIT). The bundle now brainstorms from local reasoning and repository
context by default; deliberate `curl` use is guarded by Minimal Action Confirmation. Its
archived license notice remains in `LICENSES/pi-web-access-MIT.txt`.

Removed from the bundle (2026-07-20): `pi-ask-user` (npm `0.13.0`, MIT).
Discovery and plan approval now use ordinary conversational turns; safety
confirmation uses Pi's built-in dialogs. Its archived license notice remains
in `LICENSES/pi-ask-user-MIT.txt`.

## Local compatibility changes

- Powerbar imports the vendored Extension Settings module by relative path.
- Manage Todo List imports the current `@earendil-works/pi-*` package scope in place of its legacy `@mariozechner/pi-*` scope.
- Headless safeguards keep Session Dashboard and safety confirmation from hijacking or blocking non-interactive processes.
- Minimal Action Confirmation is denylist-scoped, uses Pi's built-in dialogs,
  and retains its on/off toggle in Extension Settings.
