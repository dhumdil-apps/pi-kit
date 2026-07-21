import { mkdtemp, readFile, rm } from "node:fs/promises";
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
});
