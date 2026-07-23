import { afterEach, describe, expect, it, vi } from "vitest";
import { contextUsageText, updatePhaseIndicator, updateTodoWidget } from "./todo-widget.js";
import { TodoStateManager } from "../state-manager.js";

const theme = { fg: (color: string, text: string) => `[${color}]${text}` } as any;

describe("phase indicator", () => {
	it.each([
		["goal", "plan", "accent", "● PLAN"],
		["planning", "implement", "accent", "● IMPLEMENT · PLANNING"],
		["implementation", "implement", "accent", "● IMPLEMENT · IMPLEMENTATION"],
	] as const)("renders the idle %s phase with %s mode persistently", (phase, mode, color, expected) => {
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

	it("appends the context readout to the idle indicator", () => {
		let factory: any;
		const ctx = {
			ui: {
				setWorkingVisible: () => {},
				setWidget: (_id: string, nextFactory: unknown) => { factory = nextFactory; },
			},
		} as any;

		updatePhaseIndicator("planning", "implement", ctx, false, { tokens: 84_000, contextWindow: 1_000_000, percent: 8.4 } as any);
		expect(factory({ requestRender: () => {} }, theme).render(120)).toEqual([
			"[accent]● IMPLEMENT · PLANNING · [accent]ctx [accent]█[dim]░░░ [accent]84.0k / 1.0M",
		]);

		// The goal phase stays label-free, and the working row is unchanged.
		updatePhaseIndicator("goal", "plan", ctx, false, { tokens: 84_000, contextWindow: 1_000_000, percent: 8.4 } as any);
		expect(factory({ requestRender: () => {} }, theme).render(120)[0]).toContain("[accent]● PLAN · [accent]ctx");
	});

	it("keeps the context readout on the working spinner line", () => {
		let factory: any;
		const ctx = {
			ui: {
				setWorkingVisible: () => {},
				setWidget: (_id: string, nextFactory: unknown) => { factory = nextFactory; },
			},
		} as any;

		updatePhaseIndicator("implementation", "implement", ctx, true, { tokens: 84_000, contextWindow: 1_000_000, percent: 8.4 } as any);
		const line = factory({ requestRender: () => {} }, theme).render(120)[0];
		// The spinner and activity stay, and ctx is appended rather than dropped.
		expect(line).toContain("IMPLEMENT · ");
		expect(line).toContain("ctx [accent]█[dim]░░░ [accent]84.0k / 1.0M");
	});

	it.each([
		["plan", ["Mapping…", "Exploring…", "Framing…", "Surveying…", "Designing…", "Specifying…"]],
		["implement", ["Building…", "Wiring…", "Refining…", "Crafting…", "Testing…", "Polishing…"]],
	] as const)("changes the active %s activity every 10 seconds without repeating it", (mode, messages) => {
		vi.useFakeTimers();
		vi.spyOn(Math, "random").mockReturnValue(0);
		let factory: any;
		const requestRender = vi.fn();
		const ctx = {
			ui: {
				setWorkingVisible: () => {},
				setWidget: (_id: string, nextFactory: unknown) => { factory = nextFactory; },
			},
		} as any;
		updatePhaseIndicator("implementation", mode, ctx, true);
		const component = factory({ requestRender }, { fg: (color: string, text: string) => `[${color}]${text}` });

		expect(component.render(80)[0]).toContain(`${mode.toUpperCase()} · ${messages[0]}`);
		vi.advanceTimersByTime(9_999);
		expect(component.render(80)[0]).toContain(`${mode.toUpperCase()} · ${messages[0]}`);
		const rendersBeforeChange = requestRender.mock.calls.length;
		vi.advanceTimersByTime(1);
		expect(component.render(80)[0]).toContain(`${mode.toUpperCase()} · ${messages[1]}`);
		expect(requestRender).toHaveBeenCalledTimes(rendersBeforeChange + 1);
		component.dispose();
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
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
});
