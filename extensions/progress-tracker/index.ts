/**
 * pi-todo-list — A pi extension that replicates GitHub Copilot's manage_todo_list.
 *
 * Provides:
 * - A single `manage_todo_list` tool with read/write operations
 * - A read-only widget showing todo progress
 * - /todos command to toggle widget
 * - /todos clear command to clear the list
 * - Session persistence via tool result details
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { TodoStateManager } from "./state-manager.js";
import { createManageTodoListTool } from "./tool.js";
import {
  clearWorkflowWidget,
  updateTodoWidget,
  updateWorkflowWidget,
} from "./ui/todo-widget.js";

export default function (pi: ExtensionAPI) {
  const state = new TodoStateManager();

  let currentCtx: ExtensionContext | undefined;
  let workflowVisible = false;
  let todosVisible = false;

  const refreshWidgets = () => {
    if (!currentCtx) return;
    if (workflowVisible) updateWorkflowWidget(state, currentCtx);
    else clearWorkflowWidget(currentCtx);
    updateTodoWidget(state, currentCtx, todosVisible);
  };

  const hasSubmittedPrompt = (ctx: ExtensionContext): boolean =>
    ctx.sessionManager.getBranch().some(
      (entry) => entry.type === "message" && entry.message.role === "user"
    );

  // --- Reconstruct state from session on load/switch/fork/tree ---

  const reconstructState = (ctx: ExtensionContext) => {
    currentCtx = ctx;
    state.loadFromSession(ctx);
    workflowVisible = hasSubmittedPrompt(ctx);
    todosVisible = state.read().length > 0;
    refreshWidgets();
  };

  const onTodoUpdate = (operation: "phase" | "write") => {
    if (operation === "write") todosVisible = state.read().length > 0;
    refreshWidgets();
  };

  pi.on("session_start", async (_event, ctx) => reconstructState(ctx));
  pi.on("session_tree", async (_event, ctx) => reconstructState(ctx));

  // Keep ctx reference fresh on every turn
  pi.on("input", async (_event, ctx) => {
    currentCtx = ctx;
    workflowVisible = true;
    refreshWidgets();
  });

  pi.on("turn_start", async (_event, ctx) => {
    currentCtx = ctx;
  });

  pi.on("turn_end", async (_event, ctx) => {
    currentCtx = ctx;
    refreshWidgets();
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
        todosVisible = false;
        refreshWidgets();
        ctx.ui.notify("Todo list cleared.", "info");
        return;
      }

      workflowVisible = true;
      const todos = state.read();
      if (todos.length === 0) {
        refreshWidgets();
        ctx.ui.notify("No local todos. Workflow progress is visible.", "info");
        return;
      }

      todosVisible = !todosVisible;
      refreshWidgets();
      ctx.ui.notify(
        todosVisible
          ? `${state.getStats().completed}/${state.getStats().total} todos completed.`
          : "Todo list hidden.",
        "info"
      );
    },
  });
}
