import { describe, expect, it } from "vitest";
import { updatePhaseIndicator, updateTodoWidget } from "./todo-widget.js";
import { TodoStateManager } from "../state-manager.js";

describe("phase indicator", () => {
	it.each([
		["goal", "accent", "● GOAL"],
		["planning", "accent", "● PLANNING"],
		["implementation", "accent", "● IMPLEMENTATION"],
	] as const)("renders the idle %s phase persistently", (phase, color, expected) => {
		let factory: any;
		const ctx = {
			ui: {
				setWorkingVisible: (visible: boolean) => expect(visible).toBe(false),
				setWidget: (_id: string, nextFactory: unknown) => { factory = nextFactory; },
			},
		} as any;
		const theme = { fg: (actualColor: string, text: string) => `[${actualColor}]${text}` } as any;

		updatePhaseIndicator(phase, ctx, false);

		expect(factory({ requestRender: () => {} }, theme).render(80)).toEqual([`[${color}]${expected}`]);
	});

	it.each([
		["goal", "Visioning…"],
		["planning", "Exploring…"],
		["implementation", "Implementing…"],
	] as const)("shows an accent-colored animated message while %s is working", (phase, message) => {
		let factory: any;
		const ctx = {
			ui: {
				setWorkingVisible: () => {},
				setWidget: (_id: string, nextFactory: unknown) => { factory = nextFactory; },
			},
		} as any;
		updatePhaseIndicator(phase, ctx, true);
		const component = factory({ requestRender: () => {} }, { fg: (color: string, text: string) => `[${color}]${text}` });
		expect(component.render(80)[0]).toContain(`[accent]⠋ ${message}`);
		component.dispose();
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
