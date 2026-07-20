# Troubleshooting

## Pi does not show the bundle

1. Check `packages` in `~/.pi/agent/settings.json` contains the absolute
   path of your `pi-bundle` clone.
2. Run `pi list`.
3. Restart Pi; a running process does not reload edited extensions.
4. Run the headless smoke from [DEVELOPMENT.md](DEVELOPMENT.md).

## The agent edits before we agreed on a direction

The local-first flow is guidance, not enforcement (see [FLOW.md](FLOW.md)).
Say so in chat — "we haven't agreed on an approach yet" — and the agent should
return to exploration. The hard gates only cover destructive commands, web
access, and vendored-code reads.

## Permission Gate did not prompt

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

## Ask User cannot open

The inline prompt requires an interactive UI. Headless calls must return a
safe text result or block instead of waiting for input. Confirm the Ask User
extension is loaded before Permission Gate in `package.json`.

## Full typecheck fails

Do not suppress new typecheck errors in touched files; distinguish any known
vendored backlog from regressions introduced by a change.

## Project memory is not being used

- Project memory is an optional user-owned `.pi/MEMORY.md` file.
- The workflow checks for and reads it at the start of every task when present.
- It is not automatically created, modified, or injected; create and curate it manually.
