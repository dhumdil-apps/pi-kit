/**
 * Context-usage readout shared across the workflow UI.
 *
 * Lives in agent-workflow (not progress-tracker) so the /mode picker can show
 * the same `ctx █░░░ 84.0k / 1.0M` readout the phase indicator renders, without
 * a circular import: progress-tracker already depends on agent-workflow.
 */

import type { ContextUsage, Theme, ThemeColor } from "@earendil-works/pi-coding-agent";

// Four blocks regardless of context-window size, so the readout stays stable across models.
// Bars use Block Elements (█ ░) rather than Geometric Shapes (▰ ▱): terminals draw these
// themselves, so the bar never falls back to a foreign font face that breaks the cell rhythm.
export const CONTEXT_BAR_SEGMENTS = 4;

/** Compact token count: 940, 84.0k, 1.0M. */
export function formatTokens(tokens: number): string {
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
