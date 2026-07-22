import { describe, expect, it } from "vitest";
import { buildSessionEvidence } from "./session-evidence.js";

describe("buildSessionEvidence", () => {
	function metricsBlock(evidence: string): string {
		return evidence.match(/<tool_output_metrics[\s\S]*?<\/tool_output_metrics>/)?.[0] ?? "";
	}

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
		expect(evidence).toContain('unit="text-characters"');
		expect(evidence).toContain("results=1 chars=6 images=0 errors=1");
		expect(evidence).toContain("tool read");
		expect(evidence).toContain("ENOENT");
	});

	it("aggregates text, images, errors, tools, and the three largest results", () => {
		const secret = "PRIVATE-OUTPUT";
		const evidence = buildSessionEvidence([
			{
				type: "message",
				message: {
					role: "assistant",
					content: [{ type: "toolCall", name: "read", arguments: { path: "/private/file" } }],
					usage: { cost: {} },
				},
			},
			{
				type: "message",
				message: {
					role: "toolResult",
					toolName: "read",
					isError: false,
					content: [{ type: "text", text: secret }, { type: "image", data: "base64-data" }, { type: "text", text: "ok" }],
				},
			},
			{ type: "message", message: { role: "toolResult", toolName: "bash", isError: true, content: "1234567890" } },
			{ type: "message", message: { role: "toolResult", toolName: "read", isError: false, content: "12345" } },
			{ type: "message", message: { role: "toolResult", toolName: "grep", isError: false, content: "x" } },
		] as any);

		const metrics = metricsBlock(evidence);
		expect(metrics).toContain("results=4 chars=32 images=1 errors=1");
		expect(metrics).toContain("read(results=2,chars=21,max=16,images=1,errors=0)");
		expect(metrics).toContain("bash(results=1,chars=10,max=10,images=0,errors=1)");
		expect(metrics).toContain("largest=read:16; bash:10; read:5");
		expect(metrics).not.toContain(secret);
		expect(metrics).not.toContain("/private/file");
		expect(metrics).not.toContain("base64-data");
	});

	it("marks only materially large or concentrated output", () => {
		const normal = buildSessionEvidence([
			{ type: "message", message: { role: "toolResult", toolName: "read", content: "a".repeat(9_999) } },
			{ type: "message", message: { role: "toolResult", toolName: "bash", content: "b".repeat(9_999) } },
		] as any);
		expect(metricsBlock(normal)).toContain('material="false"');

		const singleLarge = buildSessionEvidence([
			{ type: "message", message: { role: "toolResult", toolName: "read", content: "a".repeat(20_000) } },
		] as any);
		expect(metricsBlock(singleLarge)).toContain('material="true"');

		const concentrated = buildSessionEvidence([
			{ type: "message", message: { role: "toolResult", toolName: "read", content: "a".repeat(14_000) } },
			{ type: "message", message: { role: "toolResult", toolName: "bash", content: "b".repeat(6_000) } },
		] as any);
		expect(metricsBlock(concentrated)).toContain('material="true"');

		const sessionLarge = buildSessionEvidence([
			{ type: "message", message: { role: "toolResult", toolName: "read", content: "a".repeat(50_000) } },
			{ type: "message", message: { role: "toolResult", toolName: "bash", content: "b".repeat(50_000) } },
		] as any);
		expect(metricsBlock(sessionLarge)).toContain('material="true"');
	});

	it("reports evidence truncation", () => {
		const evidence = buildSessionEvidence([
			{ type: "message", message: { role: "user", content: "x".repeat(500) } },
		] as any, { raw: true, maxCharacters: 100 });
		expect(evidence).toContain("omitted");
		expect(evidence).toContain("<tool_output_metrics");
		expect(evidence).toContain("</tool_output_metrics>");
	});

	it("keeps the newest entries and drops the oldest when truncating, not the reverse", () => {
		// This evidence exists to answer "what just happened" for /retro and
		// /forensic — dropping the most recent activity to keep ancient history
		// would defeat the point.
		const evidence = buildSessionEvidence(
			[
				{ type: "message", timestamp: "2026-01-01", message: { role: "user", content: "OLDEST-MARKER".repeat(20) } },
				{ type: "message", timestamp: "2026-01-02", message: { role: "user", content: "middle ".repeat(20) } },
				{ type: "message", timestamp: "2026-01-03", message: { role: "user", content: "NEWEST-MARKER".repeat(20) } },
			] as any,
			{ raw: true, maxCharacters: 500 },
		);

		expect(evidence).toContain("NEWEST-MARKER");
		expect(evidence).not.toContain("OLDEST-MARKER");
	});
});
