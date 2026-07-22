# pi-kit

Guidance over rules.

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

- **agent-workflow** — the visible **GOAL (VISION) → PLANNING (DISCOVER) →
  IMPLEMENTATION (SHAPE → POLISH)** flow, conversational question batches and plan
  approval, `/flash` cruise control, and `/retro`, `/forensic`, and
  `/improvements` learning commands. See
  [docs/FLOW.md](docs/FLOW.md).
- **minimal-action-confirmation** — the enforced guardrails: destructive commands, writes
  outside the project, web access (`curl` plus any externally supplied web
  tools), reads into vendored code (`node_modules`, `vendor`,
  `.venv`), and recursive search/list (`find`, `grep -r`, `rg`, `tree`,
  `ls -R`) rooted outside the project. Every gate confirms on every call through
  Pi's built-in Proceed/Deny/Deny-with-guidance dialog—no session or per-kind
  approval.
- **project memory** — optional, user-owned `.pi/MEMORY.md`. The workflow reads
  it at task start; only explicit `/retro` and `/forensic` reflection may
  maintain concise, durable, deduplicated lessons.
- **progress-tracker** — a global GOAL → PLANNING → IMPLEMENTATION route,
  shown after the first prompt or `/todos`; local todos remain independent and
  `/todos` toggles their separate widget.
- **session-dashboard** — the interactive startup ruler, project/spend panel,
  and loaded-resource map.
- **status-bar** (+ live quota via **usage-monitor**), **usage-history**
  (`/usage` history), separate **review** and **simplify** skills, bundled `dark`
  and `github-dark` themes, and `/init` prompt.

## Install

Consumers install the public Git package and let Pi manage its runtime copy:

```bash
pi install https://github.com/dhumdil-apps/pi-kit
```

Refresh it after a release with `pi update --extensions`. For a fresh machine,
follow [docs/SETUP.md](docs/SETUP.md).

Maintainers use a separate editable checkout. On Martin's Mac it lives at
`~/Github/pi-kit`; see [docs/LOCAL_SETUP.md](docs/LOCAL_SETUP.md). Test
unpublished changes directly from that checkout:

```bash
pi -ne -e .
```

## Development

Edit the source under `extensions/` or `skills/`. Keep upstream provenance in
[`UPSTREAM.md`](UPSTREAM.md) when importing updates.

```bash
npm test
npm run typecheck
```

`npm run typecheck` checks every vendored extension and is expected to pass.
