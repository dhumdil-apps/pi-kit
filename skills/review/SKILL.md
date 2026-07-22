---
name: review
description: "Review and improve an implementation diff before committing or final delivery. Use after relevant checks pass, when responding to code-review feedback, before a step commit, or for the final full-task review. Find correctness, safety, contract, validation, operational, scope, and maintainability problems; fix clear in-scope blocking and important findings, rerun checks, and report unresolved risks honestly."
---

# Review the implementation

Review the current step diff before a commit, or the complete task diff before
final delivery. This is a self-review, not an independent or human review.

## Procedure

1. Read the approved plan or current request, repository instructions,
   `git status --short`, and the complete relevant diff. Inspect relevant existing
   code and tests where the diff alone cannot establish behavior.
2. Identify the strongest plausible way the implementation could still be
   wrong. Try to falsify completion with existing evidence or the cheapest
   focused check before accepting the result.
3. Review every applicable area below. Mark findings **blocking**, **important**,
   or **optional**; do not use numeric scores.
4. Fix clear blocking and important findings that remain within approved scope.
   Do not apply optional taste changes. If a fix would change the approved
   outcome, behavior, scope, assumptions, or acceptance criteria, return to
   Planning and request fresh approval instead.
5. After each material fix, rerun the cheapest affected check. Finish with the
   repository-required full tests, typecheck/lint/build checks, diff check, and
   real smoke or manual acceptance checks that apply.
6. Report fixed findings, unresolved findings, skipped or failed checks, and
   outstanding human acceptance. If there are no findings, say so plainly.

## Review areas

- **Correctness** — Compare the implementation with every approved outcome and
  acceptance criterion. Check boundary values, invalid input, empty/missing
  state, ordering, state transitions, timing/concurrency, cleanup, retry, and
  recovery where relevant.
- **Contracts** — For changed APIs, schemas, persistence, events, CLI output, or
  configuration, verify producers and consumers agree and compatibility or
  migration behavior is deliberate.
- **Safety and security** — Trace untrusted input to sensitive operations. Check
  authorization, secret exposure, injection, unsafe paths, destructive scope,
  and failure behavior when the change touches those surfaces.
- **Validation quality** — Confirm tests exercise observable behavior and would
  fail without the implementation. Look for missing regression coverage,
  assertion-free or over-mocked tests, untested failure paths, and mechanical
  checks presented as human acceptance.
- **Operational behavior** — Check resource lifecycle, actionable errors,
  partial failure, cancellation/timeouts, headless or accessibility fallbacks,
  and observability when applicable.
- **Diff discipline** — Remove unrelated edits, formatting churn, debug output,
  commented-out code, temporary flags/fallbacks, and other development residue.
- **Maintainability** — Remove dead code and duplication. Reuse established
  utilities. Reject speculative helpers, interfaces, options, or parameters.
  Improve unclear names and keep only comments that express constraints the code
  cannot express.

## Constraints

- Do not expand scope or rewrite working code for taste.
- Do not blindly accept reviewer feedback; verify each claim against the code,
  requirements, and evidence.
- Do not impose arbitrary function sizes, style doctrine, coverage numbers, or
  fixed quality thresholds.
- Do not claim independent review, user acceptance, or checks that did not run.
- Do not commit or push unless the user has authorized it.
