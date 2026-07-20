export interface ExtensionPresentation {
	name: string;
	group: "workflow" | "progress" | "safety" | "session";
	description: string;
}

export const EXTENSION_GROUPS = [
	{ id: "session", title: "Session" },
	{ id: "progress", title: "Progress & usage" },
	{ id: "safety", title: "Safety" },
	{ id: "workflow", title: "Workflow & setup" },
] as const;

/**
 * User-facing descriptions for every extension registered by this bundle.
 * Keep this list in sync with the live manifest; the focused test enforces
 * a one-to-one match.
 */
export const EXTENSION_PRESENTATIONS: readonly ExtensionPresentation[] = [
	{
		name: "extension-settings",
		group: "workflow",
		description: "shared extension settings; `/extension-settings`",
	},
	{
		name: "ask-user",
		group: "workflow",
		description: "inline choice and confirmation prompts; `ask_user`",
	},
	{
		name: "claude-style",
		group: "workflow",
		description: "guides each turn through Explore → Align → Build → Review (automatic)",
	},
	{
		name: "manage-todo-list",
		group: "progress",
		description: "plan-step progress widget; `manage_todo_list`, `/todos`",
	},
	{
		name: "powerbar",
		group: "progress",
		description: "status footer for git, tokens, context, model, and quota; `/extension-settings`",
	},
	{
		name: "pi-usage",
		group: "progress",
		description: "refreshes live provider quota data for Powerbar (automatic)",
	},
	{
		name: "usage-extension",
		group: "progress",
		description: "historical token and spend dashboard; `/usage`",
	},
	{
		name: "permission-gate",
		group: "safety",
		description: "per-call confirmation for destructive commands, external writes, curl/web access, and vendored-code reads",
	},
	{
		name: "cancel-guard",
		group: "safety",
		description: "red confirmation before an interrupt stops a running agent (automatic)",
	},
	{
		name: "welcome",
		group: "session",
		description: "interactive startup map with project, spend, and bundle resources (automatic)",
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
