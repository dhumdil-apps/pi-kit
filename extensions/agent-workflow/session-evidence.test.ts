import { describe, expect, it } from "vitest";
import { buildSessionEvidence } from "./session-evidence.js";

describe("buildSessionEvidence", () => {
	it("summarizes usage, tools, errors, and timeline text", () => {
		const evidence = buildSessionEvidence([
			{ type: "message", timestamp: "2026-01-01", message: { role: "user", content: "Fix it" } },
			{
				type: "message",
				timestamp: "2026-01-02",
				message: {
					role: "assistant",
					content: [{ type: "toolCall", name: "read", arguments: { path: "a.ts" } }],
					usage: { input: 10, output: 4, cacheRead: 7, reasoning: 2, cost: { total: 0.1 } },
				},
			},
			{ type: "message", timestamp: "2026-01-03", message: { role: "toolResult", toolName: "read", isError: true, content: "ENOENT" } },
		] as any);

		expect(evidence).toContain("toolCalls=1");
		expect(evidence).toContain("toolErrors=1");
		expect(evidence).toContain("costUsd=0.100000");
		expect(evidence).toContain("tool read");
		expect(evidence).toContain("ENOENT");
	});

	it("reports evidence truncation", () => {
		const evidence = buildSessionEvidence([
			{ type: "message", message: { role: "user", content: "x".repeat(500) } },
		] as any, { raw: true, maxCharacters: 100 });
		expect(evidence).toContain("Evidence truncated");
	});
});
