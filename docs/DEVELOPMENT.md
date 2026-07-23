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

Run the working copy — extensions, prompts, and themes, no push required — with discovery
off so the managed copy cannot load alongside it:

```bash
pi -ne -np --no-themes -e ~/Github/pi-kit
```

`-e` accepts the package directory and reads its `package.json` manifest; `.`
works when the shell is already in the repository root. Use an absolute path to
dogfood a change from inside another project. `-ne` disables extension discovery, while
`-np` and `--no-themes` disable prompt template and theme discovery from installed packages
to avoid collision warnings.

Do **not** `pi install <local path>` while the published package is installed:
both copies register `save_plan` and `manage_todo_list`, so the managed
extensions fail to load with a tool-conflict error on every start. `-ne -np --no-themes -e` is
the conflict-free way to run unpublished code.

## Verification

Run typecheck and test suite before committing:

```bash
npm test
npm run typecheck
git diff --check
```

`npm run typecheck` checks every vendored TypeScript extension and must exit zero.

Smoke the working copy headlessly — the bundle loads and the default session is
Plan mode:

```bash
pi -p -ne -e ~/Github/pi-kit --tools '' --no-session "Reply with exactly one word: the session mode named in your workflow flow."
```

Session-boundary changes need a scratch project with a seeded plan
(`.pi/plan/demo-task.md`) and a session directory to inspect afterwards:

```bash
pi -p -ne -e ~/Github/pi-kit --tools '' --session-dir ./sessions "/handoff demo-task"
```

The newest file under `./sessions` must contain, in order: the `parentSession`
link, the hidden `agent-workflow:mode` marker, a `session_info` entry naming the
task, and the kickoff user message carrying the real plan path.

Interactive checks still belong to visual or lifecycle changes: Status Bar
rendering, the above-editor indicator, session dashboard, and workflow prompts.

## After publishing

Push, then refresh and smoke the managed copy consumers actually run:

```bash
pi update --extension https://github.com/dhumdil-apps/pi-kit && pi list
```

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
