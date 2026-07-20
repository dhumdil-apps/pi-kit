# Repository instructions

- This is a personal vendored Pi package loaded directly from this working copy.
- Start with `README.md` and `docs/README.md`; component provenance is in `UPSTREAM.md`.
- Active code lives under `extensions/`; portable skills, prompts, and themes are declared in `package.json`.
- There is no plan mode: the working flow is guidance in `extensions/claude-style/` (see `docs/FLOW.md`); enforced guardrails live in `extensions/permission-gate/`.
- The bundle runs single-agent (no subagent tool, no child-process delegation); the agent alone owns user decisions, todos, commits, and acceptance.
- At the start of every task, check for `.pi/MEMORY.md` in the project and read it when present before planning or changing anything. It is user-owned: never create, modify, or inject it automatically.
- For plan approval with `ask_user`, always send `options: [{ title: "Proceed" }]` and `allowFreeform: true`; never ask a bare "Proceed?" question, which opens a text prompt instead of a selectable approval.
- Preserve headless bypasses and the Permission Gate's denylist scope (destructive commands, outside-project writes, web access, vendored-code reads).
- Use relative `.js` specifiers for local TypeScript imports where the surrounding extension does.
- Run `npm test` and `npm run typecheck`; run one test with `npx vitest run <test-file>`.
- `npm run typecheck` covers all vendored TypeScript and currently has an upstream error backlog; do not claim it passes unless exit code is zero.
- Also run `git diff --check` and a proportional headless/interactive smoke test.
- Update the focused guide under `docs/` whenever behavior, commands, settings, local paths, or invariants change.
- Preserve licenses and update `UPSTREAM.md` whenever importing or replacing vendored code.
- Never commit `~/.pi/agent/auth.json`, sessions, caches, runtime model catalogs, project `.pi/plans`, or `.pi/MEMORY.md` by accident.
