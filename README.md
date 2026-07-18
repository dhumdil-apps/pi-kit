# pi-bundle

A single, vendored [Pi](https://pi.dev) package maintained by `dhumdil-apps`.
It includes the active extensions and the Ask User skill previously installed as
separate packages.

## Features

- **plan-mode** — auto-starts planning every interactive session (quick effort, animated powerbar spinner); every plan ends with a mandatory "Review and simplify the changes" phase. `/plan deep|off|execute|resume|status`.
- **permission-gate** — ask-user confirmation only for destructive commands (`rm -rf`, `git reset --hard`, `sudo`, …) and writes outside the project.
- **memory** — minimal per-project `.pi/MEMORY.md`, injected each turn; `remember` tool + `/memory`.
- **manage-todo-list**, **subagents**, **web-access**, **powerbar** (+ live quota via **pi-usage**), **usage-extension** (`/usage` history), **ask-user** modal + skill, **claude-style** prompt, **welcome** banner, `dark` theme, `/init` prompt.

## Install (local path)

This is a working copy loaded directly by Pi. In `~/.pi/agent/settings.json`:

```json
"packages": ["/Users/martin-peter.lakatos/pi-bundle"]
```

Edits apply on the next Pi start — no `pi install`/`pi update` needed. GitHub
(`git@github.com:dhumdil-apps/pi-bundle.git`) is the backup remote; push after
meaningful changes.

For a one-off test without changing settings:

```bash
pi -ne -e /absolute/path/to/pi-bundle
```

## Development

Edit the source under `extensions/` or `skills/`. Keep upstream provenance in
[`UPSTREAM.md`](UPSTREAM.md) when importing updates.

To verify type correctness across typescript files:

```bash
npx -y --package typescript tsc --noEmit <path-to-file> --target esnext --module esnext --moduleResolution bundler --skipLibCheck
```
