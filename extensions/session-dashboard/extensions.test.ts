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
	QUICK_REF_END,
	QUICK_REF_START,
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

	it("renders extensions, then context info, then the quick-reference marker in order", () => {
		const welcome = renderWelcomeText({
			extensionDeck: "EXTENSIONS",
			contextInfo: "~/work\n📜 AGENTS.md",
		});
		expect(welcome.startsWith("EXTENSIONS")).toBe(true);
		expect(welcome.indexOf("EXTENSIONS")).toBeLessThan(welcome.indexOf("~/work"));
		expect(welcome.indexOf("~/work")).toBeLessThan(welcome.indexOf(QUICK_REF_START));
		expect(welcome).toContain(`${QUICK_REF_START}\n${QUICK_REF_END}`);
		expect(welcome).not.toContain("Measure twice");
		expect(welcome).not.toContain("Session context");
	});

	it("places the usage chart between the extensions and the context info", () => {
		const welcome = renderWelcomeText({
			extensionDeck: "EXTENSIONS",
			contextInfo: "~/work",
			usageChart: '{"model":true}',
		});
		expect(welcome.indexOf("EXTENSIONS")).toBeLessThan(welcome.indexOf('{"model":true}'));
		expect(welcome.indexOf('{"model":true}')).toBeLessThan(welcome.indexOf("~/work"));
		expect(welcome.indexOf("~/work")).toBeLessThan(welcome.indexOf(QUICK_REF_START));
	});
});
