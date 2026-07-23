import { describe, expect, it, vi } from "vitest";
import { MODE_ENTRY_TYPE, MODE_UPDATE_EVENT, registerModeManagement } from "./mode.js";

function harness() {
	const handlers = new Map<string, Array<(event: any, ctx: any) => any>>();
	const commands = new Map<string, { description?: string; handler: (args: string, ctx: any) => Promise<void> }>();
	const emitted: Array<[string, any]> = [];
	const sent: Array<[any, any]> = [];
	const userMessages: string[] = [];
	const pi = {
		on: vi.fn((name: string, handler: (event: any, ctx: any) => any) => {
			handlers.set(name, [...(handlers.get(name) ?? []), handler]);
		}),
		registerCommand: vi.fn((name: string, command: any) => commands.set(name, command)),
		sendMessage: vi.fn((message: any, options: any) => sent.push([message, options])),
		sendUserMessage: vi.fn((content: string) => userMessages.push(content)),
		events: {
			emit: vi.fn((name: string, value: any) => emitted.push([name, value])),
		},
	};
	const mode = registerModeManagement(pi as any);
	return { handlers, commands, emitted, sent, userMessages, mode };
}

function uiCtx() {
	return { hasUI: true, ui: { notify: vi.fn() } };
}

function branchCtx(entries: any[]) {
	return { sessionManager: { getBranch: () => entries } };
}

/** The shape sessionManager.getBranch() actually returns for pi.sendMessage markers. */
function modeMarker(mode: string, origin?: string, approved?: boolean) {
	return { type: "custom_message", customType: MODE_ENTRY_TYPE, display: false, content: `Workflow mode: ${mode}.`, details: { mode, origin, approved } };
}

describe("workflow mode management", () => {
	it("registers no commands of its own and defaults to plan at a boundary", () => {
		const { commands, mode } = harness();
		// The mode selectors are folded into the single /mode command (index.ts);
		// mode management only exposes switchInPlace, not its own commands.
		for (const name of ["plan", "implement", "review", "mode", "handoff"]) expect(commands.has(name)).toBe(false);
		expect(mode.getState()).toEqual({ mode: "plan", origin: "boundary" });
	});

	it("flips the mode in place, persists a hidden in-place marker, and publishes the mode", () => {
		const { emitted, sent, mode } = harness();
		const ctx = uiCtx();
		mode.switchInPlace(ctx as any, "implement");
		expect(mode.getState()).toEqual({ mode: "implement", origin: "inplace", approved: false });
		const [marker, options] = sent[0];
		expect(marker.customType).toBe(MODE_ENTRY_TYPE);
		expect(marker.display).toBe(false);
		expect(marker.details).toEqual({ mode: "implement", origin: "inplace", approved: false });
		expect(options).toEqual({ triggerTurn: false });
		expect(emitted).toContainEqual([MODE_UPDATE_EVENT, "implement"]);
		expect(emitted.some(([name]) => name.startsWith("powerbar:"))).toBe(false);
		expect(ctx.ui.notify).toHaveBeenCalledWith(expect.stringContaining("implement"), "info");

		mode.switchInPlace(uiCtx() as any, "review");
		expect(mode.getState().mode).toBe("review");
		mode.switchInPlace(uiCtx() as any, "plan");
		expect(mode.getState().mode).toBe("plan");
	});

	it("kicks off the turn instead of a notice when a kickoff is given", () => {
		const { userMessages, sent, mode } = harness();
		const ctx = uiCtx();
		mode.switchInPlace(ctx as any, "implement", { kickoff: "Resume the plan and cut the slice." });
		// The marker is still written, but the kickoff triggers the turn and the
		// mode notice is suppressed.
		expect(sent.some(([message]) => message.customType === MODE_ENTRY_TYPE)).toBe(true);
		expect(userMessages).toEqual(["Resume the plan and cut the slice."]);
		expect(ctx.ui.notify).not.toHaveBeenCalled();
	});

	it("falls back to sendMessage for the notice when the session has no UI", () => {
		const { sent, mode } = harness();
		mode.switchInPlace({ hasUI: false, ui: { notify: vi.fn() } } as any, "review");
		const notice = sent.find(([message]) => message.display === true);
		expect(notice?.[0].content).toContain("review");
	});

	it("reconstructs and publishes the last mode marker on session_start", async () => {
		const { handlers, emitted, mode } = harness();
		const sessionStart = handlers.get("session_start")![0];
		await sessionStart({}, branchCtx([modeMarker("implement"), modeMarker("review")]));
		expect(mode.getState().mode).toBe("review");
		expect(emitted).toContainEqual([MODE_UPDATE_EVENT, "review"]);
		// No marker (or an unknown one) restores the plan default.
		await sessionStart({}, branchCtx([modeMarker("bogus")]));
		expect(mode.getState()).toEqual({ mode: "plan", origin: "boundary" });
		expect(emitted).toContainEqual([MODE_UPDATE_EVENT, "plan"]);
	});

	it("reconstructs on session_tree navigation as well", async () => {
		const { handlers, mode } = harness();
		await handlers.get("session_tree")![0]({}, branchCtx([modeMarker("implement")]));
		expect(mode.getState().mode).toBe("implement");
	});

	it("restores the marker's origin, defaulting unmarked entries to boundary", () => {
		const { mode } = harness();
		expect(mode.syncFromBranch(branchCtx([modeMarker("implement", "inplace")]) as any)).toEqual({
			mode: "implement",
			origin: "inplace",
			approved: false,
		});
		expect(mode.syncFromBranch(branchCtx([modeMarker("review", "boundary")]) as any).origin).toBe("boundary");
		// Markers written before origin existed restore as boundary.
		expect(mode.syncFromBranch(branchCtx([modeMarker("review")]) as any).origin).toBe("boundary");
	});

	it("carries the approved flag through the marker so the approval gate stays closed once", () => {
		const { sent, mode } = harness();
		mode.switchInPlace(uiCtx() as any, "implement", { kickoff: "go", approved: true });
		expect(sent[0][0].details).toEqual({ mode: "implement", origin: "inplace", approved: true });
		expect(mode.getState().approved).toBe(true);
		// A handoff-seeded marker restores it too; anything but an explicit true is false.
		expect(mode.syncFromBranch(branchCtx([modeMarker("implement", "boundary", true)]) as any).approved).toBe(true);
		expect(mode.syncFromBranch(branchCtx([modeMarker("implement", "boundary")]) as any).approved).toBe(false);
	});

	it("derives the mode of a session seeded after load, publishing only on change", () => {
		const { emitted, mode } = harness();
		// A /handoff-seeded session loads in the plan default, then finds its marker.
		expect(mode.getState().mode).toBe("plan");
		mode.syncFromBranch(branchCtx([modeMarker("implement", "boundary")]) as any);
		expect(mode.getState()).toEqual({ mode: "implement", origin: "boundary", approved: false });
		expect(emitted).toEqual([[MODE_UPDATE_EVENT, "implement"]]);

		mode.syncFromBranch(branchCtx([modeMarker("implement", "boundary")]) as any);
		expect(emitted).toHaveLength(1);
	});
});
