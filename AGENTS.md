# Repository instructions

- This is a personal vendored Pi package loaded directly from this working copy.
- Start with `README.md` and `docs/README.md`; component provenance is in `UPSTREAM.md`.
- Active code lives under `extensions/`; portable skills, prompts, and themes are declared in `package.json`.
- There is no plan mode: the working flow is guidance in `extensions/agent-workflow/` (see `docs/FLOW.md`); enforced guardrails live in `extensions/minimal-action-confirmation/`.
- The bundle runs single-agent (no subagent tool, no child-process delegation); the agent alone owns user decisions, todos, commits, and acceptance.
- At the start of every task, check for `.pi/MEMORY.md` in the project and read it when present before planning or changing anything. Only explicit `/retro` and `/forensic` reflection may maintain it; keep durable lessons concise and deduplicated, replace stale contradictions, and preserve manual content.
- Ask planning questions conversationally in batches of two or three with recommended answer A. Accept compact replies such as `1A 2C`; after each batch give the big-picture summary, percent, open topics, estimated remaining batches, and next topics.
- Start implementation only after a positive approval directly answering the presented plan. Revision language remains in planning. `/flash` is the only autonomous no-question mode and never bypasses safety or expands authority.
- Preserve headless bypasses and the Permission Gate's denylist scope (destructive commands, outside-project writes, web access, vendored-code reads).
- Use relative `.js` specifiers for local TypeScript imports where the surrounding extension does.
- Run `npm test` and `npm run typecheck`; run one test with `npx vitest run <test-file>`.
- `npm run typecheck` covers all vendored TypeScript and must exit zero.
- Also run `git diff --check` and a proportional headless/interactive smoke test.
- Update the focused guide under `docs/` whenever behavior, commands, settings, local paths, or invariants change.
- Preserve licenses and update `UPSTREAM.md` whenever importing or replacing vendored code.
- Never commit `~/.pi/agent/auth.json`, sessions, caches, runtime model catalogs, or project `.pi/` state by accident.
