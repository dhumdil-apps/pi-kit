/**
 * TodoWidget — read-only widget that shows the current todo list.
 *
 * Displayed above the editor using ctx.ui.setWidget().
 * Shows status icons and a flat list.
 */

import type { ContextUsage, ExtensionContext, Theme } from "@earendil-works/pi-coding-agent";
import { truncateToWidth } from "@earendil-works/pi-tui";
import { contextUsageText } from "../../agent-workflow/context-usage.js";
import type { WorkflowMode } from "../../agent-workflow/mode.js";
import type { TodoStateManager } from "../state-manager.js";
import type { WorkflowPhase } from "../types.js";

// Re-exported so existing importers (and the widget's own test) keep a single entry point.
export { contextUsageText } from "../../agent-workflow/context-usage.js";

const PHASE_WIDGET_ID = "workflow-phase";
const TODO_WIDGET_ID = "todo-list";
const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const SPINNER_INTERVAL_MS = 120;
const IDLE_MARKER = "›";
const MODE_DISPLAY: Record<WorkflowMode, string> = {
  plan: "PLAN",
  implement: "IMPLEMENT",
};

/** Status icons for each todo state */
export const STATUS_ICONS: Record<string, string> = {
  "completed": "✓",
  "in-progress": "›",
  "not-started": "○",
};

/** Render a compact semantic-theme progress bar. */
export function progressBar(completed: number, total: number, theme: Theme, width = 8): string {
  const filled = total === 0 ? 0 : Math.round((completed / total) * width);
  return theme.fg("success", "█".repeat(filled)) + theme.fg("dim", "░".repeat(width - filled));
}

/** Replace pi's transient working row with a persistent workflow indicator. */
export function updatePhaseIndicator(_phase: WorkflowPhase, mode: WorkflowMode, ctx: ExtensionContext, working: boolean, usage?: ContextUsage): void {
  ctx.ui.setWorkingVisible(false);
  ctx.ui.setWidget(
    PHASE_WIDGET_ID,
    (tui, theme) => {
      let tick = 0;
      // Only an active run animates; an idle widget keeps no timer alive.
      const spinnerTimer = working
        ? setInterval(() => {
            tick++;
            tui.requestRender();
          }, SPINNER_INTERVAL_MS)
        : undefined;
      spinnerTimer?.unref?.();

      return {
        render: (width: number) => {
          const marker = working ? SPINNER_FRAMES[tick % SPINNER_FRAMES.length] : IDLE_MARKER;
          const head = `${marker} ${MODE_DISPLAY[mode]}`;
          const context = contextUsageText(usage, theme);
          const line = context
            ? `${theme.fg("accent", `${head} · `)}${context}`
            : theme.fg("accent", head);
          return [truncateToWidth(line, width)];
        },
        invalidate: () => {},
        dispose: () => {
          if (spinnerTimer) clearInterval(spinnerTimer);
        },
      };
    },
    { placement: "aboveEditor" },
  );
}

export function clearPhaseIndicator(ctx: ExtensionContext): void {
  ctx.ui.setWidget(PHASE_WIDGET_ID, undefined);
  ctx.ui.setWorkingVisible(true);
}

/** Show local todos only when explicitly visible and non-empty. */
export function updateTodoWidget(state: TodoStateManager, ctx: ExtensionContext, visible: boolean): void {
  const todos = state.read();
  if (!visible || todos.length === 0) {
    ctx.ui.setWidget(TODO_WIDGET_ID, undefined);
    return;
  }

  ctx.ui.setWidget(TODO_WIDGET_ID, (_tui, theme) => {
    const lines: string[] = [];
    const gutter = theme.fg("accent", "▍ ");

    for (const todo of todos) {
      const icon = STATUS_ICONS[todo.status] ?? "⏳";
      const id = theme.fg("accent", `${todo.id}.`);
      const coloredIcon =
        todo.status === "completed"
          ? theme.fg("success", icon)
          : todo.status === "in-progress"
            ? theme.fg("warning", icon)
            : theme.fg("dim", icon);

      let title: string;
      if (todo.status === "completed") {
        title = theme.fg("dim", theme.strikethrough(todo.title));
      } else if (todo.status === "in-progress") {
        title = theme.fg("warning", todo.title);
      } else {
        title = todo.title;
      }

      lines.push(`${gutter}${coloredIcon} ${id} ${title}`);
    }

    return {
      render: () => lines,
      invalidate: () => {},
    };
  });
}
