import { readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getAgentDir, loadProjectContextFiles } from "@earendil-works/pi-coding-agent";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Box, type Component, Container, Markdown, Spacer, truncateToWidth, visibleWidth, wrapTextWithAnsi } from "@earendil-works/pi-tui";
import { collectUsageData } from "../usage-history/data.js";
import { buildGraphModel, type GraphModel, renderChart, TOTAL_SERIES_KEY } from "../usage-history/graph.js";
import { COLOR_RESET, formatAxisCost, seriesColor } from "../usage-history/index.js";
import { renderExtensionDeck } from "./extensions.js";
import {
	QUICK_REF_START,
	USAGE_CHART_END,
	USAGE_CHART_START,
	renderWelcomeText,
} from "./welcome.js";

const BUNDLE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

const QUICK_REF_MAX_WIDTH = 72;
const QUICK_REF_TITLE = " Quick reference ";

interface QuickRefItem {
	cmd: string;
	desc: string;
}

interface QuickRefGroup {
	title: string;
	items: QuickRefItem[];
}

/**
 * Curated reminder of the handy commands the Extensions deck does not already
 * spell out (the deck covers /usage, /todos, /extension-settings, …). Static:
 * the list never changes at runtime, so the card carries no serialized payload.
 */
const QUICK_REFERENCE: QuickRefGroup[] = [
	{
		title: "Shortcuts",
		items: [
			{ cmd: "! cmd", desc: "run a shell command" },
			{ cmd: "escape", desc: "cancel the current turn" },
		],
	},
	{
		title: "Workflow",
		items: [
			{ cmd: "/flash", desc: "finish the task autonomously" },
			{ cmd: "/retro", desc: "reflect on this session" },
			{ cmd: "/forensic", desc: "deep session retrospective" },
			{ cmd: "/init", desc: "create or improve AGENTS.md" },
		],
	},
];

/**
 * Static "Quick reference" card: a bordered, width-aware box (rounded borders +
 * centered title) listing grouped command/description pairs. Reuses the border
 * chrome shape of the former Session context card; commands share one aligned
 * column, descriptions wrap under the command when the pane is too narrow.
 */
export class QuickReferenceCard implements Component {
	constructor(
		private readonly groups: QuickRefGroup[],
		private readonly borderFn: (text: string) => string,
		private readonly titleFn: (text: string) => string,
		private readonly groupFn: (text: string) => string,
		private readonly cmdFn: (text: string) => string,
		private readonly descFn: (text: string) => string,
	) {}

	render(width: number): string[] {
		if (width <= 0 || this.groups.length === 0) return [];
		const items = this.groups.flatMap((group) => group.items);
		const cmdWidth = Math.max(0, ...items.map((item) => visibleWidth(item.cmd)));
		const desiredWidth = Math.max(
			visibleWidth(QUICK_REF_TITLE) + 3,
			...this.groups.map((group) => visibleWidth(group.title) + 4),
			...items.map((item) => 2 + cmdWidth + 2 + visibleWidth(item.desc) + 4),
		);
		const cardWidth = Math.min(width, QUICK_REF_MAX_WIDTH, desiredWidth);
		if (cardWidth < 4) return [this.borderFn("─".repeat(Math.max(cardWidth, 0)))];

		const titleFits = cardWidth >= visibleWidth(QUICK_REF_TITLE) + 3;
		const top = titleFits
			? this.borderFn("╭─") + this.titleFn(QUICK_REF_TITLE) + this.borderFn(`${"─".repeat(cardWidth - visibleWidth(QUICK_REF_TITLE) - 3)}╮`)
			: this.borderFn(`╭${"─".repeat(cardWidth - 2)}╮`);
		const innerWidth = cardWidth - 4;
		if (innerWidth <= 0) return [top, this.borderFn(`╰${"─".repeat(cardWidth - 2)}╯`)];

		// Build styled inner lines: a group header, then one line per item with the
		// command in an aligned column. When the command column plus a little room
		// for the description no longer fits, stack the description on its own line.
		const stacked = innerWidth <= cmdWidth + 6;
		const lines: string[] = [];
		for (const group of this.groups) {
			lines.push(this.groupFn(truncateToWidth(group.title, innerWidth, "…")));
			for (const item of group.items) {
				if (stacked) {
					lines.push(truncateToWidth("  " + this.cmdFn(item.cmd), innerWidth, ""));
					for (const line of wrapTextWithAnsi(item.desc, Math.max(innerWidth - 4, 1))) {
						lines.push(truncateToWidth("    " + this.descFn(line), innerWidth, ""));
					}
				} else {
					const descWidth = innerWidth - 2 - cmdWidth - 2;
					const wrapped = wrapTextWithAnsi(item.desc, descWidth);
					wrapped.forEach((line, i) => {
						const cmdCell = i === 0 ? this.cmdFn(padRightVis(item.cmd, cmdWidth)) : " ".repeat(cmdWidth);
						lines.push(truncateToWidth("  " + cmdCell + "  " + this.descFn(line), innerWidth, ""));
					});
				}
			}
		}

		const body = lines.map((line) => {
			const padding = " ".repeat(Math.max(0, innerWidth - visibleWidth(line)));
			return this.borderFn("│ ") + line + padding + this.borderFn(" │");
		});
		return [top, ...body, this.borderFn(`╰${"─".repeat(cardWidth - 2)}╯`)];
	}

	invalidate(): void {
		// Stateless: theme callbacks are evaluated on every render.
	}
}

const USAGE_CHART_MAX_WIDTH = 72;
const USAGE_CHART_HEIGHT = 8;

function padRightVis(text: string, len: number): string {
	const pad = len - visibleWidth(text);
	return pad > 0 ? text + " ".repeat(pad) : text;
}

function padLeftVis(text: string, len: number): string {
	const pad = len - visibleWidth(text);
	return pad > 0 ? " ".repeat(pad) + text : text;
}

/**
 * Decorative, non-interactive reproduction of the /usage "Graphs" view for the
 * "This Week · Per bucket cost · by provider" mode. Holds a pre-built GraphModel
 * (serialized into the banner text, rebuilt here) and renders the same braille
 * chart via the shared renderChart(), plus a static legend. Width-responsive:
 * the chart is generated at the pane width (capped) and every line is clipped so
 * a narrow pane degrades gracefully instead of word-wrapping the braille rows.
 */
export class UsageChartCard implements Component {
	constructor(
		private readonly model: GraphModel,
		private readonly titleFn: (text: string) => string,
		private readonly mutedFn: (text: string) => string,
		private readonly dimFn: (text: string) => string,
	) {}

	render(width: number): string[] {
		if (width <= 0) return [];
		const lines: string[] = [this.titleFn("This Week") + this.mutedFn(" · Per bucket cost · by provider")];

		if (this.model.groupedTotal === 0) {
			lines.push(this.dimFn("  No usage yet this week"));
			return lines.map((line) => truncateToWidth(line, width, ""));
		}

		const spanMs = this.model.domainEndMs - this.model.domainStartMs;
		const formatTime = (ms: number): string => {
			const d = new Date(ms);
			if (spanMs <= 26 * 3_600_000) {
				return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
			}
			return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
		};

		const chart = renderChart(this.model, {
			width: Math.max(Math.min(width, USAGE_CHART_MAX_WIDTH), 30),
			height: USAGE_CHART_HEIGHT,
			formatValue: formatAxisCost,
			formatTime,
			colorize: (seriesIndex, text) => (seriesIndex < 0 ? this.dimFn(text) : seriesColor(seriesIndex) + text + COLOR_RESET),
		});
		lines.push(...chart, "");

		for (let i = 0; i < this.model.series.length; i++) {
			const s = this.model.series[i]!;
			const marker = seriesColor(i) + "●" + COLOR_RESET;
			const value = formatAxisCost(s.total);
			const pct =
				s.key !== TOTAL_SERIES_KEY && this.model.groupedTotal > 0
					? ` ${this.dimFn(`${Math.round((s.total / this.model.groupedTotal) * 100)}%`)}`
					: "";
			lines.push(`  ${marker} ${padRightVis(s.label, 24)} ${padLeftVis(value, 8)}${pct}`);
		}

		return lines.map((line) => truncateToWidth(line, width, ""));
	}

	invalidate(): void {
		// Stateless: theme callbacks and renderChart run on every render.
	}
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
		const contentBox = new Container();

		// Render a text segment, swapping any usage-chart marker block for a live
		// UsageChartCard and rendering the surrounding text as markdown.
		const addSegment = (segment: string) => {
			const trimmed = segment.trim();
			if (!trimmed) return;
			const chartStart = trimmed.indexOf(USAGE_CHART_START);
			const chartEnd = trimmed.indexOf(USAGE_CHART_END);
			if (chartStart < 0 || chartEnd < chartStart) {
				if (trimmed) contentBox.addChild(markdown(trimmed));
				return;
			}
			const beforeChart = trimmed.slice(0, chartStart).trim();
			const json = trimmed.slice(chartStart + USAGE_CHART_START.length, chartEnd).trim();
			const afterChart = trimmed.slice(chartEnd + USAGE_CHART_END.length).trim();
			if (beforeChart) contentBox.addChild(markdown(beforeChart));
			try {
				const model = JSON.parse(json) as GraphModel;
				contentBox.addChild(new Spacer(1));
				contentBox.addChild(new UsageChartCard(
					model,
					(line) => theme.fg("mdHeading", theme.bold(line)),
					(line) => theme.fg("muted", line),
					(line) => theme.fg("dim", line),
				));
			} catch {
				// Malformed model: skip the panel rather than dumping raw JSON.
			}
			if (afterChart) contentBox.addChild(markdown(afterChart));
		};

		// The quick-reference card is static, so its markers just mark where to
		// insert the component; everything before them (deck, usage chart, context
		// lines) flows through addSegment.
		const quickRefStart = content.indexOf(QUICK_REF_START);
		if (quickRefStart >= 0) {
			addSegment(content.slice(0, quickRefStart));
			contentBox.addChild(new Spacer(1));
			contentBox.addChild(new QuickReferenceCard(
				QUICK_REFERENCE,
				(line) => theme.fg("borderMuted", line),
				(line) => theme.fg("mdHeading", theme.bold(line)),
				(line) => theme.fg("mdHeading", theme.bold(line)),
				(line) => theme.fg("accent", line),
				(line) => theme.fg("muted", line),
			));
		} else {
			addSegment(content);
		}
		box.addChild(contentBox);
		return box;
	});

	pi.on("session_start", async (_event, ctx) => {
		// Purely decorative banner: in headless/print mode it would land after the
		// prompt and trigger a spurious extra turn, so interactive sessions only.
		if (!ctx.hasUI) return;
		ctx.ui.setWidget("session-dashboard-loading", ["Preparing session dashboard…"]);
		try {
			const cwd = ctx.cwd;
			// Only the usage cache is needed now (branch/status live in the status
			// bar). collectUsageData may do a cold build, so keep it off the hot path.
			const usage = await collectUsageData().catch(() => null);

			let usageChart: string | undefined;
			if (usage) {
				// Same model the /usage Graphs view builds for This Week · Per bucket
				// cost · by provider. GraphModel is plain arrays/objects, so it serializes
				// cleanly into the banner text and is rebuilt by the message renderer.
				const model = buildGraphModel(usage.hourly, {
					period: "thisWeek",
					metric: "cost",
					groupBy: "provider",
					cumulative: false,
					bounds: usage.bounds,
				});
				usageChart = JSON.stringify(model);
			}

			// Slim context lines rendered as plain markdown above the quick-reference
			// card: the working directory and whatever context files pi loaded.
			const contextLines = [truncateLeft(tildify(cwd), 60)];
			const contextFiles = contextFileList(cwd);
			if (contextFiles.length > 0) contextLines.push(`📜 ${contextFiles.join(" · ")}`);

			const bundle = loadBundleResources();
			const welcomeText = renderWelcomeText({
				extensionDeck: bundle.extensions.length > 0 ? renderExtensionDeck(bundle.extensions) : "",
				usageChart,
				contextInfo: contextLines.join("\n"),
			});

			pi.sendMessage(
				{
					customType: "session-dashboard",
					content: welcomeText,
					display: true,
				},
				{ triggerTurn: false }
			);
		} finally {
			ctx.ui.setWidget("session-dashboard-loading", undefined);
		}
	});
}
