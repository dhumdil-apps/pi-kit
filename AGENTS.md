# Repository instructions

- This is a personal vendored Pi package loaded directly from this working copy.
- Start with `README.md` and `docs/README.md`; component provenance is in `UPSTREAM.md`.
- Active code lives under `extensions/`; portable skills, prompts, and themes are declared in `package.json`.
- Plan Mode is split into `index.ts`, `state.ts`, `ledger.ts`, and `checkpoint.ts`; keep pure logic out of the event-wiring closure when practical.
- Plan Mode runs single-agent (no subagent tool, no child-process delegation); the agent alone owns user decisions, todos, commits, and acceptance.
- Preserve headless bypasses, destructive-only Permission Gate behavior, and the exact active-ledger dirty exception.
- Use relative `.js` specifiers for local TypeScript imports where the surrounding extension does.
- Run `npm test` and `npm run typecheck:plan`; run one test with `npx vitest run <test-file>`.
- `npm run typecheck` covers all vendored TypeScript and currently has an upstream error backlog; do not claim it passes unless exit code is zero.
- Also run `git diff --check` and a proportional headless/interactive smoke test.
- Update the focused guide under `docs/` whenever behavior, commands, settings, local paths, or invariants change.
- Preserve licenses and update `UPSTREAM.md` whenever importing or replacing vendored code.
- Never commit `~/.pi/agent/auth.json`, sessions, caches, runtime model catalogs, project `.pi/plans`, or `.pi/MEMORY.md` by accident.
