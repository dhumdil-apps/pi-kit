import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FetchResult, UsageSnapshot } from "./types.js";

let agentDir: string;

vi.mock("@earendil-works/pi-coding-agent", () => ({
	getAgentDir: () => agentDir,
}));

function makeSnapshot(usedPercent: number): UsageSnapshot {
	return { provider: "anthropic", displayName: "Claude Plan", windows: [{ label: "5h", usedPercent }] };
}

beforeEach(() => {
	agentDir = mkdtempSync(join(tmpdir(), "usage-monitor-cache-"));
	// cache.ts computes its file paths from getAgentDir() once at module load;
	// reset the module registry so each test's fresh import picks up its own
	// tmpdir instead of reusing the path baked in by an earlier test's import.
	vi.resetModules();
});

afterEach(() => {
	rmSync(agentDir, { recursive: true, force: true });
});

describe("fetchWithCache force", () => {
	it("without force, returns the cached snapshot and never calls fetchFn again within the TTL", async () => {
		const { fetchWithCache } = await import("./cache.js");
		const fetchFn = vi.fn(async (): Promise<FetchResult> => ({ usage: makeSnapshot(10) }));

		await fetchWithCache("anthropic", 60_000, fetchFn);
		const second = await fetchWithCache("anthropic", 60_000, fetchFn);

		expect(fetchFn).toHaveBeenCalledTimes(1);
		expect(second?.windows[0]?.usedPercent).toBe(10);
	});

	it("with force:true, calls fetchFn again even though the cached entry is still fresh", async () => {
		const { fetchWithCache } = await import("./cache.js");
		let call = 0;
		const fetchFn = vi.fn(async (): Promise<FetchResult> => ({ usage: makeSnapshot(++call * 10) }));

		const first = await fetchWithCache("anthropic", 60_000, fetchFn);
		const forced = await fetchWithCache("anthropic", 60_000, fetchFn, true);

		expect(fetchFn).toHaveBeenCalledTimes(2);
		expect(first?.windows[0]?.usedPercent).toBe(10);
		expect(forced?.windows[0]?.usedPercent).toBe(20);
	});
});
