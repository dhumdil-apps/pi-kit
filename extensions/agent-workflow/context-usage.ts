/**
 * Context-usage readout shared across the workflow UI.
 *
 * Lives in agent-workflow (not progress-tracker) so the approval prompt can
 * lean on the same thresholds the phase indicator's `ctx █░░░ 84.0k / 1.0M`
 * readout uses, without a circular import: progress-tracker already depends
 * on agent-workflow.
 */

import type { ContextUsage, Theme, ThemeColor } from "@earendil-works/pi-coding-agent";

// Four blocks regardless of context-window size, so the readout stays stable across models.
// Bars use Block Elements (█ ░) rather than Geometric Shapes (▰ ▱): terminals draw these
// themselves, so the bar never falls back to a foreign font face that breaks the cell rhythm.
export const CONTEXT_BAR_SEGMENTS = 4;

// Severity reacts to the absolute token count as well as the fill ratio: on a 1M-window
// model 200k of context is only 20% full, yet output quality has already degraded. Whichever
// threshold trips first wins.
export const CONTEXT_WARNING_TOKENS = 100_000;
export const CONTEXT_ERROR_TOKENS = 200_000;
export const CONTEXT_WARNING_PERCENT = 40;
export const CONTEXT_ERROR_PERCENT = 80;

/** Compact token count: 940, 84.0k, 1.0M. */
export function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}k`;
  return `${tokens}`;
}

/**
 * How loaded the context is: accent (healthy), warning, or error. Undefined while the
 * token count is unknown (e.g. right after compaction), matching contextUsageText.
 */
export function contextSeverity(usage: ContextUsage | undefined): ThemeColor | undefined {
  if (!usage || usage.tokens == null || usage.contextWindow <= 0) return undefined;
  const percent = Math.round(usage.percent ?? (usage.tokens / usage.contextWindow) * 100);
  if (usage.tokens > CONTEXT_ERROR_TOKENS || percent > CONTEXT_ERROR_PERCENT) return "error";
  if (usage.tokens > CONTEXT_WARNING_TOKENS || percent > CONTEXT_WARNING_PERCENT) return "warning";
  return "accent";
}

/**
 * Whether the context is healthy enough to keep working in this session. An unknown
 * usage counts as lean, mirroring the neutral `ctx —` fallback in the pickers.
 */
export function isLeanContext(usage: ContextUsage | undefined): boolean {
  return (contextSeverity(usage) ?? "accent") === "accent";
}

/**
 * Context readout in the powerbar idiom — `ctx █░░░ 84.0k / 1.0M`.
 * The bar carries the proportion, so the load survives only as the readout color.
 * Returns undefined while the token count is unknown (e.g. right after compaction).
 */
export function contextUsageText(usage: ContextUsage | undefined, theme: Theme): string | undefined {
  const color = contextSeverity(usage);
  if (!color || !usage || usage.tokens == null) return undefined;
  // Ceil, so any context in use shows at least one block rather than an empty track.
  const filled = Math.min(CONTEXT_BAR_SEGMENTS, Math.max(0, Math.ceil((usage.tokens / usage.contextWindow) * CONTEXT_BAR_SEGMENTS)));
  const bar = theme.fg(color, "█".repeat(filled)) + theme.fg("dim", "░".repeat(CONTEXT_BAR_SEGMENTS - filled));
  const readout = `${formatTokens(usage.tokens)} / ${formatTokens(usage.contextWindow)}`;
  return `${theme.fg(color, "ctx")} ${bar} ${theme.fg(color, readout)}`;
}
