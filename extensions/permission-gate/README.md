# Permission Gate

Global, mode-independent guardrails. Prompts (via `ask_user`: "Proceed"
button, or type to deny) for every gated call — deliberately no session-wide
or per-kind approval: an annoying gate is a signal to narrow what's gated, not
to make the gate leakier.

Typing anything instead of picking Proceed denies the call **and** is treated
as guidance: it's saved to `.pi/MEMORY.md` (via memory's `rememberEntry`,
category `guidance`) and placed in the block reason so the agent can act on it
immediately.

## What is gated

- Destructive bash: `rm`/`rmdir`/`unlink`/`shred`/`dd`/`mkfs`, `sudo`,
  `find -delete/-exec rm|mv`, `xargs rm|mv`, recursive `chmod`/`chown`/`chgrp`,
  destructive git (`reset --hard`, `clean`, force push, `branch -D`,
  `stash drop/clear`).
- `edit`/`write` targeting paths outside the project cwd.
- Web access: `web_search`, `fetch_content`, `get_search_content`
  (fetched pages are untrusted text — prompt-injection risk).
- Vendored/dependency code reads (`node_modules/`, `vendor/`, `.venv/`,
  `~/.pi/agent/git|cache`).
- Recursive search/list commands (`find`, `grep -r`, `rg`, `tree`, `ls -R`)
  whose target reaches outside the project directory.

Everything else runs without prompting. Deliberately NOT gated: redirects and
`tee`, `mv`/`cp`, package managers, `kill`.

## Known limits

Denylist-based: `bash -c "..."`, scripts, and aliases can smuggle destructive
commands past the matcher.

## User surface

Inline ask-user prompts only; toggle via `/extension-settings` →
permission-gate → `enabled`.

## Origin

Bundle-local.
