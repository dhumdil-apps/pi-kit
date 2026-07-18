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
| Simplify (`/simplify` command) | `pi-simplify` (Matt Devy) | npm `0.2.3` |
| Add Dir (external directory context) | `pi-add-dir` (itisbryan) | npm `1.3.1` |
| Memory MD (git-backed markdown memory) | `VandeeFeng/pi-memory-md` | commit `326db42`-era snapshot, 2026-07-18 |

`pi-subagents` and `pi-simplify` declare MIT in their npm manifests but their
tarballs contain no separate license file; their MIT notices in `LICENSES/`
are reconstructed from that declaration plus the package's stated author.

`pi-web-access`'s demo video/screenshot assets and `pi-memory-md`'s test suite
were dropped from the vendored copy — neither is needed at runtime.

`pi-memory-md`'s `nodejieba` dependency pulls in `@mapbox/node-pre-gyp@1.0.11`,
which depends on a vulnerable `tar` with no patched release available
(`npm audit fix [--force]` cannot resolve it). This is an install-time-only
exposure — the vulnerable `tar` runs only when `node-pre-gyp` fetches
`nodejieba`'s prebuilt native binary during `npm install`, never on pi's
runtime path. Revisit if `nodejieba` or `@mapbox/node-pre-gyp` ship a fix.

## Local compatibility changes

- Powerbar imports the vendored Extension Settings module by relative path.
- Manage Todo List imports the current `@earendil-works/pi-*` package scope in place of its legacy `@mariozechner/pi-*` scope.
- Pi Add Dir imports the current `@earendil-works/pi-*` package scope in place of its legacy `@mariozechner/pi-*` scope.
- Headless and RPC mode compatibility safeguards added to `plan-mode` (notifying on headless start) and `ask-user` (preventing crash on single-question calls without UI).
