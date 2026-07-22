import type { SessionEntry } from "@earendil-works/pi-coding-agent";

export interface SessionEvidenceOptions {
	raw?: boolean;
	maxCharacters?: number;
}

interface ToolStats {
	results: number;
	textCharacters: number;
	images: number;
	errors: number;
	maxTextCharacters: number;
}

interface LargestToolResult {
	tool: string;
	textCharacters: number;
	sequence: number;
}

interface ToolOutputMetrics {
	results: number;
	textCharacters: number;
	images: number;
	errors: number;
	byTool: Map<string, ToolStats>;
	largest: LargestToolResult[];
}

const MATERIAL_SINGLE_RESULT_CHARACTERS = 20_000;
const MATERIAL_SESSION_CHARACTERS = 100_000;
const MATERIAL_CONCENTRATION_MIN_CHARACTERS = 20_000;
const MATERIAL_CONCENTRATION_RATIO = 0.7;
const LARGEST_RESULT_COUNT = 3;

function contentText(content: unknown): string {
	if (typeof content === "string") return content;
	if (!Array.isArray(content)) return "";
	return content
		.map((part) => {
			if (!part || typeof part !== "object") return "";
			const item = part as Record<string, unknown>;
			if (item.type === "text" && typeof item.text === "string") return item.text;
			if (item.type === "toolCall") {
				return `tool ${String(item.name ?? "unknown")} ${JSON.stringify(item.arguments ?? {})}`;
			}
			return "";
		})
		.filter(Boolean)
		.join("\n");
}

function safeToolName(value: unknown): string {
	const name = String(value ?? "unknown").slice(0, 80);
	return name.replace(/[^a-zA-Z0-9_.:-]/g, "?") || "unknown";
}

function measureToolContent(content: unknown): { textCharacters: number; images: number } {
	if (typeof content === "string") return { textCharacters: content.length, images: 0 };
	if (!Array.isArray(content)) return { textCharacters: 0, images: 0 };

	let textCharacters = 0;
	let images = 0;
	for (const part of content) {
		if (!part || typeof part !== "object") continue;
		const item = part as Record<string, unknown>;
		if (item.type === "text" && typeof item.text === "string") textCharacters += item.text.length;
		else if (item.type === "image") images++;
	}
	return { textCharacters, images };
}

function createToolOutputMetrics(): ToolOutputMetrics {
	return { results: 0, textCharacters: 0, images: 0, errors: 0, byTool: new Map(), largest: [] };
}

function recordToolOutput(metrics: ToolOutputMetrics, message: any): void {
	const tool = safeToolName(message.toolName);
	const measured = measureToolContent(message.content);
	const isError = Boolean(message.isError);
	const stats = metrics.byTool.get(tool) ?? {
		results: 0,
		textCharacters: 0,
		images: 0,
		errors: 0,
		maxTextCharacters: 0,
	};
	stats.results++;
	stats.textCharacters += measured.textCharacters;
	stats.images += measured.images;
	if (isError) stats.errors++;
	stats.maxTextCharacters = Math.max(stats.maxTextCharacters, measured.textCharacters);
	metrics.byTool.set(tool, stats);

	metrics.results++;
	metrics.textCharacters += measured.textCharacters;
	metrics.images += measured.images;
	if (isError) metrics.errors++;
	metrics.largest.push({ tool, textCharacters: measured.textCharacters, sequence: metrics.results });
	metrics.largest.sort((a, b) => b.textCharacters - a.textCharacters || a.sequence - b.sequence);
	if (metrics.largest.length > LARGEST_RESULT_COUNT) metrics.largest.pop();
}

function renderToolOutputMetrics(metrics: ToolOutputMetrics): string {
	const largestSingle = metrics.largest[0]?.textCharacters ?? 0;
	const dominantToolCharacters = Math.max(0, ...[...metrics.byTool.values()].map((stats) => stats.textCharacters));
	const materiallyConcentrated =
		metrics.textCharacters >= MATERIAL_CONCENTRATION_MIN_CHARACTERS &&
		dominantToolCharacters / metrics.textCharacters >= MATERIAL_CONCENTRATION_RATIO;
	const material =
		largestSingle >= MATERIAL_SINGLE_RESULT_CHARACTERS ||
		metrics.textCharacters >= MATERIAL_SESSION_CHARACTERS ||
		materiallyConcentrated;
	const tools = [...metrics.byTool.entries()]
		.sort(([aName, a], [bName, b]) => b.textCharacters - a.textCharacters || aName.localeCompare(bName))
		.map(([tool, stats]) =>
			`${tool}(results=${stats.results},chars=${stats.textCharacters},max=${stats.maxTextCharacters},images=${stats.images},errors=${stats.errors})`
		)
		.join("; ") || "none";
	const largest = metrics.largest.map((result) => `${result.tool}:${result.textCharacters}`).join("; ") || "none";
	return [
		`<tool_output_metrics scope="session-lifetime" unit="text-characters" material="${material}">`,
		`results=${metrics.results} chars=${metrics.textCharacters} images=${metrics.images} errors=${metrics.errors}`,
		`byTool=${tools}`,
		`largest=${largest}`,
		"</tool_output_metrics>",
	].join("\n");
}

function compact(text: string, limit: number): string {
	const normalized = text.replace(/\s+/g, " ").trim();
	return normalized.length <= limit ? normalized : `${normalized.slice(0, limit)}… [${normalized.length - limit} chars omitted]`;
}

export function buildSessionEvidence(
	entries: SessionEntry[],
	options: SessionEvidenceOptions = {},
): string {
	const raw = options.raw ?? false;
	const maxCharacters = options.maxCharacters ?? (raw ? 120_000 : 40_000);
	const perEntryLimit = raw ? 12_000 : 1_500;
	const lines: string[] = [];
	const toolOutputMetrics = createToolOutputMetrics();
	let input = 0;
	let output = 0;
	let cacheRead = 0;
	let reasoning = 0;
	let cost = 0;
	let toolCalls = 0;
	let toolErrors = 0;

	for (const entry of entries) {
		if (entry.type !== "message") continue;
		const message = entry.message as any;
		const role = String(message.role ?? "unknown");
		const timestamp = String(message.timestamp ?? (entry as any).timestamp ?? "");
		const text = contentText(message.content);
		if (role === "toolResult") recordToolOutput(toolOutputMetrics, message);
		if (role === "assistant") {
			const usage = message.usage ?? {};
			input += usage.input ?? 0;
			output += usage.output ?? 0;
			cacheRead += usage.cacheRead ?? 0;
			reasoning += usage.reasoning ?? 0;
			cost += usage.cost?.total ?? 0;
			if (Array.isArray(message.content)) {
				toolCalls += message.content.filter((item: any) => item?.type === "toolCall").length;
			}
		}
		if (role === "toolResult" && message.isError) toolErrors++;
		if (!text && role !== "toolResult") continue;
		const tool = role === "toolResult" && message.toolName ? `:${message.toolName}` : "";
		lines.push(`${timestamp || "?"} ${role}${tool} | ${compact(text, perEntryLimit)}`);
	}

	const header = [
		`entries=${entries.length}`,
		`toolCalls=${toolCalls}`,
		`toolErrors=${toolErrors}`,
		`input=${input}`,
		`output=${output}`,
		`cacheRead=${cacheRead}`,
		`reasoning=${reasoning}`,
		`costUsd=${cost.toFixed(6)}`,
	].join(" ");
	const metrics = renderToolOutputMetrics(toolOutputMetrics);
	const prefix = `${header}\n\n${metrics}`;
	const full = `${prefix}\n\n${lines.join("\n")}`;
	if (full.length <= maxCharacters) return full;

	// Keep the newest entries, not the oldest: this evidence exists to answer
	// "what just happened" for /retro and /forensic, so truncating from the
	// end (dropping recent activity, keeping ancient history) is backwards.
	const body = lines.join("\n");
	const notice = "[earlier evidence omitted; report this limitation.]";
	const budget = maxCharacters - prefix.length - notice.length - 4; // 2 blank-line separators
	if (budget <= 0) return `${prefix}\n\n${notice}`;
	const kept = body.slice(-budget);
	return `${prefix}\n\n${notice}\n\n${kept}`;
}
