import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listPlanNames, normalizeTaskName, registerTaskManagement } from "./task.js";

function makeHarness(cwd: string, name?: string) {
	let sessionName = name;
	let tool: any;
	const pi = {
		on: vi.fn(),
		registerTool: (registered: any) => { tool = registered; },
		getSessionName: () => sessionName,
		setSessionName: vi.fn((next: string) => { sessionName = next; }),
	};
	registerTaskManagement(pi as never);
	const ctx = { cwd };
	const execute = (params: any) => tool.execute("call", params, undefined, undefined, ctx);
	return { execute, pi, getName: () => sessionName };
}

const plan = "## Current state\n\nA.\n\n## Desired state\n\nB.\n\n## Approach\n\nC.\n\n## Quirks\n\nD.\n";

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

describe("save_plan", () => {
	let cwd: string;
	beforeEach(async () => { cwd = await mkdtemp(join(tmpdir(), "pi-task-management-")); });
	afterEach(async () => { await rm(cwd, { recursive: true, force: true }); });

	it("normalizes the name, writes the flat plan file, and names the session", async () => {
		const harness = makeHarness(cwd);
		const saved = await harness.execute({ name: "SI-7 dashboard polish", plan });
		const path = join(cwd, ".pi", "plan", "SI-7-dashboard-polish.md");
		expect(saved.details).toEqual({ name: "SI-7-dashboard-polish", path });
		expect(await readFile(path, "utf8")).toBe(plan);
		expect(harness.getName()).toBe("SI-7-dashboard-polish");
	});

	it("overwrites the same file on a re-save after a revision", async () => {
		const harness = makeHarness(cwd);
		await harness.execute({ name: "revised approach", plan });
		const revised = `${plan}\nRevised.\n`;
		const result = await harness.execute({ name: "revised approach", plan: revised });
		expect(result.isError).toBeUndefined();
		expect(await readFile(result.details.path, "utf8")).toBe(revised);
	});

	it("rejects an empty plan without touching the session name", async () => {
		const harness = makeHarness(cwd, "existing-name");
		const result = await harness.execute({ name: "empty plan", plan: "   " });
		expect(result.isError).toBe(true);
		expect(result.content[0].text).toContain("plan is required");
		expect(harness.getName()).toBe("existing-name");
	});

	it("ignores and preserves legacy .pi/goal files", async () => {
		const harness = makeHarness(cwd);
		await mkdir(join(cwd, ".pi", "goal"), { recursive: true });
		await writeFile(join(cwd, ".pi", "goal", "legacy-state.todo.md"), "# Legacy\n");
		const saved = await harness.execute({ name: "legacy state", plan });
		expect(saved.isError).toBeUndefined();
		expect(saved.details.path).toBe(join(cwd, ".pi", "plan", "legacy-state.md"));
		await expect(access(join(cwd, ".pi", "goal", "legacy-state.todo.md"))).resolves.toBeUndefined();
	});
});

describe("listPlanNames", () => {
	let cwd: string;
	beforeEach(async () => { cwd = await mkdtemp(join(tmpdir(), "pi-plan-list-")); });
	afterEach(async () => { await rm(cwd, { recursive: true, force: true }); });

	it("lists canonical plan names sorted, and is empty without a plan dir", async () => {
		expect(listPlanNames(cwd)).toEqual([]);
		const plans = join(cwd, ".pi", "plan");
		await mkdir(plans, { recursive: true });
		await writeFile(join(plans, "zeta-task.md"), plan);
		await writeFile(join(plans, "SI-1-alpha-task.md"), plan);
		await writeFile(join(plans, "not a plan.txt"), "x");
		expect(listPlanNames(cwd)).toEqual(["SI-1-alpha-task", "zeta-task"]);
	});
});
