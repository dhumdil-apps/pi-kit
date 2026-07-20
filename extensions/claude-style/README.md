# Claude Style

Appends a compact behavioral prompt (`<pi_style>`) to every agent turn's
system prompt. This is guidance, not enforcement: it describes tone, the
① Understand → ② Align → ③ Build → ④ Review working flow, and code/engineering
rules. It directs the agent to brainstorm from local reasoning and repository
context by default. Hard gates (destructive commands, web access, vendored-code
reads) live in `permission-gate`.

## User surface

None — fully automatic, no tools or commands. The prompt text is the
`CLAUDE_STYLE_PROMPT` constant in [index.ts](index.ts).

## Notes

- The block is fully static, so it remains near the start of the extension
  load order for stable provider prefix-cache hits.
- The flow it encodes is documented in [docs/FLOW.md](../../docs/FLOW.md).

## Origin

Bundle-local.
