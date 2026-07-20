# The working flow

There is no plan mode, no phases, and no state machine. The flow below is
**guidance** baked into the every-turn system prompt (the `claude-style`
extension); the only hard enforcement is a small set of global gates in
`permission-gate`. The agent is trusted to follow the flow; the gates protect
against the genuinely dangerous stuff regardless of what the agent decides.

## The flow (guidance)

Every task follows the same shape — no "trivial change" exception:
**① Understand → ② Align → ③ Build → ④ Review.**

1. **① Understand.** Start read-only: read the relevant code before
   touching anything. If the task needs ideas or docs that aren't available
   locally, the agent proposes web research and the user decides — never
   fetches by default.
2. **② Align.** Concrete, batched questions (via `ask_user`) about
   direction, scope, and trade-offs come up front; wrong-direction work
   costs far more than questions. Answers may loop back into Understand —
   that's the loop working, not a detour. Once direction is clear, the plan
   itself goes through `ask_user` the same way a permission-gate prompt
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
   fix before declaring done. If a permission-gate denial surfaced user
   guidance this session that hasn't been acted on, ask the user whether
   they want it addressed now.

## The gates (enforced in code, `permission-gate`)

Confirm on **every** call — no "allow for session" or per-kind approval
anywhere. This is deliberate: if a gate turns out to be too annoying in
practice, the fix is to narrow what's gated (tighten the matcher, drop a
rule), not to add a bypass that quietly reintroduces the risk.

Each prompt has one button, **Proceed** — there is no separate "Deny"
button. Typing anything instead denies the call and is treated as guidance
for what the agent should do instead: it's saved to `.pi/MEMORY.md`
(category `guidance`, via the `memory` extension's `rememberEntry`) for
future sessions, and it's also included directly in the denial the agent
sees, so it can act on it in the current turn instead of only next time.

Gated actions:

- Destructive bash (`rm`, `git reset --hard`, `sudo`, force push, …)
- `edit`/`write` outside the project directory
- `web_search`, `fetch_content`, `get_search_content` — fetched pages are
  untrusted text (prompt-injection risk)
- Reads into vendored code (`node_modules/`, `vendor/`, `.venv/`,
  `~/.pi/agent/git`, `~/.pi/agent/cache`) via `read` or bash
- Recursive search/list (`find`, `grep -r`, `rg`, `tree`, `ls -R`) rooted
  outside the project directory

Headless (no UI): gated calls are blocked with a visible notice instead of
hanging on a prompt.

All confirmations render **inline** below the transcript (never a fullscreen
overlay), so the conversation — e.g. a proposed plan — stays readable while
answering.
