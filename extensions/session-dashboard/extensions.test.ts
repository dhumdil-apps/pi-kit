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
import {
	DASHBOARD_INVITATION,
	HERO_QUOTE,
	RULER_END,
	RULER_START,
	SESSION_CONTEXT_END,
	SESSION_CONTEXT_START,
	parseSessionContext,
	renderWelcomeText,
} from "./welcome.js";

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
			expect(presentation.description).not.toBe("");
			expect(readFileSync(join(BUNDLE_ROOT, presentation.readme), "utf8")).not.toBe("");
			expect(deck).toContain(`**${presentation.name}** — ${presentation.description}`);
			expect(deck).toContain(`README: \`${presentation.readme}\``);
		}
		expect(deck).toContain("README paths are relative to the bundle root.");
		expect(deck.indexOf("**UI**")).toBeLessThan(deck.indexOf("**Flow**"));
		expect(deck.indexOf("**Flow**")).toBeLessThan(deck.indexOf("**Config**"));
	});

	it("renders the hero, extensions, and session context in order without a duplicate phase ribbon", () => {
		const welcome = renderWelcomeText({
			rulerPanel: "RULER PANEL",
			extensionDeck: "EXTENSIONS",
			sessionContext: [
				{ label: "project", values: ["PROJECT"] },
				{ label: "resources", values: ["📜 CONTEXT", "🎓 SKILLS"] },
				{ label: "commands", values: ["⌨️ COMMANDS"] },
			],
		});
		expect(welcome.startsWith(`${HERO_QUOTE}\n${RULER_START}`)).toBe(true);
		expect(welcome).toContain(`${RULER_START}\nRULER PANEL\n${RULER_END}`);
		expect(welcome).toContain(`${SESSION_CONTEXT_START}\nproject\tPROJECT\nresources\t📜 CONTEXT\n\t🎓 SKILLS\ncommands\t⌨️ COMMANDS\n${SESSION_CONTEXT_END}`);
		expect(welcome.indexOf("RULER PANEL")).toBeLessThan(welcome.indexOf(DASHBOARD_INVITATION));
		expect(welcome.indexOf(DASHBOARD_INVITATION)).toBeLessThan(welcome.indexOf("EXTENSIONS"));
		expect(welcome.indexOf("EXTENSIONS")).toBeLessThan(welcome.indexOf("PROJECT"));
		expect(welcome).not.toContain("GOAL (VISION)");
	});

	it("round-trips context sections with continuation values", () => {
		expect(parseSessionContext("project\t~/work main · clean\nresources\t📜 AGENTS.md\n\t🎓 simplify")).toEqual([
			{ label: "project", values: ["~/work main · clean"] },
			{ label: "resources", values: ["📜 AGENTS.md", "🎓 simplify"] },
		]);
	});
});
