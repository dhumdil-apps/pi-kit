import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import createExtension from "./index.js";
import { MODE_ENTRY_TYPE } from "./mode.js";

type Mode = "plan" | "implement";

const planText = "## Current state\n\nA.\n\n## Desired state\n\nB.\n\n## Approach\n\nC.\n\n## Quirks\n\nD.\n";

function harness(cwd = "/pi-kit-index-test-nonexistent") {
	const handlers = new Map<string, Array<(event?: any, ctx?: any) => any>>();
	const commands = new Map<string, { handler: (args: string, ctx: any) => Promise<void> }>();
	const tools: any[] = [];
	const branch: any[] = [];
	const notify = vi.fn();
	let sessionName: string | undefined;
	const userMessages: string[] = [];
	const messages: any[] = [];
	const pi = {
		on: vi.fn((name: string, handler: (event?: any, ctx?: any) => any) => {
			handlers.set(name, [...(handlers.get(name) ?? []), handler]);
		}),
		registerCommand: vi.fn((name: string, command: any) => commands.set(name, command)),
		registerTool: vi.fn((tool: any) => tools.push(tool)),
		getSessionName: vi.fn(() => sessionName),
		setSessionName: vi.fn((name: string) => { sessionName = name; }),
		// Hidden markers are what the mode is derived from, so mirror them into the
		// branch in the shape getBranch() really returns.
		sendMessage: vi.fn((message: any) => {
			messages.push(message);
			if (message.display === false) {
				branch.push({ type: "custom_message", customType: message.customType, display: false, content: message.content, details: message.details });
			}
		}),
		sendUserMessage: vi.fn((content: string) => userMessages.push(content)),
		events: { emit: vi.fn(), on: vi.fn() },
	};
	createExtension(pi as any);
	const newSession = vi.fn(async () => ({ cancelled: false }));
	const ctx = {
		hasUI: true,
		ui: { notify },
		cwd,
		getContextUsage: () => undefined as any,
		waitForIdle: vi.fn(async () => {}),
		newSession,
		sessionManager: {
			getBranch: () => branch,
			getSessionName: () => sessionName,
			getSessionFile: () => "/sessions/current.jsonl",
		},
	};

	const inject = async (): Promise<string> => {
		const injectors = handlers.get("before_agent_start")!;
		const result = await injectors[injectors.length - 1]({ systemPrompt: "base" }, ctx);
		return (result.systemPrompt as string).replace(/\s+/g, " ");
	};

	/** Seed the mode the way a /handoff-spawned session does, then inject. */
	const promptFor = async (mode: Mode): Promise<string> => {
		branch.push({ type: "custom_message", customType: MODE_ENTRY_TYPE, display: false, content: `Workflow mode: ${mode}.`, details: { mode } });
		return inject();
	};

	/**
	 * Drive the approval prompt: arm it with a save_plan result, then settle with
	 * a ctx whose select answers `choice` (undefined = dismissed). The editor
	 * starts empty unless `editorText` says otherwise.
	 */
	const offer = async (result: unknown, choice: string | undefined, options: { editorText?: string; isError?: boolean; usage?: any; hasUI?: boolean } = {}) => {
		const setEditorText = vi.fn();
		const offerNotify = vi.fn();
		const select = vi.fn(async (_title: string, _options: string[]) => choice);
		const settleCtx = {
			...ctx,
			hasUI: options.hasUI ?? true,
			getContextUsage: () => options.usage,
			ui: { notify: offerNotify, setEditorText, getEditorText: () => options.editorText ?? "", select },
		};
		await handlers.get("tool_execution_end")![0]({ toolName: "save_plan", isError: options.isError ?? false, result }, settleCtx);
		await handlers.get("agent_settled")![0]({}, settleCtx);
		return { setEditorText, notify: offerNotify, select, settleCtx };
	};

	const setSessionName = (name: string) => { sessionName = name; };

	return { handlers, commands, tools, notify, userMessages, messages, promptFor, inject, ctx, offer, newSession, setSessionName };
}

const savedPlan = { details: { name: "dashboard-polish" } };

describe("agent workflow lifecycle", () => {
	it("registers only the /handoff command and the save_plan tool", () => {
		const { commands, tools, handlers } = harness();
		for (const gone of ["mode", "plan", "implement", "review", "flash", "retro"]) {
			expect(commands.has(gone)).toBe(false);
		}
		expect(commands.has("handoff")).toBe(true);
		expect(tools.map((tool) => tool.name)).toEqual(["save_plan"]);
		// The only turn-time hooks are the system-prompt injector and the approval
		// prompt (tool_execution_end arms it, agent_settled delivers it).
		expect(handlers.has("input")).toBe(false);
		expect(handlers.has("agent_start")).toBe(false);
		expect(handlers.has("agent_settled")).toBe(true);
	});

	it("injects the plan flow by default with the four sections and the approval question", async () => {
		const { inject } = harness();
		const prompt = await inject();
		expect(prompt).toContain("<pi_workflow>");
		expect(prompt).toContain("Session mode: PLAN");
		for (const section of ["Current state", "Desired state", "Approach", "Quirks"]) {
			expect(prompt).toContain(section);
		}
		expect(prompt).toContain("Proceed, handoff, or revise?");
		expect(prompt).not.toContain("REVIEW");
		expect(prompt).not.toContain("slice");
	});

	it("injects the implement flow for a seeded implement session", async () => {
		const { promptFor } = harness();
		const prompt = await promptFor("implement");
		expect(prompt).toContain("Session mode: IMPLEMENT");
		expect(prompt).toContain("already approved");
		expect(prompt).toContain("stop, report it, and let the user decide");
		expect(prompt).toContain("Never delete the plan file");
		expect(prompt).not.toContain("Session mode: PLAN");
	});

	it("carries the standing rules in every mode", async () => {
		const { inject, promptFor } = harness();
		for (const prompt of [await inject(), await promptFor("implement")]) {
			expect(prompt).toContain("Never commit, stash, or push");
			expect(prompt).toContain("Never weaken a test");
			expect(prompt).toContain(".pi/plan/<task-name>.md");
			expect(prompt).toContain("Never delete a plan file");
			expect(prompt).toContain("Legacy .pi/goal/ files are ignored");
			// The learning block is a single propose-then-confirm sentence.
			expect(prompt).toContain("only after the user confirms");
			expect(prompt).not.toContain("durable");
		}
	});
});

describe("approval prompt", () => {
	let cwd: string;
	beforeEach(async () => {
		cwd = await mkdtemp(join(tmpdir(), "pi-index-offer-"));
		await mkdir(join(cwd, ".pi", "plan"), { recursive: true });
		await writeFile(join(cwd, ".pi", "plan", "dashboard-polish.md"), planText);
	});
	afterEach(async () => { await rm(cwd, { recursive: true, force: true }); });

	it("Proceed switches to implement in place and kicks off the approved plan", async () => {
		const h = harness(cwd);
		const { notify } = await h.offer(savedPlan, "Proceed in this session (recommended)");
		expect(h.messages.some((m) => m.customType === MODE_ENTRY_TYPE && m.details?.mode === "implement")).toBe(true);
		expect(h.userMessages[0]).toContain(".pi/plan/dashboard-polish.md");
		expect(h.userMessages[0]).toContain("do not ask for approval again");
		expect(notify).not.toHaveBeenCalled();
	});

	it("Handoff prefills /handoff with the task name only when the editor is empty", async () => {
		const h = harness(cwd);
		const { setEditorText, notify } = await h.offer(savedPlan, "Handoff to a fresh session");
		expect(setEditorText).toHaveBeenCalledWith("/handoff dashboard-polish");
		expect(notify).toHaveBeenCalledWith(expect.stringContaining("/handoff dashboard-polish"), "info");

		const busy = harness(cwd);
		const { setEditorText: untouched } = await busy.offer(savedPlan, "Handoff to a fresh session", { editorText: "half-typed thought" });
		expect(untouched).not.toHaveBeenCalled();
	});

	it("Revise and a dismissed prompt change nothing and stay in plan", async () => {
		for (const choice of ["Revise the plan", undefined]) {
			const h = harness(cwd);
			const { notify, setEditorText } = await h.offer(savedPlan, choice as any);
			expect(notify).toHaveBeenCalledWith(expect.stringContaining("Staying in plan"), "info");
			expect(setEditorText).not.toHaveBeenCalled();
			expect(h.messages.some((m) => m.customType === MODE_ENTRY_TYPE)).toBe(false);
		}
	});

	it("recommends Proceed on a lean context and Handoff on a loaded one", async () => {
		const lean = harness(cwd);
		const { select: leanSelect } = await lean.offer(savedPlan, undefined);
		expect(leanSelect.mock.calls[0]![1][0]).toBe("Proceed in this session (recommended)");

		const loaded = harness(cwd);
		const { select: loadedSelect } = await loaded.offer(savedPlan, undefined, { usage: { tokens: 150_000, contextWindow: 1_000_000, percent: 15 } });
		expect(loadedSelect.mock.calls[0]![1][0]).toBe("Handoff to a fresh session (recommended)");
	});

	it("fires once per save and never on a failed save", async () => {
		const h = harness(cwd);
		const first = await h.offer(savedPlan, "Revise the plan");
		expect(first.select).toHaveBeenCalledTimes(1);
		// Settle again without a new save: the offer was consumed.
		await h.handlers.get("agent_settled")![0]({}, first.settleCtx);
		expect(first.select).toHaveBeenCalledTimes(1);

		const failed = harness(cwd);
		const { select } = await failed.offer(savedPlan, "Revise the plan", { isError: true });
		expect(select).not.toHaveBeenCalled();
	});

	it("degrades to a displayed /handoff hint when headless", async () => {
		const h = harness(cwd);
		const { select } = await h.offer(savedPlan, undefined, { hasUI: false });
		expect(select).not.toHaveBeenCalled();
		const hint = h.messages.find((m) => m.display === true);
		expect(hint?.content).toContain("/handoff dashboard-polish");
	});
});

describe("/handoff command", () => {
	let cwd: string;
	beforeEach(async () => { cwd = await mkdtemp(join(tmpdir(), "pi-index-handoff-")); });
	afterEach(async () => { await rm(cwd, { recursive: true, force: true }); });

	it("spawns the implement session for the resolved plan", async () => {
		await mkdir(join(cwd, ".pi", "plan"), { recursive: true });
		await writeFile(join(cwd, ".pi", "plan", "dashboard-polish.md"), planText);
		const h = harness(cwd);
		await h.commands.get("handoff")!.handler("", h.ctx);
		expect(h.newSession).toHaveBeenCalledTimes(1);
	});

	it("warns instead of spawning when no plan exists", async () => {
		const h = harness(cwd);
		await h.commands.get("handoff")!.handler("", h.ctx);
		expect(h.notify).toHaveBeenCalledWith(expect.stringContaining("plan first"), "warning");
		expect(h.newSession).not.toHaveBeenCalled();
	});
});
