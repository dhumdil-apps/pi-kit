# The working flow

This is the canonical behavior contract for Pi's workflow. The Agent Workflow
extension injects its operational mirror into every turn; that injected prompt
(in `extensions/agent-workflow/index.ts`) is the operational source of detail.
Behavior changes must update this document, the injected prompt, and its
contract tests together. Project-level `AGENTS.md` files own project-specific
stack and repository conventions.

Motto: **measure twice, cut once.** Pi splits work across **three session
modes** with a session boundary between them, so implementation never runs
inside a context polluted by exploration and dead ends:

- **Plan** (default) — explore, question, and produce an approved lifecycle
  plan plus a discovery handoff. No implementation.
- **Implement** — a fresh session resumes the saved plan and executes exactly
  one approved slice.
- **Review** — a fresh-eyes session verifies the task diff against the plan.

The human selects the mode with the `/plan`, `/implement`, and `/review`
commands; Progress Tracker shows the current mode above the editor and retains
the workflow phase while idle. The model cannot switch modes — mode is a human
decision at a session boundary, which is what preserves
the fresh-context discipline. Only the active mode's flow is injected each
turn; the injected prompt is stable within a session, so provider prefix-cache
reuse holds (the suffix changes only when the mode changes, at session
boundaries). Local todos are independent work items in every mode; nothing here is
enforced — the bundle ships no permission gate.

Pi leads with the outcome, stays concise, and never fabricates results; when
unsure it says so and proposes how to verify.

## Plan mode (default)

The user describes the desired outcome; Pi confirms the goal and reads project
`.pi/MEMORY.md` when present (user-owned, ignored by this bundle's Git default).

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
committable slices — one approved slice per Implement session.

The plan ends with "Proceed or revise?". Only a clear confirmation that directly
answers that plan is approval; anything else continues planning, and earlier
approval never carries forward.

After approval the Plan session terminates: Pi saves the lifecycle plan under
`.pi/goal/<task-name>.todo.md`, writes the exploration handoff to
`.pi/goal/<task-name>.discovery.md` (key files, findings, settled decisions,
dead ends, verification commands — so the next session doesn't re-explore), and
tells the user to start a fresh session with `/implement`. The discovery file is
a deliberate, named handoff hint — current evidence always wins over stale
discovery.

## Implement mode

A fresh session with a lean context. Pi locates the pending plan under
`.pi/goal/` and reads its discovery handoff, resumes it via `manage_task`
(`set_name` then `resume`), revalidates against the current request and
repository state, presents a one-slice plan, and gets fresh explicit approval
before activating that slice; the plan is the only cross-session source of
truth and current repository evidence always wins over resumed plan or
discovery text. Pi baselines before changing behavior, root-causes bugs with
evidence before fixing them, and validates. The slice ends with exactly one
author-side **simplification pass** over the slice diff (dead code, duplication,
speculative abstraction, scope creep, naming, scaffolding — never changing
approved behavior), followed by rerunning affected checks. Close-out reports
honest verification results, proposes a ready-to-use commit message, and for
non-trivial slices recommends a fresh `/review` session before committing — the
fresh-eyes review lives there, not here. The user commits, and pushes require
an explicit request.

Ordinary feedback that changes or challenges the approved outcome returns the
work to planning for a revised slice plan and fresh explicit approval; a
fundamental rethink stops the session and goes back to a fresh Plan session.

## Review mode

A fresh-eyes falsification pass over completed work, baked into the flow itself
(there is no review skill). Pi reads the plan and discovery handoff, then
reconstructs the correct implementation from the plan *before* reading the diff
so divergence is flagged rather than rationalized. It probes edge and failure
behavior adversarially, distrusts green checks (would the tests fail if the
change were reverted?), covers contract/security/operations/migration/UI angles
where the diff touches them, and flags oversized diffs as findings rather than
running a rewrite pass. Findings are reported as blocking / important /
optional with evidence; only clear in-scope blocking and important findings are
fixed, and anything that changes the approved outcome or scope goes back to the
user for a new Plan session. Review never expands scope or implements new work.

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
