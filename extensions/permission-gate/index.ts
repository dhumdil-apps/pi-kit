/**
 * Permission Gate
 *
 * Claude Code-style approval prompts for risky tool calls.
 * - Read-only tools and read-only bash commands pass silently.
 * - Mutating bash, file writes outside the project cwd, and dangerous git
 *   commands prompt via askUserFancy: Allow once / Allow for session / Deny.
 * - Headless (no UI): gated calls are blocked with a chat notice, matching
 *   Claude Code's non-interactive default.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { isAbsolute, resolve } from "path";
import { askUserFancy } from "../ask-user/index";

// Tools that never mutate anything.
const READ_ONLY_TOOLS = new Set([
	"read",
	"grep",
	"glob",
	"ls",
	"list",
	"ask_user",
	"manage_todo_list",
]);

// First tokens of bash commands that are read-only on their own.
const READ_ONLY_COMMANDS = new Set([
	"ls", "cat", "head", "tail", "less", "grep", "rg", "fd", "find", "tree",
	"pwd", "cd", "echo", "which", "type", "file", "stat", "wc", "du", "df",
	"ps", "env", "printenv", "date", "whoami", "uname", "diff", "sort", "uniq",
	"jq", "basename", "dirname", "realpath", "md5", "shasum", "column",
]);

// git subcommands that are read-only.
const READ_ONLY_GIT = new Set([
	"status", "log", "diff", "show", "branch", "remote", "stash", "blame",
	"describe", "rev-parse", "ls-files", "ls-remote", "shortlog", "reflog",
	"config",
]);
const MUTATING_GIT_STASH = /^git\s+stash\s+(push|pop|apply|drop|clear|save)/;
const MUTATING_GIT_CONFIG = /^git\s+config\s+(?!--get|--list|-l\b)/;
const MUTATING_GIT_BRANCH = /^git\s+branch\s+(-[dDmM]|--delete|--move)/;

// Redirections / in-pipeline writers make a command mutating.
const WRITE_MARKERS = /(^|[^>])>(?!&2)|>>|\btee\b|\bxargs\b.*\b(rm|mv|cp)\b/;

function splitSegments(command: string): string[] {
	// Good-enough split on shell connectors; quoted connectors are rare in
	// agent-issued commands, and a false split only makes us more cautious.
	return command
		.split(/&&|\|\||;|\|/)
		.map((s) => s.trim())
		.filter(Boolean);
}

function segmentIsReadOnly(segment: string): boolean {
	const tokens = segment.split(/\s+/);
	const cmd = tokens[0];
	if (!cmd) return true;
	if (cmd === "git") {
		const sub = tokens[1];
		if (!sub || !READ_ONLY_GIT.has(sub)) return false;
		if (MUTATING_GIT_STASH.test(segment)) return false;
		if (MUTATING_GIT_CONFIG.test(segment)) return false;
		if (MUTATING_GIT_BRANCH.test(segment)) return false;
		return true;
	}
	if (cmd === "find" && /\s(-delete|-exec)\b/.test(segment)) return false;
	return READ_ONLY_COMMANDS.has(cmd);
}

function bashIsReadOnly(command: string): boolean {
	if (WRITE_MARKERS.test(command)) return false;
	return splitSegments(command).every(segmentIsReadOnly);
}

function sessionKey(toolName: string, input: Record<string, unknown>): string {
	if (toolName === "bash") {
		const command = String(input.command ?? "");
		// Key on the first two tokens ("git push", "npm install") so one
		// session approval covers repeats of the same kind of command.
		return `bash:${command.split(/\s+/).slice(0, 2).join(" ")}`;
	}
	return `tool:${toolName}`;
}

export default function createExtension(pi: ExtensionAPI): void {
	const sessionAllowed = new Set<string>();

	pi.on("tool_call", async (event, ctx) => {
		const toolName = event.toolName;
		const input = (event.input ?? {}) as Record<string, unknown>;

		let gateReason: string | undefined;

		if (toolName === "bash") {
			const command = String(input.command ?? "");
			if (!bashIsReadOnly(command)) {
				gateReason = `Run bash command:\n\n  ${command}`;
			}
		} else if (toolName === "edit" || toolName === "write") {
			const rawPath = String(input.path ?? input.file_path ?? "");
			if (rawPath) {
				const full = isAbsolute(rawPath) ? rawPath : resolve(ctx.cwd, rawPath);
				if (!full.startsWith(resolve(ctx.cwd))) {
					gateReason = `${toolName} outside the project directory:\n\n  ${full}`;
				}
			}
		} else if (READ_ONLY_TOOLS.has(toolName)) {
			return undefined;
		}

		if (!gateReason) return undefined;

		const key = sessionKey(toolName, input);
		if (sessionAllowed.has(key)) return undefined;

		if (!ctx.hasUI) {
			// Headless/RPC: never hang on a modal — block with a visible notice.
			pi.sendMessage(
				{
					customType: "permission-gate",
					content: `⚠️ **Permission Gate**: blocked (no UI to confirm): ${gateReason.split("\n")[0]}`,
					display: true,
				},
				{ triggerTurn: false },
			);
			return { block: true, reason: "Blocked by permission gate: no UI available for confirmation." };
		}

		const response = await askUserFancy(ctx, {
			question: `Permission required — ${gateReason}`,
			options: ["Allow once", "Allow for session", "Deny"],
			allowFreeform: false,
		});

		if (response?.kind === "selection") {
			const choice = response.selections[0];
			if (choice === "Allow once") return undefined;
			if (choice === "Allow for session") {
				sessionAllowed.add(key);
				return undefined;
			}
		}
		return { block: true, reason: "Denied by user via permission gate." };
	});
}
