# Minimal Action Confirmation

Global, mode-independent guardrails. Pi's built-in dialogs offer Proceed,
Deny, or Deny with guidance for every gated call — deliberately no session-wide
or per-kind approval: an annoying gate is a signal to narrow what's gated, not
to make the gate leakier.

Optional denial guidance is placed in the block reason so the agent can act on
it immediately. It is not persisted automatically.

## What is gated

- Destructive bash: `rm`/`rmdir`/`unlink`/`shred`/`dd`/`mkfs`, `sudo`,
  `find -delete/-exec rm|mv`, `xargs rm|mv`, recursive `chmod`/`chown`/`chgrp`,
  destructive git (`reset --hard`, `clean`, force push, `branch -D`,
  `stash drop/clear`).
- `edit`/`write` targeting paths outside the project cwd.
- Web access: agent-issued `curl` plus any externally supplied `web_search`,
  `fetch_content`, or `get_search_content` tools
  (fetched pages are untrusted text — prompt-injection risk).
- Vendored/dependency code reads (`node_modules/`, `vendor/`, `.venv/`,
  `~/.pi/agent/git|cache`). Trusted packages/scopes are exempt — extend the
  `TRUSTED_PACKAGES` list in `index.ts` (one entry per line; an entry is an
  npm scope like `@earendil-works` or a single package like `lodash`).
- Recursive search/list commands (`find`, `grep -r`, `rg`, `tree`, `ls -R`)
  whose target reaches outside the project directory.

Everything else runs without prompting. Deliberately NOT gated: redirects and
`tee`, `mv`/`cp`, package managers, `kill`.

Prompts represent actual access to untrusted dependency content, not its name
appearing in a filter expression. `find` predicates and pruning patterns,
`rg` glob filters, `grep` include/exclude filters, and `tree` ignore filters
therefore do not prompt; using a dependency directory as a search root or file
argument still does.

Headless/RPC sessions (no dialog-capable UI) block gated calls instead of
hanging, with a visible chat notice.

## Confirmation log

Every gated call appends one line to `.pi/confirmations/<session-id>.md` in the
project (gitignored by the bundle's default), recording the timestamp, the
outcome (`Proceeded`, `Denied`, `Denied with guidance`, or `Blocked (no UI)`),
and the flattened reason (including the triggering command). This is best-effort
telemetry — a write failure never changes the gate decision, and a session with
no id (e.g. under unit tests) writes nothing. The agent-workflow reflection
policy reviews this log at close-out and may propose an ask-first `.pi/MEMORY.md`
note when a pattern recurs.

## Known limits

Denylist-based: `bash -c "..."`, scripts, and aliases can smuggle destructive
commands past the matcher.

## User surface

Built-in Pi confirmation dialogs; toggle via `/extension-settings` →
Minimal Action Confirmation (stored as `permission-gate`) → `enabled`.

## Origin

Bundle-local.
