/**
 * Permission Gate — destructive commands only.
 *
 * Prompts (askUserFancy: Allow once / Allow for session / Deny) ONLY for:
 * - Destructive bash commands: rm/rmdir/unlink/shred/dd/mkfs, sudo,
 *   find -delete/-exec rm|mv, xargs rm|mv, recursive chmod/chown/chgrp,
 *   and destructive git (reset --hard, clean, force push, branch -D,
 *   stash drop/clear).
 * - edit/write targeting paths OUTSIDE the project cwd.
 *
 * Everything else runs without prompting. Deliberately NOT gated: redirects
 * and tee (can't cheaply tell truncate vs create), mv/cp (recoverable),
 * package managers, kill. Known denylist limits: `bash -c "..."`, scripts,
 * and aliases can smuggle destructive commands past the matcher.
 *
 * Headless (no UI): gated calls are blocked with a chat notice.
 * Toggle via /extension-settings → permission-gate → enabled.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { isAbsolute, resolve } from "path";
import { askUserFancy } from "../ask-user/index";
import { getSetting } from "../extension-settings/index.js";

const EXTENSION_NAME = "permission-gate";

// Wrappers/prefixes that may precede the real command.
const WRAPPERS = new Set(["command", "nice", "nohup", "time", "env"]);
const ENV_ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/;

const DESTRUCTIVE_COMMANDS = new Set(["rm", "rmdir", "unlink", "shred", "dd"]);

const DESTRUCTIVE_GIT = [
	/^git\s+reset\s+--hard\b/,
	/^git\s+clean\b/,
	/^git\s+push\s+.*(--force\b|--force-with-lease\b|-f\b|\s\+\S)/,
	/^git\s+branch\s+(-D\b|--delete\s+--force\b)/,
	/^git\s+stash\s+(drop|clear)\b/,
];

function splitSegments(command: string): string[] {
	// Good-enough split on shell connectors; quoted connectors are rare in
	// agent-issued commands, and a false split only makes us more cautious.
	return command
		.split(/&&|\|\||;|\|/)
		.map((s) => s.trim())
		.filter(Boolean);
}

function segmentIsDestructive(segment: string): boolean {
	const tokens = segment.split(/\s+/);
	while (tokens.length && (WRAPPERS.has(tokens[0]) || ENV_ASSIGNMENT.test(tokens[0]))) {
		tokens.shift();
	}
	const cmd = tokens[0];
	if (!cmd) return false;
	const stripped = tokens.join(" ");
	if (cmd === "sudo") return true;
	if (DESTRUCTIVE_COMMANDS.has(cmd)) return true;
	if (cmd.startsWith("mkfs")) return true;
	if (cmd === "find" && /\s(-delete\b|-exec\s+(rm|mv)\b)/.test(stripped)) return true;
	if (cmd === "xargs" && /\b(rm|mv)\b/.test(stripped)) return true;
	if ((cmd === "chmod" || cmd === "chown" || cmd === "chgrp") && /\s-\w*R/.test(stripped)) return true;
	if (cmd === "git") return DESTRUCTIVE_GIT.some((re) => re.test(stripped));
	return false;
}

function bashIsDestructive(command: string): boolean {
	return splitSegments(command).some(segmentIsDestructive);
}

function sessionKey(toolName: string, input: Record<string, unknown>): string {
	if (toolName === "bash") {
		const command = String(input.command ?? "");
		// Key on the first two tokens ("rm -rf", "git clean") so one session
		// approval covers repeats of the same kind of command.
		return `bash:${command.split(/\s+/).slice(0, 2).join(" ")}`;
	}
	return `tool:${toolName}`;
}

export default function createExtension(pi: ExtensionAPI): void {
	const sessionAllowed = new Set<string>();

	pi.events.emit("pi-extension-settings:register", {
		name: EXTENSION_NAME,
		settings: [
			{ id: "enabled", label: "Gate destructive commands", defaultValue: "on", values: ["on", "off"] },
		],
	});

	pi.on("tool_call", async (event, ctx) => {
		if (getSetting(EXTENSION_NAME, "enabled", "on") === "off") return undefined;

		const toolName = event.toolName;
		const input = (event.input ?? {}) as Record<string, unknown>;

		let gateReason: string | undefined;

		if (toolName === "bash") {
			const command = String(input.command ?? "");
			if (bashIsDestructive(command)) {
				gateReason = `Run destructive bash command:\n\n  ${command}`;
			}
		} else if (toolName === "edit" || toolName === "write") {
			const rawPath = String(input.path ?? input.file_path ?? "");
			if (rawPath) {
				const full = isAbsolute(rawPath) ? rawPath : resolve(ctx.cwd, rawPath);
				if (!full.startsWith(resolve(ctx.cwd))) {
					gateReason = `${toolName} outside the project directory:\n\n  ${full}`;
				}
			}
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
