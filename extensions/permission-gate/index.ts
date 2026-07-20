/**
 * Permission Gate — global, mode-independent guardrails.
 *
 * Prompts (askUserFancy: "Proceed" button, or type to deny) for every single
 * call — no session-wide or per-kind approval, by design: an annoying gate
 * is a signal to narrow what's gated, not to make the gate leakier. Typing
 * anything instead of picking Proceed denies the call and is put directly in
 * the block reason so the current agent sees it immediately and can act on it
 * this turn. Covers:
 * - Destructive bash commands: rm/rmdir/unlink/shred/dd/mkfs, sudo,
 *   find -delete/-exec rm|mv, xargs rm|mv, recursive chmod/chown/chgrp,
 *   and destructive git (reset --hard, clean, force push, branch -D,
 *   stash drop/clear).
 * - edit/write targeting paths OUTSIDE the project cwd.
 * - Web access: curl plus web_search, fetch_content, get_search_content
 *   (fetched pages are untrusted text — prompt-injection risk).
 * - Vendored/dependency code reads (read tool or bash referencing
 *   node_modules/, vendor/, .venv/, ~/.pi/agent/git|cache): untrusted
 *   third-party text. Packages/scopes in TRUSTED_PACKAGES are exempt.
 * - Recursive search/list commands (find, grep -r, rg, tree, ls -R) whose
 *   target path reaches outside the project directory — avoids runaway
 *   scans of the home directory / filesystem when an agent goes looking
 *   for context files with too broad a root. Paths in SAFE_PATHS (the
 *   user's own bundle at ~/.pi/pi-bundle) count as in-project for both
 *   this and the edit/write gate.
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
import { homedir } from "os";
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

const WEB_FETCH_TOOLS = new Set(["fetch_content", "get_search_content"]);
const WEB_BASH_COMMANDS = new Set(["curl"]);

const VENDORED_DIRS = ["node_modules", "vendor", ".venv"];

// Packages/scopes whose vendored code is trusted — reads skip the gate.
// Entries match a whole npm scope ("@earendil-works") or a single package
// ("@scope/pkg", "lodash").
const TRUSTED_PACKAGES = [
	"@earendil-works",
];

const SEARCH_COMMANDS = new Set(["find", "grep", "rg", "tree", "ls"]);

// Paths treated as in-project everywhere: the user's own bundle working
// copy — searching, reading, and editing it from any cwd is routine.
const SAFE_PATHS = [resolve(homedir(), ".pi/pi-bundle")];

function pathIsSafelisted(abs: string): boolean {
	return SAFE_PATHS.some((dir) => abs === dir || abs.startsWith(`${dir}/`));
}

const GATE_OPTIONS = ["Proceed"];

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

/** True when a shell segment invokes a guarded network client. */
export function bashUsesGuardedWebCommand(command: string): boolean {
	return splitSegments(command).some((segment) => {
		const { command: tool } = commandAndArgs(segment);
		if (!tool) return false;
		const executable = tool.split("/").at(-1) ?? tool;
		return WEB_BASH_COMMANDS.has(executable);
	});
}

/**
 * If the path (or command text) reaches into a vendored dir, return a label
 * for it: the package for node_modules ("node_modules/@scope/pkg"),
 * otherwise the vendored dir itself. Undefined when no vendored dir is touched.
 */
function vendoredDirForPath(path: string): string | undefined {
	const agentDirs = [resolve(homedir(), ".pi/agent/git"), resolve(homedir(), ".pi/agent/cache")];
	const abs = isAbsolute(path) ? resolve(path) : undefined;
	if (abs) {
		for (const dir of agentDirs) {
			if (abs === dir || abs.startsWith(`${dir}/`)) return dir;
		}
	}
	const segments = path.split("/");
	for (let i = 0; i < segments.length; i++) {
		if (!VENDORED_DIRS.includes(segments[i])) continue;
		if (segments[i] !== "node_modules") return segments[i];
		const first = segments[i + 1];
		if (!first) return "node_modules";
		const pkg = first.startsWith("@") && segments[i + 2] ? `${first}/${segments[i + 2]}` : first;
		if (TRUSTED_PACKAGES.some((t) => pkg === t || pkg.startsWith(`${t}/`))) continue;
		return `node_modules/${pkg}`;
	}
	return undefined;
}

const FILTER_FLAGS: Record<string, ReadonlySet<string>> = {
	find: new Set(["-path", "-wholename", "-ipath", "-name", "-iname", "-regex", "-iregex", "-lname"]),
	rg: new Set(["-g", "--glob", "--iglob"]),
	grep: new Set(["--include", "--exclude", "--exclude-dir"]),
	tree: new Set(["-I", "--ignore"]),
};

function commandAndArgs(segment: string): { command?: string; args: string[] } {
	const tokens = segment.split(/\s+/).filter(Boolean);
	while (tokens.length && (WRAPPERS.has(tokens[0]) || ENV_ASSIGNMENT.test(tokens[0]))) tokens.shift();
	const command = tokens.shift();
	return { command, args: tokens };
}

/**
 * Return indexes containing glob/predicate operands. These arguments describe
 * what to exclude or match; they are not paths the command reads.
 */
function filterOperandIndexes(command: string | undefined, args: string[]): Set<number> {
	const flags = command ? FILTER_FLAGS[command] : undefined;
	if (!flags) return new Set();

	const operands = new Set<number>();
	for (let i = 0; i < args.length; i++) {
		const token = args[i];
		const flag = token.split("=", 1)[0];
		if (!flags.has(flag)) continue;
		if (token.includes("=")) operands.add(i);
		else if (i + 1 < args.length) operands.add(++i);
	}
	return operands;
}

export function vendoredDirForBash(command: string): string | undefined {
	for (const segment of splitSegments(command)) {
		const { command: tool, args } = commandAndArgs(segment);
		const filters = filterOperandIndexes(tool, args);
		for (let i = 0; i < args.length; i++) {
			if (filters.has(i)) continue;
			const cleaned = args[i].replace(/^['"]|['"]$/g, "");
			if (!/node_modules|vendor\/|\.venv|\.pi\/agent\/(git|cache)/.test(cleaned)) continue;
			const key = vendoredDirForPath(cleaned);
			if (key) return key;
		}
	}
	return undefined;
}

function expandTilde(path: string): string {
	if (path === "~") return homedir();
	if (path.startsWith("~/")) return resolve(homedir(), path.slice(2));
	return path;
}

/** True if a resolved path arg reaches outside cwd. Unresolvable ($VAR) tokens are skipped. */
function pathEscapesProject(rawPath: string, cwd: string): boolean {
	const cleaned = rawPath.replace(/^['"]|['"]$/g, "");
	if (!cleaned || cleaned.startsWith("$")) return false;
	const expanded = expandTilde(cleaned);
	const abs = isAbsolute(expanded) ? resolve(expanded) : resolve(cwd, expanded);
	const root = resolve(cwd);
	if (pathIsSafelisted(abs)) return false;
	return abs !== root && !abs.startsWith(`${root}/`);
}

const RECURSIVE_FLAG = /^-\w*[rR]\w*$|^--recursive$/;

/** Path-like args for a search command, per its grammar. Empty when the command isn't recursive/isn't gated. */
function searchPathArgsForCommand(cmd: string, args: string[]): string[] {
	const nonFlag = args.filter((a) => !a.startsWith("-"));
	if (cmd === "find" || cmd === "tree") {
		// find/tree: leading (or all, for tree) non-flag tokens are paths.
		return nonFlag;
	}
	if (cmd === "ls") {
		if (!args.some((a) => RECURSIVE_FLAG.test(a))) return [];
		return nonFlag;
	}
	if (cmd === "rg") {
		// rg <pattern> [path...]; single non-flag token is just the pattern.
		return nonFlag.length > 1 ? nonFlag.slice(1) : [];
	}
	if (cmd === "grep") {
		if (!args.some((a) => RECURSIVE_FLAG.test(a))) return [];
		return nonFlag.length > 1 ? nonFlag.slice(1) : [];
	}
	return [];
}

function segmentSearchEscapesProject(segment: string, cwd: string): boolean {
	const tokens = segment.split(/\s+/);
	while (tokens.length && (WRAPPERS.has(tokens[0]) || ENV_ASSIGNMENT.test(tokens[0]))) {
		tokens.shift();
	}
	const cmd = tokens[0];
	if (!cmd || !SEARCH_COMMANDS.has(cmd)) return false;
	const paths = searchPathArgsForCommand(cmd, tokens.slice(1));
	return paths.some((p) => pathEscapesProject(p, cwd));
}

function bashSearchEscapesProject(command: string, cwd: string): boolean {
	return splitSegments(command).some((segment) => segmentSearchEscapesProject(segment, cwd));
}

interface Gate {
	reason: string;
}

export default function createExtension(pi: ExtensionAPI): void {
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

		let gate: Gate | undefined;

		if (toolName === "bash") {
			const command = String(input.command ?? "");
			if (bashIsDestructive(command)) {
				gate = { reason: `Run destructive bash command:\n\n  ${command}` };
			} else if (bashUsesGuardedWebCommand(command)) {
				gate = { reason: `Access the web via guarded shell command:\n\n  ${command}` };
			} else {
				const vendored = vendoredDirForBash(command);
				if (vendored) {
					gate = { reason: `Read vendored/dependency code (untrusted third-party text) via bash:\n\n  ${command}` };
				} else if (bashSearchEscapesProject(command, ctx.cwd)) {
					gate = { reason: `Search/list outside the project directory:\n\n  ${command}` };
				}
			}
		} else if (toolName === "edit" || toolName === "write") {
			const rawPath = String(input.path ?? input.file_path ?? "");
			if (rawPath) {
				const full = isAbsolute(rawPath) ? resolve(rawPath) : resolve(ctx.cwd, rawPath);
				if (!full.startsWith(resolve(ctx.cwd)) && !pathIsSafelisted(full)) {
					gate = { reason: `${toolName} outside the project directory:\n\n  ${full}` };
				}
			}
		} else if (toolName === "read") {
			const rawPath = String(input.path ?? input.file_path ?? "");
			const vendored = rawPath ? vendoredDirForPath(rawPath) : undefined;
			if (vendored) {
				gate = { reason: `Read vendored/dependency code (untrusted third-party text):\n\n  ${rawPath}` };
			}
		} else if (toolName === "web_search") {
			const queries = Array.isArray(input.queries) ? input.queries : [input.query].filter(Boolean);
			gate = { reason: `Search the web:\n\n  ${queries.map(String).join("\n  ")}` };
		} else if (WEB_FETCH_TOOLS.has(toolName)) {
			const targets = Array.isArray(input.urls)
				? input.urls
				: [input.url ?? input.query ?? input.responseId].filter(Boolean);
			gate = { reason: `Load web content into context (untrusted text) via ${toolName}:\n\n  ${targets.map(String).join("\n  ")}` };
		}

		if (!gate) return undefined;

		if (!ctx.hasUI) {
			// Headless/RPC: never hang on a modal — block with a visible notice.
			pi.sendMessage(
				{
					customType: "permission-gate",
					content: `⚠️ **Permission Gate**: blocked (no UI to confirm): ${gate.reason.split("\n")[0]}`,
					display: true,
				},
				{ triggerTurn: false },
			);
			return { block: true, reason: "Blocked by permission gate: no UI available for confirmation." };
		}

		const response = await askUserFancy(ctx, {
			question: `Permission required — ${gate.reason}`,
			options: GATE_OPTIONS,
			allowFreeform: true,
		});

		if (response?.kind === "selection" && response.selections[0] === "Proceed") return undefined;

		if (response?.kind === "freeform" && response.text.trim()) {
			const guidance = response.text.trim();
			return {
				block: true,
				reason: `Denied by user via permission gate. User guidance for next time: ${guidance}`,
			};
		}

		return { block: true, reason: "Denied by user via permission gate." };
	});
}
