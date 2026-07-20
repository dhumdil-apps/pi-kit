/**
 * TodoWidget — read-only widget that shows the current todo list.
 *
 * Displayed above the editor using ctx.ui.setWidget().
 * Shows status icons, progress stats, and a flat list.
 */

import type { ExtensionContext, Theme } from "@earendil-works/pi-coding-agent";
import type { TodoStateManager } from "../state-manager.js";
import type { WorkflowPhase } from "../types.js";

const WIDGET_ID = "todo-list";

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

export function phaseRibbon(phase: WorkflowPhase, theme: Theme): string {
  const stages: Array<{ id: WorkflowPhase; label: string; detail: string }> = [
    { id: "goal", label: "GOAL", detail: "VISION" },
    { id: "measure", label: "MEASURE", detail: "DISCOVER" },
    { id: "cut", label: "CUT", detail: "SHAPE → POLISH" },
  ];
  return stages
    .map((stage) => {
      const text = `${stage.label} (${stage.detail})`;
      return stage.id === phase ? theme.fg("warning", theme.bold(text)) : theme.fg("dim", text);
    })
    .join(theme.fg("muted", "  →  "));
}

/**
 * Update (or clear) the todo widget.
 * Call this after every state change.
 */
export function updateWidget(state: TodoStateManager, ctx: ExtensionContext): void {
  const todos = state.read();

  const stats = state.getStats();

  ctx.ui.setWidget(WIDGET_ID, (_tui, theme) => {
    const lines: string[] = [];

    const gutter = theme.fg("accent", "▍ ");
    lines.push(gutter + phaseRibbon(state.getPhase(), theme));

    if (todos.length === 0) {
      return {
        render: () => lines,
        invalidate: () => {},
      };
    }

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

/** Clear the widget */
export function clearWidget(ctx: ExtensionContext): void {
  ctx.ui.setWidget(WIDGET_ID, undefined);
}
