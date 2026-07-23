import { describe, expect, it, vi } from "vitest";
import { runModePicker } from "./mode-picker.js";

/**
 * ctx.ui.custom is the overlay driver: each call resolves with the value the
 * SelectOverlay would pass to done(). We stub it to return a queued sequence of
 * choices, so runModePicker's step wiring is testable without a real terminal.
 */
function ctxWith(choices: (string | null)[]) {
	const calls: any[] = [];
	let index = 0;
	const custom = vi.fn(async (factory: any) => {
		// Build the component so its constructor (title/choices) is exercised.
		const theme = { fg: (_c: string, t: string) => t, bold: (t: string) => t };
		const tui = { requestRender: () => {} };
		const keybindings = { matches: () => false };
		factory(tui, theme, keybindings, () => {});
		calls.push(index);
		return choices[index++];
	});
	return { ui: { custom }, getContextUsage: () => undefined } as any;
}

describe("runModePicker", () => {
	it("returns the chosen mode and placement across both steps", async () => {
		const ctx = ctxWith(["implement", "fresh"]);
		const selection = await runModePicker(ctx, { current: "plan", usage: undefined });
		expect(selection).toEqual({ mode: "implement", placement: "fresh" });
		expect(ctx.ui.custom).toHaveBeenCalledTimes(2);
	});

	it("skips the placement step for plan (always same-session)", async () => {
		const ctx = ctxWith(["plan"]);
		const selection = await runModePicker(ctx, { current: "implement", usage: undefined });
		expect(selection).toEqual({ mode: "plan", placement: "continue" });
		expect(ctx.ui.custom).toHaveBeenCalledTimes(1);
	});

	it("skips step 1 when the mode is already known", async () => {
		const ctx = ctxWith(["continue"]);
		const selection = await runModePicker(ctx, { current: "plan", usage: undefined, mode: "implement" });
		expect(selection).toEqual({ mode: "implement", placement: "continue" });
		expect(ctx.ui.custom).toHaveBeenCalledTimes(1);
	});

	it("returns undefined when the mode step is cancelled", async () => {
		const ctx = ctxWith([null]);
		expect(await runModePicker(ctx, { current: "plan", usage: undefined })).toBeUndefined();
	});

	it("returns undefined when the placement step is cancelled", async () => {
		const ctx = ctxWith(["review", null]);
		expect(await runModePicker(ctx, { current: "plan", usage: undefined })).toBeUndefined();
	});
});
