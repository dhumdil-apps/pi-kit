import { describe, expect, it, vi } from "vitest";

vi.mock("../../../extension-preferences/index.js", () => ({
	getSetting: (_ext: string, _id: string, defaultValue?: string) => defaultValue,
}));

import createPowerbar from "./index.js";

const theme = { fg: (_color: string, text: string) => text, getFgAnsi: () => "" } as any;

function makeFakePi() {
	const eventHandlers: Record<string, ((data: unknown) => void)[]> = {};
	const lifecycleHandlers: Record<string, (event: unknown, ctx: unknown) => Promise<void>> = {};
	const pi = {
		events: {
			on: vi.fn((event: string, handler: (data: unknown) => void) => {
				(eventHandlers[event] ??= []).push(handler);
			}),
			emit: vi.fn((event: string, data: unknown) => {
				for (const handler of eventHandlers[event] ?? []) handler(data);
			}),
		},
		on: vi.fn((event: string, handler: (event: unknown, ctx: unknown) => Promise<void>) => {
			lifecycleHandlers[event] = handler;
		}),
	};
	return { pi, lifecycleHandlers };
}

function makeCtx() {
	let widgetFactory: ((tui: unknown, theme: unknown) => { render(width: number): string[] }) | undefined;
	const ctx = {
		hasUI: true,
		ui: {
			setWidget: (_name: string, factory: typeof widgetFactory) => {
				widgetFactory = factory;
			},
			setFooter: () => {},
		},
	};
	return { ctx, getRenderedLine: () => widgetFactory?.(undefined, theme).render(80)[0] ?? "" };
}

describe("powerbar segment lifecycle", () => {
	it("clears stale segments on a new session_start instead of carrying them into the next session", async () => {
		const { pi, lifecycleHandlers } = makeFakePi();
		createPowerbar(pi as never);

		const { ctx, getRenderedLine } = makeCtx();
		await lifecycleHandlers.session_start(undefined, ctx);

		// Simulate a producer (e.g. powerbar-git) emitting for the first session.
		pi.events.emit("powerbar:update", { id: "git-branch", text: "main" });
		expect(getRenderedLine()).toContain("main");

		// A new session starts, but this producer hasn't re-emitted yet (e.g.
		// it's still resolving ctx.model, or was momentarily unavailable).
		const next = makeCtx();
		await lifecycleHandlers.session_start(undefined, next.ctx);

		expect(next.getRenderedLine()).not.toContain("main");
	});
});
