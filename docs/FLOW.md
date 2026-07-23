# The working flow

This is the canonical behavior contract for Pi's workflow. The Agent Workflow
extension injects its operational mirror into every turn; that injected prompt
(in `extensions/agent-workflow/index.ts`) is the operational source of detail.
Behavior changes must update this document, the injected prompt, and its
contract tests together. Project-level `AGENTS.md` files own project-specific
stack and repository conventions.

The flow is three steps:

1. **Understand** the goal and explore the repository.
2. **Present** a short plan — current state, desired state, approach, quirks —
   and end with a native prompt: **Proceed, handoff, or revise.**
3. **Execute** the approved plan and summarize honestly.

Two session modes carry those steps: **Plan** (the default — steps 1 and 2) and
**Implement** (step 3). Implement is reachable only through Proceed or a
handoff, so executing is always executing an approved plan. There is no review
mode — a review is just a new request whose goal is "review X", handled by the
same two steps. The model never switches modes itself.

Standing rules, in every mode: **never commit, stash, or push.** Progress
Tracker shows the current mode, the workflow phase, and context usage above the
editor. Only the active mode's flow is injected each turn, so the prompt is
stable within a session and provider prefix-cache reuse holds. Nothing here is
enforced — the bundle ships no permission gate.

## Plan mode (default)

Pi reads project `.pi/MEMORY.md` when present, explores the repository on every
task regardless of size, and asks questions only for genuine open choices that
exploration surfaced — in ordinary messages, no ceremony. When exploration
settles everything, the plan comes directly.

The plan is exactly four sections:

1. **Current state** — how it works today.
2. **Desired state** — what it should do instead.
3. **Approach** — how to get from one to the other.
4. **Quirks** — the non-obvious constraints, gotchas, and key paths worth
   carrying into a handoff.

Pi presents those sections in chat, calls `save_plan` with the same content —
the message and the file are identical, so there is nothing to keep in sync —
and ends with **Proceed, handoff, or revise?** The file lands at
`.pi/plan/<task-name>.md` and names the session. When the turn settles, the
approval prompt appears:

- **Proceed** — switch to Implement in this session and start immediately. The
  prompt recommends this while the context is lean.
- **Handoff** — prefills `/handoff <task-name>`; Enter spawns a fresh Implement
  session seeded with the mode and task name plus a kickoff naming the plan
  path. Recommended once the context is loaded (past 100k tokens or 40% full).
- **Revise** (or dismissing the prompt) — nothing changes; revise and save
  again, which simply overwrites the same file.

Headless runs get a displayed message naming the `/handoff` command instead of
the prompt. Plan mode never implements.

## Implement mode

The plan is already approved — from Proceed or from a handoff — so Pi reads it
and executes it without re-requesting approval. On a blocker unknown at
planning time it stops, reports, and lets the user decide — never guesses.
Close-out is a concise, honest summary: what changed, verification results,
every skipped or failed check. The user commits.

Plan files are **never deleted by the agent** — not at close-out, not on
success. `.pi/plan/` is the user's to keep, archive, or prune; because it
accumulates, `/handoff` resolution never assumes a single file: the explicit
name wins, then the session name, and only a lone remaining file is picked
implicitly — otherwise it asks which. Legacy `.pi/goal/` files are ignored and
preserved.

## Autonomous runs

There is no managed autonomous mode. To run Pi without this bundle — no workflow
guidance and **no safety guardrails** — start it with `pi --no-extensions`
(`-ne`). This is raw Pi, deliberately not a supervised "keep going" mode.

## Reflection and durable learning

At close-out Pi may propose concise `.pi/MEMORY.md` updates and applies them
only after the user confirms. For a deeper review, ask for one in plain chat —
no command or extension is involved:

> Reconstruct a causal timeline of this session: what I asked, what you did,
> where friction or rework happened, and why. Cite the specific turns and tool
> calls you can see, then surface any durable takeaway worth recording in
> `.pi/MEMORY.md` (ask before writing).

Pi reasons over the session it can see in context, so this is a qualitative
reconstruction, not an instrumented report. Keep takeaways honest: a one-off
event is not durable.
