export interface ExtensionPresentation {
	name: string;
	group: "display" | "usage" | "workflow" | "guardrails" | "config";
	description: string;
}

export const EXTENSION_GROUPS = [
	{ id: "display", title: "Display" },
	{ id: "usage", title: "Usage" },
	{ id: "workflow", title: "Workflow" },
	{ id: "guardrails", title: "Guardrails" },
	{ id: "config", title: "Config" },
] as const;

/**
 * User-facing descriptions for every extension registered by this bundle.
 * Keep this list in sync with the live manifest; the focused test enforces
 * a one-to-one match.
 */
export const EXTENSION_PRESENTATIONS: readonly ExtensionPresentation[] = [
	{
		name: "session-dashboard",
		group: "display",
		description: "Renders this startup welcome (Pi glyph, This-Week cost chart, project context) and provides `/help`; reads local usage history.",
	},
	{
		name: "status-bar",
		group: "display",
		description: "Persistent status line: git, tokens, context, model, system, and quota segments.",
	},
	{
		name: "usage-monitor",
		group: "usage",
		description: "Tracks subscription quota — cached at startup, refreshed every 60s and on model/session change; `/usage-refresh`.",
	},
	{
		name: "usage-history",
		group: "usage",
		description: "Reads local session records to render historical token and spend data with `/usage`.",
	},
	{
		name: "agent-workflow",
		group: "workflow",
		description: "Guides the planning workflow with plan persistence and durable project memory.",
	},
	{
		name: "progress-tracker",
		group: "workflow",
		description: "Persists workflow phase and todos in sessions; provides `manage_todo_list` and `/todos`.",
	},
	{
		name: "interrupt-confirmation",
		group: "guardrails",
		description: "Confirms an interrupt before it stops a running agent.",
	},
	{
		name: "extension-preferences",
		group: "config",
		description: "Stores shared extension settings locally and provides `/extension-settings`.",
	},
];

export function presentationCoverageErrors(extensionNames: readonly string[]): string[] {
	const active = new Set(extensionNames);
	const presented = new Set(EXTENSION_PRESENTATIONS.map((presentation) => presentation.name));
	const missing = extensionNames.filter((name) => !presented.has(name));
	const inactive = EXTENSION_PRESENTATIONS.map((presentation) => presentation.name).filter((name) => !active.has(name));
	return [
		...missing.map((name) => `Missing presentation metadata for active extension: ${name}`),
		...inactive.map((name) => `Presentation metadata references inactive extension: ${name}`),
	];
}

/**
 * Render the manifest's active extensions as one aligned line per group
 * (`Group  name · name`) — compact, so the banner stays short. Per-extension
 * descriptions live in each extension's README, not here.
 */
export function renderExtensionDeck(extensionNames: readonly string[]): string {
	const active = new Set(extensionNames);
	const labelWidth = Math.max(...EXTENSION_GROUPS.map((group) => group.title.length), "Other".length);
	const line = (title: string, names: readonly string[]) =>
		`**${title}**${" ".repeat(labelWidth - title.length + 2)}${names.join(" · ")}`;
	const groups = EXTENSION_GROUPS.flatMap((group) => {
		const names = EXTENSION_PRESENTATIONS
			.filter((presentation) => presentation.group === group.id && active.has(presentation.name))
			.map((presentation) => presentation.name);
		return names.length > 0 ? [line(group.title, names)] : [];
	});
	const presented = new Set(EXTENSION_PRESENTATIONS.map((presentation) => presentation.name));
	const unknown = extensionNames.filter((name) => !presented.has(name));
	if (unknown.length > 0) groups.push(line("Other", unknown));
	return `🧩 **Extensions** (${extensionNames.length})\n\n${groups.join("\n")}`;
}
