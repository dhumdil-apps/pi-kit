# Troubleshooting

## Pi does not show the bundle

1. Check `packages` in `~/.pi/agent/settings.json` contains
   `https://github.com/dhumdil-apps/pi-kit`.
2. Run `pi list`.
3. Run `pi update --extensions`, then restart Pi.
4. Run the headless smoke from [DEVELOPMENT.md](DEVELOPMENT.md).

## The agent edits before we agreed on a direction

The local-first flow is guidance, not enforcement (see [FLOW.md](FLOW.md)).
Say so in chat — "we haven't agreed on an approach yet" — and the agent should
return to exploration. There are no hard gates — the bundle ships no permission
gate, so nothing intercepts a tool call.

## Nothing prompts before destructive commands

Expected. The permission gate was removed on 2026-07-23; agent tool calls run
ungated. If you want confirmation prompts back, use Pi's own permission
configuration or run with a sandbox — this bundle no longer provides one.

## Full typecheck fails

Run `npm run typecheck`; the bundle expects a zero exit. Treat every reported
error as a regression or compatibility issue to fix.

## Project memory is not being used

- Project memory is an optional user-owned `.pi/MEMORY.md` file.
- The workflow checks for and reads it at the start of every task when present.
- Project memory is maintained with user confirmation during implementation close-out.
  That step preserves manual content while deduplicating or replacing stale durable
  lessons.
- `.pi/` is ignored by default; projects may customize that Git policy.
