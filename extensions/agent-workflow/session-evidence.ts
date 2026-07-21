import type { SessionEntry } from "@earendil-works/pi-coding-agent";

export interface SessionEvidenceOptions {
	raw?: boolean;
	maxCharacters?: number;
}

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
	const full = `${header}\n\n${lines.join("\n")}`;
	if (full.length <= maxCharacters) return full;

	// Keep the newest entries, not the oldest: this evidence exists to answer
	// "what just happened" for /retro and /forensic, so truncating from the
	// end (dropping recent activity, keeping ancient history) is backwards.
	const body = lines.join("\n");
	const notice = "[earlier evidence omitted; report this limitation.]";
	const budget = maxCharacters - header.length - notice.length - 4; // 2 blank-line separators
	if (budget <= 0) return `${header}\n\n${notice}`;
	const kept = body.slice(-budget);
	return `${header}\n\n${notice}\n\n${kept}`;
}
