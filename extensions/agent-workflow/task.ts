import { mkdir, writeFile } from "node:fs/promises";
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
	operation: Type.Union([Type.Literal("set_name"), Type.Literal("save_plan")]),
	name: Type.Optional(Type.String({ description: "A concise 2–4 meaningful-word task summary, optionally prefixed with SI-<ticket>." })),
	plan: Type.Optional(Type.String({ description: "The complete user-approved Markdown plan. Required for save_plan." })),
});

type ManageTaskInput = Static<typeof ManageTaskParams>;

interface TaskDetails {
	operation: ManageTaskInput["operation"];
	name: string;
	frozen: boolean;
	path?: string;
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
		description: "Set a concise branch-ready task name after exploration, or save the approved plan and freeze that name. Use set_name during PLANNING and save_plan only after explicit plan approval.",
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
			if (!name) return taskError(params.operation, "", "set a task name before saving its plan");
			if (!params.plan?.trim()) return taskError(params.operation, name, "plan is required");
			if (frozenName && frozenName !== name) return taskError(params.operation, frozenName, "task name is frozen by its saved plan");

			const path = taskPlanPath(ctx.cwd, name);
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
		},
	});
}

function taskResult(operation: ManageTaskInput["operation"], name: string, frozen: boolean, path: string | undefined, text: string) {
	return {
		content: [{ type: "text" as const, text }],
		details: { operation, name, frozen, path } satisfies TaskDetails,
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
