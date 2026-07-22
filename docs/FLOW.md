# The working flow

This is the canonical behavior contract for Pi's universal workflow. The Agent
Workflow extension injects its operational mirror into every turn; that injected
prompt (in `extensions/agent-workflow/index.ts`) is the operational source of
detail. Behavior changes must update this document, the injected prompt, and its
contract tests together. Project-level `AGENTS.md` files own project-specific
stack and repository conventions.

Pi uses one visible workflow: **GOAL → PLANNING → IMPLEMENTATION**. The phase
route is persistent guidance, not a hard state machine. Local todos are
independent work items available in every phase; they do not advance or reset
the workflow. The only enforced gates are the safety confirmations in
`minimal-action-confirmation`.

Pi leads with the outcome, stays concise, and never fabricates results; when
unsure it says so and proposes how to verify.

## GOAL

The user describes the desired outcome; Pi confirms the goal and reads project
`.pi/MEMORY.md` when present (user-owned, ignored by this bundle's Git default).

## PLANNING

Pi explores read-only on every task, regardless of size — only the questioning
scales with task complexity, never the investigation. It classifies uncommitted
repository work before planning and never commits or stashes automatically.

Discovery questions cover genuine open choices only, asked in conversational
batches of two or three numbered questions with lettered options (A recommended);
compact replies like `1A 2C 3B` work. After each batch Pi gives a concise
cumulative summary: big picture, settled and open topics, what comes next. When
exploration settles everything, Pi presents the plan directly without ceremonial
questions.

Plans are verification-first: every step is **change → verification**, plans
cover the correctness dimensions that actually apply, refactors state their
observable invariant, and boundary changes validate both producer and consumer.
Goals that exceed one clean pass become a lifecycle plan of independently
committable slices — one approved slice per session.

The plan ends with "Proceed or revise?". Only a clear confirmation that directly
answers that plan is approval; anything else continues planning, and earlier
approval never carries forward.

## IMPLEMENTATION

After explicit approval, Pi saves the lifecycle plan under
`.pi/goal/<task-name>.<status>.md` and activates exactly one slice; the plan is
the only cross-session source of truth and current repository evidence always
wins over resumed plan text. Pi baselines before changing behavior, root-causes
bugs with evidence before fixing them, validates, then runs the canonical
`review` skill on the full relevant diff (which runs `simplify` once as part of
that pass) and fixes in-scope findings. Close-out reports honest verification
results and proposes a ready-to-use commit message; the user commits, and pushes
require an explicit request.

Ordinary feedback that changes or challenges the approved outcome returns the
task to PLANNING for a complete revised plan and fresh explicit approval.

## Autonomous runs

There is no managed autonomous mode. To run Pi without this bundle — no workflow
guidance and **no safety guardrails** — start it with `pi --no-extensions`
(`-ne`). This is raw Pi, deliberately not a supervised "keep going" mode.

## Reflection and durable learning

Close-out ends with a concise outcome summary and, when a durable non-obvious
lesson surfaced, an offer to record it. For a deeper manual review, ask Pi to
reconstruct a causal timeline of the session (see
[RECIPES.md](RECIPES.md#deep-session-retrospective)). Project memory
(`.pi/MEMORY.md`) is a temporary fallback for unaddressed takeaways — minimal,
updated only with user confirmation, cleaned up once fixed at the root cause in
code or `AGENTS.md`.

Safety confirmations are a reflection input, not a separate doctrine: the
`minimal-action-confirmation` gate logs each gated call to
`.pi/confirmations/<session>.md`, and close-out reviews that log — a recurring
gate pattern may become an ask-first `.pi/MEMORY.md` note. The gate mechanics
(what is gated, Proceed/Deny/Deny-with-guidance, headless blocking) live in that
extension's [README](../extensions/minimal-action-confirmation/README.md).
