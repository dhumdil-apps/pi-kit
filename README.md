# pi-bundle

A single, vendored [Pi](https://pi.dev) package maintained by `dhumdil-apps`.
It includes the active extensions and skills previously installed as separate
packages.

## Documentation

Start with the [documentation index](docs/README.md), then use the focused guide:

- [Clean-machine setup](docs/SETUP.md)
- [Extension and resource catalog](docs/EXTENSIONS.md)
- [The working flow](docs/FLOW.md)
- [Commands and tools](docs/COMMANDS.md)
- [Local Pi setup](docs/LOCAL_SETUP.md)
- [Development and maintenance](docs/DEVELOPMENT.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)
- [Vendored upstream inventory](UPSTREAM.md)

## Features

- **claude-style** — the working flow ("measure twice, cut once") baked into
  every turn's system prompt as guidance, no "trivial change" shortcut:
  ① Understand (explore read-only) → ② Align (ask early and often, then get
  a plan go-ahead through the same Proceed/type-to-revise `ask_user` shape
  as a permission-gate prompt; multi-phase plans persisted to
  `.pi/plans/<name>.md`) → ③ Build (steps with checks + a simplify pass
  before each commit) → ④ Review (full diff at the end). See
  [docs/FLOW.md](docs/FLOW.md).
- **permission-gate** — the enforced guardrails: destructive commands, writes
  outside the project, web access (`web_search`, `fetch_content`,
  `get_search_content`), reads into vendored code (`node_modules`, `vendor`,
  `.venv`), and recursive search/list (`find`, `grep -r`, `rg`, `tree`,
  `ls -R`) rooted outside the project. Every gate confirms on every call —
  no session or per-kind approval. Each prompt is a single "Proceed" button;
  typing anything else denies the call and is saved as guidance for the
  agent (see **memory** below).
- **memory** — minimal per-project `.pi/MEMORY.md`, injected each turn;
  `remember` tool + `/memory`. Also written to directly by permission-gate
  when a gate denial comes with typed guidance (category `guidance`).
- **manage-todo-list**, **web-access**, **powerbar** (+ live quota via
  **pi-usage**), **usage-extension** (`/usage` history), **ask-user** inline
  prompt + skill, **simplify** skill, **welcome** banner, bundled `dark` and
  `github-dark` themes, and `/init` prompt. Config templates for a new machine
  live in [`setup/`](setup/).

## Install (local path)

This is a working copy loaded directly by Pi. In `~/.pi/agent/settings.json`,
point `packages` at your clone (absolute path):

```json
"packages": ["/absolute/path/to/pi-bundle"]
```

Edits apply on the next Pi start — no `pi install`/`pi update` needed. GitHub
(`git@github.com:dhumdil-apps/pi-bundle.git`) is the backup remote; push after
meaningful changes. For a fresh machine, follow
[docs/SETUP.md](docs/SETUP.md).

For a one-off test without changing settings:

```bash
pi -ne -e /absolute/path/to/pi-bundle
```

## Development

Edit the source under `extensions/` or `skills/`. Keep upstream provenance in
[`UPSTREAM.md`](UPSTREAM.md) when importing updates.

```bash
npm test
npm run typecheck
```

`npm run typecheck` checks every vendored extension. It currently also reports
upstream type/API drift in pi-web-access; do not add new errors in touched
files while those upstream errors are retired.
