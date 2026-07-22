import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { CONFIG_DIR_NAME, type ExtensionAPI, type ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Type, type Static } from "@sinclair/typebox";

const SESSION_NAME = /^(?:([a-z0-9]+-\d+)-)?([a-z0-9]+(?:-[a-z0-9]+)*)$/i;
const TICKET_ID = /\b([a-z0-9]+-\d+)\b/i;
const UNCHECKED_ITEM = /^\s*[-*]\s+\[ \]/m;
const MAX_SLUG_WORDS = 4;
const PLAN_STATUSES = ["todo", "active", "done"] as const;
type PlanStatus = (typeof PLAN_STATUSES)[number];

const STOP_WORDS = new Set([
	"a", "an", "and", "are", "as", "be", "can", "could", "for", "i", "is", "it", "need",
	"of", "or", "please", "should", "that", "the", "this", "to", "want", "we", "with", "would",
]);

const ManageTaskParams = Type.Object({
	operation: Type.Union([
		Type.Literal("set_name"),
		Type.Literal("save_plan"),
		Type.Literal("update_plan"),
		Type.Literal("resume"),
	]),
	name: Type.Optional(Type.String({ description: "A concise 2–4 meaningful-word task summary, optionally prefixed with a ticket ID (e.g. TEST-1234)." })),
	plan: Type.Optional(Type.String({ description: "The complete lifecycle-plan Markdown. Required for save_plan and update_plan." })),
	status: Type.Optional(Type.Union([
		Type.Literal("todo"),
		Type.Literal("active"),
		Type.Literal("done"),
	], { description: "Target lifecycle status. Required for update_plan." })),
});

type ManageTaskInput = Static<typeof ManageTaskParams>;

interface TaskDetails {
	operation: ManageTaskInput["operation"];
	name: string;
	frozen: boolean;
	path?: string;
	status?: PlanStatus;
	error?: string;
}

interface PlanState {
	status: PlanStatus;
	path: string;
}

export function normalizeTaskName(summary: string, currentName?: string): string {
	const suppliedTicket = summary.match(TICKET_ID)?.[1]?.toUpperCase();
	const currentTicket = currentName?.match(TICKET_ID)?.[1]?.toUpperCase();
	const ticket = suppliedTicket ?? currentTicket;
	const words = summary
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.replace(/\b[a-z0-9]+-\d+\b/g, " ")
		.replace(/[^a-z0-9]+/g, " ")
		.trim()
		.split(/\s+/)
		.filter((word) => word && !STOP_WORDS.has(word))
		.slice(0, MAX_SLUG_WORDS);
	if (words.length === 0) words.push("task", "summary");
	if (words.length === 1) words.push("task");
	const slug = words.join("-");
	return ticket ? `${ticket}-${slug}` : slug;
}

function canonicalTaskName(name: string | undefined): string | undefined {
	const match = name?.trim().match(SESSION_NAME);
	if (!match) return undefined;
	const ticket = match[1]?.toUpperCase();
	const slug = match[2].toLowerCase();
	return ticket ? `${ticket}-${slug}` : slug;
}

function taskPlanPath(cwd: string, name: string, status: PlanStatus): string {
	return join(cwd, CONFIG_DIR_NAME, "plans", `${name}.${status}.md`);
}

function findPlanStates(cwd: string, name: string): PlanState[] {
	return PLAN_STATUSES
		.map((status) => ({ status, path: taskPlanPath(cwd, name, status) }))
		.filter(({ path }) => existsSync(path));
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

function validatePlanForStatus(plan: string, status: PlanStatus): string | undefined {
	if (!plan.trim()) return "plan is required";
	if (status === "done" && UNCHECKED_ITEM.test(plan)) return "done plans cannot contain unchecked checklist items";
	if (status === "todo" && !UNCHECKED_ITEM.test(plan)) return "todo plans require at least one unchecked checklist item";
	return undefined;
}

function transitionAllowed(from: PlanStatus, to: PlanStatus): boolean {
	return (from === "todo" && to === "active") ||
		(from === "active" && (to === "active" || to === "todo" || to === "done"));
}

export function registerTaskManagement(pi: ExtensionAPI): void {
	let frozenName: string | undefined;

	pi.on("session_start", async (_event, ctx) => {
		const current = canonicalTaskName(pi.getSessionName());
		frozenName = restoredFrozenName(ctx);
		if (!frozenName && current && findPlanStates(ctx.cwd, current).length > 0) frozenName = current;
		if (frozenName && frozenName !== pi.getSessionName()) pi.setSessionName(frozenName);
	});

	pi.on("session_info_changed", async (event) => {
		if (frozenName && event.name !== frozenName) pi.setSessionName(frozenName);
	});

	pi.registerTool({
		name: "manage_task",
		label: "Task Lifecycle",
		description: "Set task identity; create, transition, update, or resume one status-suffixed lifecycle plan. The plan checklist is the cross-session source of truth.",
		parameters: ManageTaskParams,
		async execute(_toolCallId, params: ManageTaskInput, _signal, _onUpdate, ctx) {
			if (params.operation === "set_name") {
				if (!params.name?.trim()) return taskError(params.operation, frozenName ?? pi.getSessionName() ?? "", "name is required");
				const name = normalizeTaskName(params.name, pi.getSessionName());
				if (frozenName && name !== frozenName) return taskError(params.operation, frozenName, "task name is frozen by its lifecycle plan");
				pi.setSessionName(name);
				return taskResult(params.operation, name, !!frozenName, undefined, undefined, `Task name set to ${name}.`);
			}

			const name = canonicalTaskName(pi.getSessionName());
			if (!name) return taskError(params.operation, "", "set a task name before using this operation");
			if (frozenName && frozenName !== name) return taskError(params.operation, frozenName, "task name is frozen by its lifecycle plan");

			const states = findPlanStates(ctx.cwd, name);
			if (states.length > 1) {
				return taskError(params.operation, name, `ambiguous lifecycle state; found ${states.map(({ status }) => status).join(", ")}`);
			}

			if (params.operation === "save_plan") {
				if (states.length > 0) return taskError(params.operation, name, `lifecycle plan already exists at ${states[0].path}`, states[0].path, true);
				const plan = params.plan ?? "";
				const validationError = validatePlanForStatus(plan, "todo");
				if (validationError) return taskError(params.operation, name, validationError);
				const path = taskPlanPath(ctx.cwd, name, "todo");
				try {
					await mkdir(join(ctx.cwd, CONFIG_DIR_NAME, "plans"), { recursive: true });
					await writeFile(path, `${plan.trim()}\n`, { encoding: "utf8", flag: "wx" });
				} catch (error) {
					return taskError(params.operation, name, `could not save plan: ${(error as Error).message}`);
				}
				frozenName = name;
				return taskResult(params.operation, name, true, path, "todo", `Lifecycle plan saved to ${path}; task name is now frozen.`);
			}

			if (states.length === 0) return taskError(params.operation, name, "save an approved lifecycle plan before updating or resuming");
			const current = states[0];
			frozenName = name;

			if (params.operation === "update_plan") {
				if (!params.status) return taskError(params.operation, name, "target status is required", current.path, true);
				if (!transitionAllowed(current.status, params.status)) {
					return taskError(params.operation, name, `invalid lifecycle transition ${current.status} → ${params.status}`, current.path, true);
				}
				const plan = params.plan ?? "";
				const validationError = validatePlanForStatus(plan, params.status);
				if (validationError) return taskError(params.operation, name, validationError, current.path, true);
				const targetPath = taskPlanPath(ctx.cwd, name, params.status);
				try {
					await writeAtomically(current.path, `${plan.trim()}\n`);
					if (targetPath !== current.path) await rename(current.path, targetPath);
				} catch (error) {
					return taskError(params.operation, name, `could not update plan: ${(error as Error).message}`, current.path, true);
				}
				return taskResult(params.operation, name, true, targetPath, params.status, `Lifecycle plan updated at ${targetPath}.`);
			}

			let plan: string;
			try {
				plan = await readFile(current.path, "utf8");
			} catch (error) {
				return taskError(params.operation, name, `could not read lifecycle plan: ${(error as Error).message}`, current.path, true);
			}
			if (!plan.trim()) return taskError(params.operation, name, "lifecycle plan is empty", current.path, true);
			const nextStep = current.status === "done"
				? "This lifecycle is terminal; do not add more work to it. Start a fresh goal and plan for any new outcome."
				: "Select one committable slice, plan it, and obtain fresh approval before implementation.";
			return taskResult(
				params.operation,
				name,
				true,
				current.path,
				current.status,
				`Lifecycle plan (${current.status}):\n\n${plan.trim()}\n\nRevalidate it against the current request, git status --short, the relevant diff, and validation results. ${nextStep} Current evidence wins over stale plan text.`,
			);
		},
	});
}

function taskResult(
	operation: ManageTaskInput["operation"],
	name: string,
	frozen: boolean,
	path: string | undefined,
	status: PlanStatus | undefined,
	text: string,
) {
	return {
		content: [{ type: "text" as const, text }],
		details: { operation, name, frozen, path, status } satisfies TaskDetails,
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
