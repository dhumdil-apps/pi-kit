import { readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getAgentDir, loadProjectContextFiles } from "@earendil-works/pi-coding-agent";
import type { ExtensionAPI, Theme } from "@earendil-works/pi-coding-agent";
import { Box, type Component, Container, Markdown, Spacer, truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import { renderHelp } from "./help.js";
import { collectUsageData } from "../usage-history/data.js";
import { buildGraphModel, type GraphModel, renderChart, TOTAL_SERIES_KEY } from "../usage-history/graph.js";
import { COLOR_RESET, formatAxisCost, seriesColor } from "../usage-history/index.js";
import { USAGE_CHART_END, USAGE_CHART_START, renderWelcomeText } from "./welcome.js";

const BUNDLE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** One consistent separator across the whole context line. */
const CONTEXT_SEP = " · ";

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
 * "Last 30 Days · Per bucket cost · by model" mode. Holds a pre-built GraphModel
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
		const lines: string[] = [this.titleFn("Last 30 Days") + this.mutedFn(" · Per bucket cost · by model")];

		if (this.model.groupedTotal === 0) {
			lines.push(this.dimFn("  No usage in the last 30 days"));
			return lines.map((line) => truncateToWidth(line, width, ""));
		}

		const spanMs = this.model.domainEndMs - this.model.domainStartMs;
		const formatTime = (ms: number): string => {
			const d = new Date(ms);
			const hm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
			// Short spans use times or weekday + time so ticks stay distinct.
			// The 30-day dashboard uses dates.
			if (spanMs <= 26 * 3_600_000) return hm;
			if (spanMs <= 8 * 24 * 3_600_000) return `${d.toLocaleDateString(undefined, { weekday: "short" })} ${hm}`;
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

		// Total is excluded from the chart (see the build site) — keep it out of the
		// series legend too, and close with it as a dim summary row instead.
		for (let i = 0; i < this.model.series.length; i++) {
			const s = this.model.series[i]!;
			if (s.key === TOTAL_SERIES_KEY) continue;
			const marker = seriesColor(i) + "●" + COLOR_RESET;
			const value = formatAxisCost(s.total);
			const pct =
				this.model.groupedTotal > 0 ? ` ${this.dimFn(`${Math.round((s.total / this.model.groupedTotal) * 100)}%`)}` : "";
			lines.push(`  ${marker} ${padRightVis(s.label, 24)} ${padLeftVis(value, 8)}${pct}`);
		}

		const total = this.model.series.find((s) => s.key === TOTAL_SERIES_KEY);
		// One blank marker column keeps the row aligned with the series rows above.
		if (total) lines.push(this.dimFn(`    ${padRightVis(total.label, 24)} ${padLeftVis(formatAxisCost(total.total), 8)}`));

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
export function contextFileList(cwd: string): string[] {
	try {
		return loadProjectContextFiles({ cwd, agentDir: getAgentDir() }).map((f) => {
			const inProject = f.path.startsWith(`${cwd}/`);
			const displayPath = inProject ? `./${f.path.slice(cwd.length + 1)}` : tildify(f.path);
			if (displayPath.endsWith("MEMORY.md")) {
				try {
					const content = readFileSync(f.path, "utf8");
					const lines = content.split("\n").filter((line) => line.trim().length > 0).length;
					return `${displayPath} (${lines} line${lines === 1 ? "" : "s"} · workarounds)`;
				} catch {
					return displayPath;
				}
			}
			return displayPath;
		});
	} catch {
		return [];
	}
}

/** Flatten a custom message's content (string or content-item array) to text. */
function messageText(content: string | { type: string; text?: string }[]): string {
	return typeof content === "string"
		? content
		: content.filter((item) => item.type === "text").map((item) => item.text ?? "").join("\n");
}

/** Markdown component wired to the interactive theme, shared by the banner and /help. */
function themedMarkdown(theme: Theme, text: string): Markdown {
	return new Markdown(text, 0, 0, {
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
}

export default function sessionDashboardExtension(pi: ExtensionAPI): void {
	pi.registerMessageRenderer("session-dashboard", (message, _options, theme) => {
		const content = messageText(message.content);
		const markdown = (text: string) => themedMarkdown(theme, text);
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
			if (afterChart) {
				// The chart is a component, so the blank line the source text puts
				// before the context tail gets trimmed — re-add it as a Spacer so the
				// tail is not jammed against the chart legend.
				contentBox.addChild(new Spacer(1));
				contentBox.addChild(markdown(afterChart));
			}
		};

		// The whole banner is markdown plus the usage-chart marker block, which
		// addSegment swaps for the live UsageChartCard.
		addSegment(content);
		box.addChild(contentBox);
		return box;
	});

	// /help renders as markdown inside the same themed box as the banner.
	pi.registerMessageRenderer("session-dashboard-help", (message, _options, theme) => {
		const box = new Box(1, 1, (text) => theme.bg("customMessageBg", text));
		box.addChild(themedMarkdown(theme, messageText(message.content)));
		return box;
	});

	pi.registerCommand("help", {
		description: "List the bundle's extensions, commands, and shortcuts",
		handler: async () => {
			const bundle = loadBundleResources();
			pi.sendMessage(
				{ customType: "session-dashboard-help", content: renderHelp(bundle.extensions), display: true },
				{ triggerTurn: false },
			);
		},
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
				// Same model the /usage Graphs view builds for Last 30 Days · Per bucket
				// cost · by model. GraphModel is plain arrays/objects, so it serializes
				// cleanly into the banner text and is rebuilt by the message renderer.
				// Total is hidden here (unlike /usage, where the legend can toggle it):
				// renderChart draws it last so it wins contested cells, which on this
				// small card overdraws the very per-model lines it summarizes. Hiding it
				// at build time also keeps it out of the serialized model's yMax.
				const model = buildGraphModel(usage.hourly, {
					period: "last30Days",
					metric: "cost",
					groupBy: "model",
					cumulative: false,
					hidden: new Set([TOTAL_SERIES_KEY]),
					bounds: usage.bounds,
				});
				usageChart = JSON.stringify(model);
			}

			// One concise markdown line: working directory + loaded files (italic /
			// de-emphasised) then `/help` as code so it pops — `/help` lists every
			// other command, so it is the only pointer the banner needs.
			const chips = [`*${truncateLeft(tildify(cwd), 60)}*`];
			const contextFiles = contextFileList(cwd);
			if (contextFiles.length > 0) chips.push(`*📜 ${contextFiles.join(CONTEXT_SEP)}*`);
			chips.push("❓ `/help`");
			const contextInfo = chips.join(CONTEXT_SEP);

			const welcomeText = renderWelcomeText({
				welcome: "π Measure twice, cut once. What’s your goal?",
				usageChart,
				contextInfo,
				tip: "*⚡ Raw Pi: `pi --no-extensions`*",
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
