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

## Local compatibility changes

- Powerbar imports the vendored Extension Settings module by relative path.
- Manage Todo List imports the current `@earendil-works/pi-*` package scope in place of its legacy `@mariozechner/pi-*` scope.
- Headless and RPC mode compatibility safeguards added to `plan-mode` (notifying on headless start) and `ask-user` (preventing crash on single-question calls without UI).
