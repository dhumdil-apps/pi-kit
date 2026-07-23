# Development and maintenance

Guide for maintainers developing, testing, and updating `pi-kit`.

## Maintainer Setup

Clone the repository and install dependencies:

```bash
git clone https://github.com/dhumdil-apps/pi-kit.git
cd pi-kit
npm install
```

## Working Model

Consumers install `pi-kit` via `pi install` and run the managed copy in `~/.pi/agent/git/`.
Maintainers work from an editable clone of this repository.

To test unpublished working-copy code directly without altering your global Pi installation:

```bash
pi -ne -e .
```

## Verification

Run typecheck and test suite before committing:

```bash
npm test
npm run typecheck
git diff --check
```

`npm run typecheck` checks every vendored TypeScript extension and must exit zero.

Run headless load smoke test:

```bash
pi -p --no-session --tools '' "Reply exactly HEADLESS_OK"
```

Interactive checks should be performed when making visual or lifecycle changes to Status Bar rendering, session dashboard, workflow questions, or action confirmation dialogs.

## Change checklist

1. Identify the owning repository, run `git status --short`, inspect relevant diffs, and classify matching continuation versus separate completed or unfinished work before planning changes.
2. Read the relevant focused guide and upstream README/source.
3. Keep extension imports compatible with the active `@earendil-works/pi-*` packages.
4. Add focused tests for extracted state/persistence/safety logic.
5. Update documentation whenever behavior, commands, settings, or paths change.
6. Run full verification (`npm test`, `npm run typecheck`, headless load).
7. Propose clear, concise commit messages. Do not commit secrets or runtime session data.
8. Update `UPSTREAM.md` when importing or updating vendored components.

## Updating vendored components

Treat an upstream update as a merge, not a blind overwrite:

1. Record current local changes for that component.
2. Inspect the upstream changelog/source and license.
3. Import into a temporary location or compare before replacing files.
4. Reapply local compatibility and workflow changes deliberately.
5. Run the component's checks plus bundle tests and load smoke.
6. Update its snapshot in `UPSTREAM.md`.

High-risk local behavior to preserve includes explicit plan approval and the ask-first project-memory policy.
