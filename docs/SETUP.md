# Clean-machine setup

How to get a fully working Pi setup from this repo on a fresh machine.

## 1. Prerequisites

- Node LTS + npm, git with SSH access to `github.com:dhumdil-apps`.
- Install Pi: `npm install -g @earendil-works/pi` (see [pi.dev](https://pi.dev)
  if the install method has changed).

## 2. Clone the bundle

```bash
git clone git@github.com:dhumdil-apps/pi-bundle.git ~/pi-bundle
cd ~/pi-bundle && npm install
```

Any clone location works — it just has to match the `packages` path below.

## 3. Copy the config templates

Run Pi once (`pi`, then quit) so `~/.pi/agent/` exists, then:

```bash
cp ~/pi-bundle/setup/settings.json            ~/.pi/agent/settings.json
cp ~/pi-bundle/setup/AGENTS.md                ~/.pi/agent/AGENTS.md
cp ~/pi-bundle/setup/settings-extensions.json ~/.pi/agent/settings-extensions.json
cp ~/pi-bundle/setup/web-search.json          ~/.pi/web-search.json
```

Then edit `~/.pi/agent/settings.json` and replace the
`/ABSOLUTE/PATH/TO/pi-bundle` placeholder in `packages` with your real clone
path (no `~` — Pi expects an absolute path). If Pi already wrote defaults you
want to keep (e.g. `lastChangelogVersion`), merge instead of overwriting.

The `github-dark` theme ships in this repo's `themes/` and is registered by
the bundle, so `"theme": "github-dark"` works with no extra copy.

## 4. Authenticate (manual — never in this repo)

- Run `pi` and log in to your provider (writes `~/.pi/agent/auth.json`).
- Custom providers / API keys (e.g. OpenRouter, a local LM Studio endpoint) go
  in `~/.pi/agent/models.json` by hand. Both files hold secrets — never commit
  them anywhere.
- Optionally add `defaultProvider` / `defaultModel` to
  `~/.pi/agent/settings.json` once you know which provider you'll use.

## 5. What is intentionally not restored

Machine-local runtime data that Pi recreates or that shouldn't travel:

- `~/.pi/agent/sessions/`, caches, `run-history.jsonl`, `models-store.json`
- `~/.pi/agent/bin/` (Pi re-fetches `fd`/`rg`)
- `~/.pi/agent/npm/` — previously npm-installed extensions (`pi-subagents`,
  `pi-simplify`, `pi-add-dir`, `pi-web-access`) are all superseded by this
  bundle; do not reinstall them on a new machine (they can be removed from old
  machines too).
- Per-project `.pi/` dirs (memory, plans) — they belong to their projects.

## 6. Verify

Start `pi` in any project:

- Welcome banner and powerbar appear, `github-dark` theme is active.
- `/usage` opens the usage history.
- A destructive command (e.g. asking it to `rm` something) triggers the
  permission gate.
