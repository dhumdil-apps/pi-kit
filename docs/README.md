# Documentation index

Use this page as the map for the vendored Pi bundle and the local installation
that loads it.

## Start here

| Need | Document |
| --- | --- |
| Understand what is installed | [Extension and resource catalog](EXTENSIONS.md) |
| Understand the default workflow | [Orchestrated Plan Mode](PLAN_MODE.md) |
| Find a command quickly | [Commands and tools](COMMANDS.md) |
| Recreate or inspect this Mac's setup | [Local setup](LOCAL_SETUP.md) |
| Change, test, or update the bundle | [Development and maintenance](DEVELOPMENT.md) |
| Diagnose something that is not behaving | [Troubleshooting](TROUBLESHOOTING.md) |
| Trace vendored code to its source | [Upstream inventory](../UPSTREAM.md) |

## Source-of-truth boundaries

- The Git repository is the source for extensions, skills, prompts, themes,
  tests, and portable documentation.
- `~/.pi/agent/settings.json` is the source for the currently selected model,
  theme, package path, and subagent overrides on this machine.
- `~/.pi/agent/settings-extensions.json` stores global, string-backed extension
  settings changed through `/extension-settings`.
- `~/.pi/web-search.json` stores Web Access configuration.
- Project-specific state belongs to the project: `.pi/MEMORY.md` and
  `.pi/plans/*`.
- Sessions, authentication, caches, generated package state, and model catalogs
  are runtime data. They are not bundle configuration and must not be committed.

## Repository locations

- Local working copy: `/Users/martin-peter.lakatos/pi-bundle`
- GitHub remote: `git@github.com:dhumdil-apps/pi-bundle.git`
- Active branch: `main`
- Local Pi directory: `/Users/martin-peter.lakatos/.pi`

Changes to the local working copy are picked up on the next Pi start because
Pi loads the package by absolute path.
