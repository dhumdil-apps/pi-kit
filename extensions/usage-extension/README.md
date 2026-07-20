# Usage Extension

Historical token/cost usage dashboard, grouped by provider, rendered inline
in the TUI.

## User surface

- `/usage` command — opens the dashboard.
  - Tab cycles: Today → This Week → Last Week → All Time
  - Arrow keys navigate providers; Enter expands/collapses to show models.

Data collection and caching live in [data.ts](data.ts) (also reused by the
`welcome` extension's startup spend summary); graph rendering in
[graph.ts](graph.ts), export in [export.ts](export.ts).

## Origin

Vendored from `@tmustier/pi-usage-extension` (npm 0.9.1, MIT) — see
[UPSTREAM.md](../../UPSTREAM.md).
