/**
 * Session mode management for the Agent Workflow extension.
 *
 * Each session runs in exactly one mode — plan (default), implement, or
 * review — selected by a human through the /mode command: switchInPlace here
 * reuses the running session, and openHandoffSession (handoff.ts) spawns a
 * fresh seeded one. The model cannot switch modes: mode is a session-boundary
 * decision that preserves fresh-context discipline (measure twice, cut once).
 *
 * A hidden custom-message marker in the branch is the single source of truth,
 * so the mode survives reload/fork and also applies to a handoff-seeded session
 * — whose extension instance loads (and defaults to plan) before the marker is
 * appended. State is therefore re-derived from the branch on session events and
 * before every turn, mirroring the progress-tracker clear-marker pattern.
 */

import type { ExtensionAPI, ExtensionContext, SessionEntry } from "@earendil-works/pi-coding-agent";

export const WORKFLOW_MODES = ["plan", "implement", "review"] as const;
export type WorkflowMode = (typeof WORKFLOW_MODES)[number];

/**
 * Where the active mode came from: a session boundary (restored marker or a
 * handoff-seeded session) or an in-place switch mid-session.
 */
export type ModeOrigin = "boundary" | "inplace";

export interface ModeState {
	mode: WorkflowMode;
	origin: ModeOrigin;
}

export const MODE_ENTRY_TYPE = "agent-workflow:mode";

export const MODE_UPDATE_EVENT = "agent-workflow:mode-update";
export const MODE_DESCRIPTIONS: Record<WorkflowMode, string> = {
	plan: "Plan mode: explore and produce an approved lifecycle plan plus discovery handoff; no implementation",
	implement: "Implement mode: resume a saved plan in a fresh context and execute one approved slice",
	review: "Review mode: fresh-eyes review of the task diff against the saved plan; no new work",
};

export function isWorkflowMode(value: unknown): value is WorkflowMode {
	return typeof value === "string" && (WORKFLOW_MODES as readonly string[]).includes(value);
}

/**
 * getBranch() yields raw session entries, so a hidden marker sent with
 * pi.sendMessage is a top-level custom_message entry — not a message entry
 * with a custom role.
 */
function markerDetails(entry: SessionEntry): { mode?: unknown; origin?: unknown } | undefined {
	if (entry.type !== "custom_message" || entry.customType !== MODE_ENTRY_TYPE) return undefined;
	return entry.details as { mode?: unknown; origin?: unknown } | undefined;
}

function restoredState(ctx: ExtensionContext): ModeState {
	let state: ModeState = { mode: "plan", origin: "boundary" };
	for (const entry of ctx.sessionManager.getBranch()) {
		const details = markerDetails(entry);
		if (!isWorkflowMode(details?.mode)) continue;
		state = { mode: details.mode, origin: details.origin === "inplace" ? "inplace" : "boundary" };
	}
	return state;
}

export interface ModeManagement {
	getState: () => ModeState;
	/** Re-derive the mode from the branch marker; publishes only on change. */
	syncFromBranch: (ctx: ExtensionContext) => ModeState;
	/**
	 * Switch mode inside the running session: persist the in-place marker,
	 * publish the change, and either kick off the mode's first turn (when a
	 * kickoff is given, so the flow starts immediately) or surface a notice.
	 * This is the same-session half of /mode; a fresh session opens via handoff.
	 */
	switchInPlace: (ctx: ExtensionContext, mode: WorkflowMode, options?: { kickoff?: string }) => void;
}

export function registerModeManagement(pi: ExtensionAPI): ModeManagement {
	let current: ModeState = { mode: "plan", origin: "boundary" };

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

	const switchInPlace = (ctx: ExtensionContext, mode: WorkflowMode, options: { kickoff?: string } = {}): void => {
		current = { mode, origin: "inplace" };
		pi.sendMessage(
			{ customType: MODE_ENTRY_TYPE, content: `Workflow mode: ${mode}.`, display: false, details: current },
			{ triggerTurn: false },
		);
		emitMode();
		// A kickoff message triggers the next turn itself, so the flow starts
		// without a separate notice; a bare switch just announces the new mode.
		if (options.kickoff) {
			pi.sendUserMessage(options.kickoff);
			return;
		}
		const note = `Workflow mode: ${mode}. ${MODE_DESCRIPTIONS[mode]}.`;
		if (ctx.hasUI) ctx.ui.notify(note, "info");
		else pi.sendMessage({ customType: `${MODE_ENTRY_TYPE}-notice`, content: note, display: true }, { triggerTurn: false });
	};

	return { getState: () => current, syncFromBranch, switchInPlace };
}
