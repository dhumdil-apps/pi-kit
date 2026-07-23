/**
 * Session mode management for the Agent Workflow extension.
 *
 * Each session runs in exactly one mode — plan (the default) or implement.
 * Plan flips to implement either in place (the Proceed choice of the approval
 * prompt) or across a session boundary (/handoff, handoff.ts). The model
 * cannot switch modes.
 *
 * A hidden custom-message marker in the branch is the single source of truth,
 * so the mode survives reload/fork and also applies to a handoff-seeded session
 * — whose extension instance loads (and defaults to plan) before the marker is
 * appended. State is therefore re-derived from the branch on session events and
 * before every turn, mirroring the progress-tracker clear-marker pattern.
 */

import type { ExtensionAPI, ExtensionContext, SessionEntry } from "@earendil-works/pi-coding-agent";

export const WORKFLOW_MODES = ["plan", "implement"] as const;
export type WorkflowMode = (typeof WORKFLOW_MODES)[number];

export interface ModeState {
	mode: WorkflowMode;
}

export const MODE_ENTRY_TYPE = "agent-workflow:mode";

export const MODE_UPDATE_EVENT = "agent-workflow:mode-update";
export const MODE_DESCRIPTIONS: Record<WorkflowMode, string> = {
	plan: "Plan mode: explore and present a plan for approval; no implementation",
	implement: "Implement mode: execute the approved plan and summarize honestly",
};

export function isWorkflowMode(value: unknown): value is WorkflowMode {
	return typeof value === "string" && (WORKFLOW_MODES as readonly string[]).includes(value);
}

/**
 * getBranch() yields raw session entries, so a hidden marker sent with
 * pi.sendMessage is a top-level custom_message entry — not a message entry
 * with a custom role.
 */
function markerDetails(entry: SessionEntry): { mode?: unknown } | undefined {
	if (entry.type !== "custom_message" || entry.customType !== MODE_ENTRY_TYPE) return undefined;
	return entry.details as { mode?: unknown } | undefined;
}

function restoredState(ctx: ExtensionContext): ModeState {
	let state: ModeState = { mode: "plan" };
	for (const entry of ctx.sessionManager.getBranch()) {
		const details = markerDetails(entry);
		// Legacy markers (e.g. the retired review mode) fail this guard and the
		// session falls back to plan.
		if (!isWorkflowMode(details?.mode)) continue;
		state = { mode: details.mode };
	}
	return state;
}

export interface ModeManagement {
	getState: () => ModeState;
	/** Re-derive the mode from the branch marker; publishes only on change. */
	syncFromBranch: (ctx: ExtensionContext) => ModeState;
	/**
	 * Switch mode inside the running session: persist the marker, publish the
	 * change, and either kick off the mode's first turn (when a kickoff is
	 * given, so the flow starts immediately) or surface a notice. A fresh
	 * session opens via handoff.ts instead.
	 */
	switchInPlace: (ctx: ExtensionContext, mode: WorkflowMode, kickoff?: string) => void;
}

export function registerModeManagement(pi: ExtensionAPI): ModeManagement {
	let current: ModeState = { mode: "plan" };

	const emitMode = () => pi.events.emit(MODE_UPDATE_EVENT, current.mode);

	const syncFromBranch = (ctx: ExtensionContext): ModeState => {
		const next = restoredState(ctx);
		const changed = next.mode !== current.mode;
		current = next;
		if (changed) emitMode();
		return current;
	};

	const reconstruct = async (_event: unknown, ctx: ExtensionContext) => {
		current = restoredState(ctx);
		emitMode();
	};
	pi.on("session_start", reconstruct);
	pi.on("session_tree", reconstruct);

	const switchInPlace = (ctx: ExtensionContext, mode: WorkflowMode, kickoff?: string): void => {
		current = { mode };
		pi.sendMessage(
			{ customType: MODE_ENTRY_TYPE, content: `Workflow mode: ${mode}.`, display: false, details: current },
			{ triggerTurn: false },
		);
		emitMode();
		// A kickoff message triggers the next turn itself, so the flow starts
		// without a separate notice; a bare switch just announces the new mode.
		if (kickoff) {
			pi.sendUserMessage(kickoff);
			return;
		}
		const note = `Workflow mode: ${mode}. ${MODE_DESCRIPTIONS[mode]}.`;
		if (ctx.hasUI) ctx.ui.notify(note, "info");
		else pi.sendMessage({ customType: `${MODE_ENTRY_TYPE}-notice`, content: note, display: true }, { triggerTurn: false });
	};

	return { getState: () => current, syncFromBranch, switchInPlace };
}
