import { describe, expect, it, vi } from "vitest";
import { MODE_ENTRY_TYPE, MODE_UPDATE_EVENT, registerModeManagement } from "./mode.js";

function harness() {
	const handlers = new Map<string, Array<(event: any, ctx: any) => any>>();
	const commands = new Map<string, { description?: string; handler: (args: string, ctx: any) => Promise<void> }>();
	const emitted: Array<[string, any]> = [];
	const sent: Array<[any, any]> = [];
	const pi = {
		on: vi.fn((name: string, handler: (event: any, ctx: any) => any) => {
			handlers.set(name, [...(handlers.get(name) ?? []), handler]);
		}),
		registerCommand: vi.fn((name: string, command: any) => commands.set(name, command)),
		sendMessage: vi.fn((message: any, options: any) => sent.push([message, options])),
		events: {
			emit: vi.fn((name: string, value: any) => emitted.push([name, value])),
		},
	};
	const mode = registerModeManagement(pi as any);
	return { handlers, commands, emitted, sent, mode };
}

function uiCtx() {
	return { hasUI: true, ui: { notify: vi.fn() } };
}

function branchCtx(entries: any[]) {
	return { sessionManager: { getBranch: () => entries } };
}

/** The shape sessionManager.getBranch() actually returns for pi.sendMessage markers. */
function modeMarker(mode: string, origin?: string) {
	return { type: "custom_message", customType: MODE_ENTRY_TYPE, display: false, content: `Workflow mode: ${mode}.`, details: { mode, origin } };
}

describe("workflow mode management", () => {
	it("registers the three mode commands and defaults to plan at a boundary", () => {
		const { commands, mode } = harness();
		for (const name of ["plan", "implement", "review"]) expect(commands.has(name)).toBe(true);
		expect(mode.getState()).toEqual({ mode: "plan", origin: "boundary" });
	});

	it("flips the mode, persists a hidden in-place marker, and publishes the mode on command", async () => {
		const { commands, emitted, sent, mode } = harness();
		const ctx = uiCtx();
		await commands.get("implement")!.handler("", ctx);
		expect(mode.getState()).toEqual({ mode: "implement", origin: "inplace" });
		const [marker, options] = sent[0];
		expect(marker.customType).toBe(MODE_ENTRY_TYPE);
		expect(marker.display).toBe(false);
		expect(marker.details).toEqual({ mode: "implement", origin: "inplace" });
		expect(options).toEqual({ triggerTurn: false });
		expect(emitted).toContainEqual([MODE_UPDATE_EVENT, "implement"]);
		expect(emitted.some(([name]) => name.startsWith("powerbar:"))).toBe(false);
		expect(ctx.ui.notify).toHaveBeenCalledWith(expect.stringContaining("implement"), "info");

		await commands.get("review")!.handler("", uiCtx());
		expect(mode.getState().mode).toBe("review");
		await commands.get("plan")!.handler("", uiCtx());
		expect(mode.getState().mode).toBe("plan");
	});

	it("falls back to sendMessage for the notice when the session has no UI", async () => {
		const { commands, sent } = harness();
		await commands.get("review")!.handler("", { hasUI: false, ui: { notify: vi.fn() } });
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
		});
		expect(mode.syncFromBranch(branchCtx([modeMarker("review", "boundary")]) as any).origin).toBe("boundary");
		// Markers written before origin existed restore as boundary.
		expect(mode.syncFromBranch(branchCtx([modeMarker("review")]) as any).origin).toBe("boundary");
	});

	it("derives the mode of a session seeded after load, publishing only on change", () => {
		const { emitted, mode } = harness();
		// A /handoff-seeded session loads in the plan default, then finds its marker.
		expect(mode.getState().mode).toBe("plan");
		mode.syncFromBranch(branchCtx([modeMarker("implement", "boundary")]) as any);
		expect(mode.getState()).toEqual({ mode: "implement", origin: "boundary" });
		expect(emitted).toEqual([[MODE_UPDATE_EVENT, "implement"]]);

		mode.syncFromBranch(branchCtx([modeMarker("implement", "boundary")]) as any);
		expect(emitted).toHaveLength(1);
	});
});
