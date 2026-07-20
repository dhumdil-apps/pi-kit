# Troubleshooting

## Pi does not show the bundle

1. Check `packages` in `~/.pi/agent/settings.json` contains exactly
   `/Users/martin-peter.lakatos/pi-bundle`.
2. Run `pi list`.
3. Restart Pi; a running process does not reload edited extensions.
4. Run the headless smoke from [DEVELOPMENT.md](DEVELOPMENT.md).

## The agent edits before we agreed on a direction

The explore-first flow is guidance, not enforcement (see [FLOW.md](FLOW.md)).
Say so in chat — "we haven't agreed on an approach yet" — and the agent should
return to exploration. The hard gates only cover destructive commands, web
access, and vendored-code reads.

## Permission Gate did not prompt

It is intentionally denylist-based, not a general approval system. It prompts
for recognized destructive commands, edit/write outside the project, web
search/fetch, and vendored-code reads. It does not normally prompt for
installs, pushes without force, mkdir, redirects, or other reversible work.
See source comments in `extensions/permission-gate/index.ts` for known matcher
limits.

## Web tools are blocked in headless runs

Intentional: the web and vendored-code gates need an interactive confirmation,
and headless runs have no UI, so gated calls are blocked with a notice rather
than hanging. Disable the gate (`/extension-settings` → permission-gate) only
if you accept ungated web access.

## Ask User cannot open

The inline prompt requires an interactive UI. Headless calls must return a
safe text result or block instead of waiting for input. Confirm the Ask User
extension is loaded before Permission Gate in `package.json`.

## Full typecheck fails

`npm run typecheck` includes large vendored extensions (`pi-web-access`) and
currently exposes their upstream API/type drift. Do not suppress new errors in
touched files; distinguish the known vendored backlog from regressions
introduced by a change.

## Memory is missing or too large

- Memory is per project at `.pi/MEMORY.md`.
- `/memory` shows it; `remember` creates/appends it.
- Check `/extension-settings` → Memory → enabled.
- Injection keeps the newest tail when the file exceeds roughly 8,000
  characters; periodically curate durable entries if it becomes noisy.
