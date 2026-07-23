# Agent Status Bridge

Optional, vendor-neutral display-only progress reporting. It is disabled by default; enable
`agent-status-bridge / Report display-only agent status` in `/extension-settings`.

Configure `AGENT_STATUS_URL` and `AGENT_STATUS_TOKEN`. When those are absent, the bridge
optionally reads `AGENT_STATUS_DISCOVERY`, falling back to `~/.wingman/status.json`. Network
calls are best-effort, capped by a short timeout, and never block or fail a Pi turn.
