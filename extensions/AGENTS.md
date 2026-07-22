# Extension development rules

Rules for developing the extensions in this kit. Each rule: trigger → action → why.

## Extension rules

1. **Starting a new plan** (e.g. in `chooseEffort`) → reset local memory state to `undefined` before creating the plan → stale state from a completed/aborted plan otherwise leaks into the new slug and todos.
2. **Executing a plan from a `"blocked"` phase** → resume with the existing todo items, never overwrite them → progress made before the block must survive the restart.
3. **Soliciting a choice from the user** → use built-in Pi dialogs or conversational turns, not `ctx.ui.select` → consistent TUI experience; also skip filler options like "Continue exploring" when escape/dismiss already covers it.
4. **Emitting `powerbar:update` / segment-deletion events** → emit unconditionally, never gated behind `ctx.hasUI` → headless and RPC clients rely on the event bus to stay in sync.
5. **Any user-facing modal or notification when `ctx.hasUI` is false** → fall back to `pi.sendMessage` in the chat log (e.g. how to execute the plan or that lifecycle state changed) → headless runs must never silently drop warnings or status.

## Running & verifying

- Test the bundle locally without touching settings, from the repo root: `pi -ne -e .`
- Typecheck a single extension file:
  `npx -y --package typescript tsc --noEmit <path-to-file> --target esnext --module esnext --moduleResolution bundler --skipLibCheck`
- Loaded extensions are listed under the `pi.extensions` key in `package.json`; a new extension must be added there to load.
- Typecheck any extension you touched before considering the change done.
