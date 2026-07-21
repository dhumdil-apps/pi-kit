import { describe, expect, it } from "vitest";
import { phaseRibbon, updateTodoWidget, updateWorkflowWidget } from "./todo-widget.js";
import { TodoStateManager } from "../state-manager.js";

const theme = {
	fg: (_color: string, text: string) => text,
	bold: (text: string) => `[${text}]`,
} as any;

describe("phaseRibbon", () => {
	it.each([
		["goal", "▍ ╭─ [◉ GOAL]\n▍ ├─ ○ MEASURE TWICE\n▍ ╰─ ○ CUT ONCE"],
		["measure", "▍ ╭─ ✓ GOAL\n▍ ├─ [◉ MEASURE TWICE]\n▍ ╰─ ○ CUT ONCE"],
		["cut", "▍ ╭─ ✓ GOAL\n▍ ├─ ✓ MEASURE TWICE\n▍ ╰─ [◉ CUT ONCE]"],
	] as const)("renders the %s phase as a vertical route", (phase, expected) => {
		expect(phaseRibbon(phase, theme)).toBe(expected);
	});
});

describe("widget separation", () => {
	it("renders global workflow and local todos in separate widgets", () => {
		const state = new TodoStateManager();
		state.write([{ id: 1, title: "Implement", description: "Do it", status: "in-progress" }]);
		const calls: Array<[string, unknown]> = [];
		const ctx = { ui: { setWidget: (id: string, widget: unknown) => calls.push([id, widget]) } } as any;

		updateWorkflowWidget(state, ctx);
		updateTodoWidget(state, ctx, true);

		expect(calls.map(([id]) => id)).toEqual(["workflow-phase", "todo-list"]);
		const workflow = calls[0][1] as (tui: unknown, currentTheme: typeof theme) => { render(): string[] };
		expect(workflow(undefined, theme).render()).toEqual(["▍ ╭─ [◉ GOAL]", "▍ ├─ ○ MEASURE TWICE", "▍ ╰─ ○ CUT ONCE"]);
		const todos = calls[1][1] as (tui: unknown, currentTheme: typeof theme) => { render(): string[] };
		expect(todos(undefined, { ...theme, strikethrough: (text: string) => text }).render().join("\n")).not.toContain("GOAL");
	});

	it("clears the local widget when it is hidden", () => {
		const state = new TodoStateManager();
		const calls: Array<[string, unknown]> = [];
		const ctx = { ui: { setWidget: (id: string, widget: unknown) => calls.push([id, widget]) } } as any;

		updateTodoWidget(state, ctx, false);

		expect(calls).toEqual([["todo-list", undefined]]);
	});
});
