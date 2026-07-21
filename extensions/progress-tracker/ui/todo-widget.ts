/**
 * TodoWidget — read-only widget that shows the current todo list.
 *
 * Displayed above the editor using ctx.ui.setWidget().
 * Shows status icons, progress stats, and a flat list.
 */

import type { ExtensionContext, Theme, ThemeColor } from "@earendil-works/pi-coding-agent";
import { truncateToWidth } from "@earendil-works/pi-tui";
import type { TodoStateManager } from "../state-manager.js";
import type { WorkflowPhase } from "../types.js";

const PHASE_WIDGET_ID = "workflow-phase";
const TODO_WIDGET_ID = "todo-list";
const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const PHASE_DISPLAY: Record<WorkflowPhase, { label: string; color: ThemeColor; messages: string[] }> = {
  goal: { label: "GOAL", color: "accent", messages: ["Visioning…"] },
  planning: { label: "PLANNING", color: "accent", messages: ["Exploring…", "Discovering…"] },
  implementation: { label: "IMPLEMENTATION", color: "accent", messages: ["Implementing…", "Shaping…", "Polishing…"] },
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
  return theme.fg("success", "▰".repeat(filled)) + theme.fg("dim", "▱".repeat(width - filled));
}

/** Replace pi's transient working row with a persistent phase-aware indicator. */
export function updatePhaseIndicator(phase: WorkflowPhase, ctx: ExtensionContext, working: boolean): void {
  ctx.ui.setWorkingVisible(false);
  ctx.ui.setWidget(
    PHASE_WIDGET_ID,
    (tui, theme) => {
      let tick = 0;
      const timer = working
        ? setInterval(() => {
            tick++;
            tui.requestRender();
          }, 120)
        : undefined;
      timer?.unref?.();

      return {
        render: (width: number) => {
          const display = PHASE_DISPLAY[phase];
          const text = working
            ? `${SPINNER_FRAMES[tick % SPINNER_FRAMES.length]} ${display.messages[Math.floor(tick / 12) % display.messages.length]}`
            : `● ${display.label}`;
          return [truncateToWidth(theme.fg(display.color, text), width)];
        },
        invalidate: () => {},
        dispose: () => {
          if (timer) clearInterval(timer);
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

  const stats = state.getStats();
  ctx.ui.setWidget(TODO_WIDGET_ID, (_tui, theme) => {
    const lines: string[] = [];
    const gutter = theme.fg("accent", "▍ ");

    lines.push(gutter);
    const header =
      gutter +
      theme.fg("accent", theme.bold("Todo List")) +
      "  " +
      progressBar(stats.completed, stats.total, theme, stats.total) +
      theme.fg("muted", `  ${stats.completed}/${stats.total}`);
    lines.push(header);
    lines.push(gutter);

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
