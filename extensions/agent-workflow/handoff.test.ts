import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openHandoffSession, resolveHandoffTask } from "./handoff.js";
import { MODE_ENTRY_TYPE } from "./mode.js";

const plan = "## Current state\n\nA.\n\n## Desired state\n\nB.\n\n## Approach\n\nC.\n\n## Quirks\n\nD.\n";

interface CtxOptions { sessionName?: string; hasUI?: boolean }

function makeHarness(cwd: string, options: CtxOptions = {}) {
	const sent: any[] = [];
	const notify = vi.fn();
	const pi = {
		sendMessage: vi.fn((message: any) => sent.push(message)),
	};

	const seeded = { entries: [] as any[], names: [] as string[] };
	const next = {
		hasUI: true,
		ui: { notify: vi.fn() },
		// Never resolves: the caller must not await the kickoff turn.
		sendUserMessage: vi.fn((_kickoff: string) => new Promise<void>(() => {})),
		sendMessage: vi.fn(async () => {}),
	};
	const newSession = vi.fn(async (opts: any) => {
		await opts.setup?.({
			appendCustomMessageEntry: (customType: string, content: string, display: boolean, details: unknown) =>
				seeded.entries.push({ customType, content, display, details }),
			appendSessionInfo: (name: string) => seeded.names.push(name),
		});
		await opts.withSession?.(next);
		return { cancelled: false };
	});

	const ctx = {
		cwd,
		hasUI: options.hasUI ?? true,
		ui: { notify },
		waitForIdle: vi.fn(async () => {}),
		newSession,
		sessionManager: {
			getSessionName: () => options.sessionName,
			getSessionFile: () => "/sessions/current.jsonl",
		},
	};

	const open = (taskName?: string) => openHandoffSession(pi as never, ctx as never, taskName);
	return { open, notify, sent, newSession, next, seeded };
}

async function seedPlan(cwd: string, name: string) {
	await mkdir(join(cwd, ".pi", "plan"), { recursive: true });
	await writeFile(join(cwd, ".pi", "plan", `${name}.md`), plan);
}

describe("handoff task resolution", () => {
	let cwd: string;
	beforeEach(async () => { cwd = await mkdtemp(join(tmpdir(), "pi-handoff-")); });
	afterEach(async () => { await rm(cwd, { recursive: true, force: true }); });

	it("resolves the single plan when nothing is named", async () => {
		await seedPlan(cwd, "dashboard-polish");
		expect(resolveHandoffTask(cwd, undefined, undefined).task).toEqual({
			name: "dashboard-polish",
			planPath: ".pi/plan/dashboard-polish.md",
		});
	});

	it("prefers an explicitly named task and canonicalizes it", async () => {
		await seedPlan(cwd, "dashboard-polish");
		await seedPlan(cwd, "SI-7-cache-recovery");
		expect(resolveHandoffTask(cwd, "si-7-cache-recovery", undefined).task?.name).toBe("SI-7-cache-recovery");
		expect(resolveHandoffTask(cwd, "no-such-task", undefined).error).toContain("No plan for no-such-task");
	});

	it("falls back to the session name before the lone-file pick", async () => {
		await seedPlan(cwd, "dashboard-polish");
		await seedPlan(cwd, "cache-recovery");
		expect(resolveHandoffTask(cwd, undefined, "cache-recovery").task?.name).toBe("cache-recovery");
	});

	it("asks which task when several plans exist", async () => {
		await seedPlan(cwd, "dashboard-polish");
		await seedPlan(cwd, "cache-recovery");
		const { task, error } = resolveHandoffTask(cwd, undefined, undefined);
		expect(task).toBeUndefined();
		expect(error).toContain("cache-recovery, dashboard-polish");
		expect(error).toContain("/handoff <task-name>");
	});

	it("errors when no plan exists", () => {
		expect(resolveHandoffTask(cwd, undefined, undefined).error).toContain("plan first");
	});
});

describe("openHandoffSession", () => {
	let cwd: string;
	beforeEach(async () => { cwd = await mkdtemp(join(tmpdir(), "pi-handoff-cmd-")); });
	afterEach(async () => { await rm(cwd, { recursive: true, force: true }); });

	it("seeds the new session with the implement marker, task name, and an auto-approved kickoff", async () => {
		await seedPlan(cwd, "dashboard-polish");
		const { open, newSession, seeded, next } = makeHarness(cwd);
		await open();

		expect(newSession).toHaveBeenCalledWith(expect.objectContaining({ parentSession: "/sessions/current.jsonl" }));
		expect(seeded.entries).toEqual([
			{ customType: MODE_ENTRY_TYPE, content: "Workflow mode: implement.", display: false, details: { mode: "implement" } },
		]);
		expect(seeded.names).toEqual(["dashboard-polish"]);
		const [kickoff] = next.sendUserMessage.mock.calls[0];
		expect(kickoff).toContain(".pi/plan/dashboard-polish.md");
		expect(kickoff).toContain("do not ask for approval again");
		expect(kickoff).toContain("stop and report");
	});

	it("waits for the kickoff turn only when the new session has no UI", async () => {
		await seedPlan(cwd, "dashboard-polish");
		const interactive = makeHarness(cwd);
		// next.sendUserMessage never resolves; an interactive handoff still returns.
		await interactive.open();

		const headless = makeHarness(cwd);
		headless.next.hasUI = false;
		let settled = false;
		let finishTurn = () => {};
		headless.next.sendUserMessage.mockImplementation(() => new Promise<void>((resolve) => { finishTurn = resolve; }));
		const pending = headless.open().then(() => { settled = true; });
		await vi.waitFor(() => expect(headless.next.sendUserMessage).toHaveBeenCalled());
		expect(settled).toBe(false);
		finishTurn();
		await pending;
		expect(settled).toBe(true);
	});

	it("notifies the resolution error and spawns nothing when no plan exists", async () => {
		const { open, notify, newSession } = makeHarness(cwd);
		await open();
		expect(notify).toHaveBeenCalledWith(expect.stringContaining("plan first"), "warning");
		expect(newSession).not.toHaveBeenCalled();
	});

	it("falls back to a displayed message when the session has no UI", async () => {
		const { open, sent, newSession } = makeHarness(cwd, { hasUI: false });
		await open();
		expect(sent[0]).toMatchObject({ display: true, content: expect.stringContaining("plan first") });
		expect(newSession).not.toHaveBeenCalled();
	});
});
