# Extension Preferences

Global, string-backed settings registry for pi extensions, plus one UI to
configure everything registered with it.

## User surface

- `/extension-settings` command — browse and change all registered settings.

## For extension authors

- Register settings at load time by emitting the
  `pi-extension-settings:register` event with a `SettingDefinition[]`.
- Read/write programmatically via the exported `getSetting`/`setSetting`
  helpers (this is how `status-bar` loads its layout).

See the header comment in [index.ts](index.ts) for code examples, and the
settings registry table in [docs/EXTENSIONS.md](../../docs/EXTENSIONS.md).

## Origin

Vendored from `@juanibiapina/pi-extension-settings` (npm 0.8.0, MIT) — see
[UPSTREAM.md](../../UPSTREAM.md).
