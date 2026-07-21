# The working flow

Pi uses one visible workflow:
**GOAL (VISION) → PLANNING (DISCOVER) → IMPLEMENTATION (SHAPE → POLISH)**.
The phase route is persistent guidance, not a hard state machine. Its initial
state is shown in the dashboard's compact startup mark, then its labeled route appears
after the first submitted prompt (or an explicit `/todos` request). Local todos
are independent work items available in every phase; they do not advance or
reset the workflow. The only enforced gates are the small set of safety
confirmations in `minimal-action-confirmation`.

## GOAL (VISION)

The dashboard is the starting point. The user describes the desired outcome;
Pi confirms the goal and reads project `.pi/MEMORY.md` when present. The file
is user-owned and ignored by this bundle's Git default.

## PLANNING (DISCOVER)

Pi explores read-only and keeps the user involved without modal pressure:

- Identify the owning repository and inspect status plus relevant uncommitted
  changes before planning edits. Preserve prior work and surface conflicts with
  earlier decisions instead of silently absorbing or overwriting them.
- Ask related questions in conversational batches of two or three.
- Give lettered options and keep the recommended answer at **A**.
- Accept compact replies such as `1A 2C 3B` or normal prose.
- After the first batch, infer a shared rubric and use it consistently.
- Challenge conflicts with that rubric and reopen earlier choices when useful.
- After every batch, show an extremely concise cumulative summary: the big
  picture, planning progress, settled/open topics, estimated batches remaining,
  and what comes next.
- Once exploration supports a concise summary, set a branch-ready task identity
  with `manage_task`. It uses `SI-0000` when no ticket is supplied and may be
  refined while Planning continues.
- Before IMPLEMENTATION, identify every dimension on which correctness depends and plan the
  relevant ones explicitly: states and transitions, boundaries, timing,
  lifecycle and recovery, failure modes, accessibility or fallbacks, external
  interactions, and validation. Do not add irrelevant dimensions mechanically.

When direction is clear, Pi presents the plan in conversation. `Proceed`,
`Approved`, or `Continue` approves only when it directly answers that plan.
`Revise`, `Refine`, or `Check` means planning continues. Pi never treats
silence, an unrelated acknowledgement, or an earlier approval as permission to
start implementation.

## IMPLEMENTATION (SHAPE → POLISH)

After explicit approval, Pi saves repository implementation plans once at
`.pi/plans/<task-name>.md`; this freezes the task identity across resume. The
name can be used for a branch, but Pi does not create or switch branches unless
asked. Pi then shapes the change, validates it, and polishes the result. The separate local todo list can track ordinary work while the global
phase route stays on IMPLEMENTATION. Polish includes the full diff, tests, simplification,
follow-up learnings, and documentation—not just a final review. Pushes still
require an explicit request.

When Flash is off, ordinary IMPLEMENTATION feedback invalidates the earlier approval
whenever it changes or challenges the approved outcome, requirements,
constraints, scope, assumptions, behavior, acceptance criteria, or validation
expectations, including by reporting a mismatch. Pi judges the substance rather
than matching known examples or keywords, so novel feedback follows the same
rule. It returns to PLANNING, revalidates read-only, and identifies what changed.
It asks questions only when choices remain, but always presents the complete
revised goal, approach, interfaces, and validation plan and waits for fresh
explicit approval before editing or using another state-changing implementation
tool. Earlier approval does not carry forward. Explicit Flash may authorize
autonomous replanning, but ordinary user input brakes Flash first and safety
confirmations still apply.

## Flash mode

`/flash` is explicit cruise control. It preserves the same visible workflow,
plans, todos, checks, and normal outputs, but Pi chooses its recommended option
instead of stopping for routine input and continues through completion.

- It may start at any point in the workflow.
- An ordinary user message cancels it immediately, like touching the brake.
- The status bar shows `⚡ flash` only while active.
- It never bypasses safety confirmations or broadens the user's authority.
- When its recommendation supersedes an earlier or uncommitted decision, it
  reports the conflict and chosen resolution before continuing automatically.
- Phrases such as “proceed and don't stop” do not silently activate it; Pi
  explains `/flash` and how to opt in.

## Reflection and durable learning

- `/retro` reviews the current session compactly and ends with a `/forensic`
  reminder.
- `/forensic` reconstructs a deeper current-session timeline.
- `/forensic raw` includes bounded, annotated raw evidence.
- `/improvements` lists and revalidates deferred project improvements.

Only `/retro` and `/forensic` may maintain `.pi/MEMORY.md`. They write concise,
durable, deduplicated lessons, replace stale contradictions, and preserve manual
content. Actionable deferred findings go to `.pi/improvements/<slug>.md` with
status, priority, source, problem, evidence, and fix; completed or rejected
items are archived. Project `.pi/` state is local by default, and each project
may choose a different Git policy.

## Safety confirmations

The built-in Pi dialog asks **Proceed**, **Deny**, or **Deny with guidance** on
every gated call. Headless sessions block gated calls instead of hanging.

Gated actions are destructive shell commands, writes outside the project, web
access, reads into vendored code, and recursive search/list rooted outside the
project. These confirmations are deliberately separate from conversational
planning and remain interactive because they protect safety boundaries. For
an already-authorized gated action, Pi invokes the tool and lets this dialog be
the sole confirmation instead of asking once in chat and again in the gate.
