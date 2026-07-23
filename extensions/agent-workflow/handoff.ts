/**
 * /handoff — open a fresh session in a chosen workflow mode.
 *
 * The bare /plan, /implement, and /review commands switch mode inside the
 * running session, which is right for small tasks. /handoff is the session
 * boundary: it spawns a new session, seeds the mode marker and the task name
 * before the first turn, and sends a kickoff message carrying the concrete
 * lifecycle-plan and discovery paths, so the next mode starts with a lean
 * context and nothing to retype.
 */

import { readdirSync } from "node:fs";
import { join } from "node:path";
import { CONFIG_DIR_NAME, type ExtensionAPI, type ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { isWorkflowMode, MODE_ENTRY_TYPE, WORKFLOW_MODES, type WorkflowMode } from "./mode.js";
import { canonicalTaskName, findPlanStates, type PlanStatus } from "./task.js";

const HANDOFF_NOTICE_TYPE = "agent-workflow:handoff-notice";
const PLAN_FILE = /^(.+)\.(todo|active|done)\.md$/;
const PENDING_STATUSES: readonly PlanStatus[] = ["todo", "active"];
const USAGE = `Usage: /handoff <${WORKFLOW_MODES.join("|")}> [task-name] — opens a fresh session in that mode.`;

interface HandoffTask {
	name: string;
	status: PlanStatus;
	planPath: string;
	discoveryPath: string;
}

interface Resolution {
	task?: HandoffTask;
	error?: string;
}

function relativePlanPath(name: string, status: PlanStatus): string {
	return `${CONFIG_DIR_NAME}/goal/${name}.${status}.md`;
}

/** Unique canonical task names that own a plan in one of the given statuses. */
function listTaskNames(cwd: string, statuses: readonly PlanStatus[]): string[] {
	let files: string[];
	try {
		files = readdirSync(join(cwd, CONFIG_DIR_NAME, "goal"));
	} catch {
		return [];
	}
	const names = new Set<string>();
	for (const file of files) {
		const match = file.match(PLAN_FILE);
		if (!match || !statuses.includes(match[2] as PlanStatus)) continue;
		const name = canonicalTaskName(match[1]);
		if (name) names.add(name);
	}
	return [...names].sort();
}

/** Load the single lifecycle plan for a task name, mirroring manage_task's ambiguity rule. */
function taskFor(cwd: string, name: string): Resolution {
	const states = findPlanStates(cwd, name);
	if (states.length === 0) return { error: `No lifecycle plan for ${name} under ${CONFIG_DIR_NAME}/goal/.` };
	if (states.length > 1) {
		return { error: `Ambiguous lifecycle state for ${name}; found ${states.map(({ status }) => status).join(", ")}.` };
	}
	return {
		task: {
			name,
			status: states[0].status,
			planPath: relativePlanPath(name, states[0].status),
			discoveryPath: `${CONFIG_DIR_NAME}/goal/${name}.discovery.md`,
		},
	};
}

export function resolveHandoffTask(cwd: string, mode: WorkflowMode, requested: string | undefined, sessionName: string | undefined): Resolution {
	if (requested) {
		const name = canonicalTaskName(requested);
		if (!name) return { error: `"${requested}" is not a task name. ${USAGE}` };
		return taskFor(cwd, name);
	}

	// The session name is the task name once a lifecycle plan froze it.
	const current = canonicalTaskName(sessionName);
	if (current && findPlanStates(cwd, current).length > 0) return taskFor(cwd, current);

	let names = listTaskNames(cwd, PENDING_STATUSES);
	// Reviewing a finished task is legitimate; implementing one is not.
	if (names.length === 0 && mode === "review") names = listTaskNames(cwd, ["done"]);
	if (names.length === 1) return taskFor(cwd, names[0]);
	if (names.length > 1) return { error: `Several plans under ${CONFIG_DIR_NAME}/goal/: ${names.join(", ")} — run /handoff ${mode} <task-name>.` };
	if (mode === "plan") return {};
	return { error: `No lifecycle plan under ${CONFIG_DIR_NAME}/goal/ — run a Plan session first.` };
}

export function handoffKickoff(mode: WorkflowMode, task: HandoffTask | undefined): string | undefined {
	if (!task) return undefined;
	switch (mode) {
		case "implement":
			return `Resume the lifecycle plan at ${task.planPath} and execute the next slice. Read ${task.discoveryPath} first when present.`;
		case "review":
			return `Review the task ${task.name}: plan at ${task.planPath}, discovery handoff at ${task.discoveryPath}.`;
		case "plan":
			return `Re-plan the task ${task.name}: existing plan at ${task.planPath}, discovery handoff at ${task.discoveryPath}.`;
	}
}

export function registerHandoffCommand(pi: ExtensionAPI): void {
	const notify = (ctx: ExtensionCommandContext, message: string, type: "info" | "warning") => {
		if (ctx.hasUI) ctx.ui.notify(message, type);
		else pi.sendMessage({ customType: HANDOFF_NOTICE_TYPE, content: message, display: true }, { triggerTurn: false });
	};

	pi.registerCommand("handoff", {
		description: "Open a fresh session in a workflow mode, seeded with the task's plan and discovery paths",
		getArgumentCompletions: (prefix) =>
			WORKFLOW_MODES.filter((mode) => mode.startsWith(prefix.trim())).map((mode) => ({ value: mode, label: mode })),
		handler: async (args, ctx) => {
			const [modeArg, ...rest] = args.trim().split(/\s+/).filter(Boolean);
			if (!isWorkflowMode(modeArg)) {
				notify(ctx, USAGE, "warning");
				return;
			}

			const { task, error } = resolveHandoffTask(ctx.cwd, modeArg, rest.join(" ") || undefined, ctx.sessionManager.getSessionName());
			if (error) {
				notify(ctx, error, "warning");
				return;
			}

			const kickoff = handoffKickoff(modeArg, task);
			await ctx.waitForIdle();
			await ctx.newSession({
				parentSession: ctx.sessionManager.getSessionFile(),
				// session_start fires before this, so the marker is what the new
				// session's extension instance derives its mode from.
				setup: async (sessionManager) => {
					sessionManager.appendCustomMessageEntry(MODE_ENTRY_TYPE, `Workflow mode: ${modeArg}.`, false, { mode: modeArg, origin: "boundary" });
					if (task) sessionManager.appendSessionInfo(task.name);
				},
				withSession: async (next) => {
					if (!kickoff) {
						const message = `Plan session ready. Describe the goal.`;
						if (next.hasUI) next.ui.notify(message, "info");
						else await next.sendMessage({ customType: HANDOFF_NOTICE_TYPE, content: message, display: true }, { triggerTurn: false });
						return;
					}
					// sendUserMessage resolves only when the triggered turn ends: an
					// interactive session must not block on it, while a headless run
					// would otherwise exit mid-turn.
					const turn = next.sendUserMessage(kickoff);
					if (next.hasUI) void turn.catch(() => {});
					else await turn;
				},
			});
		},
	});
}
