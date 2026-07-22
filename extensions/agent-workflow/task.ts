import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { CONFIG_DIR_NAME, type ExtensionAPI, type ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Type, type Static } from "@sinclair/typebox";

const SESSION_NAME = /^SI-(\d+)-([a-z0-9]+(?:-[a-z0-9]+)*)$/i;
const TICKET_ID = /\bSI-(\d+)\b/i;
const MAX_SLUG_WORDS = 4;
const STOP_WORDS = new Set([
	"a", "an", "and", "are", "as", "be", "can", "could", "for", "i", "is", "it", "need",
	"of", "or", "please", "should", "that", "the", "this", "to", "want", "we", "with", "would",
]);

const ManageTaskParams = Type.Object({
	operation: Type.Union([
		Type.Literal("set_name"),
		Type.Literal("save_plan"),
		Type.Literal("checkpoint"),
		Type.Literal("resume"),
	]),
	name: Type.Optional(Type.String({ description: "A concise 2–4 meaningful-word task summary, optionally prefixed with SI-<ticket>." })),
	plan: Type.Optional(Type.String({ description: "The complete user-approved Markdown plan. Required for save_plan." })),
	status: Type.Optional(Type.Union([Type.Literal("active"), Type.Literal("blocked"), Type.Literal("complete")])),
	lastCompletedStep: Type.Optional(Type.String({ description: "The last completed approved-plan step, if any." })),
	nextAction: Type.Optional(Type.String({ description: "The single next action. Required for active checkpoints." })),
	remainingChecks: Type.Optional(Type.Array(Type.String(), { description: "Mechanical or manual checks still outstanding." })),
	openDecision: Type.Optional(Type.String({ description: "The one unresolved decision blocking or shaping continuation, if any." })),
});

type ManageTaskInput = Static<typeof ManageTaskParams>;

interface TaskDetails {
	operation: ManageTaskInput["operation"];
	name: string;
	frozen: boolean;
	path?: string;
	handoffPath?: string;
	status?: ManageTaskInput["status"];
	error?: string;
}

export function normalizeTaskName(summary: string, currentName?: string): string {
	const suppliedTicket = summary.match(TICKET_ID)?.[1];
	const currentTicket = currentName?.match(SESSION_NAME)?.[1];
	const words = summary
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.replace(/\bsi-\d+\b/g, " ")
		.replace(/[^a-z0-9]+/g, " ")
		.trim()
		.split(/\s+/)
		.filter((word) => word && !STOP_WORDS.has(word))
		.slice(0, MAX_SLUG_WORDS);
	if (words.length === 0) words.push("task", "summary");
	if (words.length === 1) words.push("task");
	return `SI-${suppliedTicket ?? currentTicket ?? "0000"}-${words.join("-")}`;
}

function canonicalTaskName(name: string | undefined): string | undefined {
	const match = name?.trim().match(SESSION_NAME);
	return match ? `SI-${match[1]}-${match[2].toLowerCase()}` : undefined;
}

function taskPlanPath(cwd: string, name: string): string {
	return join(cwd, CONFIG_DIR_NAME, "plans", `${name}.md`);
}

function taskHandoffPath(cwd: string, name: string): string {
	return join(cwd, CONFIG_DIR_NAME, "handoffs", `${name}.md`);
}

function cleanLine(value: string | undefined): string | undefined {
	const cleaned = value?.replace(/\s+/g, " ").trim();
	return cleaned || undefined;
}

function renderHandoff(name: string, params: ManageTaskInput): string {
	const status = params.status!;
	const lastCompleted = cleanLine(params.lastCompletedStep) ?? "None recorded";
	const nextAction = cleanLine(params.nextAction) ?? "None";
	const openDecision = cleanLine(params.openDecision) ?? "None";
	const remainingChecks = (params.remainingChecks ?? []).map(cleanLine).filter((check): check is string => !!check);
	return [
		`# Task handoff: ${name}`,
		"",
		`Status: ${status}`,
		`Last completed plan step: ${lastCompleted}`,
		`Next action: ${nextAction}`,
		"Remaining checks:",
		...(remainingChecks.length > 0 ? remainingChecks.map((check) => `- ${check}`) : ["- None"]),
		`Open decision: ${openDecision}`,
		"",
	].join("\n");
}

function handoffStatus(contents: string): ManageTaskInput["status"] | undefined {
	const status = contents.match(/^Status: (active|blocked|complete)$/m)?.[1];
	return status as ManageTaskInput["status"] | undefined;
}

async function writeAtomically(path: string, contents: string): Promise<void> {
	const temporaryPath = `${path}.${randomUUID()}.tmp`;
	try {
		await writeFile(temporaryPath, contents, { encoding: "utf8", flag: "wx" });
		await rename(temporaryPath, path);
	} catch (error) {
		await rm(temporaryPath, { force: true });
		throw error;
	}
}

function restoredFrozenName(ctx: ExtensionContext): string | undefined {
	let frozen: string | undefined;
	for (const entry of ctx.sessionManager.getBranch()) {
		if (entry.type !== "message" || entry.message.role !== "toolResult" || entry.message.toolName !== "manage_task") continue;
		const details = entry.message.details as TaskDetails | undefined;
		if (details?.frozen) frozen = canonicalTaskName(details.name);
	}
	return frozen;
}

export function registerTaskManagement(pi: ExtensionAPI): void {
	let frozenName: string | undefined;

	pi.on("session_start", async (_event, ctx) => {
		const current = canonicalTaskName(pi.getSessionName());
		frozenName = restoredFrozenName(ctx);
		if (!frozenName && current && existsSync(taskPlanPath(ctx.cwd, current))) frozenName = current;
		if (frozenName && frozenName !== pi.getSessionName()) pi.setSessionName(frozenName);
	});

	pi.on("session_info_changed", async (event) => {
		if (frozenName && event.name !== frozenName) pi.setSessionName(frozenName);
	});

	pi.registerTool({
		name: "manage_task",
		label: "Task Identity",
		description: "Set task identity, save an approved immutable plan, or persist/resume one compact cross-session handoff. Checkpoints are for pauses, blocks, and completion—not todo tracking.",
		parameters: ManageTaskParams,
		async execute(_toolCallId, params: ManageTaskInput, _signal, _onUpdate, ctx) {
			if (params.operation === "set_name") {
				if (!params.name?.trim()) {
					return taskError(params.operation, frozenName ?? pi.getSessionName() ?? "", "name is required");
				}
				const name = normalizeTaskName(params.name, pi.getSessionName());
				if (frozenName && name !== frozenName) return taskError(params.operation, frozenName, "task name is frozen by its saved plan");
				pi.setSessionName(name);
				return taskResult(params.operation, name, !!frozenName, undefined, `Task name set to ${name}.`);
			}

			const name = canonicalTaskName(pi.getSessionName());
			if (!name) return taskError(params.operation, "", "set a task name before using this operation");
			if (frozenName && frozenName !== name) return taskError(params.operation, frozenName, "task name is frozen by its saved plan");

			const path = taskPlanPath(ctx.cwd, name);
			if (params.operation === "save_plan") {
				if (!params.plan?.trim()) return taskError(params.operation, name, "plan is required");
				try {
					await mkdir(join(ctx.cwd, CONFIG_DIR_NAME, "plans"), { recursive: true });
					await writeFile(path, `${params.plan.trim()}\n`, { encoding: "utf8", flag: "wx" });
				} catch (error) {
					if ((error as NodeJS.ErrnoException).code === "EEXIST") {
						frozenName = name;
						return taskError(params.operation, name, `plan already exists at ${path}`, path, true);
					}
					return taskError(params.operation, name, `could not save plan: ${(error as Error).message}`);
				}
				frozenName = name;
				return taskResult(params.operation, name, true, path, `Plan saved to ${path}; task name is now frozen.`);
			}

			if (!existsSync(path)) return taskError(params.operation, name, "save an approved plan before checkpointing or resuming");
			let plan: string;
			try {
				plan = await readFile(path, "utf8");
			} catch (error) {
				return taskError(params.operation, name, `could not read approved plan: ${(error as Error).message}`, path);
			}
			if (!plan.trim()) return taskError(params.operation, name, "approved plan is empty", path);
			frozenName = name;
			const handoffPath = taskHandoffPath(ctx.cwd, name);

			if (params.operation === "checkpoint") {
				if (!params.status) return taskError(params.operation, name, "checkpoint status is required", path, true);
				if (params.status === "active" && !cleanLine(params.nextAction)) {
					return taskError(params.operation, name, "active checkpoints require a next action", path, true);
				}
				const hasOutstandingWork =
					!!cleanLine(params.nextAction) ||
					!!cleanLine(params.openDecision) ||
					(params.remainingChecks ?? []).some((check) => !!cleanLine(check));
				if (params.status === "complete" && hasOutstandingWork) {
					return taskError(
						params.operation,
						name,
						"complete checkpoints cannot contain a next action, remaining checks, or an open decision",
						path,
						true,
					);
				}
				try {
					await mkdir(join(ctx.cwd, CONFIG_DIR_NAME, "handoffs"), { recursive: true });
					await writeAtomically(handoffPath, renderHandoff(name, params));
				} catch (error) {
					return taskError(params.operation, name, `could not save checkpoint: ${(error as Error).message}`, path, true);
				}
				return taskResult(
					params.operation,
					name,
					true,
					path,
					`Checkpoint saved to ${handoffPath}.`,
					handoffPath,
					params.status,
				);
			}

			if (!existsSync(handoffPath)) {
				return taskResult(
					params.operation,
					name,
					true,
					path,
					`Approved plan:\n\n${plan.trim()}\n\nNo handoff checkpoint exists. Reconstruct current progress from git status --short, the relevant diff, and validation results before continuing.`,
				);
			}
			let handoff: string;
			try {
				handoff = await readFile(handoffPath, "utf8");
			} catch (error) {
				return taskError(params.operation, name, `could not read handoff: ${(error as Error).message}`, path, true);
			}
			const status = handoffStatus(handoff);
			if (!status) {
				return taskError(params.operation, name, "handoff status is invalid; expected active, blocked, or complete", path, true);
			}
			if (status === "complete") {
				return taskResult(
					params.operation,
					name,
					true,
					path,
					`Approved plan:\n\n${plan.trim()}\n\nThe saved handoff is complete and is not active resume state. Revalidate the user's current intent and repository state before starting more work.`,
					handoffPath,
					status,
				);
			}
			return taskResult(
				params.operation,
				name,
				true,
				path,
				`Approved plan:\n\n${plan.trim()}\n\nCurrent handoff hint:\n\n${handoff.trim()}\n\nBefore continuing, compare this hint with the user's current request, git status --short, the relevant diff, and validation results. Current evidence wins over stale handoff text.`,
				handoffPath,
				status,
			);
		},
	});
}

function taskResult(
	operation: ManageTaskInput["operation"],
	name: string,
	frozen: boolean,
	path: string | undefined,
	text: string,
	handoffPath?: string,
	status?: ManageTaskInput["status"],
) {
	return {
		content: [{ type: "text" as const, text }],
		details: { operation, name, frozen, path, handoffPath, status } satisfies TaskDetails,
	};
}

function taskError(
	operation: ManageTaskInput["operation"],
	name: string,
	error: string,
	path?: string,
	frozen = false,
) {
	return {
		content: [{ type: "text" as const, text: `Error: ${error}.` }],
		details: { operation, name, frozen, path, error } satisfies TaskDetails,
		isError: true,
	};
}
