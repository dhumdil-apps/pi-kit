import { describe, expect, it, vi } from "vitest";
import createTokens from "./index.js";

describe("session status segments", () => {
	it("emits active-branch token and agent counts on the session row", async () => {
		const handlers = new Map<string, (event: unknown, ctx: unknown) => Promise<void>>();
		const emit = vi.fn();
		const pi = {
			events: { emit },
			on: (event: string, handler: (event: unknown, ctx: unknown) => Promise<void>) => handlers.set(event, handler),
		};
		createTokens(pi as never);
		emit.mockClear();

		const ctx = {
			sessionManager: {
				getBranch: () => [
					{ type: "message", message: { role: "user" } },
					{
						type: "message",
						message: { role: "assistant", usage: { input: 79_000, output: 2_300, cost: { total: 0.59 } } },
					},
					{ type: "message", message: { role: "toolResult" } },
				],
			},
		};
		await handlers.get("session_start")!(undefined, ctx);

		expect(emit).toHaveBeenCalledWith("powerbar:update", {
			id: "agent-stats",
			text: "msgs 3 · user 1 · agent 1 · tools 1",
			color: "dim",
			row: 2,
		});
		expect(emit).toHaveBeenCalledWith("powerbar:update", {
			id: "tokens",
			text: "↑79k ↓2.3k $0.59",
			color: "dim",
			row: 2,
		});
	});
});
