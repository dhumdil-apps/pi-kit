# Local Pi setup

This documents the active installation on Martin's Mac. It is intentionally
separate from portable bundle code.

## Paths

| Path | Purpose | Backup/commit policy |
| --- | --- | --- |
| `~/.pi/pi-kit` | Git working copy loaded by Pi | Commit and push intentional changes |
| `~/.pi/agent/settings.json` | Core Pi settings, local package path, role overrides | Private machine config; document values, do not blindly publish |
| `~/.pi/agent/settings-extensions.json` | Extension UI values | Private machine config; safe to reconstruct from this guide |
| `~/.pi/agent/themes/` | Optional machine-local theme overrides | The active `github-dark` theme now ships in the bundle (`themes/github-dark.json`); a local copy here is redundant |
| `~/.pi/agent/auth.json` | Authentication credentials/tokens | Secret; never print, copy into docs, or commit |
| `~/.pi/agent/sessions/` | Session history | Generated/private |
| `~/.pi/agent/usage-extension-cache.json` | Usage cache | Generated |
| `~/.pi/agent/models*.json` | Runtime model catalogs/overrides | Local/generated unless deliberately curated |
| `~/.pi/agent/npm/`, `~/.pi/agent/git/` | Pi package runtime/cache areas | Generated; not the bundle source |

## Active core settings

The important values in `~/.pi/agent/settings.json` are:

```json
{
  "defaultProvider": "openai-codex",
  "defaultModel": "gpt-5.6-terra",
  "defaultThinkingLevel": "medium",
  "theme": "github-dark",
  "packages": ["~/.pi/pi-kit"]
}
```

Role thinking overrides are documented in
[Extension and resource catalog](EXTENSIONS.md#role-policy).

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

Extension Settings are global and string-backed. Missing values use the default
registered by the extension.

## Load and update behavior

Pi loads the `~/.pi/pi-kit` working copy directly. Source edits apply
on the next Pi process; there is no install/update step between editing and
testing.

Useful checks:

```bash
pi list
pi -p --no-session --tools '' "Reply exactly HEADLESS_OK"
cd ~/.pi/pi-kit
npm test
npm run typecheck
```

The GitHub remote is a backup and collaboration surface, not the runtime load
source. Committing/pushing does not refresh a running Pi process; restart Pi.

## Recreate the setup

Follow [SETUP.md](SETUP.md) — it covers cloning, the config templates in
`setup/`, authentication, and verification. Machine-specific extras for this
Mac: the role thinking overrides from [EXTENSIONS.md](EXTENSIONS.md) and the
`defaultProvider`/`defaultModel` values shown above.

Do not restore stale Git-package clones or old settings backups; the
`~/.pi/pi-kit` local package path is the intended setup.
