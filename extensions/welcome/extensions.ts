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
		name: "welcome",
		group: "ui",
		description: "interactive startup map with project, spend, and bundle resources (automatic)",
	},
	{
		name: "powerbar",
		group: "ui",
		description: "status footer for git, tokens, context, model, and quota; `/extension-settings`",
	},
	{
		name: "pi-usage",
		group: "ui",
		description: "refreshes live provider quota data for Powerbar (automatic)",
	},
	{
		name: "manage-todo-list",
		group: "flow",
		description: "plan-step progress widget; `manage_todo_list`, `/todos`",
	},
	{
		name: "permission-gate",
		group: "flow",
		description: "per-call confirmation for destructive commands, external writes, curl/web access, and vendored-code reads",
	},
	{
		name: "cancel-guard",
		group: "flow",
		description: "red confirmation before an interrupt stops a running agent (automatic)",
	},
	{
		name: "ask-user",
		group: "flow",
		description: "inline choice and confirmation prompts; `ask_user`",
	},
	{
		name: "claude-style",
		group: "flow",
		description: "guides each turn through Explore → Align → Build → Review (automatic)",
	},
	{
		name: "extension-settings",
		group: "config",
		description: "shared extension settings; `/extension-settings`",
	},
	{
		name: "usage-extension",
		group: "config",
		description: "historical token and spend dashboard; `/usage`",
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
