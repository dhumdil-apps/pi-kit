# Recipes — things you can ask Pi to do

One-off tasks that used to be dedicated commands but work just as well as a plain
request in the conversation. Ask for them in ordinary chat; no command or extension
is required.

## Deep session retrospective

Formerly the `/forensic` command. Ask Pi to review the current session:

> Reconstruct a causal timeline of this session: what I asked, what you did, where
> friction or rework happened, and why. Cite the specific turns and tool calls you
> can see, then surface any durable takeaway worth recording in `.pi/MEMORY.md`
> (ask before writing).

Notes:

- Pi reasons over the session it can see in context. Unlike the old `/forensic`
  command, there is no bounded raw-evidence packet injected and no session-lifetime
  tool-output measurement — the review is a qualitative reconstruction, not an
  instrumented report.
- Keep durable takeaways honest: a one-off event is not durable. Project memory
  (`.pi/MEMORY.md`) is a temporary fallback — clean entries up once the root cause is
  fixed in code or `AGENTS.md`. See [FLOW.md](FLOW.md#reflection-and-durable-learning).
