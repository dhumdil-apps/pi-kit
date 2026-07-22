# pi-kit

> π Measure twice, cut once.

A single, vendored [Pi](https://pi.dev) package maintained by `dhumdil-apps`.
It bundles productivity extensions, workflow automation, status indicators, and skills into one cohesive toolkit for your Pi coding sessions.

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

- **agent-workflow** — Guidance-driven development: **GOAL → PLANNING → IMPLEMENTATION**, conversational question batches, plan persistence, and durable-learning policy. See [docs/FLOW.md](docs/FLOW.md).
- **minimal-action-confirmation** — Enforced safety guardrails: confirms destructive shell commands, out-of-project writes, web requests, reading vendored dependencies, and recursive search.
- **project-memory** — Optional project-level `.pi/MEMORY.md` consulted at task start and maintained with your confirmation at task close-out.
- **progress-tracker** — Global workflow status route and interactive `/todos` checklist widget.
- **session-dashboard** — Interactive welcome banner, spend visualization chart, and context indicators (`/help`).
- **status-bar & usage-monitor** — Real-time quota and usage metrics in the status bar (`/usage`).
- **bundled skills & themes** — `/review` and `/simplify` skills, plus `dark` and `github-dark` themes.

## Documentation

- [Extension and resource catalog](docs/EXTENSIONS.md)
- [The working flow](docs/FLOW.md)
- [Commands and tools](docs/COMMANDS.md)
- [Recipes — things you can ask Pi to do](docs/RECIPES.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)
- [Vendored upstream inventory](UPSTREAM.md)

## Contributing & Maintenance

If you want to modify, test, or contribute to `pi-kit` locally, see the [Development & Maintenance Guide](docs/DEVELOPMENT.md).
