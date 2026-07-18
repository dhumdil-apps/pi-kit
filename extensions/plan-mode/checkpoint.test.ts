import { describe, expect, it, vi } from "vitest";
import { detectGit, runAcceptanceChecks, runPackageChecks } from "./checkpoint.js";

describe("checkpoint scheduling", () => {
	it("runs requested available scripts in order and stops on failure", async () => {
		const runner = vi.fn(async (_command: string, args: string[]) => ({ code: args.at(-1) === "typecheck" ? 1 : 0, stdout: "", stderr: "" }));
		const results = await runPackageChecks(runner, { lint: "lint", typecheck: "tsc", test: "test" }, ["lint", "typecheck", "test"]);
		expect(results.map((result) => result.name)).toEqual(["lint", "typecheck"]);
	});

	it("runs plan acceptance commands as targeted slice checks", async () => {
		const runner = vi.fn(async () => ({ code: 0, stdout: "ok", stderr: "" }));
		const results = await runAcceptanceChecks(runner, ["npm test -- auth", ""]);
		expect(results[0]?.name).toBe("acceptance: npm test -- auth");
		expect(runner).toHaveBeenCalledWith("sh", ["-lc", "npm test -- auth"], { timeout: 120_000 });
	});

	it("degrades cleanly when Git is unavailable", async () => {
		const runner = vi.fn(async () => ({ code: 128, stdout: "", stderr: "not a repository" }));
		expect(await detectGit(runner)).toEqual({ isGit: false });
	});
});
