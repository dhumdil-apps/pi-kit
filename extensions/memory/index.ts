/**
 * Project Memory — minimal replacement for pi-memory-md.
 *
 * One `.pi/MEMORY.md` per project:
 * - Injected into the system prompt each turn (when present, truncated ~8k chars).
 * - `remember` tool appends dated decision/learning/preference entries.
 * - `/memory` shows the file.
 * Toggle via /extension-settings → memory → enabled.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { getSetting } from "../extension-settings/index.js";

const EXTENSION_NAME = "memory";
const MAX_INJECT_CHARS = 8_000;
const EMPTY_TEMPLATE = "# Project Memory\n\n## Log\n";

function memoryPath(cwd: string): string {
	return join(cwd, ".pi", "MEMORY.md");
}

function truncate(content: string): string {
	if (content.length <= MAX_INJECT_CHARS) return content;
	// Keep the tail — newest log entries live at the bottom.
	return `…(older memory truncated)…\n${content.slice(-MAX_INJECT_CHARS)}`;
}

export default function memoryExtension(pi: ExtensionAPI): void {
	pi.events.emit("pi-extension-settings:register", {
		name: EXTENSION_NAME,
		settings: [
			{ id: "enabled", label: "Project memory (.pi/MEMORY.md)", defaultValue: "on", values: ["on", "off"] },
		],
	});

	pi.on("before_agent_start", async (event, ctx) => {
		if (getSetting(EXTENSION_NAME, "enabled", "on") === "off") return;
		const content = await readFile(memoryPath(ctx.cwd), "utf8").catch(() => "");
		if (!content.trim()) return;
		return {
			systemPrompt: `${event.systemPrompt}\n\n[PROJECT MEMORY — ${memoryPath(ctx.cwd)}]\n${truncate(content.trim())}\n\nUse the remember tool to record durable decisions, learnings, or user preferences worth recalling in future sessions.`,
		};
	});

	pi.registerTool({
		name: "remember",
		label: "Remember",
		description:
			"Append a dated entry to the project's .pi/MEMORY.md. Use for durable decisions, learnings, and user preferences worth recalling in future sessions. Do not record transient task state.",
		parameters: Type.Object({
			note: Type.String({ description: "One concise sentence to remember." }),
			category: Type.Optional(
				Type.Union([Type.Literal("decision"), Type.Literal("learning"), Type.Literal("preference")], {
					description: "Kind of memory entry.",
				}),
			),
		}),
		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			const path = memoryPath(ctx.cwd);
			await mkdir(dirname(path), { recursive: true });
			const existing = await readFile(path, "utf8").catch(() => EMPTY_TEMPLATE);
			const date = new Date().toISOString().slice(0, 10);
			const entry = `- [${date}]${params.category ? ` (${params.category})` : ""} ${params.note.trim()}\n`;
			const base = existing.endsWith("\n") ? existing : `${existing}\n`;
			await writeFile(path, base + entry, "utf8");
			return { content: [{ type: "text", text: `Remembered: ${params.note.trim()}` }], details: undefined };
		},
	});

	pi.registerCommand("memory", {
		description: "Show project memory (.pi/MEMORY.md)",
		handler: async (_args, ctx) => {
			const content = await readFile(memoryPath(ctx.cwd), "utf8").catch(() => "");
			pi.sendMessage(
				{
					customType: "memory",
					content: content.trim() || "_No project memory yet. The remember tool creates `.pi/MEMORY.md`._",
					display: true,
				},
				{ triggerTurn: false },
			);
		},
	});
}
