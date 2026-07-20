# Usage Monitor

Live subscription/quota usage data for all providers (anthropic, copilot,
gemini, antigravity, codex, kiro, zai). Feeds the Status Bar's `sub-*` segments;
has no UI of its own.

## Events emitted

- `usage-core:ready` → `{ state: UsageCoreState }`
- `usage-core:update-current` → `{ state: UsageCoreState }`

Refreshes on a 60s interval, respecting cache TTLs.

## Origin

Vendored simplified fork of `@juanibiapina/pi-usage` / `@marckrenn/pi-sub-core`
(MIT) with two fixes: no Bedrock false-positive provider detection, and
turn-end refreshes respect cache TTL instead of forcing. See
[UPSTREAM.md](../../UPSTREAM.md) and the header of [index.ts](index.ts).
