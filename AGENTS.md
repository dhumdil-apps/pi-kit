# AGENTS.md — pi-kit repository instructions

Vendored Pi package repository. Active code lives under `extensions/` and `skills/`, declared in `package.json` (`pi.extensions`, `pi.skills`, `pi.prompts`, `pi.themes`).

## Operating Model & Workflow

- **Single Agent**: Single-agent execution with guidance in `extensions/agent-workflow/` (see [`docs/FLOW.md`](docs/FLOW.md)).
- **Safety**: Enforced guardrails live in `extensions/minimal-action-confirmation/`.
- **Task Start**: Read `.pi/MEMORY.md` when present in the target project before modifying code.
- **Task Planning**: Follow [`docs/FLOW.md`](docs/FLOW.md) for conversational question batching and explicit plan approval.
- **Commit Discipline**: Never commit or stash automatically. After completing a verified slice, inspect `git status` and propose a ready-to-use commit message.

## Extension Architecture Rules

1. **New Plans**: Reset local memory state to `undefined` before creating a new plan to prevent stale state leaks.
2. **Resuming Blocked Plans**: Preserve existing todo items when resuming from a `blocked` phase.
3. **User Options**: Use built-in Pi dialogs or conversational turns instead of `ctx.ui.select`.
4. **Event Updates**: Emit `powerbar:update` and status events unconditionally (never gate behind `ctx.hasUI`).
5. **Headless Fallback**: When `ctx.hasUI` is false, fall back to `pi.sendMessage` so non-interactive sessions receive status messages.
6. **Imports**: Use relative `.js` specifiers for local TypeScript imports (`import ... from "./foo.js"`).

## Verification

```bash
npm test                          # Run Vitest extension unit tests
npm run typecheck                 # Run tsc --noEmit (must pass with 0 errors)
npx vitest run <test-file>        # Run a single test file
pi -p --no-session --tools '' "Reply exactly HEADLESS_OK" # Headless load smoke test
```

## Safety & Secrets

- Preserve Minimal Action Confirmation denylist gates (destructive commands, out-of-project writes, web requests, reading vendored dependencies, recursive search).
- Never commit `~/.pi/agent/auth.json`, session histories, caches, or runtime `.pi/` state.
- Update [`UPSTREAM.md`](UPSTREAM.md) whenever importing or updating vendored components.
