import { describe, expect, it, vi } from "vitest";
import { MODE_ENTRY_TYPE, registerModeManagement } from "./mode.js";

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
		events: { emit: vi.fn((name: string, value: any) => emitted.push([name, value])) },
	};
	const getMode = registerModeManagement(pi as any);
	return { handlers, commands, emitted, sent, getMode, pi };
}

function uiCtx() {
	return { hasUI: true, ui: { notify: vi.fn() } };
}

function branchCtx(entries: any[]) {
	return { sessionManager: { getBranch: () => entries } };
}

function modeMarker(mode: string) {
	return { type: "message", message: { role: "custom", customType: MODE_ENTRY_TYPE, details: { mode } } };
}

describe("workflow mode management", () => {
	it("registers the three mode commands and defaults to plan", () => {
		const { commands, getMode } = harness();
		for (const name of ["plan", "implement", "review"]) expect(commands.has(name)).toBe(true);
		expect(getMode()).toBe("plan");
	});

	it("flips the mode, persists a hidden marker, and updates the powerbar on command", async () => {
		const { commands, emitted, sent, getMode } = harness();
		const ctx = uiCtx();
		await commands.get("implement")!.handler("", ctx);
		expect(getMode()).toBe("implement");
		const [marker, options] = sent[0];
		expect(marker.customType).toBe(MODE_ENTRY_TYPE);
		expect(marker.display).toBe(false);
		expect(marker.details).toEqual({ mode: "implement" });
		expect(options).toEqual({ triggerTurn: false });
		const update = emitted.find(([name, value]) => name === "powerbar:update" && value.id === "workflow-mode");
		expect(update?.[1].text).toBe("IMPLEMENT");
		expect(ctx.ui.notify).toHaveBeenCalledWith(expect.stringContaining("implement"), "info");

		await commands.get("review")!.handler("", uiCtx());
		expect(getMode()).toBe("review");
		await commands.get("plan")!.handler("", uiCtx());
		expect(getMode()).toBe("plan");
	});

	it("falls back to sendMessage for the notice when the session has no UI", async () => {
		const { commands, sent } = harness();
		await commands.get("review")!.handler("", { hasUI: false, ui: { notify: vi.fn() } });
		const notice = sent.find(([message]) => message.display === true);
		expect(notice?.[0].content).toContain("review");
	});

	it("reconstructs the last mode marker from the branch on session_start", async () => {
		const { handlers, getMode } = harness();
		const sessionStart = handlers.get("session_start")![0];
		await sessionStart({}, branchCtx([modeMarker("implement"), modeMarker("review")]));
		expect(getMode()).toBe("review");
		// No marker (or an unknown one) restores the plan default.
		await sessionStart({}, branchCtx([modeMarker("bogus")]));
		expect(getMode()).toBe("plan");
	});

	it("registers the powerbar segment on session_start, not at module init", async () => {
		const { handlers, emitted } = harness();
		expect(emitted.filter(([name]) => name === "powerbar:register-segment")).toHaveLength(0);
		await handlers.get("session_start")![0]({}, branchCtx([]));
		const registration = emitted.find(([name]) => name === "powerbar:register-segment");
		expect(registration?.[1].id).toBe("workflow-mode");
	});

	it("reconstructs on session_tree navigation as well", async () => {
		const { handlers, getMode } = harness();
		await handlers.get("session_tree")![0]({}, branchCtx([modeMarker("implement")]));
		expect(getMode()).toBe("implement");
	});
});
