---
name: review
description: "Run a risk-adaptive, evidence-based review of an implementation diff before committing or final delivery. Use after relevant checks pass, when responding to review feedback, before a step commit, or for the final full-task review. Challenge intent, correctness, validation, applicable integration/security/operations/migration/UI risks, and completion; fix supported in-scope findings, invoke the standalone simplify pass once, rerun checks, and report unresolved risks honestly."
---

# Review the implementation

Review the current step diff before a commit, or the complete task diff before
final delivery. Treat the implementation as unproven and try to falsify it. This
is a self-review, not an independent or human review.

## Procedure

1. Read the approved plan or current request, repository instructions,
   `git status --short`, and the complete relevant diff. Inspect surrounding
   code, callers, tests, and history only where needed to establish behavior.
   Then classify the changed surface: for each conditional pass below, record
   whether the diff activates it and why, in one line, so no applicable pass is
   skipped.
2. Run the Intent, Adversarial correctness, and Validation core passes plus each
   triggered conditional pass below. Collect their complete finding set before
   editing so local fixes do not hide systemic issues. Defer Simplification and
   the Completion challenge to steps 5 and 7 respectively.
3. Record each finding as **blocking**, **important**, or **optional**, with:
   **claim**, **evidence**, **impact**, and **verification path**. Treat unsupported
   suspicion as an uncertainty, not a finding. Do not use numeric scores.
4. Fix supported blocking and important findings within approved scope. Do not
   apply optional taste changes. If a fix changes the approved outcome, behavior,
   scope, assumptions, or acceptance criteria, return to Planning for fresh
   approval.
5. Whether or not correctness fixes were needed, read
   `../simplify/SKILL.md` completely and follow it as exactly one
   simplification pass. Do not duplicate or repeat that pass.
6. Rerun the cheapest affected check after each material fix, then the
   repository-required full tests, typecheck/lint/build checks, diff check, and
   applicable real smoke or manual acceptance checks.
7. Run the completion challenge, then report fixed and unresolved findings,
   uncertainties, skipped or failed checks, and outstanding human acceptance.
   If there are no findings, say so plainly.

## Core passes

- **Intent — assume the wrong outcome was implemented.** First reconstruct from
  the approved plan alone what a correct implementation must do; then read the
  diff and flag where it diverges, rather than reading the diff first and
  rationalizing it. Trace every approved outcome and acceptance criterion to
  implementation plus evidence. Flag missing, contradicted, or accidentally
  expanded behavior.
- **Adversarial correctness — assume the happy path hides a defect.** Probe
  empty, missing, invalid, minimum, and maximum inputs plus relevant ordering,
  state transitions, timing/concurrency, retry, idempotency, partial completion,
  cleanup, and recovery behavior.
- **Validation — assume green checks provide false confidence.** Confirm tests
  assert observable behavior and would fail if the implementation were removed
  or reverted. For the single riskiest new behavior, when cheap and safe,
  confirm this empirically: briefly regress it (revert one line or invert a
  condition), run the covering test to observe the failure, then restore —
  prefer this evidence over asserting the test would fail. Detect weak
  assertions, excessive mocking, the wrong test level, and missing negative,
  boundary, failure, or regression cases.
- **Simplification — assume the diff is larger than necessary.** Run the
  standalone simplification procedure at the prescribed point in this workflow.
- **Completion challenge — assume something important remains unproven.** Name
  the strongest remaining risk and attempt one concrete falsification. Separate
  mechanical evidence from acceptance only the user can provide.

## Conditional passes

Run those your step-1 surface classification marked triggered:

- **Integration/contracts** — APIs, schemas, configuration, persistence, events,
  serialization, or CLI contracts: verify producers, consumers, defaults, and
  compatibility together.
- **Security** — External input, authentication/authorization, user data,
  secrets, paths, shell/network operations, or destructive behavior: trace trust
  boundaries and plausible abuse paths while filtering unsupported suspicions.
- **Operations** — Resources, background work, external services, or long-running
  operations: test partial failure, cancellation, timeouts, retries, cleanup,
  actionable errors, and observability.
- **Migration/rollback** — Versioned data, irreversible writes, or compatibility
  transitions: verify forward migration, mixed-version behavior where relevant,
  failure recovery, and rollback limitations.
- **UI/interaction** — Visual or interactive behavior: verify loading, empty,
  error, and disabled states plus responsiveness, keyboard use, accessibility,
  and headless fallback where applicable.

## Constraints

- Do not expand scope or rewrite working code for taste.
- Do not blindly accept reviewer feedback; verify each claim against the code,
  requirements, and evidence.
- Do not impose arbitrary function sizes, style doctrine, coverage numbers, or
  fixed quality thresholds.
- Do not claim independent review, user acceptance, or checks that did not run.
- Do not commit or push unless the user has authorized it.
