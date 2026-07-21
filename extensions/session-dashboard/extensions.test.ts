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
			expect(deck).toContain(`**${presentation.name}** — ${presentation.description}`);
		}
		expect(deck).not.toContain("README");
		expect(deck.indexOf("**UI**")).toBeLessThan(deck.indexOf("**Flow**"));
		expect(deck.indexOf("**Flow**")).toBeLessThan(deck.indexOf("**Config**"));
	});

	it("renders extensions, then session context, with no hero quote, ruler, or invitation", () => {
		const welcome = renderWelcomeText({
			extensionDeck: "EXTENSIONS",
			sessionContext: [
				{ label: "project", values: ["PROJECT"] },
				{ label: "resources", values: ["📜 CONTEXT", "🎓 SKILLS"] },
				{ label: "commands", values: ["⌨️ COMMANDS"] },
			],
		});
		expect(welcome.startsWith("EXTENSIONS")).toBe(true);
		expect(welcome).toContain(`${SESSION_CONTEXT_START}\nproject\tPROJECT\nresources\t📜 CONTEXT\n\t🎓 SKILLS\ncommands\t⌨️ COMMANDS\n${SESSION_CONTEXT_END}`);
		expect(welcome.indexOf("EXTENSIONS")).toBeLessThan(welcome.indexOf("PROJECT"));
		expect(welcome).not.toContain("Measure twice");
		expect(welcome).not.toContain("Describe your goal");
		expect(welcome).not.toContain("π");
	});

	it("places the usage chart between the extensions and the session context", () => {
		const welcome = renderWelcomeText({
			extensionDeck: "EXTENSIONS",
			sessionContext: [{ label: "project", values: ["PROJECT"] }],
			usageChart: '{"model":true}',
		});
		expect(welcome.indexOf("EXTENSIONS")).toBeLessThan(welcome.indexOf('{"model":true}'));
		expect(welcome.indexOf('{"model":true}')).toBeLessThan(welcome.indexOf("PROJECT"));
	});

	it("round-trips context sections with continuation values", () => {
		expect(parseSessionContext("project\t~/work main · clean\nresources\t📜 AGENTS.md\n\t🎓 simplify")).toEqual([
			{ label: "project", values: ["~/work main · clean"] },
			{ label: "resources", values: ["📜 AGENTS.md", "🎓 simplify"] },
		]);
	});
});
