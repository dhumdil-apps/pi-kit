# Development and maintenance

## Working model

This repository is a personal vendored bundle. Preserve upstream license and
snapshot information, but optimize local behavior for the documented workflow.
Pi loads the working copy directly, so incomplete edits can affect the next Pi
session.

## Verification

```bash
npm test
npm run typecheck
git diff --check
```

`npm run typecheck` checks every vendored TypeScript extension and must exit
zero.

Headless load smoke:

```bash
pi -p --no-session --tools '' "Reply exactly HEADLESS_OK"
```

Interactive checks still matter for Status Bar rendering, the dashboard,
workflow questions, Flash lifecycle, and safety dialogs.

## Change checklist

1. Identify the owning repository, run `git status --short`, and inspect the
   relevant uncommitted diff before planning changes.
2. Read the relevant focused guide and upstream README/source.
3. Preserve unrelated working-tree changes and explicitly resolve overlaps
   with earlier decisions.
4. Keep extension imports compatible with the active
   `@earendil-works/pi-*` packages.
5. Add focused tests for extracted state/persistence/safety logic.
6. Update the matching document when behavior, commands, settings, paths, or
   ownership rules change.
7. Run focused tests/typecheck, headless load, and relevant interactive smoke.
8. Before discussing or creating a commit, run `git status --short` and inspect
   the relevant diff. Keep pre-existing work separate, verify status afterward,
   and never commit local secrets or runtime state.
9. Update `UPSTREAM.md` and license material when importing a new snapshot.

## Documentation ownership

- Root `README.md`: landing page and fastest start.
- `docs/EXTENSIONS.md`: what is loaded and why.
- `docs/FLOW.md`: the working flow (guidance) and the enforced gates.
- `docs/COMMANDS.md`: user-facing reference.
- `docs/LOCAL_SETUP.md`: reproducible local configuration, without secrets.
- `docs/TROUBLESHOOTING.md`: symptoms and recovery.
- `AGENTS.md`: short repository instructions for coding agents.
- `UPSTREAM.md`: provenance, removals, and compatibility patches.

## Updating vendored components

Treat an upstream update as a merge, not a blind overwrite:

1. Record current local changes for that component.
2. Inspect the upstream changelog/source and license.
3. Import into a temporary location or compare before replacing files.
4. Reapply local compatibility and workflow changes deliberately.
5. Run the component's checks plus bundle tests and load smoke.
6. Update its snapshot in `UPSTREAM.md`.

High-risk local behavior to preserve includes Flash cancellation, explicit plan
approval, retrospective evidence bounds, and Minimal Action Confirmation's denylist
scope (destructive commands, outside-project writes, per-call `curl`/web
access, and vendored-code reads).
