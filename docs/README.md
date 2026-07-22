# Documentation index

Use this page as the map for the vendored Pi bundle and the local installation
that loads it.

## Start here

| Need | Document |
| --- | --- |
| Set up a fresh machine | [Clean-machine setup](SETUP.md) |
| Understand what is installed | [Extension and resource catalog](EXTENSIONS.md) |
| Understand the default workflow | [The working flow](FLOW.md) |
| Find a command quickly | [Commands and tools](COMMANDS.md) |
| Recreate or inspect this Mac's setup | [Local setup](LOCAL_SETUP.md) |
| Change, test, or update the bundle | [Development and maintenance](DEVELOPMENT.md) |
| Diagnose something that is not behaving | [Troubleshooting](TROUBLESHOOTING.md) |
| Trace vendored code to its source | [Upstream inventory](../UPSTREAM.md) |

## Source-of-truth boundaries

- The Git repository is the source for extensions, skills, prompts, themes,
  tests, and portable documentation.
- `~/.pi/agent/settings.json` is the source for the currently selected model,
  theme, and package path on this machine.
- `~/.pi/agent/settings-extensions.json` stores global, string-backed extension
  settings changed through `/extension-settings`.
- Project-specific files belong to the project: `.pi/MEMORY.md`, approved plans,
  optional task handoffs, and deferred improvement records. `.pi/` is ignored
  by default.
- Sessions, authentication, caches, generated package state, and model catalogs
  are runtime data. They are not bundle configuration and must not be committed.

## Repository locations

- Local working copy: `~/.pi/pi-kit`
- GitHub remote: `git@github.com:dhumdil-apps/pi-kit.git`
- Active branch: `main`
- Local Pi directory: `~/.pi`

Changes to the local working copy are picked up on the next Pi start because
Pi loads the package by absolute path.
