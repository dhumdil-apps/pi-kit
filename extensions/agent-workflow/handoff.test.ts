import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openHandoffSession, resolveHandoffTask } from "./handoff.js";
import { MODE_ENTRY_TYPE, type WorkflowMode } from "./mode.js";

const plan = "# Goal\n\n## Checklist\n\n- [ ] Implement slice → verify it\n";

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

	const open = (mode: WorkflowMode, taskName?: string) => openHandoffSession(pi as never, ctx as never, mode, taskName);
	return { open, notify, sent, newSession, next, seeded };
}

async function seedPlan(cwd: string, name: string, status = "todo") {
	await mkdir(join(cwd, ".pi", "goal"), { recursive: true });
	await writeFile(join(cwd, ".pi", "goal", `${name}.${status}.md`), plan);
}

describe("handoff task resolution", () => {
	let cwd: string;
	beforeEach(async () => { cwd = await mkdtemp(join(tmpdir(), "pi-handoff-")); });
	afterEach(async () => { await rm(cwd, { recursive: true, force: true }); });

	it("resolves the single pending plan when nothing is named", async () => {
		await seedPlan(cwd, "dashboard-polish");
		expect(resolveHandoffTask(cwd, "implement", undefined, undefined).task).toMatchObject({
			name: "dashboard-polish",
			status: "todo",
			planPath: ".pi/goal/dashboard-polish.todo.md",
			discoveryPath: ".pi/goal/dashboard-polish.discovery.md",
		});
	});

	it("prefers an explicitly named task and canonicalizes it", async () => {
		await seedPlan(cwd, "dashboard-polish");
		await seedPlan(cwd, "SI-7-cache-recovery", "active");
		expect(resolveHandoffTask(cwd, "implement", "si-7-cache-recovery", undefined).task).toMatchObject({
			name: "SI-7-cache-recovery",
			status: "active",
		});
		expect(resolveHandoffTask(cwd, "implement", "no-such-task", undefined).error).toContain("No lifecycle plan for no-such-task");
	});

	it("falls back to the frozen session name before scanning", async () => {
		await seedPlan(cwd, "dashboard-polish");
		await seedPlan(cwd, "cache-recovery");
		expect(resolveHandoffTask(cwd, "implement", undefined, "cache-recovery").task?.name).toBe("cache-recovery");
	});

	it("asks which task when several plans are pending", async () => {
		await seedPlan(cwd, "dashboard-polish");
		await seedPlan(cwd, "cache-recovery", "active");
		const { task, error } = resolveHandoffTask(cwd, "implement", undefined, undefined);
		expect(task).toBeUndefined();
		expect(error).toContain("cache-recovery, dashboard-polish");
		expect(error).toContain("/mode implement fresh <task-name>");
	});

	it("reviews a finished task but never implements one", async () => {
		await seedPlan(cwd, "shipped-goal", "done");
		expect(resolveHandoffTask(cwd, "review", undefined, undefined).task).toMatchObject({ name: "shipped-goal", status: "done" });
		expect(resolveHandoffTask(cwd, "implement", undefined, undefined).error).toContain("run a Plan session first");
	});

	it("allows a fresh plan session with no task at all", () => {
		expect(resolveHandoffTask(cwd, "plan", undefined, undefined)).toEqual({});
	});

	it("reports an ambiguous lifecycle state instead of guessing", async () => {
		await seedPlan(cwd, "dashboard-polish");
		await seedPlan(cwd, "dashboard-polish", "active");
		expect(resolveHandoffTask(cwd, "implement", undefined, undefined).error).toContain("Ambiguous lifecycle state");
	});
});

describe("openHandoffSession", () => {
	let cwd: string;
	beforeEach(async () => { cwd = await mkdtemp(join(tmpdir(), "pi-handoff-cmd-")); });
	afterEach(async () => { await rm(cwd, { recursive: true, force: true }); });

	it("seeds the new session with the mode marker, task name, and a kickoff carrying real paths", async () => {
		await seedPlan(cwd, "dashboard-polish");
		const { open, newSession, seeded, next } = makeHarness(cwd);
		await open("implement");

		expect(newSession).toHaveBeenCalledWith(expect.objectContaining({ parentSession: "/sessions/current.jsonl" }));
		expect(seeded.entries).toEqual([
			{ customType: MODE_ENTRY_TYPE, content: "Workflow mode: implement.", display: false, details: { mode: "implement", origin: "boundary" } },
		]);
		expect(seeded.names).toEqual(["dashboard-polish"]);
		const [kickoff] = next.sendUserMessage.mock.calls[0];
		expect(kickoff).toContain(".pi/goal/dashboard-polish.todo.md");
		expect(kickoff).toContain(".pi/goal/dashboard-polish.discovery.md");
		expect(kickoff).toContain("execute the next slice");
	});

	it("waits for the kickoff turn only when the new session has no UI", async () => {
		await seedPlan(cwd, "dashboard-polish");
		const interactive = makeHarness(cwd);
		// next.sendUserMessage never resolves; an interactive handoff still returns.
		await interactive.open("implement");

		const headless = makeHarness(cwd);
		headless.next.hasUI = false;
		let settled = false;
		let finishTurn = () => {};
		headless.next.sendUserMessage.mockImplementation(() => new Promise<void>((resolve) => { finishTurn = resolve; }));
		const pending = headless.open("implement").then(() => { settled = true; });
		await vi.waitFor(() => expect(headless.next.sendUserMessage).toHaveBeenCalled());
		expect(settled).toBe(false);
		finishTurn();
		await pending;
		expect(settled).toBe(true);
	});

	it("kicks off review and re-plan sessions with their own framing", async () => {
		await seedPlan(cwd, "dashboard-polish", "active");
		const review = makeHarness(cwd);
		await review.open("review", "dashboard-polish");
		expect(review.next.sendUserMessage.mock.calls[0][0]).toContain("Review the task dashboard-polish");

		const replan = makeHarness(cwd);
		await replan.open("plan", "dashboard-polish");
		expect(replan.next.sendUserMessage.mock.calls[0][0]).toContain("Re-plan the task dashboard-polish");
	});

	it("opens an empty plan session when there is no task to carry over", async () => {
		const { open, seeded, next } = makeHarness(cwd);
		await open("plan");
		expect(seeded.entries[0].details).toEqual({ mode: "plan", origin: "boundary" });
		expect(seeded.names).toEqual([]);
		expect(next.sendUserMessage).not.toHaveBeenCalled();
		expect(next.ui.notify).toHaveBeenCalledWith(expect.stringContaining("Describe the goal"), "info");
	});

	it("notifies the resolution error and spawns nothing when no plan exists", async () => {
		const { open, notify, newSession } = makeHarness(cwd);
		await open("implement");
		expect(notify).toHaveBeenCalledWith(expect.stringContaining("run a Plan session first"), "warning");
		expect(newSession).not.toHaveBeenCalled();
	});

	it("falls back to a displayed message when the session has no UI", async () => {
		const { open, sent, newSession } = makeHarness(cwd, { hasUI: false });
		await open("implement");
		expect(sent[0]).toMatchObject({ display: true, content: expect.stringContaining("run a Plan session first") });
		expect(newSession).not.toHaveBeenCalled();
	});
});
