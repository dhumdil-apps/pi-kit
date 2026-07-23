import { afterEach, describe, expect, it, vi } from "vitest";
import { updatePhaseIndicator, updateTodoWidget } from "./todo-widget.js";
import { TodoStateManager } from "../state-manager.js";

describe("phase indicator", () => {
	it.each([
		["goal", "plan", "accent", "● PLAN · GOAL"],
		["planning", "implement", "accent", "● IMPLEMENT · PLANNING"],
		["implementation", "review", "accent", "● REVIEW · IMPLEMENTATION"],
	] as const)("renders the idle %s phase with %s mode persistently", (phase, mode, color, expected) => {
		let factory: any;
		const ctx = {
			ui: {
				setWorkingVisible: (visible: boolean) => expect(visible).toBe(false),
				setWidget: (_id: string, nextFactory: unknown) => { factory = nextFactory; },
			},
		} as any;
		const theme = { fg: (actualColor: string, text: string) => `[${actualColor}]${text}` } as any;

		updatePhaseIndicator(phase, mode, ctx, false);

		expect(factory({ requestRender: () => {} }, theme).render(80)).toEqual([`[${color}]${expected}`]);
	});

	it.each([
		["plan", ["Mapping…", "Exploring…", "Framing…", "Surveying…", "Designing…", "Specifying…"]],
		["implement", ["Building…", "Wiring…", "Refining…", "Crafting…", "Testing…", "Polishing…"]],
		["review", ["Auditing…", "Probing…", "Verifying…", "Inspecting…", "Challenging…", "Confirming…"]],
	] as const)("rotates the approved %s activity messages while working", (mode, messages) => {
		vi.useFakeTimers();
		let factory: any;
		const ctx = {
			ui: {
				setWorkingVisible: () => {},
				setWidget: (_id: string, nextFactory: unknown) => { factory = nextFactory; },
			},
		} as any;
		updatePhaseIndicator("implementation", mode, ctx, true);
		const component = factory({ requestRender: () => {} }, { fg: (color: string, text: string) => `[${color}]${text}` });
		for (const message of messages) {
			expect(component.render(80)[0]).toContain(`${mode.toUpperCase()} · ${message}`);
			vi.advanceTimersByTime(12 * 120);
		}
		component.dispose();
	});

	afterEach(() => vi.useRealTimers());
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
