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

export const MODE_UPDATE_EVENT = "agent-workflow:mode-update";
const MODE_DESCRIPTIONS: Record<WorkflowMode, string> = {
	plan: "Plan mode: explore and produce an approved lifecycle plan plus discovery handoff; no implementation",
	implement: "Implement mode: resume a saved plan in a fresh context and execute one approved slice",
	review: "Review mode: fresh-eyes review of the task diff against the saved plan; no new work",
};

export function isWorkflowMode(value: unknown): value is WorkflowMode {
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

	const emitMode = () => pi.events.emit(MODE_UPDATE_EVENT, currentMode);

	const reconstruct = async (_event: unknown, ctx: ExtensionContext) => {
		currentMode = restoredMode(ctx);
		emitMode();
	};
	pi.on("session_start", reconstruct);
	pi.on("session_tree", reconstruct);

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
