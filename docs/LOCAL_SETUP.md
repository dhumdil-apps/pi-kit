# Local Pi setup

This documents the active maintainer installation on Martin's Mac.

## Ownership boundaries

| Path | Purpose | Policy |
| --- | --- | --- |
| `~/Github/pi-kit` | Editable Git working copy | Develop, test, commit, and push here |
| `~/.pi/agent/git/github.com/dhumdil-apps/pi-kit` | Pi-managed runtime copy | Do not edit; refresh with Pi |
| `~/.pi/agent/settings.json` | Core Pi settings and Git package source | Machine-local; never publish secrets |
| `~/.pi/agent/settings-extensions.json` | Extension UI values | Machine-local and reproducible |
| `~/.pi/agent/auth.json` | Authentication credentials | Secret; never print or commit |
| `~/.pi/agent/sessions/` | Session history | Generated and private |

The working copy is the source of truth. Normal Pi sessions deliberately load
the managed Git installation so the maintainer exercises the same package path
as consumers.

## Active core settings

The important values in `~/.pi/agent/settings.json` are:

```json
{
  "defaultProvider": "openai-codex",
  "defaultModel": "gpt-5.6-terra",
  "defaultThinkingLevel": "medium",
  "theme": "github-dark",
  "packages": ["https://github.com/dhumdil-apps/pi-kit"]
}
```

Provider, model, and thinking level remain machine-local choices.

## Active extension settings

`~/.pi/agent/settings-extensions.json` currently keeps:

```json
{
  "powerbar": {
    "separator": " · ",
    "placement": "belowEditor",
    "bar-style": "blocks",
    "bar-width": "6"
  }
}
```

## Development and release flow

```bash
cd ~/Github/pi-kit
npm test
npm run typecheck
pi -ne -e . -p --no-session --tools '' "Reply exactly HEADLESS_OK"
```

The explicit `-e .` smoke loads unpublished working-copy code without changing
settings. After intentional changes are committed and pushed:

```bash
pi update --extensions
```

Restart Pi after the update. Do not patch the managed copy: reconciliation may
reset and clean it.

## Recreate the setup

Follow [SETUP.md](SETUP.md) for consumer installation, then clone the maintainer
working copy separately:

```bash
git clone git@github.com:dhumdil-apps/pi-kit.git ~/Github/pi-kit
cd ~/Github/pi-kit && npm install
```
