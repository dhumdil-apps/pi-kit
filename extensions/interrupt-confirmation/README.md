# Interrupt Confirmation

Protects a running agent from accidental interruption. Pressing an interrupt
key while the agent is active opens the same native prompt the rest of the
bundle uses; **Confirm cancellation** stops the run, while **Keep running** or
Esc returns without discarding the active work. The prompt closes itself if the
agent finishes while it is open.

## User surface

Automatic in interactive TUI sessions. It does not register a command or tool.

## Origin

Bundle-local.
