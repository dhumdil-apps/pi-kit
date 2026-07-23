import { describe, expect, it, vi } from "vitest";
import { MODE_ENTRY_TYPE, MODE_UPDATE_EVENT, registerModeManagement } from "./mode.js";

function harness() {
	const handlers = new Map<string, Array<(event: any, ctx: any) => any>>();
	const emitted: Array<[string, any]> = [];
	const sent: Array<[any, any]> = [];
	const userMessages: string[] = [];
	const pi = {
		on: vi.fn((name: string, handler: (event: any, ctx: any) => any) => {
			handlers.set(name, [...(handlers.get(name) ?? []), handler]);
		}),
		sendMessage: vi.fn((message: any, options: any) => sent.push([message, options])),
		sendUserMessage: vi.fn((content: string) => userMessages.push(content)),
		events: {
			emit: vi.fn((name: string, value: any) => emitted.push([name, value])),
		},
	};
	const mode = registerModeManagement(pi as any);
	return { handlers, emitted, sent, userMessages, mode };
}

function uiCtx() {
	return { hasUI: true, ui: { notify: vi.fn() } };
}

function branchCtx(entries: any[]) {
	return { sessionManager: { getBranch: () => entries } };
}

/** The shape sessionManager.getBranch() actually returns for pi.sendMessage markers. */
function modeMarker(mode: string) {
	return { type: "custom_message", customType: MODE_ENTRY_TYPE, display: false, content: `Workflow mode: ${mode}.`, details: { mode } };
}

describe("workflow mode management", () => {
	it("defaults to plan", () => {
		const { mode } = harness();
		expect(mode.getState()).toEqual({ mode: "plan" });
	});

	it("flips the mode in place, persists a hidden marker, and publishes the mode", () => {
		const { emitted, sent, mode } = harness();
		const ctx = uiCtx();
		mode.switchInPlace(ctx as any, "implement");
		expect(mode.getState()).toEqual({ mode: "implement" });
		const [marker, options] = sent[0];
		expect(marker.customType).toBe(MODE_ENTRY_TYPE);
		expect(marker.display).toBe(false);
		expect(marker.details).toEqual({ mode: "implement" });
		expect(options).toEqual({ triggerTurn: false });
		expect(emitted).toContainEqual([MODE_UPDATE_EVENT, "implement"]);
		expect(ctx.ui.notify).toHaveBeenCalledWith(expect.stringContaining("implement"), "info");

		mode.switchInPlace(uiCtx() as any, "plan");
		expect(mode.getState().mode).toBe("plan");
	});

	it("kicks off the turn instead of a notice when a kickoff is given", () => {
		const { userMessages, sent, mode } = harness();
		const ctx = uiCtx();
		mode.switchInPlace(ctx as any, "implement", "Execute the approved plan.");
		// The marker is still written, but the kickoff triggers the turn and the
		// mode notice is suppressed.
		expect(sent.some(([message]) => message.customType === MODE_ENTRY_TYPE)).toBe(true);
		expect(userMessages).toEqual(["Execute the approved plan."]);
		expect(ctx.ui.notify).not.toHaveBeenCalled();
	});

	it("falls back to sendMessage for the notice when the session has no UI", () => {
		const { sent, mode } = harness();
		mode.switchInPlace({ hasUI: false, ui: { notify: vi.fn() } } as any, "implement");
		const notice = sent.find(([message]) => message.display === true);
		expect(notice?.[0].content).toContain("implement");
	});

	it("reconstructs and publishes the last mode marker on session_start", async () => {
		const { handlers, emitted, mode } = harness();
		const sessionStart = handlers.get("session_start")![0];
		await sessionStart({}, branchCtx([modeMarker("plan"), modeMarker("implement")]));
		expect(mode.getState().mode).toBe("implement");
		expect(emitted).toContainEqual([MODE_UPDATE_EVENT, "implement"]);
		// No marker (or an unknown one) restores the plan default.
		await sessionStart({}, branchCtx([modeMarker("bogus")]));
		expect(mode.getState()).toEqual({ mode: "plan" });
		expect(emitted).toContainEqual([MODE_UPDATE_EVENT, "plan"]);
	});

	it("degrades a legacy review marker to the plan default", async () => {
		const { handlers, mode } = harness();
		await handlers.get("session_start")![0]({}, branchCtx([modeMarker("review")]));
		expect(mode.getState()).toEqual({ mode: "plan" });
	});

	it("reconstructs on session_tree navigation as well", async () => {
		const { handlers, mode } = harness();
		await handlers.get("session_tree")![0]({}, branchCtx([modeMarker("implement")]));
		expect(mode.getState().mode).toBe("implement");
	});

	it("derives the mode of a session seeded after load, publishing only on change", () => {
		const { emitted, mode } = harness();
		// A /handoff-seeded session loads in the plan default, then finds its marker.
		expect(mode.getState().mode).toBe("plan");
		mode.syncFromBranch(branchCtx([modeMarker("implement")]) as any);
		expect(mode.getState()).toEqual({ mode: "implement" });
		expect(emitted).toEqual([[MODE_UPDATE_EVENT, "implement"]]);

		mode.syncFromBranch(branchCtx([modeMarker("implement")]) as any);
		expect(emitted).toHaveLength(1);
	});
});
