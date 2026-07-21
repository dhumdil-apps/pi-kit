import { readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getAgentDir, loadProjectContextFiles } from "@earendil-works/pi-coding-agent";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Box, type Component, Container, Markdown } from "@earendil-works/pi-tui";
import { collectUsageData } from "../usage-history/data.js";
import { renderExtensionDeck } from "./extensions.js";
import { RULER_END, RULER_START, renderWelcomeText } from "./welcome.js";

const BUNDLE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const MAX_PANEL_ROW = 60;
const DASHBOARD_RULER = [
	"._________________________________________________",
	"|\"\"\"\"\"\"\"\"\"|\"\"\"\"\"\"\"\"\"|\"\"\"\"\"\"\"\"\"|\"|\"\"\"\"\"\"\"|\"\"\"\"\"\"\"\"\"|",
	"|         1         2         3 π       4         |",
	"'-------------------------------------------------'",
];

/**
 * Renders fixed-width ASCII art (the ruler) verbatim: clipped, never
 * word-wrapped. pi-tui's Text component word-wraps each line independently
 * once the container is narrower than that line, which breaks a line with
 * spaces (e.g. "1  2  3 π  4") at a different column than a line with none
 * (e.g. the border rows) — the ruler comes out visibly misaligned. Clipping
 * keeps every row's left edge aligned even on a narrow pane.
 */
export class RulerText implements Component {
	constructor(
		private readonly lines: string[],
		private readonly colorFn: (text: string) => string,
	) {}

	render(width: number): string[] {
		return this.lines.map((line) => this.colorFn(width > 0 && line.length > width ? line.slice(0, width) : line));
	}

	invalidate(): void {
		// Stateless: render() has no cache to invalidate.
	}
}

async function git(pi: ExtensionAPI, cwd: string, args: string[]) {
	try {
		const res = await pi.exec("git", args, { cwd, timeout: 5000 });
		return res.code === 0 ? res.stdout.trim() : "";
	} catch {
		return "";
	}
}

function formatUsdSpend(cost: number): string {
	if (cost < 0.01) return `$${cost.toFixed(4)}`;
	if (cost < 1) return `$${cost.toFixed(2)}`;
	if (cost < 100) return `$${cost.toFixed(1)}`;
	return `$${Math.round(cost)}`;
}

export function tildify(path: string): string {
	const home = homedir();
	// A boundary check, not a bare prefix check: "/Users/alice-backup" is a
	// sibling of "/Users/alice", not a path under it.
	return path === home || path.startsWith(`${home}/`) ? `~${path.slice(home.length)}` : path;
}

function truncateLeft(text: string, max: number): string {
	return text.length <= max ? text : `…${text.slice(text.length - max + 1)}`;
}

interface BundleResources {
	extensions: string[];
	skills: string[];
	prompts: string[];
}

/** Name an extension entry like "./extensions/agent-workflow/index.ts" → "agent-workflow". */
function extensionName(entry: string): string {
	const parts = entry.split("/").filter((p) => p && p !== ".");
	const idx = parts.indexOf("extensions");
	return idx >= 0 && parts[idx + 1] ? parts[idx + 1] : (parts[0] ?? "");
}

function listSkills(dir: string): string[] {
	try {
		return readdirSync(dir, { withFileTypes: true })
			.filter((e) => e.isDirectory())
			.map((e) => e.name)
			.filter((name) => {
				try {
					readFileSync(join(dir, name, "SKILL.md"));
					return true;
				} catch {
					return false;
				}
			});
	} catch {
		return [];
	}
}

function listPrompts(dir: string): string[] {
	try {
		return readdirSync(dir)
			.filter((f) => f.endsWith(".md"))
			.map((f) => `/${basename(f, ".md")}`);
	} catch {
		return [];
	}
}

/** What this bundle registers, read live from its own package.json. */
function loadBundleResources(): BundleResources {
	try {
		const pkg = JSON.parse(readFileSync(join(BUNDLE_ROOT, "package.json"), "utf8"));
		const cfg = pkg?.pi ?? {};
		const extensions: string[] = (cfg.extensions ?? []).map(extensionName).filter(Boolean).sort();
		const skills: string[] = (cfg.skills ?? [])
			.flatMap((dir: string) => listSkills(join(BUNDLE_ROOT, dir)))
			.sort();
		const prompts: string[] = (cfg.prompts ?? [])
			.flatMap((dir: string) => listPrompts(join(BUNDLE_ROOT, dir)))
			.sort();
		return { extensions, skills, prompts };
	} catch {
		return { extensions: [], skills: [], prompts: [] };
	}
}

/** Context files exactly as pi core discovers them, formatted for display. */
function contextFileList(cwd: string): string[] {
	try {
		return loadProjectContextFiles({ cwd, agentDir: getAgentDir() }).map((f) => {
			const inProject = f.path.startsWith(`${cwd}/`);
			return inProject ? `./${f.path.slice(cwd.length + 1)}` : tildify(f.path);
		});
	} catch {
		return [];
	}
}

/** Box-drawing only inside the panel — emoji are double-width and break alignment. */
function renderPanel(rows: string[]): string {
	const width = Math.max(...rows.map((r) => r.length));
	const body = rows.map((r) => `│  ${r.padEnd(width)}  │`);
	return [`╭${"─".repeat(width + 4)}╮`, ...body, `╰${"─".repeat(width + 4)}╯`].join("\n");
}

export default function sessionDashboardExtension(pi: ExtensionAPI): void {
	pi.registerMessageRenderer("session-dashboard", (message, _options, theme) => {
		const content = typeof message.content === "string" ? message.content : message.content
			.filter((item) => item.type === "text")
			.map((item) => item.text)
			.join("\n");
		const markdown = (text: string) => new Markdown(text, 0, 0, {
			heading: (value) => theme.fg("mdHeading", value),
			link: (value) => theme.fg("mdLink", value),
			linkUrl: (value) => theme.fg("mdLinkUrl", value),
			code: (value) => theme.fg("mdCode", value),
			codeBlock: (value) => theme.fg("mdCodeBlock", value),
			codeBlockBorder: (value) => theme.fg("mdCodeBlockBorder", value),
			quote: (value) => theme.fg("mdQuote", value),
			quoteBorder: (value) => theme.fg("mdQuoteBorder", value),
			hr: (value) => theme.fg("mdHr", value),
			listBullet: (value) => theme.fg("mdListBullet", value),
			bold: (value) => theme.bold(value),
			italic: (value) => theme.italic(value),
			strikethrough: (value) => value,
			underline: (value) => theme.underline(value),
			highlightCode: (code) => code.split("\n").map((line) => theme.fg("mdCodeBlock", line)),
		}, { color: (value) => theme.fg("customMessageText", value) });
		const box = new Box(1, 1, (text) => theme.bg("customMessageBg", text));
		const rulerStart = content.indexOf(RULER_START);
		const rulerEnd = content.indexOf(RULER_END);
		if (rulerStart < 0 || rulerEnd < rulerStart) {
			box.addChild(markdown(content));
			return box;
		}

		const contentBox = new Container();
		const before = content.slice(0, rulerStart).trim();
		const ruler = content.slice(rulerStart + RULER_START.length, rulerEnd).trim();
		const after = content.slice(rulerEnd + RULER_END.length).trim();
		if (before) contentBox.addChild(markdown(before));
		contentBox.addChild(new RulerText(ruler.split("\n"), (line) => theme.fg("mdLink", line)));
		if (after) contentBox.addChild(markdown(after));
		box.addChild(contentBox);
		return box;
	});

	pi.on("session_start", async (_event, ctx) => {
		// Purely decorative banner: in headless/print mode it would land after the
		// prompt and trigger a spurious extra turn, so interactive sessions only.
		if (!ctx.hasUI) return;
		const cwd = ctx.cwd;
		// Independent lookups — run concurrently so a cold usage-cache build
		// doesn't add its full duration on top of the two git calls before this
		// purely decorative banner can render.
		const [branchResult, dirtyOutput, usage] = await Promise.all([
			git(pi, cwd, ["rev-parse", "--abbrev-ref", "HEAD"]),
			git(pi, cwd, ["status", "--porcelain"]),
			collectUsageData().catch(() => null),
		]);
		const branch = branchResult || "no git";
		const dirtyCount = dirtyOutput ? dirtyOutput.split("\n").filter(Boolean).length : 0;

		const projectRow = `${truncateLeft(tildify(cwd), 34)}  ${branch} · ${
			dirtyCount === 0 ? "clean" : `${dirtyCount} modified`
		}`;
		const rulerPanel = [...DASHBOARD_RULER, "Measure twice, cut once"].join("\n");
		const infoRows = [`project  ${truncateLeft(projectRow, MAX_PANEL_ROW - 9)}`];
		if (usage) {
			const spend = [
				`${formatUsdSpend(usage.today.totals.cost)} today`,
				`${formatUsdSpend(usage.last30Days.totals.cost)} 30d`,
				`${formatUsdSpend(usage.allTime.totals.cost)} all`,
			].join(" · ");
			infoRows.push(`spend    ${spend}`);
		}

		const bundle = loadBundleResources();
		const contextFiles = contextFileList(cwd);
		const sections: string[] = [];
		if (contextFiles.length > 0) {
			sections.push(`📜 **Context** · ${contextFiles.map((f) => `\`${f}\``).join(" · ")}`);
		}
		if (bundle.skills.length > 0) {
			sections.push(`🎓 **Skills** (${bundle.skills.length}) · ${bundle.skills.join(" · ")}`);
		}
		if (bundle.prompts.length > 0) {
			sections.push(`⌘ **Prompts** · ${bundle.prompts.map((p) => `\`${p}\``).join(" · ")}`);
		}

		const welcomeText = renderWelcomeText({
			rulerPanel,
			infoPanel: renderPanel(infoRows),
			sections,
			extensionDeck: bundle.extensions.length > 0 ? renderExtensionDeck(bundle.extensions) : "",
		});

		pi.sendMessage(
			{
				customType: "session-dashboard",
				content: welcomeText,
				display: true,
			},
			{ triggerTurn: false }
		);
	});
}
