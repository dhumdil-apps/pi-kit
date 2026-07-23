# pi-kit

> π Measure twice, cut once.

A single, vendored [Pi](https://pi.dev) package maintained by `dhumdil-apps`.
It bundles productivity extensions, workflow guidance, status indicators, prompts, and themes into one cohesive toolkit for your Pi coding sessions.

## Quick Start

### Prerequisites

- Node LTS + npm and Git.
- Install Pi CLI: `npm install -g @earendil-works/pi` (see [pi.dev](https://pi.dev) for details).

### Installation

Install the package directly into Pi:

```bash
pi install https://github.com/dhumdil-apps/pi-kit
```

Pi manages the package installation automatically. To update to the latest release at any time, run:

```bash
pi update --extensions
```

### Configuration & Preferences

- **Provider & Model**: Configured through Pi or in `~/.pi/agent/settings.json`.
- **Extension Settings**: Managed via `/extension-settings` in your chat session.
- **Project Memory**: Optionally create a `.pi/MEMORY.md` in your project for persistent agent takeaways.

### Verification

Verify the package is loaded cleanly in your Pi installation:

```bash
pi list
```

## Included Features

- **agent-workflow** — Guidance-driven development across two session modes — **Plan → Implement**. Plan explores, presents a four-section plan (`save_plan` → `.pi/plan/<task>.md`), and ends in a native approval prompt: Proceed switches to Implement in place, Handoff (`/handoff`) spawns a fresh seeded session, Revise stays in Plan. Standing rule: never commit, stash, or push. See [docs/FLOW.md](docs/FLOW.md).
- **progress-tracker** — Workflow mode, phase, and context-usage indicator plus the interactive `/todos` checklist widget.
- **session-dashboard** — Interactive welcome banner, spend visualization chart, and context indicators (`/help`).
- **status-bar & usage-monitor** — Real-time quota and usage metrics in the status bar (`/usage`).
- **bundled themes** — `dark` and `github-dark`.

## Documentation

- [Extension and resource catalog](docs/EXTENSIONS.md)
- [The working flow](docs/FLOW.md)
- [Commands and tools](docs/COMMANDS.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)
- [Vendored upstream inventory](UPSTREAM.md)

## Contributing & Maintenance

If you want to modify, test, or contribute to `pi-kit` locally, see the [Development & Maintenance Guide](docs/DEVELOPMENT.md).
