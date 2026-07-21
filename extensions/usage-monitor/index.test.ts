import { beforeEach, describe, expect, it, vi } from "vitest";

const cachedUsage = {
	provider: "codex",
	displayName: "Codex",
	windows: [{ label: "5h", usedPercent: 12 }],
};
const refreshedUsage = {
	provider: "codex",
	displayName: "Codex",
	windows: [{ label: "5h", usedPercent: 20 }],
};

const { getGoodUsage, fetchWithCache } = vi.hoisted(() => ({
	getGoodUsage: vi.fn(),
	fetchWithCache: vi.fn(),
}));
vi.mock("./src/cache.js", () => ({
	getGoodUsage,
	fetchWithCache,
	watchCache: vi.fn(() => () => {}),
}));
vi.mock("./src/registry.js", () => ({
	hasCredentials: vi.fn(() => true),
	createProvider: vi.fn(() => ({ fetchUsage: vi.fn() })),
}));

import createUsageMonitor from "./index.js";

function makeFakePi() {
	const handlers = new Map<string, (event: unknown, ctx: any) => Promise<void>>();
	const commands = new Map<string, { handler: (args: string, ctx: any) => Promise<void> }>();
	const emitted: Array<[string, any]> = [];
	return {
		pi: {
			on: (event: string, handler: (event: unknown, ctx: any) => Promise<void>) => handlers.set(event, handler),
			registerCommand: (name: string, command: { handler: (args: string, ctx: any) => Promise<void> }) => commands.set(name, command),
			events: { emit: (event: string, payload: unknown) => emitted.push([event, payload]) },
		},
		handlers,
		commands,
		emitted,
	};
}

const codexCtx = { model: { provider: "openai-codex", id: "gpt-5.6-sol" } };

describe("usage monitor model switches", () => {
	beforeEach(() => {
		getGoodUsage.mockReset();
		fetchWithCache.mockReset();
	});

	it("restores cached usage at startup without a network refresh", async () => {
		getGoodUsage.mockReturnValue(cachedUsage);
		const { pi, handlers, emitted } = makeFakePi();
		createUsageMonitor(pi as never, {} as never);

		await handlers.get("session_start")?.({}, codexCtx);

		expect(getGoodUsage).toHaveBeenCalledWith("codex", Number.POSITIVE_INFINITY);
		expect(fetchWithCache).not.toHaveBeenCalled();
		expect(emitted).toContainEqual([
			"usage-core:ready",
			{ state: { provider: "codex", usage: cachedUsage } },
		]);
		await handlers.get("session_shutdown")?.({}, codexCtx);
	});

	it("refreshes quota only through the usage-refresh command", async () => {
		getGoodUsage.mockReturnValue(cachedUsage);
		fetchWithCache.mockResolvedValue(refreshedUsage);
		const { pi, commands, handlers } = makeFakePi();
		createUsageMonitor(pi as never, {} as never);

		await commands.get("usage-refresh")?.handler("", codexCtx);

		expect(fetchWithCache).toHaveBeenCalledWith("codex", 60_000, expect.any(Function), true);
		await handlers.get("session_shutdown")?.({}, codexCtx);
	});

	it("force-refreshes quota on model changes", async () => {
		getGoodUsage.mockReturnValue(cachedUsage);
		fetchWithCache.mockResolvedValue(refreshedUsage);
		const { pi, handlers, emitted } = makeFakePi();
		createUsageMonitor(pi as never, {} as never);

		await handlers.get("model_select")?.({}, codexCtx);

		expect(fetchWithCache).toHaveBeenCalledWith("codex", 60_000, expect.any(Function), true);
		expect(emitted).toContainEqual([
			"usage-core:update-current",
			{ state: { provider: "codex", usage: refreshedUsage } },
		]);
		await handlers.get("session_shutdown")?.({}, codexCtx);
	});
});
