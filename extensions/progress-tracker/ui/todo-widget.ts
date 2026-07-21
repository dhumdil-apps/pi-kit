/**
 * TodoWidget — read-only widget that shows the current todo list.
 *
 * Displayed above the editor using ctx.ui.setWidget().
 * Shows status icons, progress stats, and a flat list.
 */

import type { ExtensionContext, Theme } from "@earendil-works/pi-coding-agent";
import type { TodoStateManager } from "../state-manager.js";
import type { WorkflowPhase } from "../types.js";

const WORKFLOW_WIDGET_ID = "workflow-phase";
const TODO_WIDGET_ID = "todo-list";

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
  const stages: Array<{ id: WorkflowPhase; label: string }> = [
    { id: "goal", label: "GOAL" },
    { id: "measure", label: "MEASURE TWICE" },
    { id: "cut", label: "CUT ONCE" },
  ];
  const activeIndex = stages.findIndex((stage) => stage.id === phase);

  return stages
    .map((stage, index) => {
      const branch = index === 0 ? "╭─" : index === stages.length - 1 ? "╰─" : "├─";
      const state = index < activeIndex ? "completed" : index === activeIndex ? "current" : "upcoming";
      const marker = state === "completed" ? "✓" : state === "current" ? "◉" : "○";
      const text = `${marker} ${stage.label}`;
      const styled =
        state === "completed"
          ? theme.fg("success", text)
          : state === "current"
            ? theme.fg("warning", theme.bold(text))
            : theme.fg("dim", text);
      return `${theme.fg("accent", "▍ ")}${theme.fg("muted", `${branch} `)}${styled}`;
    })
    .join("\n");
}

/** Show the global workflow route independently from local todos. */
export function updateWorkflowWidget(state: TodoStateManager, ctx: ExtensionContext): void {
  ctx.ui.setWidget(WORKFLOW_WIDGET_ID, (_tui, theme) => ({
    render: () => phaseRibbon(state.getPhase(), theme).split("\n"),
    invalidate: () => {},
  }));
}

export function clearWorkflowWidget(ctx: ExtensionContext): void {
  ctx.ui.setWidget(WORKFLOW_WIDGET_ID, undefined);
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
