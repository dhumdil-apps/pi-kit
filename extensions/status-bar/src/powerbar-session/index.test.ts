import { describe, expect, it, vi } from "vitest";
import createSessionName from "./index.js";

describe("session-name display", () => {
	it("shows the existing session name at startup", async () => {
		const handlers = new Map<string, (event: any) => Promise<void>>();
		const emit = vi.fn();
		const pi = {
			events: { emit },
			on: (event: string, handler: (event: any) => Promise<void>) => handlers.set(event, handler),
			getSessionName: () => "SI-42-cache-recovery",
		};
		createSessionName(pi as never);
		emit.mockClear();

		await handlers.get("session_start")!(undefined);

		expect(emit).toHaveBeenLastCalledWith("powerbar:update", {
			id: "session-name",
			text: "SI-42-cache-recovery",
			color: "accent",
			row: 1,
		});
	});

	it("updates when task management changes the session name", async () => {
		const handlers = new Map<string, (event: any) => Promise<void>>();
		const emit = vi.fn();
		const pi = {
			events: { emit },
			on: (event: string, handler: (event: any) => Promise<void>) => handlers.set(event, handler),
			getSessionName: () => undefined,
		};
		createSessionName(pi as never);
		emit.mockClear();

		await handlers.get("session_info_changed")!({ name: "SI-0000-dashboard-polish" });

		expect(emit).toHaveBeenLastCalledWith(
			"powerbar:update",
			expect.objectContaining({ text: "SI-0000-dashboard-polish" }),
		);
	});
});
