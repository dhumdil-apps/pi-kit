import { access, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { normalizeTaskName, registerTaskManagement } from "./task.js";

interface HarnessOptions {
	name?: string;
	branch?: unknown[];
}

function makeHarness(cwd: string, options: HarnessOptions = {}) {
	const handlers = new Map<string, (event: any, ctx: any) => Promise<void>>();
	let sessionName = options.name;
	let tool: any;
	const pi = {
		on: (event: string, handler: (event: any, ctx: any) => Promise<void>) => handlers.set(event, handler),
		registerTool: (registered: any) => { tool = registered; },
		getSessionName: () => sessionName,
		setSessionName: vi.fn((name: string) => { sessionName = name; }),
	};
	registerTaskManagement(pi as never);
	const ctx = {
		cwd,
		sessionManager: { getBranch: () => options.branch ?? [] },
	};
	const execute = (params: any) => tool.execute("call", params, undefined, undefined, ctx);
	return { execute, handlers, pi, ctx, getName: () => sessionName };
}

describe("normalizeTaskName", () => {
	it("uses a concise two-to-four word summary and a fallback ticket", () => {
		expect(normalizeTaskName("please reimagine this dashboard resource section to make it better")).toBe(
			"SI-0000-reimagine-dashboard-resource-section",
		);
	});

	it("preserves a supplied or current ticket", () => {
		expect(normalizeTaskName("SI-42 cache recovery")).toBe("SI-42-cache-recovery");
		expect(normalizeTaskName("SI-42-cache-recovery")).toBe("SI-42-cache-recovery");
		expect(normalizeTaskName("dashboard polish", "SI-91-existing-task")).toBe("SI-91-dashboard-polish");
	});

	it("pads a one-word summary so names remain descriptive", () => {
		expect(normalizeTaskName("dashboard")).toBe("SI-0000-dashboard-task");
	});
});

describe("task management lifecycle", () => {
	let cwd: string;

	beforeEach(async () => {
		cwd = await mkdtemp(join(tmpdir(), "pi-task-management-"));
	});

	afterEach(async () => {
		await rm(cwd, { recursive: true, force: true });
	});

	it("allows refinement before saving a plan", async () => {
		const harness = makeHarness(cwd);
		await harness.execute({ operation: "set_name", name: "dashboard resources" });
		await harness.execute({ operation: "set_name", name: "dashboard workflow polish" });
		expect(harness.getName()).toBe("SI-0000-dashboard-workflow-polish");
	});

	it("saves without overwrite and freezes the task name", async () => {
		const harness = makeHarness(cwd);
		await harness.execute({ operation: "set_name", name: "SI-7 dashboard polish" });
		const saved = await harness.execute({ operation: "save_plan", plan: "# Approved plan" });
		const path = join(cwd, ".pi", "plans", "SI-7-dashboard-polish.md");
		expect(saved.isError).toBeUndefined();
		expect(await readFile(path, "utf8")).toBe("# Approved plan\n");

		const rename = await harness.execute({ operation: "set_name", name: "different scope" });
		expect(rename.isError).toBe(true);
		expect(harness.getName()).toBe("SI-7-dashboard-polish");

		const overwrite = await harness.execute({ operation: "save_plan", plan: "replacement" });
		expect(overwrite.isError).toBe(true);
		expect(await readFile(path, "utf8")).toBe("# Approved plan\n");
	});

	it("restores a frozen name from session tool results", async () => {
		const branch = [{
			type: "message",
			message: {
				role: "toolResult",
				toolName: "manage_task",
				details: { operation: "save_plan", name: "SI-8-frozen-task", frozen: true },
			},
		}];
		const harness = makeHarness(cwd, { name: "SI-8-frozen-task", branch });
		await harness.handlers.get("session_start")!(undefined, harness.ctx);
		const rename = await harness.execute({ operation: "set_name", name: "new task name" });
		expect(rename.isError).toBe(true);
	});

	it("rejects checkpoints until an approved plan exists", async () => {
		const harness = makeHarness(cwd);
		await harness.execute({ operation: "set_name", name: "resume continuity" });
		const checkpoint = await harness.execute({
			operation: "checkpoint",
			status: "active",
			nextAction: "Run the focused tests",
		});
		expect(checkpoint.isError).toBe(true);
		expect(checkpoint.content[0].text).toContain("save an approved plan");
	});

	it("requires a next action for active checkpoints", async () => {
		const harness = makeHarness(cwd);
		await harness.execute({ operation: "set_name", name: "resume continuity" });
		await harness.execute({ operation: "save_plan", plan: "# Approved plan" });
		const checkpoint = await harness.execute({ operation: "checkpoint", status: "active" });
		expect(checkpoint.isError).toBe(true);
		expect(checkpoint.content[0].text).toContain("require a next action");
	});

	it("rejects checkpoints when the approved plan path is not a readable file", async () => {
		const harness = makeHarness(cwd);
		await harness.execute({ operation: "set_name", name: "invalid plan state" });
		await mkdir(join(cwd, ".pi", "plans", "SI-0000-invalid-plan-state.md"), { recursive: true });
		const checkpoint = await harness.execute({
			operation: "checkpoint",
			status: "active",
			nextAction: "Should not be saved",
		});
		expect(checkpoint.isError).toBe(true);
		expect(checkpoint.content[0].text).toContain("could not read approved plan");
		expect(harness.getName()).toBe("SI-0000-invalid-plan-state");
	});

	it("rejects complete checkpoints with outstanding work", async () => {
		const harness = makeHarness(cwd);
		await harness.execute({ operation: "set_name", name: "incomplete validation" });
		await harness.execute({ operation: "save_plan", plan: "# Approved plan" });
		for (const outstanding of [
			{ nextAction: "Finish the smoke" },
			{ remainingChecks: ["npm test"] },
			{ openDecision: "Confirm the UI" },
		]) {
			const checkpoint = await harness.execute({ operation: "checkpoint", status: "complete", ...outstanding });
			expect(checkpoint.isError).toBe(true);
			expect(checkpoint.content[0].text).toContain("complete checkpoints cannot contain");
		}
	});

	it("writes a compact checkpoint without changing the immutable plan", async () => {
		const harness = makeHarness(cwd);
		await harness.execute({ operation: "set_name", name: "resume continuity" });
		await harness.execute({ operation: "save_plan", plan: "# Approved plan\n\n1. Change → `npm test`" });
		const checkpoint = await harness.execute({
			operation: "checkpoint",
			status: "blocked",
			lastCompletedStep: "1. Add checkpoint storage",
			nextAction: "Wait for the API decision",
			remainingChecks: ["npm test", "Headless smoke"],
			openDecision: "Choose the public field name",
		});
		const planPath = join(cwd, ".pi", "plans", "SI-0000-resume-continuity.md");
		const handoffPath = join(cwd, ".pi", "handoffs", "SI-0000-resume-continuity.md");
		expect(checkpoint.isError).toBeUndefined();
		expect(checkpoint.details).toMatchObject({ status: "blocked", handoffPath });
		expect(await readFile(planPath, "utf8")).toBe("# Approved plan\n\n1. Change → `npm test`\n");
		const handoff = await readFile(handoffPath, "utf8");
		for (const expected of [
			"Status: blocked",
			"Last completed plan step: 1. Add checkpoint storage",
			"Next action: Wait for the API decision",
			"- npm test",
			"Open decision: Choose the public field name",
		]) expect(handoff).toContain(expected);
	});

	it("resumes an active checkpoint in a fresh matching session", async () => {
		const first = makeHarness(cwd);
		await first.execute({ operation: "set_name", name: "SI-12 resume continuity" });
		await first.execute({ operation: "save_plan", plan: "# Approved plan" });
		await first.execute({
			operation: "checkpoint",
			status: "active",
			lastCompletedStep: "Storage",
			nextAction: "Add resume tests",
			remainingChecks: ["npm test"],
		});

		const resumed = makeHarness(cwd, { name: "SI-12-resume-continuity" });
		await resumed.handlers.get("session_start")!(undefined, resumed.ctx);
		const result = await resumed.execute({ operation: "resume" });
		expect(result.isError).toBeUndefined();
		expect(result.details).toMatchObject({ name: "SI-12-resume-continuity", frozen: true, status: "active" });
		expect(result.content[0].text).toContain("Current handoff hint");
		expect(result.content[0].text).toContain("Next action: Add resume tests");
		expect(result.content[0].text).toContain("Current evidence wins over stale handoff text");
	});

	it("does not expose completed handoffs as active resume state", async () => {
		const harness = makeHarness(cwd);
		await harness.execute({ operation: "set_name", name: "completed continuity" });
		await harness.execute({ operation: "save_plan", plan: "# Approved plan" });
		await harness.execute({
			operation: "checkpoint",
			status: "complete",
			lastCompletedStep: "Final validation",
			remainingChecks: [],
		});
		const result = await harness.execute({ operation: "resume" });
		expect(result.details.status).toBe("complete");
		expect(result.content[0].text).toContain("not active resume state");
		expect(result.content[0].text).not.toContain("Last completed plan step");
		await expect(access(join(cwd, ".pi", "handoffs", "SI-0000-completed-continuity.md"))).resolves.toBeUndefined();
	});
});
