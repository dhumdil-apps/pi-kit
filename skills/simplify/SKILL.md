---
name: simplify
description: "Simplify an implementation diff before committing or final delivery. Use after relevant checks pass, before a step commit, during a review cleanup phase, or when the user asks to remove unnecessary complexity. Fix dead code, duplication, speculative abstractions, scope creep, unclear naming/comments, weak error handling, and temporary scaffolding, then rerun affected checks."
---

# Simplify the diff

Run this on the current step diff (`git diff` for unstaged changes or
`git diff --staged` once staged), or on the complete task diff during final
cleanup.

## Procedure

1. Read the diff top to bottom as a reviewer rather than its author. For every
   hunk ask whether it should ship and whether the same outcome needs less code.
2. Fix clear findings directly, staying inside the approved behavior and scope.
3. Rerun affected lint, typecheck, tests, and smoke checks after changing code.
4. Report what was removed or clarified and any concern that could not be fixed
   without expanding scope.

## Simplification checks

- **Dead code** — Remove unused imports, variables, functions, unreachable
  branches, commented-out code, debug output, dumps, and obsolete TODOs.
- **Duplication** — Reuse an established utility or consolidate logic repeated
  in the diff. For a non-trivial new helper, first search the repository for an
  existing equivalent and prefer it when one exists. Do not create an
  abstraction when simple local code is clearer.
- **Over-abstraction** — Remove helpers, interfaces, options, parameters, or
  configuration introduced for one caller or a hypothetical future. Make every
  abstraction earn its place.
- **Scope creep** — Remove drive-by refactors, unrelated fixes, generated noise,
  and formatting churn outside the approved change.
- **Naming** — Rename things that require the diff or implementation history to
  understand; follow the surrounding domain language and conventions.
- **Comments** — Remove narration, review notes, and comments that restate code.
  Keep constraints, non-obvious reasons, and externally imposed invariants.
- **Error handling** — Remove error-handling residue introduced by the diff only
  when doing so preserves established failure behavior. Report swallowed errors,
  empty catches, or unclear failures to `/review` when correcting them could
  change behavior.
- **Temporary scaffolding** — Remove development-only fallbacks, flags,
  defensive branches, fixtures, compatibility shims, and safety nets that are
  not requirements.

## Constraints

- Do not change observable behavior or add features.
- Do not rewrite working code for taste; require a clear reduction in complexity,
  risk, or maintenance burden.
- Do not commit or push unless the user has authorized it.
