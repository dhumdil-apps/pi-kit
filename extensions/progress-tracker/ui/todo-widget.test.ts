import { describe, expect, it } from "vitest";
import { contextUsageText, updatePhaseIndicator, updateTodoWidget } from "./todo-widget.js";
import { TodoStateManager } from "../state-manager.js";

const theme = { fg: (color: string, text: string) => `[${color}]${text}` } as any;

describe("phase indicator", () => {
	it.each([
		["goal", "plan", "accent", "› PLAN"],
		["planning", "implement", "accent", "› IMPLEMENT"],
		["implementation", "implement", "accent", "› IMPLEMENT"],
	] as const)("renders the %s phase as a stable %s mode indicator", (phase, mode, color, expected) => {
		let factory: any;
		const ctx = {
			ui: {
				setWorkingVisible: (visible: boolean) => expect(visible).toBe(false),
				setWidget: (_id: string, nextFactory: unknown) => { factory = nextFactory; },
			},
		} as any;

		updatePhaseIndicator(phase, mode, ctx, false);

		expect(factory({ requestRender: () => {} }, theme).render(80)).toEqual([`[${color}]${expected}`]);
	});

	it.each([
		[{ tokens: 84_000, contextWindow: 1_000_000, percent: 8.4 }, "[accent]ctx [accent]█[dim]░░░ [accent]84.0k / 1.0M"],
		[{ tokens: 940, contextWindow: 200_000, percent: 0.47 }, "[accent]ctx [accent]█[dim]░░░ [accent]940 / 200.0k"],
		[{ tokens: 0, contextWindow: 200_000, percent: 0 }, "[accent]ctx [accent][dim]░░░░ [accent]0 / 200.0k"],
		[{ tokens: 140_000, contextWindow: 200_000, percent: 70 }, "[warning]ctx [warning]███[dim]░ [warning]140.0k / 200.0k"],
		[{ tokens: 180_000, contextWindow: 200_000, percent: 90 }, "[error]ctx [error]████[dim] [error]180.0k / 200.0k"],
		// Absolute thresholds trip on a wide window long before the fill ratio does.
		[{ tokens: 120_000, contextWindow: 1_000_000, percent: 12 }, "[warning]ctx [warning]█[dim]░░░ [warning]120.0k / 1.0M"],
		[{ tokens: 250_000, contextWindow: 1_000_000, percent: 25 }, "[error]ctx [error]█[dim]░░░ [error]250.0k / 1.0M"],
	])("renders the context readout with a usage-colored bar (%o)", (usage, expected) => {
		expect(contextUsageText(usage as any, theme)).toBe(expected);
	});

	it("omits the context readout while the token count is unknown", () => {
		expect(contextUsageText(undefined, theme)).toBeUndefined();
		expect(contextUsageText({ tokens: null, contextWindow: 200_000, percent: null } as any, theme)).toBeUndefined();
		expect(contextUsageText({ tokens: 10, contextWindow: 0, percent: null } as any, theme)).toBeUndefined();
	});

	it("renders the same context readout while working without activity or phase text", () => {
		let factory: any;
		const ctx = {
			ui: {
				setWorkingVisible: () => {},
				setWidget: (_id: string, nextFactory: unknown) => { factory = nextFactory; },
			},
		} as any;

		updatePhaseIndicator("implementation", "implement", ctx, true, { tokens: 84_000, contextWindow: 1_000_000, percent: 8.4 } as any);
		const line = factory({ requestRender: () => {} }, theme).render(120)[0];
		expect(line).toBe("[accent]› IMPLEMENT · [accent]ctx [accent]█[dim]░░░ [accent]84.0k / 1.0M");
		expect(line).not.toContain("Building…");
		expect(line).not.toContain("IMPLEMENTATION");
	});
});

describe("todo widget", () => {
	it("clears the local widget when it is hidden", () => {
		const state = new TodoStateManager();
		const calls: Array<[string, unknown]> = [];
		const ctx = { ui: { setWidget: (id: string, widget: unknown) => calls.push([id, widget]) } } as any;

		updateTodoWidget(state, ctx, false);

		expect(calls).toEqual([["todo-list", undefined]]);
	});

	it("renders todo rows without a duplicated progress header", () => {
		const state = new TodoStateManager();
		state.write([{ id: 1, title: "Remove header", description: "Keep the row", status: "in-progress" }]);
		let factory: any;
		const ctx = { ui: { setWidget: (_id: string, widget: unknown) => { factory = widget; } } } as any;

		updateTodoWidget(state, ctx, true);

		const lines = factory({}, theme).render();
		expect(lines).toEqual(["[accent]▍ [warning]› [accent]1. [warning]Remove header"]);
		expect(lines.join("\n")).not.toContain("Todo List");
		expect(lines.join("\n")).not.toContain("1/1");
	});
});
