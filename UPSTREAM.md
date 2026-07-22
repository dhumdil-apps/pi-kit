# Vendored upstream sources

This repository vendors the following MIT-licensed Pi resources. Original license
notices for vendored components are consolidated below under [Upstream License Notices](#upstream-license-notices).

- **Extension Settings** (`@juanibiapina/pi-extension-settings`) — npm `0.8.0`
- **Powerbar** (`@juanibiapina/pi-powerbar`) — npm `0.12.0`
- **Pi Usage (Powerbar dependency)** (`@juanibiapina/pi-usage`) — npm `0.1.0`
- **Usage Extension** (`@tmustier/pi-usage-extension`) — npm `0.9.1`
- **Manage Todo List** (`tintinweb/pi-manage-todo-list`) — commit `b75c449aa85ce328e9a8b632f62bf642aed40359`
- **Simplify review logic** (vendored into `skills/simplify/`) — `pi-simplify` (Matt Devy), npm `0.2.3`

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
context by default; deliberate `curl` use is guarded by Minimal Action Confirmation.

Removed from the bundle (2026-07-20): `pi-ask-user` (npm `0.13.0`, MIT).
Discovery and plan approval now use ordinary conversational turns; safety
confirmation uses Pi's built-in dialogs.

## Local compatibility changes

- Powerbar imports the vendored Extension Settings module by relative path.
- Manage Todo List imports the current `@earendil-works/pi-*` package scope in place of its legacy `@mariozechner/pi-*` scope.
- Headless safeguards keep Session Dashboard and safety confirmation from hijacking or blocking non-interactive processes.
- Minimal Action Confirmation is denylist-scoped, uses Pi's built-in dialogs,
  and retains its on/off toggle in Extension Settings.

## Upstream License Notices

### Juan Ibiapina (`@juanibiapina/pi-powerbar`, `@juanibiapina/pi-extension-settings`, `@juanibiapina/pi-usage`)
```
MIT License

Copyright (c) 2026 Juan Ibiapina

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

### Thomas Mustier (`@tmustier/pi-usage-extension`)
```
MIT License

Copyright (c) 2026 Thomas Mustier

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

### tintinweb (`tintinweb/pi-manage-todo-list`)
```
MIT License

Copyright (c) 2026 tintinweb

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

### Matt Devy (`pi-simplify`)
```
MIT License

Copyright (c) 2026 Matt Devy

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
