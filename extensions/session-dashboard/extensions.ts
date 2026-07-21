export interface ExtensionPresentation {
	name: string;
	group: "ui" | "flow" | "config";
	description: string;
}

export const EXTENSION_GROUPS = [
	{ id: "ui", title: "UI" },
	{ id: "flow", title: "Flow" },
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
		group: "ui",
		description: "Renders the startup map after session start; reads Git and local usage history.",
	},
	{
		name: "status-bar",
		group: "ui",
		description: "Renders git, tokens, context, model, system, and quota state; `/extension-settings`.",
	},
	{
		name: "usage-monitor",
		group: "ui",
		description: "Uses cached quota at startup, then calls provider quota APIs every 60s and on model/session changes; `/usage-refresh`.",
	},
	{
		name: "progress-tracker",
		group: "flow",
		description: "Persists workflow phase and todos in sessions; provides `manage_todo_list` and `/todos`.",
	},
	{
		name: "minimal-action-confirmation",
		group: "flow",
		description: "Intercepts guarded tool calls and confirms destructive commands, external writes, web access, and vendored reads.",
	},
	{
		name: "interrupt-confirmation",
		group: "flow",
		description: "Confirms an interrupt before it stops a running agent.",
	},
	{
		name: "agent-workflow",
		group: "flow",
		description: "Guides GOAL → PLANNING → IMPLEMENTATION, plan persistence, Flash, retrospectives, and improvements.",
	},
	{
		name: "extension-preferences",
		group: "config",
		description: "Stores shared extension settings locally and provides `/extension-settings`.",
	},
	{
		name: "usage-history",
		group: "config",
		description: "Reads local session records to render historical token and spend data with `/usage`.",
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

/** Render the manifest's active extensions in stable, user-oriented groups. */
export function renderExtensionDeck(extensionNames: readonly string[]): string {
	const active = new Set(extensionNames);
	const groups = EXTENSION_GROUPS.flatMap((group) => {
		const entries = EXTENSION_PRESENTATIONS
			.filter((presentation) => presentation.group === group.id && active.has(presentation.name))
			.map((presentation) => `- **${presentation.name}** — ${presentation.description}`);
		return entries.length > 0 ? [`**${group.title}**`, ...entries].join("\n") : [];
	});
	const presented = new Set(EXTENSION_PRESENTATIONS.map((presentation) => presentation.name));
	const unknown = extensionNames.filter((name) => !presented.has(name));
	if (unknown.length > 0) {
		groups.push(["**Other extensions**", ...unknown.map((name) => `- **${name}** — active extension`)].join("\n"));
	}
	return `🧩 **Extensions** (${extensionNames.length})\n\n${groups.join("\n\n")}`;
}
