import { describe, expect, it } from "vitest";
import { phaseRibbon } from "./todo-widget.js";

const theme = {
	fg: (_color: string, text: string) => text,
	bold: (text: string) => `[${text}]`,
} as any;

describe("phaseRibbon", () => {
	it.each([
		["goal", "[GOAL]  →  MEASURE TWICE  →  CUT ONCE"],
		["measure", "GOAL  →  [MEASURE TWICE]  →  CUT ONCE"],
		["cut", "GOAL  →  MEASURE TWICE  →  [CUT ONCE]"],
	] as const)("renders the %s phase with the simplified wording", (phase, expected) => {
		expect(phaseRibbon(phase, theme)).toBe(expected);
	});
});
