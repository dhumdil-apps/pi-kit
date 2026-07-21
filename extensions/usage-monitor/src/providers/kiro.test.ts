import { describe, expect, it, vi } from "vitest";
import type { Dependencies } from "../types.js";
import { KiroProvider } from "./kiro.js";

function makeDeps(execFileSync: Dependencies["execFileSync"]): Dependencies {
	return {
		fetch: vi.fn() as unknown as typeof globalThis.fetch,
		readFile: () => undefined,
		fileExists: () => false,
		execFileSync,
		homedir: () => "/home/test",
		env: {},
	};
}

const provider = new KiroProvider();

describe("KiroProvider.fetchUsage", () => {
	it("reports FETCH_FAILED (not NOT_LOGGED_IN) when whoami times out", async () => {
		const execFileSync = vi.fn((file: string, args: string[]) => {
			if (file === "which") return "/usr/local/bin/kiro-cli";
			if (args[0] === "whoami") {
				const err = new Error("timed out") as NodeJS.ErrnoException;
				err.code = "ETIMEDOUT";
				throw err;
			}
			throw new Error("unexpected call");
		}) as unknown as Dependencies["execFileSync"];

		const result = await provider.fetchUsage(makeDeps(execFileSync));
		expect(result.usage.error?.code).toBe("FETCH_FAILED");
	});

	it("still reports NOT_LOGGED_IN for a genuine (non-timeout) whoami failure", async () => {
		const execFileSync = vi.fn((file: string, args: string[]) => {
			if (file === "which") return "/usr/local/bin/kiro-cli";
			if (args[0] === "whoami") {
				throw new Error("exit code 1");
			}
			throw new Error("unexpected call");
		}) as unknown as Dependencies["execFileSync"];

		const result = await provider.fetchUsage(makeDeps(execFileSync));
		expect(result.usage.error?.code).toBe("NOT_LOGGED_IN");
	});

	it("reports FETCH_FAILED instead of a misleading 0% when the usage output format is unrecognized", async () => {
		const execFileSync = vi.fn((file: string, args: string[]) => {
			if (file === "which") return "/usr/local/bin/kiro-cli";
			if (args[0] === "whoami") return "logged in as test@example.com";
			if (args[0] === "chat") return "some entirely reformatted CLI output with no known markers";
			throw new Error("unexpected call");
		}) as unknown as Dependencies["execFileSync"];

		const result = await provider.fetchUsage(makeDeps(execFileSync));
		expect(result.usage.error?.code).toBe("FETCH_FAILED");
	});

	it("still parses a well-formed usage output", async () => {
		const execFileSync = vi.fn((file: string, args: string[]) => {
			if (file === "which") return "/usr/local/bin/kiro-cli";
			if (args[0] === "whoami") return "logged in as test@example.com";
			if (args[0] === "chat") return "████████░░ 42% (42.0 of 100 covered in plan) resets on 12/31";
			throw new Error("unexpected call");
		}) as unknown as Dependencies["execFileSync"];

		const result = await provider.fetchUsage(makeDeps(execFileSync));
		expect(result.usage.error).toBeUndefined();
		expect(result.usage.windows[0]?.usedPercent).toBe(42);
	});
});
