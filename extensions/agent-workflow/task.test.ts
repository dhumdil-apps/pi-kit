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
	it("uses a concise two-to-four word summary without fallback ticket", () => {
		expect(normalizeTaskName("please reimagine this dashboard resource section to make it better")).toBe("reimagine-dashboard-resource-section");
	});
	it("preserves a supplied or current ticket (SI-42, TEST-1234, JIRA-567)", () => {
		expect(normalizeTaskName("SI-42 cache recovery")).toBe("SI-42-cache-recovery");
		expect(normalizeTaskName("TEST-1234 fix login bug")).toBe("TEST-1234-fix-login-bug");
		expect(normalizeTaskName("dashboard polish", "JIRA-567-existing-task")).toBe("JIRA-567-dashboard-polish");
	});
	it("pads a one-word summary", () => expect(normalizeTaskName("dashboard")).toBe("dashboard-task"));
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
		const path = join(cwd, ".pi", "goal", "SI-7-dashboard-polish.todo.md");
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
		await expect(access(join(cwd, ".pi", "goal", "SI-0000-slice-lifecycle.todo.md"))).rejects.toThrow();
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

	it("rewrites a todo plan in place for a re-plan and points save_plan at update_plan", async () => {
		const harness = makeHarness(cwd);
		await harness.execute({ operation: "set_name", name: "replanned goal" });
		await harness.execute({ operation: "save_plan", plan: todoPlan });
		const blocked = await harness.execute({ operation: "save_plan", plan: todoPlan });
		expect(blocked.isError).toBe(true);
		expect(blocked.content[0].text).toContain("use update_plan to revise it");

		const revised = `${todoPlan}\n- [ ] Second slice → verify it\n`;
		const result = await harness.execute({ operation: "update_plan", status: "todo", plan: revised });
		expect(result.isError).toBeUndefined();
		expect(result.details.path).toMatch(/\.todo\.md$/);
		expect(await readFile(result.details.path, "utf8")).toBe(revised);
	});

	it("rewrites a done plan in place so review can append its verdict", async () => {
		const harness = makeHarness(cwd);
		await harness.execute({ operation: "set_name", name: "review verdict" });
		await harness.execute({ operation: "save_plan", plan: todoPlan });
		await harness.execute({ operation: "update_plan", status: "active", plan: activePlan });
		await harness.execute({ operation: "update_plan", status: "done", plan: donePlan });
		const withVerdict = `${donePlan}\n## Session notes\n\n- 2026-07-23 review: 0 blocking, 1 important (fixed), 2 optional — approved\n`;
		const result = await harness.execute({ operation: "update_plan", status: "done", plan: withVerdict });
		expect(result.isError).toBeUndefined();
		expect(result.details.status).toBe("done");
		expect(await readFile(result.details.path, "utf8")).toBe(withVerdict);
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
		const plans = join(cwd, ".pi", "goal");
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
		await mkdir(join(cwd, ".pi", "goal"), { recursive: true });
		await mkdir(join(cwd, ".pi", "handoffs"), { recursive: true });
		await writeFile(join(cwd, ".pi", "goal", "SI-0000-legacy-state.md"), "# Legacy\n");
		await writeFile(join(cwd, ".pi", "handoffs", "SI-0000-legacy-state.md"), "# Legacy handoff\n");
		const saved = await harness.execute({ operation: "save_plan", plan: todoPlan });
		expect(saved.isError).toBeUndefined();
		await expect(access(join(cwd, ".pi", "goal", "SI-0000-legacy-state.md"))).resolves.toBeUndefined();
		await expect(access(join(cwd, ".pi", "handoffs", "SI-0000-legacy-state.md"))).resolves.toBeUndefined();
	});
});
