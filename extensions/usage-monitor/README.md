# Usage Monitor

Live subscription/quota usage data for all providers (anthropic, copilot,
gemini, antigravity, codex, kiro, zai). Feeds the Status Bar's `sub-*` segments;
has no UI of its own.

## Events emitted

- `usage-core:ready` → `{ state: UsageCoreState }`
- `usage-core:update-current` → `{ state: UsageCoreState }`

Startup restores the selected provider's last cached snapshot without network
access. After startup, quota data refreshes every 60 seconds and on model/session
changes. Run `/usage-refresh` to fetch current data immediately; cached data
remains visible if a refresh fails.

## Origin

Vendored simplified fork of `@juanibiapina/pi-usage` / `@marckrenn/pi-sub-core`
(MIT) with cache-only automatic behavior and no Bedrock false-positive provider
detection. See
[UPSTREAM.md](../../UPSTREAM.md) and the header of [index.ts](index.ts).
