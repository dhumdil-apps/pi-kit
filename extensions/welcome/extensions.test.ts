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

const BUNDLE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

function activeExtensionNames(): string[] {
	const pkg = JSON.parse(readFileSync(join(BUNDLE_ROOT, "package.json"), "utf8"));
	return pkg.pi.extensions.map((entry: string) => entry.split("/").filter(Boolean).at(-2));
}

describe("welcome extension deck", () => {
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
		expect(deck.indexOf("**Session**")).toBeLessThan(deck.indexOf("**Progress & usage**"));
		expect(deck.indexOf("**Progress & usage**")).toBeLessThan(deck.indexOf("**Safety**"));
		expect(deck.indexOf("**Safety**")).toBeLessThan(deck.indexOf("**Workflow & setup**"));
	});
});
