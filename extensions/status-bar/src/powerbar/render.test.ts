import { describe, expect, it } from "vitest";
import { renderBar, type Segment } from "./render.js";

const theme = {
	fg: (_color: string, text: string) => text,
	getFgAnsi: () => "",
} as any;

const settings = {
	left: ["branch"],
	right: ["model"],
	separator: " | ",
	placement: "belowEditor" as const,
	barWidth: 6,
	barStyle: "blocks" as const,
};

describe("status bar transient segments", () => {
	it("shows active transient segments without adding them to saved settings", () => {
		const segments = new Map<string, Segment>([
			["branch", { id: "branch", text: "main" }],
			["model", { id: "model", text: "sonnet" }],
			["flash", { id: "flash", text: "flash", icon: "⚡", transient: true }],
		]);
		expect(renderBar(segments, settings, theme, 80)).toContain("sonnet | ⚡ flash");
	});

	it("does not show an unconfigured non-transient segment", () => {
		const segments = new Map<string, Segment>([
			["branch", { id: "branch", text: "main" }],
			["model", { id: "model", text: "sonnet" }],
			["hidden", { id: "hidden", text: "hidden" }],
		]);
		expect(renderBar(segments, settings, theme, 80)).not.toContain("hidden");
	});
});
