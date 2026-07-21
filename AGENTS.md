# Repository instructions

## What this is / start here

- Personal vendored Pi package loaded directly from this working copy.
- Start with `README.md` and `docs/README.md`; component provenance is in `UPSTREAM.md`.
- Active code lives under `extensions/`; portable skills, prompts, and themes are declared in `package.json` (`pi.extensions`, resource roots).
- Extension catalog: `docs/EXTENSIONS.md`.

## Operating model

- Single-agent: no subagent tool, no child-process delegation. The agent alone owns user decisions, todos, commits, and acceptance.
- No plan mode: the working flow is guidance in `extensions/agent-workflow/` (see `docs/FLOW.md`); enforced guardrails live in `extensions/minimal-action-confirmation/`.

## At task start

- Read `.pi/MEMORY.md` in the project when present before planning or changing anything. Only `/retro` and `/forensic` reflection may maintain it; keep durable lessons concise and deduplicated, replace stale contradictions, preserve manual content.
- Identify the owning repository, run `git status --short`, and inspect relevant uncommitted diffs before planning. Preserve prior work and surface conflicts; Flash reports its resolution and continues.

## Planning / implementation

- See `docs/FLOW.md` for the full flow.
- Ask planning questions conversationally in batches of 2–3 with recommended **A**. Accept compact replies such as `1A 2C`; after each batch give the big-picture summary, percent, open topics, estimated remaining batches, and next topics.
- Start implementation only after explicit approval of the presented plan. Revision language remains in planning. `/flash` is the only autonomous mode and never bypasses safety or expands authority.

## Validate

- `npm test` and `npm run typecheck` (covers all vendored TypeScript; must exit zero).
- Single test: `npx vitest run <test-file>`.
- `git diff --check` and a proportional headless/interactive smoke test.
- Headless smoke: `pi -p --no-session --tools '' "Reply exactly HEADLESS_OK"`.

## Conventions

- Use relative `.js` specifiers for local TypeScript imports where the surrounding extension does.

## Safety / provenance / secrets

- Preserve headless bypasses and Minimal Action Confirmation's denylist scope (destructive commands, outside-project writes, web access, vendored-code reads, recursive search rooted outside the project).
- Update the focused guide under `docs/` whenever behavior, commands, settings, local paths, or invariants change.
- Preserve `LICENSES/` and update `UPSTREAM.md` whenever importing or replacing vendored code.
- Before discussing or creating a commit, run `git status --short` and inspect the relevant diff so pre-existing work stays separate. Verify status again after committing.
- Never commit `~/.pi/agent/auth.json`, sessions, caches, runtime model catalogs, or project `.pi/` state.
