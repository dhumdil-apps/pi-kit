import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { collectUsageData } from "./data.js";

let sessionsDir: string;

beforeEach(() => {
	sessionsDir = mkdtempSync(join(tmpdir(), "usage-history-sessions-"));
});

afterEach(() => {
	rmSync(sessionsDir, { recursive: true, force: true });
});

function writeSessionFile(name: string, sessionId: string, messageLines: string[]): void {
	const lines = [JSON.stringify({ type: "session", id: sessionId, cwd: "/tmp/project" }), ...messageLines];
	writeFileSync(join(sessionsDir, name), `${lines.join("\n")}\n`);
}

function degenerateMessageLine(): string {
	// No timestamp on the entry or the message, and an empty usage object:
	// parses to timestamp 0 and all-zero token counts — the exact shape that
	// previously collided across every file once hashed as "0:0".
	return JSON.stringify({
		type: "message",
		message: { role: "assistant", provider: "anthropic", model: "claude", usage: {} },
	});
}

describe("collectUsageData cross-file dedupe", () => {
	it("does not drop distinct degenerate (no-timestamp, zero-usage) messages from different session files", async () => {
		writeSessionFile("2024-01-01T00-00-00_session-a.jsonl", "session-a", [degenerateMessageLine()]);
		writeSessionFile("2024-01-02T00-00-00_session-b.jsonl", "session-b", [degenerateMessageLine()]);

		const result = await collectUsageData({ sessionsDir, cachePath: null, now: new Date("2024-06-01T12:00:00Z") });

		expect(result).not.toBeNull();
		expect(result!.allTime.totals.messages).toBe(2);
		expect(result!.allTime.totals.sessions).toBe(2);
	});

	it("still dedupes a genuine repeated message (same real timestamp and usage) across files", async () => {
		const realMessage = JSON.stringify({
			type: "message",
			timestamp: "2024-05-01T00:00:00.000Z",
			message: {
				role: "assistant",
				provider: "anthropic",
				model: "claude",
				usage: { cost: { total: 0.5 }, input: 100, output: 50 },
			},
		});
		writeSessionFile("2024-05-01T00-00-00_session-a.jsonl", "session-a", [realMessage]);
		writeSessionFile("2024-05-01T00-00-01_session-a-fork.jsonl", "session-a-fork", [realMessage]);

		const result = await collectUsageData({ sessionsDir, cachePath: null, now: new Date("2024-06-01T12:00:00Z") });

		expect(result).not.toBeNull();
		expect(result!.allTime.totals.messages).toBe(1);
	});
});
