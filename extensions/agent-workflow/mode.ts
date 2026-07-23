/**
 * Session mode management for the Agent Workflow extension.
 *
 * Each session runs in exactly one mode — plan (default), implement, or
 * review — selected by a human through the /plan, /implement, and /review
 * commands. The model cannot switch modes: mode is a session-boundary
 * decision that preserves fresh-context discipline (measure twice, cut once).
 * The mode persists across reload/fork via a hidden custom-message marker and
 * is reconstructed by scanning the branch, mirroring the progress-tracker
 * clear-marker pattern.
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

export const WORKFLOW_MODES = ["plan", "implement", "review"] as const;
export type WorkflowMode = (typeof WORKFLOW_MODES)[number];

export const MODE_ENTRY_TYPE = "agent-workflow:mode";

const SEGMENT_ID = "workflow-mode";
/** Standing reminder that this bundle ships no permission gate (removed 2026-07-23). */
const YOLO_SEGMENT_ID = "yolo-mode";
const MODE_STYLE: Record<WorkflowMode, { text: string; color: string }> = {
	plan: { text: "PLAN", color: "accent" },
	implement: { text: "IMPLEMENT", color: "warning" },
	review: { text: "REVIEW", color: "muted" },
};
const MODE_DESCRIPTIONS: Record<WorkflowMode, string> = {
	plan: "Plan mode: explore and produce an approved lifecycle plan plus discovery handoff; no implementation",
	implement: "Implement mode: resume a saved plan in a fresh context and execute one approved slice",
	review: "Review mode: fresh-eyes review of the task diff against the saved plan; no new work",
};

function isWorkflowMode(value: unknown): value is WorkflowMode {
	return typeof value === "string" && (WORKFLOW_MODES as readonly string[]).includes(value);
}

function restoredMode(ctx: ExtensionContext): WorkflowMode {
	let mode: WorkflowMode = "plan";
	for (const entry of ctx.sessionManager.getBranch()) {
		if (entry.type !== "message" || entry.message.role !== "custom" || entry.message.customType !== MODE_ENTRY_TYPE) continue;
		const candidate = (entry.message.details as { mode?: unknown } | undefined)?.mode;
		if (isWorkflowMode(candidate)) mode = candidate;
	}
	return mode;
}

export function registerModeManagement(pi: ExtensionAPI): () => WorkflowMode {
	let currentMode: WorkflowMode = "plan";

	// Emitted yolo-first so the right end of row 2 reads "yolo | MODE".
	// Transients render in store insertion order, which this order fixes after
	// the powerbar core clears its store on session_start.
	const emitMode = () => {
		const style = MODE_STYLE[currentMode];
		pi.events.emit("powerbar:update", { id: YOLO_SEGMENT_ID, text: "yolo", color: "error", row: 2, transient: true });
		pi.events.emit("powerbar:update", { id: SEGMENT_ID, text: style.text, color: style.color, row: 2, transient: true });
	};

	// Emit segment registration on session_start, not at module init:
	// agent-workflow loads before status-bar, so an init-time emit would fire
	// before the powerbar consumer subscribes and be lost.
	const reconstruct = async (_event: unknown, ctx: ExtensionContext) => {
		currentMode = restoredMode(ctx);
		pi.events.emit("powerbar:register-segment", { id: YOLO_SEGMENT_ID, label: "Yolo Mode" });
		pi.events.emit("powerbar:register-segment", { id: SEGMENT_ID, label: "Workflow Mode" });
		emitMode();
	};
	pi.on("session_start", reconstruct);
	pi.on("session_tree", reconstruct);

	// agent-workflow loads before status-bar, so its session_start emit above
	// lands before the powerbar core clears its store on its own session_start.
	// The core asks earlier producers to re-emit once the store is reset.
	pi.events.on("powerbar:request-refresh", emitMode);

	for (const mode of WORKFLOW_MODES) {
		pi.registerCommand(mode, {
			description: MODE_DESCRIPTIONS[mode],
			handler: async (_args, ctx) => {
				currentMode = mode;
				pi.sendMessage(
					{ customType: MODE_ENTRY_TYPE, content: `Workflow mode: ${mode}.`, display: false, details: { mode } },
					{ triggerTurn: false },
				);
				emitMode();
				const note = `Workflow mode: ${mode}. ${MODE_DESCRIPTIONS[mode]}.`;
				if (ctx.hasUI) ctx.ui.notify(note, "info");
				else pi.sendMessage({ customType: `${MODE_ENTRY_TYPE}-notice`, content: note, display: true }, { triggerTurn: false });
			},
		});
	}

	return () => currentMode;
}
