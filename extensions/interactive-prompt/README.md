# Interactive Prompt

Inline structured question UI for pi. Registers the `ask_user` tool, which
renders single-select, multi-select, and freeform text prompts directly in the
TUI using pi's built-in primitives.

## User surface

- `ask_user` tool — the agent's default way to ask direction/scope questions,
  present plans with a single "Proceed" option, and confirm consequential
  choices. Typing a freeform answer instead of picking an option is treated as
  feedback.
- Cancelling an active question opens a red confirmation first. Enter confirms
  cancellation by default; Esc or **Keep answering** returns to the question
  without losing the current selection or draft.

## Role in the bundle

This is the interaction primitive the rest of the bundle builds on: the
agent-workflow flow's Align step and Minimal Action Confirmation's prompts both
render through it. The companion skill lives in `skills/ask-user/`.

## Origin

Vendored from `pi-ask-user` (npm 0.13.0, MIT) — see [UPSTREAM.md](../../UPSTREAM.md).
