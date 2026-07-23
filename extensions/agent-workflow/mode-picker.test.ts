import { describe, expect, it, vi } from "vitest";
import { runModePicker, runPlacementPicker } from "./mode-picker.js";

/**
 * ctx.ui.custom is the overlay driver: each call resolves with the value the
 * SelectOverlay would pass to done(). We stub it to return a queued sequence of
 * choices, so runModePicker's step wiring is testable without a real terminal.
 */
function ctxWith(choices: (string | null)[]) {
	const specs: any[] = [];
	let index = 0;
	const custom = vi.fn(async (factory: any) => {
		// Build the component so its constructor (title/choices) is exercised, and
		// keep the spec it was built from to assert labels and the default selection.
		const theme = { fg: (_c: string, t: string) => t, bold: (t: string) => t };
		const tui = { requestRender: () => {} };
		const keybindings = { matches: () => false };
		specs.push(factory(tui, theme, keybindings, () => {}).spec);
		return choices[index++];
	});
	return { ui: { custom }, getContextUsage: () => undefined, specs } as any;
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

describe("runPlacementPicker", () => {
	const lean = { tokens: 40_000, contextWindow: 1_000_000, percent: 4 } as any;
	const loaded = { tokens: 140_000, contextWindow: 1_000_000, percent: 14 } as any;

	it("names the mode in the continue label and offers a new session", async () => {
		const ctx = ctxWith(["continue"]);
		expect(await runPlacementPicker(ctx, { mode: "implement", usage: lean })).toBe("continue");
		expect(ctx.specs[0].choices.map((c: any) => c.label)).toEqual(["Continue with implementation", "Proceed in a new session"]);

		const review = ctxWith(["fresh"]);
		await runPlacementPicker(review, { mode: "review", usage: lean });
		expect(review.specs[0].choices[0].label).toBe("Continue with review");
	});

	it("recommends continuing on a lean context and handing off on a loaded one", async () => {
		const leanCtx = ctxWith(["continue"]);
		await runPlacementPicker(leanCtx, { mode: "implement", usage: lean });
		expect(leanCtx.specs[0].initialIndex).toBe(0);
		expect(leanCtx.specs[0].choices[0].badge).toBe("recommended");

		const loadedCtx = ctxWith(["fresh"]);
		await runPlacementPicker(loadedCtx, { mode: "implement", usage: loaded });
		expect(loadedCtx.specs[0].initialIndex).toBe(1);
		expect(loadedCtx.specs[0].choices[1].badge).toBe("recommended");
	});

	it("adds Reject only for the automatic offer", async () => {
		const plain = ctxWith(["continue"]);
		await runPlacementPicker(plain, { mode: "implement", usage: lean });
		expect(plain.specs[0].choices).toHaveLength(2);

		const offer = ctxWith(["reject"]);
		expect(await runPlacementPicker(offer, { mode: "implement", usage: lean, withReject: true })).toBe("reject");
		expect(offer.specs[0].choices[2].label).toBe("Reject");
	});
});
