import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
	EXTENSION_GROUPS,
	EXTENSION_PRESENTATIONS,
	presentationCoverageErrors,
	renderExtensionDeck,
} from "./extensions.js";
import { DASHBOARD_INVITATION, renderWelcomeText } from "./welcome.js";

const BUNDLE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

function activeExtensionNames(): string[] {
	const pkg = JSON.parse(readFileSync(join(BUNDLE_ROOT, "package.json"), "utf8"));
	return pkg.pi.extensions.map((entry: string) => entry.split("/").filter(Boolean).at(-2));
}

describe("session dashboard extension deck", () => {
	it("has presentation metadata for exactly the active manifest extensions", () => {
		const names = activeExtensionNames();
		expect(presentationCoverageErrors(names)).toEqual([]);
		expect(EXTENSION_PRESENTATIONS.map((presentation) => presentation.name).sort()).toEqual([...names].sort());
	});

	it("renders every extension in its configured group and order", () => {
		const names = activeExtensionNames();
		const deck = renderExtensionDeck(names);
		for (const group of EXTENSION_GROUPS) expect(deck).toContain(`**${group.title}**`);
		for (const presentation of EXTENSION_PRESENTATIONS) {
			expect(deck).toContain(`**${presentation.name}** — ${presentation.description}`);
		}
		expect(deck.indexOf("**UI**")).toBeLessThan(deck.indexOf("**Flow**"));
		expect(deck.indexOf("**Flow**")).toBeLessThan(deck.indexOf("**Config**"));
	});

	it("renders the dashboard in reference-to-invitation order without a duplicate phase ribbon", () => {
		const welcome = renderWelcomeText({
			panel: "PROJECT PANEL",
			sections: ["CONTEXT", "SKILLS"],
			extensionDeck: "EXTENSIONS",
		});
		expect(welcome).toContain("```\nPROJECT PANEL\n```");
		expect(welcome.indexOf("CONTEXT")).toBeLessThan(welcome.indexOf("EXTENSIONS"));
		expect(welcome.indexOf("EXTENSIONS")).toBeLessThan(welcome.indexOf("⌨️"));
		expect(welcome.indexOf("⌨️")).toBeLessThan(welcome.indexOf(DASHBOARD_INVITATION));
		expect(welcome.endsWith(DASHBOARD_INVITATION)).toBe(true);
		expect(welcome).not.toContain("GOAL (VISION)");
	});
});
