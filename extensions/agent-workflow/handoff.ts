/**
 * openHandoffSession — the /handoff command's implementation.
 *
 * The approval prompt's Proceed choice reuses the running session
 * (mode.switchInPlace); a handoff is the session boundary: it spawns a new
 * session, seeds the implement-mode marker and the task name before the first
 * turn, and sends a kickoff message carrying the concrete plan path, so
 * implementation starts with a lean context and nothing to retype. Only a
 * command handler can spawn a session, so /handoff owns this entry point.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";
import { CONFIG_DIR_NAME, type ExtensionAPI, type ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { MODE_ENTRY_TYPE } from "./mode.js";
import { canonicalTaskName, listPlanNames, planPath } from "./task.js";

const HANDOFF_NOTICE_TYPE = "agent-workflow:handoff-notice";
const USAGE = "Usage: /handoff [task-name].";

interface HandoffTask {
	name: string;
	planPath: string;
}

interface Resolution {
	task?: HandoffTask;
	error?: string;
}

function relativePlanPath(name: string): string {
	return `${CONFIG_DIR_NAME}/plan/${name}.md`;
}

function taskFor(cwd: string, name: string): Resolution {
	if (!existsSync(planPath(cwd, name))) {
		return { error: `No plan for ${name} under ${CONFIG_DIR_NAME}/plan/.` };
	}
	return { task: { name, planPath: relativePlanPath(name) } };
}

/**
 * .pi/plan/ accumulates (plan files are never deleted by the agent), so
 * resolution never assumes a single file: the explicit name wins, then the
 * session name, and only a lone remaining file is picked implicitly.
 */
export function resolveHandoffTask(cwd: string, requested: string | undefined, sessionName: string | undefined): Resolution {
	if (requested) {
		const name = canonicalTaskName(requested);
		if (!name) return { error: `"${requested}" is not a task name. ${USAGE}` };
		return taskFor(cwd, name);
	}

	// The session name is the task name once save_plan named it.
	const current = canonicalTaskName(sessionName);
	if (current && existsSync(planPath(cwd, current))) return taskFor(cwd, current);

	const names = listPlanNames(cwd);
	if (names.length === 1) return taskFor(cwd, names[0]);
	if (names.length > 1) return { error: `Several plans under ${CONFIG_DIR_NAME}/plan/: ${names.join(", ")} — run /handoff <task-name>.` };
	return { error: `No plan under ${CONFIG_DIR_NAME}/plan/ — plan first.` };
}

/** Executing from a handoff is auto-approved: the user approved the plan in the session that handed off. */
export function handoffKickoff(task: HandoffTask): string {
	return `Execute the approved plan at ${task.planPath}. The user approved it in the session that handed off to this one, so do not ask for approval again. If the repository state diverges from the plan, stop and report instead of guessing.`;
}

/**
 * Spawn a fresh implement session seeded with the resolved task's plan. On a
 * resolution error it notifies and spawns nothing. Callable only with a command
 * context, since session spawning is gated to command handlers.
 */
export async function openHandoffSession(
	pi: ExtensionAPI,
	ctx: ExtensionCommandContext,
	taskName?: string,
): Promise<void> {
	const notify = (message: string, type: "info" | "warning") => {
		if (ctx.hasUI) ctx.ui.notify(message, type);
		else pi.sendMessage({ customType: HANDOFF_NOTICE_TYPE, content: message, display: true }, { triggerTurn: false });
	};

	const { task, error } = resolveHandoffTask(ctx.cwd, taskName, ctx.sessionManager.getSessionName());
	if (error || !task) {
		notify(error ?? USAGE, "warning");
		return;
	}

	const kickoff = handoffKickoff(task);
	await ctx.waitForIdle();
	await ctx.newSession({
		parentSession: ctx.sessionManager.getSessionFile(),
		// session_start fires before this, so the marker is what the new
		// session's extension instance derives its mode from.
		setup: async (sessionManager) => {
			sessionManager.appendCustomMessageEntry(MODE_ENTRY_TYPE, "Workflow mode: implement.", false, { mode: "implement" });
			sessionManager.appendSessionInfo(task.name);
		},
		withSession: async (next) => {
			// sendUserMessage resolves only when the triggered turn ends: an
			// interactive session must not block on it, while a headless run
			// would otherwise exit mid-turn.
			const turn = next.sendUserMessage(kickoff);
			if (next.hasUI) void turn.catch(() => {});
			else await turn;
		},
	});
}

export { USAGE as HANDOFF_USAGE };
