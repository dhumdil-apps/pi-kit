/**
 * Powerbar Git Producer
 *
 * Shows the current git branch and a dirty-worktree marker (*).
 * Segment ID: "git-branch"
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { execFile } from "child_process";
import { readFileSync } from "fs";
import { join } from "path";

function getGitBranch(cwd: string): string | undefined {
	try {
		const head = readFileSync(join(cwd, ".git", "HEAD"), "utf-8").trim();
		if (head.startsWith("ref: refs/heads/")) {
			return head.slice(16);
		}
		// Detached HEAD — show short hash
		return head.slice(0, 8);
	} catch {
		return undefined;
	}
}

function isDirty(cwd: string): Promise<boolean> {
	return new Promise((resolve) => {
		execFile(
			"git",
			["status", "--porcelain", "--untracked-files=no"],
			{ cwd, timeout: 2000 },
			(err, stdout) => resolve(!err && stdout.trim().length > 0),
		);
	});
}

async function emitBranch(pi: ExtensionAPI, ctx: ExtensionContext): Promise<void> {
	const branch = getGitBranch(ctx.cwd);
	if (branch) {
		const dirty = await isDirty(ctx.cwd);
		pi.events.emit("powerbar:update", {
			id: "git-branch",
			text: dirty ? `${branch}*` : branch,
			icon: "⎇",
			color: dirty ? "warning" : "muted",
		});
	} else {
		pi.events.emit("powerbar:update", {
			id: "git-branch",
			text: undefined,
		});
	}
}

export default function createExtension(pi: ExtensionAPI): void {
	pi.events.emit("powerbar:register-segment", { id: "git-branch", label: "Git Branch" });

	pi.on("session_start", async (_event, ctx) => {
		await emitBranch(pi, ctx);
	});

	// Refresh after tools that can change branch or dirty state
	pi.on("tool_result", async (event, ctx) => {
		if (event.toolName === "bash" || event.toolName === "edit" || event.toolName === "write") {
			await emitBranch(pi, ctx);
		}
	});
}
