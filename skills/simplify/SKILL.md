---
name: simplify
description: "Pre-commit review/simplify pass. Use after a step's checks pass and BEFORE committing it: reread the step's diff and remove what shouldn't ship. Also used for the final full-diff review at the end of a task."
metadata:
  short-description: Review and simplify a diff before committing
---

# Simplify — the pre-commit review pass

Run this on the diff of the step you are about to commit (`git diff` for unstaged,
`git diff --staged` once staged), or on the full task diff during the final review.

## Procedure

1. Reread the diff top to bottom as a reviewer, not as the author. For each hunk ask:
   "would this survive code review as-is?"
2. Check against the list below; fix findings directly, then rerun the checks
   (lint/typecheck/tests) if anything changed.
3. Only then commit.

## What to look for

- **Dead code** — unused imports, variables, functions, branches that can never run,
  commented-out code, leftover debug output (console.log, print, dumps).
- **Duplication** — logic that already exists as a utility in the codebase, or the same
  snippet pasted twice in the diff. Reuse instead.
- **Over-abstraction** — helpers, interfaces, options, or parameters introduced for a
  single caller or a hypothetical future. Inline them; abstractions must earn their place.
- **Scope creep** — changes unrelated to the current step (drive-by refactors, formatting
  churn in untouched lines). Revert them or move them to their own step.
- **Unclear naming** — names that need the diff's context to understand. Rename to what
  the thing is, matching the surrounding code's conventions.
- **Narrating comments** — comments that restate the code or explain the change to a
  reviewer. Keep only comments stating constraints the code can't express.
- **Error handling** — swallowed errors, empty catch blocks, error messages that leak
  internals or say nothing actionable.
- **Leftover safety nets** — temporary fallbacks, feature flags, or defensive checks that
  were scaffolding for development, not requirements.

## What NOT to do

- Do not rewrite working code for taste; the bar is "clearly better", not "different".
- Do not expand scope — a simplify pass only removes and clarifies, it never adds features.
- Do not skip rerunning checks after edits made during this pass.
