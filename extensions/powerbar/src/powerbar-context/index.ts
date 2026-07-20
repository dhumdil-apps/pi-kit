/**
 * Powerbar Context Producer
 *
 * Shows context window usage as a progress bar with percentage.
 * Color changes based on usage level: accent → warning → error.
 * Segment ID: "context-usage"
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

// Keep the context indicator consistent across models and with the Powerbar
// layout: four blocks, regardless of the context-window size.
const CONTEXT_BAR_SEGMENTS = 4;

function getColor(pct: number): string {
	if (pct > 80) return "error";
	if (pct > 60) return "warning";
	return "accent";
}

function emitContextUsage(pi: ExtensionAPI, ctx: ExtensionContext): void {
	const usage = ctx.getContextUsage();
	const pct = usage?.tokens != null && usage.contextWindow > 0
		? Math.round((usage.tokens / usage.contextWindow) * 100)
		: 0;
	pi.events.emit("powerbar:update", {
		id: "context-usage",
		text: "ctx",
		suffix: `${pct}%`,
		bar: pct,
		barSegments: CONTEXT_BAR_SEGMENTS,
		color: getColor(pct),
	});
}

function resetContextUsage(pi: ExtensionAPI): void {
	pi.events.emit("powerbar:update", {
		id: "context-usage",
		text: "ctx",
		suffix: "0%",
		bar: 0,
		barSegments: CONTEXT_BAR_SEGMENTS,
		color: getColor(0),
	});
}

export default function createExtension(pi: ExtensionAPI): void {
	pi.events.emit("powerbar:register-segment", { id: "context-usage", label: "Context Usage" });

	// Reset on new/switched session
	pi.on("session_start", async () => resetContextUsage(pi));

	// Update frequently during agent work
	pi.on("turn_start", async (_event, ctx) => emitContextUsage(pi, ctx));
	pi.on("tool_result", async (_event, ctx) => emitContextUsage(pi, ctx));
	pi.on("turn_end", async (_event, ctx) => emitContextUsage(pi, ctx));
}
