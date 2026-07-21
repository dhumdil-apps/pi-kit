import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getGitBranch } from "./index.js";

let root: string;

beforeEach(() => {
	root = mkdtempSync(join(tmpdir(), "powerbar-git-"));
});

afterEach(() => {
	rmSync(root, { recursive: true, force: true });
});

describe("getGitBranch", () => {
	it("reads a named branch from a normal .git directory", () => {
		mkdirSync(join(root, ".git"));
		writeFileSync(join(root, ".git", "HEAD"), "ref: refs/heads/main\n");
		expect(getGitBranch(root)).toBe("main");
	});

	it("shows a short hash for a detached HEAD", () => {
		mkdirSync(join(root, ".git"));
		writeFileSync(join(root, ".git", "HEAD"), "abcdef0123456789\n");
		expect(getGitBranch(root)).toBe("abcdef01");
	});

	it("resolves the real git dir for a linked worktree, where .git is a file", () => {
		const mainRepo = join(root, "main-repo");
		const worktreeGitDir = join(mainRepo, ".git", "worktrees", "wt1");
		mkdirSync(worktreeGitDir, { recursive: true });
		writeFileSync(join(worktreeGitDir, "HEAD"), "ref: refs/heads/feature-branch\n");

		const worktreeCwd = join(root, "worktree-checkout");
		mkdirSync(worktreeCwd);
		writeFileSync(join(worktreeCwd, ".git"), `gitdir: ${worktreeGitDir}\n`);

		expect(getGitBranch(worktreeCwd)).toBe("feature-branch");
	});

	it("strips control/escape characters instead of passing them through to the terminal", () => {
		mkdirSync(join(root, ".git"));
		writeFileSync(join(root, ".git", "HEAD"), "\x1b[31mevil0123456789\x1b[0m\n");
		const branch = getGitBranch(root);
		expect(branch).toBeDefined();
		// biome-ignore lint/suspicious/noControlCharactersInRegex: asserting absence
		expect(branch).not.toMatch(/[\x00-\x1F\x7F]/);
	});

	it("returns undefined when there is no .git at all", () => {
		expect(getGitBranch(root)).toBeUndefined();
	});
});
