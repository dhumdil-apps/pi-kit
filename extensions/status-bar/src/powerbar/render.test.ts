import { visibleWidth } from "@earendil-works/pi-tui";
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
		expect(renderBar(segments, settings, theme, 80)[0]).toContain("sonnet | ⚡ flash");
	});

	it("does not show an unconfigured non-transient segment", () => {
		const segments = new Map<string, Segment>([
			["branch", { id: "branch", text: "main" }],
			["model", { id: "model", text: "sonnet" }],
			["hidden", { id: "hidden", text: "hidden" }],
		]);
		expect(renderBar(segments, settings, theme, 80).join("\n")).not.toContain("hidden");
	});

	it("renders identity, session, and system segments on independently aligned rows", () => {
		const segments = new Map<string, Segment>([
			["session", { id: "session", text: "SI-1234-status-layout", row: 1 }],
			["branch", { id: "branch", text: "main", row: 1 }],
			["tokens", { id: "tokens", text: "↑79k ↓2.3k $0.59", row: 2 }],
			["agent", { id: "agent", text: "msgs 9 · user 2 · agent 3 · tools 4", row: 2 }],
			["cpu", { id: "cpu", text: "cpu", bar: 10, suffix: "10%", row: 3 }],
			["net", { id: "net", text: "net ↓1G ↑2G", row: 3 }],
			["model", { id: "model", text: "sonnet · high", row: 1 }],
			["context", { id: "context", text: "ctx", bar: 10, suffix: "10%", row: 2 }],
			["quota", { id: "quota", text: "5h", bar: 20, suffix: "20%", row: 3 }],
		]);
		const lines = renderBar(
			segments,
			{
				...settings,
				left: ["session", "branch", "agent", "context", "tokens", "cpu", "net"],
				right: ["model", "quota"],
			},
			theme,
			100,
		);

		expect(lines).toHaveLength(3);
		expect(lines[0]).toContain("SI-1234-status-layout | main");
		expect(lines[0]).toContain("sonnet · high");
		expect(lines[1]).toContain("msgs 9 · user 2 · agent 3 · tools 4 | ctx");
		expect(lines[1]).toMatch(/ctx.*10% \| ↑79k ↓2\.3k \$0\.59/);
		expect(lines[2]).toContain("cpu");
		expect(lines[2]).toContain("net ↓1G ↑2G");
		expect(lines[2]).toContain("5h");
		expect(lines.every((line) => visibleWidth(line) === 100)).toBe(true);
	});
});
