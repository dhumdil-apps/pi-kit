import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cleanupWorktrees, createWorktrees, unexpectedDirtyPaths, validateAllowedDirtyPaths } from "./worktree.js";

describe("worktree active-ledger exception", () => {
	const pair = [".pi/plans/20260718-120000-000-goal.md", ".pi/plans/20260718-120000-000-goal.state.json"];

	it("allows only the exact matching ledger pair", () => {
		expect(validateAllowedDirtyPaths(pair).size).toBe(2);
		expect(() => validateAllowedDirtyPaths([pair[0]])).toThrow(/exactly one/);
		expect(() => validateAllowedDirtyPaths([pair[0], ".pi/plans/other.state.json"])).toThrow(/matching/);
		expect(() => validateAllowedDirtyPaths([pair[0], "src/app.ts"])).toThrow(/only exact/);
	});

	it("reports every non-ledger dirty path", () => {
		const status = ` M ${pair[0]}\n?? ${pair[1]}\n M src/app.ts\n?? notes.txt\n`;
		expect(unexpectedDirtyPaths(status, pair)).toEqual(["src/app.ts", "notes.txt"]);
	});

	it("creates real worktrees with only the ledger pair dirty and rejects project dirt", () => {
		const cwd = mkdtempSync(join(tmpdir(), "plan-worktree-"));
		execFileSync("git", ["init", "-q"], { cwd });
		writeFileSync(join(cwd, "README.md"), "base\n");
		execFileSync("git", ["add", "README.md"], { cwd });
		execFileSync("git", ["-c", "user.name=Plan Test", "-c", "user.email=plan@example.invalid", "commit", "-qm", "base"], { cwd });
		mkdirSync(join(cwd, ".pi", "plans"), { recursive: true });
		writeFileSync(join(cwd, pair[0]), "ledger\n");
		writeFileSync(join(cwd, pair[1]), "{}\n");
		const setup = createWorktrees(cwd, "allowed-ledger", 1, { agents: ["worker"], allowedDirtyPaths: pair });
		expect(setup.worktrees).toHaveLength(1);
		cleanupWorktrees(setup);
		writeFileSync(join(cwd, "src.ts"), "dirty\n");
		expect(() => createWorktrees(cwd, "reject-dirt", 1, { agents: ["worker"], allowedDirtyPaths: pair })).toThrow(/src\.ts/);
	});
});
