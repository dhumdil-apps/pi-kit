/**
 * TodoWidget — read-only widget that shows the current todo list.
 *
 * Displayed above the editor using ctx.ui.setWidget().
 * Shows status icons, progress stats, and a flat list.
 */

import type { ContextUsage, ExtensionContext, Theme, ThemeColor } from "@earendil-works/pi-coding-agent";
import { truncateToWidth } from "@earendil-works/pi-tui";
import type { WorkflowMode } from "../../agent-workflow/mode.js";
import type { TodoStateManager } from "../state-manager.js";
import type { WorkflowPhase } from "../types.js";

const PHASE_WIDGET_ID = "workflow-phase";
const TODO_WIDGET_ID = "todo-list";
const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const ACTIVITY_ROTATION_MS = 10_000;
// Four blocks regardless of context-window size, so the readout stays stable across models.
// Bars use Block Elements (█ ░) rather than Geometric Shapes (▰ ▱): terminals draw these
// themselves, so the bar never falls back to a foreign font face that breaks the cell rhythm.
const CONTEXT_BAR_SEGMENTS = 4;
const PHASE_DISPLAY: Record<WorkflowPhase, { label?: string; color: ThemeColor }> = {
  goal: { color: "accent" },
  planning: { label: "PLANNING", color: "accent" },
  implementation: { label: "IMPLEMENTATION", color: "accent" },
};
const MODE_DISPLAY: Record<WorkflowMode, { label: string; messages: string[] }> = {
  plan: { label: "PLAN", messages: ["Mapping…", "Exploring…", "Framing…", "Surveying…", "Designing…", "Specifying…"] },
  implement: { label: "IMPLEMENT", messages: ["Building…", "Wiring…", "Refining…", "Crafting…", "Testing…", "Polishing…"] },
  review: { label: "REVIEW", messages: ["Auditing…", "Probing…", "Verifying…", "Inspecting…", "Challenging…", "Confirming…"] },
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

/** Compact token count: 940, 84.0k, 1.0M. */
function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}k`;
  return `${tokens}`;
}

/**
 * Context readout in the powerbar idiom — `ctx █░░░ 84.0k / 1.0M`.
 * The bar carries the proportion, so the percentage survives only as the readout color.
 * Returns undefined while the token count is unknown (e.g. right after compaction).
 */
export function contextUsageText(usage: ContextUsage | undefined, theme: Theme): string | undefined {
  if (!usage || usage.tokens == null || usage.contextWindow <= 0) return undefined;
  const percent = Math.round(usage.percent ?? (usage.tokens / usage.contextWindow) * 100);
  const color: ThemeColor = percent > 80 ? "error" : percent > 60 ? "warning" : "accent";
  // Ceil, so any context in use shows at least one block rather than an empty track.
  const filled = Math.min(CONTEXT_BAR_SEGMENTS, Math.max(0, Math.ceil((usage.tokens / usage.contextWindow) * CONTEXT_BAR_SEGMENTS)));
  const bar = theme.fg(color, "█".repeat(filled)) + theme.fg("dim", "░".repeat(CONTEXT_BAR_SEGMENTS - filled));
  const readout = `${formatTokens(usage.tokens)} / ${formatTokens(usage.contextWindow)}`;
  return `${theme.fg(color, "ctx")} ${bar} ${theme.fg(color, readout)}`;
}

/** Select a random activity without immediately repeating the previous one. */
function selectActivity(messages: string[], previousIndex?: number): number {
  if (messages.length < 2 || previousIndex === undefined) return Math.floor(Math.random() * messages.length);
  const index = Math.floor(Math.random() * (messages.length - 1));
  return index >= previousIndex ? index + 1 : index;
}

/** Replace pi's transient working row with a persistent workflow indicator. */
export function updatePhaseIndicator(phase: WorkflowPhase, mode: WorkflowMode, ctx: ExtensionContext, working: boolean, usage?: ContextUsage): void {
  ctx.ui.setWorkingVisible(false);
  ctx.ui.setWidget(
    PHASE_WIDGET_ID,
    (tui, theme) => {
      const modeDisplay = MODE_DISPLAY[mode];
      let tick = 0;
      let activityIndex = working ? selectActivity(modeDisplay.messages) : 0;
      const spinnerTimer = working
        ? setInterval(() => {
            tick++;
            tui.requestRender();
          }, 120)
        : undefined;
      const activityTimer = working
        ? setInterval(() => {
            activityIndex = selectActivity(modeDisplay.messages, activityIndex);
            tui.requestRender();
          }, ACTIVITY_ROTATION_MS)
        : undefined;
      spinnerTimer?.unref?.();
      activityTimer?.unref?.();

      return {
        render: (width: number) => {
          const phaseDisplay = PHASE_DISPLAY[phase];
          if (working) {
            const text = `${SPINNER_FRAMES[tick % SPINNER_FRAMES.length]} ${modeDisplay.label} · ${modeDisplay.messages[activityIndex]}`;
            return [truncateToWidth(theme.fg(phaseDisplay.color, text), width)];
          }
          const head = `● ${modeDisplay.label}${phaseDisplay.label ? ` · ${phaseDisplay.label}` : ""}`;
          const context = contextUsageText(usage, theme);
          const line = context
            ? `${theme.fg(phaseDisplay.color, `${head} · `)}${context}`
            : theme.fg(phaseDisplay.color, head);
          return [truncateToWidth(line, width)];
        },
        invalidate: () => {},
        dispose: () => {
          if (spinnerTimer) clearInterval(spinnerTimer);
          if (activityTimer) clearInterval(activityTimer);
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
