/**
 * pi-todo-list — A pi extension that replicates GitHub Copilot's manage_todo_list.
 *
 * Provides:
 * - A single `manage_todo_list` tool with read/write operations
 * - An always-visible phase-aware working indicator
 * - A read-only widget showing local todo progress
 * - /todos command to toggle widget
 * - /todos clear command to clear the list
 * - Session persistence via tool result details
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { isWorkflowMode, MODE_UPDATE_EVENT, type WorkflowMode } from "../agent-workflow/mode.js";
import { CLEAR_ENTRY_TYPE, TodoStateManager } from "./state-manager.js";
import { createManageTodoListTool } from "./tool.js";
import { clearPhaseIndicator, updatePhaseIndicator, updateTodoWidget } from "./ui/todo-widget.js";

export default function (pi: ExtensionAPI) {
  const state = new TodoStateManager();

  let currentCtx: ExtensionContext | undefined;
  let currentMode: WorkflowMode = "plan";
  let todosVisible = false;
  let working = false;

  const refreshStatus = () => {
    if (!currentCtx) return;
    // Context usage only moves at turn boundaries, which is exactly when
    // refreshStatus runs, so reading it here keeps the render pure.
    updatePhaseIndicator(state.getPhase(), currentMode, currentCtx, working, currentCtx.getContextUsage());
    updateTodoWidget(state, currentCtx, todosVisible);
    const usage = currentCtx.getContextUsage();
    pi.events.emit?.("agent-status:update", {
      phase: state.getPhase(),
      mode: currentMode,
      working,
      todos: state.read(),
      currentTodoId: state.read().find((todo) => todo.status === "in-progress")?.id,
      contextUsed: usage?.tokens ?? undefined,
      contextMax: usage?.contextWindow ?? undefined,
      cwd: currentCtx.cwd,
    });
  };

  // --- Reconstruct state from session on load/switch/fork/tree ---

  const reconstructState = (ctx: ExtensionContext) => {
    currentCtx = ctx;
    state.loadFromSession(ctx);
    todosVisible = state.read().length > 0;
    working = !ctx.isIdle();
    refreshStatus();
  };

  const onTodoUpdate = (operation: "phase" | "write") => {
    if (operation === "write") todosVisible = state.read().length > 0;
    refreshStatus();
  };

  pi.events.on(MODE_UPDATE_EVENT, (mode: unknown) => {
    if (!isWorkflowMode(mode)) return;
    currentMode = mode;
    refreshStatus();
  });

  pi.on("session_start", async (_event, ctx) => reconstructState(ctx));
  pi.on("session_tree", async (_event, ctx) => reconstructState(ctx));

  // Keep ctx reference fresh on every turn
  pi.on("input", async (_event, ctx) => {
    currentCtx = ctx;
    refreshStatus();
  });

  pi.on("agent_start", async (_event, ctx) => {
    currentCtx = ctx;
    working = true;
    refreshStatus();
  });

  pi.on("agent_settled", async (_event, ctx) => {
    currentCtx = ctx;
    working = false;
    refreshStatus();
  });

  pi.on("turn_start", async (_event, ctx) => {
    currentCtx = ctx;
  });

  pi.on("turn_end", async (_event, ctx) => {
    currentCtx = ctx;
    refreshStatus();
  });

  pi.on("session_shutdown", async (_event, ctx) => {
    clearPhaseIndicator(ctx);
    currentCtx = undefined;
    working = false;
  });

  // --- Register the manage_todo_list tool ---

  const tool = createManageTodoListTool(state, onTodoUpdate);
  pi.registerTool(tool);

  // --- Register commands ---

  pi.registerCommand("todos", {
    description: "Toggle todo list widget or clear todos (/todos clear)",
    handler: async (args, ctx) => {
      currentCtx = ctx;

      if (args?.trim().toLowerCase() === "clear") {
        state.clear();
        // Persist the clear as a hidden marker so a later reload/`/tree`
        // navigation (which replays manage_todo_list results from the
        // branch) doesn't resurrect the list that preceded this clear.
        pi.sendMessage({ customType: CLEAR_ENTRY_TYPE, content: "", display: false }, { triggerTurn: false });
        todosVisible = false;
        refreshStatus();
        ctx.ui.notify("Todo list cleared.", "info");
        return;
      }

      const todos = state.read();
      if (todos.length === 0) {
        refreshStatus();
        ctx.ui.notify("No local todos. Workflow phase is shown above the editor.", "info");
        return;
      }

      todosVisible = !todosVisible;
      refreshStatus();
      ctx.ui.notify(
        todosVisible
          ? `${state.getStats().completed}/${state.getStats().total} todos completed.`
          : "Todo list hidden.",
        "info"
      );
    },
  });
}
