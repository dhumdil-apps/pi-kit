# Troubleshooting

## Pi does not show the bundle

1. Check `packages` in `~/.pi/agent/settings.json` contains the absolute
   path of your `pi-kit` clone.
2. Run `pi list`.
3. Restart Pi; a running process does not reload edited extensions.
4. Run the headless smoke from [DEVELOPMENT.md](DEVELOPMENT.md).

## The agent edits before we agreed on a direction

The local-first flow is guidance, not enforcement (see [FLOW.md](FLOW.md)).
Say so in chat — "we haven't agreed on an approach yet" — and the agent should
return to exploration. The hard gates only cover destructive commands, web
access, and vendored-code reads.

## Minimal Action Confirmation did not prompt

It is intentionally denylist-based, not a general approval system. It prompts
for recognized destructive commands, edit/write outside the project, `curl`
or externally supplied web search/fetch tools, and vendored-code reads. It does not normally prompt for
installs, pushes without force, mkdir, redirects, or other reversible work.
See source comments in `extensions/minimal-action-confirmation/index.ts` for known matcher
limits.

## Web access is blocked in headless runs

Intentional: `curl`, externally supplied web tools, and vendored-code reads
need interactive confirmation. Headless runs have no UI, so gated calls are
blocked with a notice rather than hanging. Disable the gate only if you accept
ungated web access.

## Flash mode will not stay active

This is intentional when an ordinary user message arrives: Flash behaves like
cruise control and that message is the brake. Run `/flash` again to reactivate
it. Safety dialogs do not cancel Flash, and Flash never bypasses them.

## Full typecheck fails

Run `npm run typecheck`; the bundle expects a zero exit. Treat every reported
error as a regression or compatibility issue to fix.

## Project memory is not being used

- Project memory is an optional user-owned `.pi/MEMORY.md` file.
- The workflow checks for and reads it at the start of every task when present.
- Only explicit `/retro` and `/forensic` reflection may maintain it. Those
  commands preserve manual content while deduplicating or replacing stale
  durable lessons.
- `.pi/` is ignored by default; projects may customize that Git policy.
