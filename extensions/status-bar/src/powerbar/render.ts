/**
 * Rendering logic for the powerbar.
 *
 * Builds independently aligned semantic rows, joined by themed separators.
 * Supports two progress bar styles:
 * continuous (█ + partial-width glyphs ▏▎▍▌▋▊▉) and blocks
 * (discrete partial-height glyphs ▁▂▃▄▅▆▇█ with dim background).
 */

import type { Theme, ThemeColor } from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import type { PowerbarSettings } from "./settings.js";

export interface Segment {
	id: string;
	/** Primary text, rendered before the bar. */
	text: string;
	/** Text rendered after the bar (e.g., "59%"). */
	suffix?: string;
	icon?: string;
	color?: string;
	/** If set, renders a progress bar. Value is 0–100. */
	bar?: number;
	/** Hint for how many discrete blocks to use in blocks mode. Falls back to barWidth setting. */
	barSegments?: number;
	/** Fixed semantic row: identity (1), session/context (2), or system/quota (3). */
	row?: 1 | 2 | 3;
	/** Render on the right while active even when absent from saved settings. */
	transient?: boolean;
}

/**
 * Render a continuous progress bar using full-width block characters.
 *
 * █ for filled columns, ▏▎▍▌▋▊▉ for the partial column, space for empty.
 */
function renderProgressBar(percent: number, width: number, theme: Theme, color: string): string {
	const clamped = Math.max(0, Math.min(100, percent));
	const filledFloat = (clamped / 100) * width;
	const filledFull = Math.floor(filledFloat);
	const remainder = filledFloat - filledFull;

	// Partial block levels: ▏(1/8) ▎(2/8) ▍(3/8) ▌(4/8) ▋(5/8) ▊(6/8) ▉(7/8)
	const levels = ["▏", "▎", "▍", "▌", "▋", "▊", "▉"];

	const themeColor = color as ThemeColor;
	const filledStr = "█".repeat(filledFull);

	let partial = "";
	let emptyCount = width - filledFull;

	if (remainder >= 0.0625 && filledFull < width) {
		const levelIndex = Math.max(0, Math.min(levels.length - 1, Math.round(remainder * 8) - 1));
		partial = levels[levelIndex];
		emptyCount = Math.max(0, emptyCount - 1);
	}

	const emptyStr = " ".repeat(emptyCount);

	return theme.fg(themeColor, filledStr + partial) + emptyStr;
}

/** Convert a foreground ANSI escape to background by replacing SGR 38 with 48. */
function fgToBgAnsi(fgAnsi: string): string {
	return fgAnsi.replace("\x1b[38;", "\x1b[48;");
}

/**
 * Render a bar of discrete block characters with a dim background track.
 *
 * Splits the 0–100 percent range evenly across `segments` blocks and
 * computes a fill level (0–8) per block. The dim theme color provides
 * the background "track"; partial block glyphs fill from the bottom
 * in the segment color.
 */
function renderBlocksBar(percent: number, segments: number, theme: Theme, color: string): string {
	const glyphs = [" ", "▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"];
	const dimBg = fgToBgAnsi(theme.getFgAnsi("dim"));
	const fgColor = theme.getFgAnsi((color || "muted") as ThemeColor);
	const reset = "\x1b[39m\x1b[49m";
	const clamped = Math.max(0, Math.min(100, percent));
	const filledFloat = (clamped / 100) * segments;

	const result: string[] = [];
	for (let i = 0; i < segments; i++) {
		const blockFill = Math.max(0, Math.min(1, filledFloat - i));
		const level = Math.round(blockFill * 8);
		const glyph = glyphs[level];
		result.push(level > 0 ? `${dimBg}${fgColor}${glyph}${reset}` : `${dimBg}${glyph}${reset}`);
	}

	return result.join(" ");
}

/**
 * Render a single segment.
 *
 * Layout: [icon] [text] [bar] [suffix]
 */
function renderSegmentText(segment: Segment, settings: PowerbarSettings, theme: Theme): string {
	const parts: string[] = [];
	const themeColor = (segment.color || "muted") as ThemeColor;

	if (segment.icon) {
		parts.push(theme.fg(themeColor, segment.icon));
	}

	if (segment.text) {
		parts.push(theme.fg(themeColor, segment.text));
	}

	if (segment.bar !== undefined) {
		const color = segment.color || "muted";
		if (settings.barStyle === "blocks") {
			const blockCount = segment.barSegments ?? settings.barWidth;
			parts.push(renderBlocksBar(segment.bar, blockCount, theme, color));
		} else {
			parts.push(renderProgressBar(segment.bar, settings.barWidth, theme, color));
		}
	}

	if (segment.suffix) {
		parts.push(theme.fg(themeColor, segment.suffix));
	}

	return parts.join(" ");
}

interface RenderedSegment {
	text: string;
	width: number;
}

function renderSideSegments(
	ids: string[],
	segments: Map<string, Segment>,
	settings: PowerbarSettings,
	theme: Theme,
): RenderedSegment[] {
	const rendered: RenderedSegment[] = [];
	for (const id of ids) {
		const seg = segments.get(id);
		if (!seg || (!seg.text && !seg.suffix && seg.bar === undefined)) continue;
		const text = renderSegmentText(seg, settings, theme);
		rendered.push({ text, width: visibleWidth(text) });
	}
	return rendered;
}

function joinSegments(segments: RenderedSegment[], separator: string, separatorWidth: number): RenderedSegment {
	if (segments.length === 0) return { text: "", width: 0 };
	const text = segments.map((s) => s.text).join(separator);
	const width = segments.reduce((sum, s) => sum + s.width, 0) + separatorWidth * (segments.length - 1);
	return { text, width };
}

/**
 * Truncate the widest segment to reclaim overflow space.
 * Mutates the array in place and returns the new total width.
 */
function shrinkWidest(segments: RenderedSegment[], overflow: number): void {
	if (segments.length === 0) return;

	let widestIdx = 0;
	for (let i = 1; i < segments.length; i++) {
		if (segments[i].width > segments[widestIdx].width) {
			widestIdx = i;
		}
	}

	const seg = segments[widestIdx];
	const targetWidth = Math.max(1, seg.width - overflow);
	segments[widestIdx] = {
		text: truncateToWidth(seg.text, targetWidth, "…"),
		width: targetWidth,
	};
}

function renderAlignedLine(
	leftIds: string[],
	rightIds: string[],
	segments: Map<string, Segment>,
	settings: PowerbarSettings,
	theme: Theme,
	width: number,
): string {
	const separator = theme.fg("dim", settings.separator);
	const separatorWidth = visibleWidth(separator);
	const leftSegs = renderSideSegments(leftIds, segments, settings, theme);
	const rightSegs = renderSideSegments(rightIds, segments, settings, theme);
	const allSegs = [...leftSegs, ...rightSegs];

	const leftSepCount = Math.max(0, leftSegs.length - 1);
	const rightSepCount = Math.max(0, rightSegs.length - 1);
	const totalSepWidth = (leftSepCount + rightSepCount) * separatorWidth;
	const minPadding = 1;
	let overflow = allSegs.reduce((sum, segment) => sum + segment.width, 0) + totalSepWidth + minPadding - width;

	for (let i = 0; i < allSegs.length && overflow > 0; i++) {
		shrinkWidest(allSegs, overflow);
		const segmentWidth = allSegs.reduce((sum, segment) => sum + segment.width, 0);
		overflow = segmentWidth + totalSepWidth + minPadding - width;
	}

	const left = joinSegments(allSegs.slice(0, leftSegs.length), separator, separatorWidth);
	const right = joinSegments(allSegs.slice(leftSegs.length), separator, separatorWidth);
	const padding = Math.max(minPadding, width - left.width - right.width);
	return truncateToWidth(`${left.text}${" ".repeat(padding)}${right.text}`, width, "…");
}

/** Render identity, session/context, and system/quota segments on independent rows. */
export function renderBar(
	segments: Map<string, Segment>,
	settings: PowerbarSettings,
	theme: Theme,
	width: number,
): string[] {
	const configured = new Set([...settings.left, ...settings.right]);
	const transient = [...segments.values()]
		.filter((segment) => segment.transient && !configured.has(segment.id))
		.map((segment) => segment.id);
	const right = [...settings.right, ...transient];
	const rowFor = (id: string): 1 | 2 | 3 => segments.get(id)?.row ?? 1;
	const hasContent = (id: string): boolean => {
		const segment = segments.get(id);
		return !!segment && (!!segment.text || !!segment.suffix || segment.bar !== undefined);
	};

	const lines: string[] = [];
	for (const row of [1, 2, 3] as const) {
		const leftIds = settings.left.filter((id) => rowFor(id) === row && hasContent(id));
		const rightIds = right.filter((id) => rowFor(id) === row && hasContent(id));
		if (leftIds.length === 0 && rightIds.length === 0) continue;
		lines.push(renderAlignedLine(leftIds, rightIds, segments, settings, theme, width));
	}
	return lines.length > 0 ? lines : [" ".repeat(width)];
}
