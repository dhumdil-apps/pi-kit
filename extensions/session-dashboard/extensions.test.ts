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
import { USAGE_CHART_END, USAGE_CHART_START, renderWelcomeText } from "./welcome.js";

const BUNDLE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

function activeExtensionNames(): string[] {
	const pkg = JSON.parse(readFileSync(join(BUNDLE_ROOT, "package.json"), "utf8"));
	return pkg.pi.extensions.map((entry: string) => entry.split("/").filter(Boolean).at(-2));
}

describe("session dashboard extension metadata", () => {
	it("has presentation metadata for exactly the active manifest extensions", () => {
		const names = activeExtensionNames();
		expect(presentationCoverageErrors(names)).toEqual([]);
		expect(EXTENSION_PRESENTATIONS.map((presentation) => presentation.name).sort()).toEqual([...names].sort());
	});

	it("renders each active extension under its group, in group order, without prose", () => {
		const names = activeExtensionNames();
		const deck = renderExtensionDeck(names);
		for (const group of EXTENSION_GROUPS) expect(deck).toContain(`**${group.title}**`);
		for (const presentation of EXTENSION_PRESENTATIONS) {
			expect(presentation.description).not.toBe("");
			expect(deck).toContain(presentation.name);
		}
		expect(deck).not.toContain("README");
		// Compact deck: names only, no per-extension prose descriptions.
		expect(deck).not.toContain(" — ");
		expect(deck.indexOf("**Display**")).toBeLessThan(deck.indexOf("**Usage**"));
		expect(deck.indexOf("**Usage**")).toBeLessThan(deck.indexOf("**Workflow**"));
		expect(deck.indexOf("**Workflow**")).toBeLessThan(deck.indexOf("**Config**"));
	});

	it("renders context and hints without a footer when omitted", () => {
		const welcome = renderWelcomeText({
			contextInfo: "~/work\n📜 AGENTS.md\n❓ `/help`",
			tip: "⌘ Workflow\n⚡ Raw Pi",
		});
		expect(welcome.startsWith("~/work")).toBe(true);
		expect(welcome.indexOf("❓ `/help`")).toBeLessThan(welcome.indexOf("⌘ Workflow"));
		expect(welcome.indexOf("⌘ Workflow")).toBeLessThan(welcome.indexOf("⚡ Raw Pi"));
		expect(welcome.trimEnd()).toBe("~/work\n📜 AGENTS.md\n❓ `/help`\n\n⌘ Workflow\n⚡ Raw Pi");
		expect(welcome).not.toContain("🧩 **Extensions**");
		expect(welcome).not.toContain("Session context");
		expect(welcome).not.toContain("Quick reference");
	});

	it("places the usage chart before the context without a footer", () => {
		const welcome = renderWelcomeText({
			contextInfo: "~/work",
			usageChart: '{"model":true}',
		});
		expect(welcome.indexOf('{"model":true}')).toBeLessThan(welcome.indexOf("~/work"));
		expect(welcome.trimEnd()).toBe(`${USAGE_CHART_START}\n{"model":true}\n${USAGE_CHART_END}\n\n~/work`);
	});
});
