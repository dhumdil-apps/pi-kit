# Claude Style

Appends a compact behavioral prompt (`<pi_style>`) to every agent turn's
system prompt. This is guidance, not enforcement: it describes tone, the
① Understand → ② Align → ③ Build → ④ Review working flow, and code/engineering
rules. Hard gates (destructive commands, web access, vendored-code reads) live
in `permission-gate` and `pi-web-access`.

## User surface

None — fully automatic, no tools or commands. The prompt text is the
`CLAUDE_STYLE_PROMPT` constant in [index.ts](index.ts).

## Notes

- The block is fully static, so it is registered *before* `memory` in
  `package.json` — keeps the changing memory block at the tail of the system
  prompt for better provider prefix-cache hits.
- The flow it encodes is documented in [docs/FLOW.md](../../docs/FLOW.md).

## Origin

Bundle-local.
