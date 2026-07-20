# The working flow

There is no plan mode, no phases, and no state machine. The flow below is
**guidance** baked into the every-turn system prompt (the `agent-workflow`
extension); the only hard enforcement is a small set of global gates in
`minimal-action-confirmation`. The agent is trusted to follow the flow; the gates protect
against the genuinely dangerous stuff regardless of what the agent decides.

## The flow (guidance)

Every task follows the same shape — no "trivial change" exception:
**① Understand → ② Align → ③ Build → ④ Review.**

1. **① Understand.** Start read-only: check for `.pi/MEMORY.md` and read it if
   present, then read the relevant code before touching anything. The memory
   file is user-owned; it is never automatically created, changed, or injected.
   Brainstorm from local reasoning and repository context by default. If the
   task needs facts or docs that aren't available locally, the agent proposes
   web research and the user decides — never fetches by default or uses
   `curl` to work around that choice.
2. **② Align.** Concrete, batched questions (via `ask_user`) about
   direction, scope, and trade-offs come up front; wrong-direction work
   costs far more than questions. Answers may loop back into Understand —
   that's the loop working, not a detour. Once direction is clear, the plan
   itself goes through `ask_user` the same way a minimal-action-confirmation prompt
   does: a single **Proceed** option, goal/steps/validation in the
   question. Typing anything instead of Proceed means *revise*, not
   *approve* — it's plan feedback, looping back into Align, not a finished
   hand-off. Multi-phase plans are written to `.pi/plans/<name>.md` and
   ticked off as steps complete, so they survive restarts.
3. **③ Build.** At build start on multi-phase work, the agent asks once
   whether to commit each completed step. Per step: implement → run all
   available checks (lint/typecheck/tests) → a review/simplify pass over the
   step's diff (the `simplify` skill) → commit. The todo list mirrors the
   plan's steps. Push never happens unless asked.
4. **④ Review.** Reread the full diff against the goal; simplify and
   fix before declaring done. If a minimal-action-confirmation denial surfaced user
   guidance this session that hasn't been acted on, ask the user whether
   they want it addressed now.

## The gates (enforced in code, `minimal-action-confirmation`)

Confirm on **every** call — no "allow for session" or per-kind approval
anywhere. This is deliberate: if a gate turns out to be too annoying in
practice, the fix is to narrow what's gated (tighten the matcher, drop a
rule), not to add a bypass that quietly reintroduces the risk.

Each prompt has one button, **Proceed** — there is no separate "Deny"
button. Typing anything instead denies the call and is included directly in
the denial the agent sees, so it can act on it in the current turn. It is not
saved automatically.

Gated actions:

- Destructive bash (`rm`, `git reset --hard`, `sudo`, force push, …)
- `edit`/`write` outside the project directory
- `curl` and any externally supplied `web_search`, `fetch_content`, or
  `get_search_content` tools — fetched pages are untrusted text
  (prompt-injection risk)
- Reads into vendored code (`node_modules/`, `vendor/`, `.venv/`,
  `~/.pi/agent/git`, `~/.pi/agent/cache`) via `read` or bash
- Recursive search/list (`find`, `grep -r`, `rg`, `tree`, `ls -R`) rooted
  outside the project directory

The dependency-read gate reflects actual access, not names in exclusion or
pruning filters. Agents should use ordinary, tightly scoped inspection
commands and never contort commands to avoid a permission prompt.

Headless (no UI): gated calls are blocked with a visible notice instead of
hanging on a prompt.

All confirmations render **inline** below the transcript (never a fullscreen
overlay), so the conversation — e.g. a proposed plan — stays readable while
answering.
