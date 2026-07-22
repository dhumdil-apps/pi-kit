import { access, mkdir, mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { normalizeTaskName, registerTaskManagement } from "./task.js";

interface HarnessOptions { name?: string; branch?: unknown[] }

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
	const ctx = { cwd, sessionManager: { getBranch: () => options.branch ?? [] } };
	const execute = (params: any) => tool.execute("call", params, undefined, undefined, ctx);
	return { execute, handlers, ctx, getName: () => sessionName };
}

const todoPlan = "# Goal\n\n## Checklist\n\n- [ ] Implement slice → verify it\n";
const activePlan = "# Goal\n\n## Checklist\n\n- [ ] Implement slice → verify it\n\n## Current slice\n\nImplement slice\n";
const donePlan = "# Goal\n\n## Checklist\n\n- [x] Implement slice → verified\n";

describe("normalizeTaskName", () => {
	it("uses a concise two-to-four word summary and a fallback ticket", () => {
		expect(normalizeTaskName("please reimagine this dashboard resource section to make it better")).toBe("SI-0000-reimagine-dashboard-resource-section");
	});
	it("preserves a supplied or current ticket", () => {
		expect(normalizeTaskName("SI-42 cache recovery")).toBe("SI-42-cache-recovery");
		expect(normalizeTaskName("dashboard polish", "SI-91-existing-task")).toBe("SI-91-dashboard-polish");
	});
	it("pads a one-word summary", () => expect(normalizeTaskName("dashboard")).toBe("SI-0000-dashboard-task"));
});

describe("task lifecycle plans", () => {
	let cwd: string;
	beforeEach(async () => { cwd = await mkdtemp(join(tmpdir(), "pi-task-management-")); });
	afterEach(async () => { await rm(cwd, { recursive: true, force: true }); });

	it("refines identity before saving, then creates todo without overwrite", async () => {
		const harness = makeHarness(cwd);
		await harness.execute({ operation: "set_name", name: "dashboard resources" });
		await harness.execute({ operation: "set_name", name: "SI-7 dashboard polish" });
		const saved = await harness.execute({ operation: "save_plan", plan: todoPlan });
		const path = join(cwd, ".pi", "plans", "SI-7-dashboard-polish.todo.md");
		expect(saved.details).toMatchObject({ status: "todo", path, frozen: true });
		expect(await readFile(path, "utf8")).toBe(todoPlan);
		expect((await harness.execute({ operation: "set_name", name: "other work" })).isError).toBe(true);
		expect((await harness.execute({ operation: "save_plan", plan: todoPlan })).isError).toBe(true);
	});

	it("restores a frozen identity from lifecycle tool results", async () => {
		const branch = [{ type: "message", message: { role: "toolResult", toolName: "manage_task", details: { operation: "save_plan", name: "SI-8-frozen-task", frozen: true } } }];
		const harness = makeHarness(cwd, { name: "SI-8-frozen-task", branch });
		await harness.handlers.get("session_start")!(undefined, harness.ctx);
		expect((await harness.execute({ operation: "set_name", name: "new task" })).isError).toBe(true);
	});

	it("requires a checklist for todo plans", async () => {
		const harness = makeHarness(cwd);
		await harness.execute({ operation: "set_name", name: "missing checklist" });
		const result = await harness.execute({ operation: "save_plan", plan: "# Goal" });
		expect(result.isError).toBe(true);
		expect(result.content[0].text).toContain("unchecked checklist item");
	});

	it("supports todo to active to todo to active to done", async () => {
		const harness = makeHarness(cwd);
		await harness.execute({ operation: "set_name", name: "slice lifecycle" });
		await harness.execute({ operation: "save_plan", plan: todoPlan });
		const active = await harness.execute({ operation: "update_plan", status: "active", plan: activePlan });
		expect(active.details.path).toMatch(/\.active\.md$/);
		await expect(access(join(cwd, ".pi", "plans", "SI-0000-slice-lifecycle.todo.md"))).rejects.toThrow();
		const queued = await harness.execute({ operation: "update_plan", status: "todo", plan: todoPlan });
		expect(queued.details.path).toMatch(/\.todo\.md$/);
		await harness.execute({ operation: "update_plan", status: "active", plan: activePlan });
		const done = await harness.execute({ operation: "update_plan", status: "done", plan: donePlan });
		expect(done.details.path).toMatch(/\.done\.md$/);
		expect(await readFile(done.details.path, "utf8")).toBe(donePlan);
	});

	it("updates an interrupted active plan in place", async () => {
		const harness = makeHarness(cwd);
		await harness.execute({ operation: "set_name", name: "interrupted slice" });
		await harness.execute({ operation: "save_plan", plan: todoPlan });
		await harness.execute({ operation: "update_plan", status: "active", plan: activePlan });
		const revised = `${activePlan}\n## Session notes\n\nValidation remains.\n`;
		const result = await harness.execute({ operation: "update_plan", status: "active", plan: revised });
		expect(result.details.status).toBe("active");
		expect(await readFile(result.details.path, "utf8")).toBe(revised);
	});

	it("rejects invalid transitions and incomplete done plans", async () => {
		const harness = makeHarness(cwd);
		await harness.execute({ operation: "set_name", name: "invalid transition" });
		await harness.execute({ operation: "save_plan", plan: todoPlan });
		expect((await harness.execute({ operation: "update_plan", status: "done", plan: donePlan })).isError).toBe(true);
		await harness.execute({ operation: "update_plan", status: "active", plan: activePlan });
		const incomplete = await harness.execute({ operation: "update_plan", status: "done", plan: activePlan });
		expect(incomplete.isError).toBe(true);
		expect(incomplete.content[0].text).toContain("unchecked checklist items");
	});

	it("rejects ambiguous lifecycle files", async () => {
		const harness = makeHarness(cwd, { name: "SI-3-ambiguous-state" });
		const plans = join(cwd, ".pi", "plans");
		await mkdir(plans, { recursive: true });
		await writeFile(join(plans, "SI-3-ambiguous-state.todo.md"), todoPlan);
		await writeFile(join(plans, "SI-3-ambiguous-state.active.md"), activePlan);
		const result = await harness.execute({ operation: "resume" });
		expect(result.isError).toBe(true);
		expect(result.content[0].text).toContain("ambiguous lifecycle state");
	});

	it("resumes current lifecycle content with fresh-approval guidance", async () => {
		const first = makeHarness(cwd);
		await first.execute({ operation: "set_name", name: "SI-12 resume continuity" });
		await first.execute({ operation: "save_plan", plan: todoPlan });
		await first.execute({ operation: "update_plan", status: "active", plan: activePlan });
		const resumed = makeHarness(cwd, { name: "SI-12-resume-continuity" });
		await resumed.handlers.get("session_start")!(undefined, resumed.ctx);
		const result = await resumed.execute({ operation: "resume" });
		expect(result.details).toMatchObject({ status: "active", frozen: true });
		expect(result.content[0].text).toContain("Current slice");
		expect(result.content[0].text).toContain("obtain fresh approval");
		expect(result.content[0].text).toContain("Current evidence wins");
	});

	it("treats done plans as terminal on resume", async () => {
		const harness = makeHarness(cwd);
		await harness.execute({ operation: "set_name", name: "completed goal" });
		await harness.execute({ operation: "save_plan", plan: todoPlan });
		await harness.execute({ operation: "update_plan", status: "active", plan: activePlan });
		await harness.execute({ operation: "update_plan", status: "done", plan: donePlan });
		const result = await harness.execute({ operation: "resume" });
		expect(result.details.status).toBe("done");
		expect(result.content[0].text).toContain("lifecycle is terminal");
		expect(result.content[0].text).not.toContain("Select one committable slice");
	});

	it("ignores legacy unsuffixed plans and handoffs", async () => {
		const harness = makeHarness(cwd);
		await harness.execute({ operation: "set_name", name: "legacy state" });
		await mkdir(join(cwd, ".pi", "plans"), { recursive: true });
		await mkdir(join(cwd, ".pi", "handoffs"), { recursive: true });
		await writeFile(join(cwd, ".pi", "plans", "SI-0000-legacy-state.md"), "# Legacy\n");
		await writeFile(join(cwd, ".pi", "handoffs", "SI-0000-legacy-state.md"), "# Legacy handoff\n");
		const saved = await harness.execute({ operation: "save_plan", plan: todoPlan });
		expect(saved.isError).toBeUndefined();
		await expect(access(join(cwd, ".pi", "plans", "SI-0000-legacy-state.md"))).resolves.toBeUndefined();
		await expect(access(join(cwd, ".pi", "handoffs", "SI-0000-legacy-state.md"))).resolves.toBeUndefined();
	});
});
