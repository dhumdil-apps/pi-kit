# Clean-machine setup

How to install the consumer package on a fresh machine.

## 1. Prerequisites

- Node LTS + npm and Git.
- Install Pi: `npm install -g @earendil-works/pi` (see [pi.dev](https://pi.dev)
  if the install method has changed).

## 2. Install the bundle

```bash
pi install https://github.com/dhumdil-apps/pi-kit
```

Pi records the Git source in `~/.pi/agent/settings.json`, clones a managed copy
under `~/.pi/agent/git/`, and installs runtime dependencies. Do not edit that
managed copy. Update it after new changes are published:

```bash
pi update --extensions
```

Maintainers use a separate checkout; see [DEVELOPMENT.md](DEVELOPMENT.md).

## 3. Configure Pi

The install command owns the package entry. Configure provider, model, theme,
and other machine-local preferences through Pi or `~/.pi/agent/settings.json`.
Configure bundle UI preferences through `/extension-settings`; missing values
use the defaults registered by each extension.

Universal behavior is injected by the bundle's Agent Workflow extension; no
global `~/.pi/agent/AGENTS.md` is required. Project-level `AGENTS.md` files own
project-specific conventions.

The `github-dark` theme ships in this package, so `"theme": "github-dark"`
works without a separate theme copy.

## 4. Authenticate

- Run `pi` and log in to your provider; credentials are written to
  `~/.pi/agent/auth.json`.
- Custom providers and API keys belong in machine-local configuration.
- Never copy authentication files into this repository.

## 5. What is intentionally not restored

- Sessions, caches, run history, and runtime model catalogs.
- `~/.pi/agent/bin/`; Pi recreates helper binaries.
- Old npm or Git package clones; Pi recreates the managed package from settings.
- Per-project `.pi/` directories; they belong to their projects.

## 6. Verify

```bash
pi list
pi -p --no-session --tools '' "Reply exactly HEADLESS_OK"
```

The dashboard and status bar should appear in an interactive session. `/usage`,
`/flash`, `/retro`, `/forensic`, and `/improvements` should be available.
