import { EXTENSION_GROUPS, EXTENSION_PRESENTATIONS } from "./extensions.js";

export interface HelpEntry {
	/** Command / shortcut, shown as inline code. */
	name: string;
	description: string;
}

/**
 * The bundle's user-facing commands, curated (each extension registers its own,
 * so there is no single runtime list to read). Keep in sync with the commands
 * the extensions register; `/help` is this command itself.
 */
export const HELP_COMMANDS: HelpEntry[] = [
	{ name: "/help", description: "Show this overview of extensions, commands, and shortcuts." },
	{ name: "/usage", description: "Open the token & spend dashboard — Graphs, Table, Insights." },
	{ name: "/usage-refresh", description: "Refresh subscription-quota usage from the provider." },
	{ name: "/todos", description: "Toggle the todo widget (`/todos clear` resets it)." },
	{ name: "/extension-settings", description: "Configure any extension's settings." },
	{ name: "/init", description: "Analyze the repo and create or improve its AGENTS.md." },
];

/** Interactive shortcuts the host provides. */
export const HELP_SHORTCUTS: HelpEntry[] = [
	{ name: "! <cmd>", description: "Run a shell command without leaving the prompt." },
	{ name: "escape", description: "Cancel the current turn." },
	{ name: "ctrl+j", description: "Insert a newline without submitting (works where shift+enter does not)." },
	{ name: "ctrl+enter", description: "Submit the prompt." },
];

/**
 * Build the `/help` document as markdown: commands, shortcuts, and the active
 * extensions with their full descriptions (the startup deck lists names only).
 */
export function renderHelp(activeExtensionNames: readonly string[]): string {
	const active = new Set(activeExtensionNames);
	const entryLines = (entries: HelpEntry[]) => entries.map((entry) => `- \`${entry.name}\` — ${entry.description}`).join("\n");

	const extensionBlocks = EXTENSION_GROUPS.flatMap((group) => {
		const items = EXTENSION_PRESENTATIONS.filter((presentation) => presentation.group === group.id && active.has(presentation.name));
		if (items.length === 0) return [];
		const lines = items.map((presentation) => `- **${presentation.name}** — ${presentation.description}`);
		return [`**${group.title}**\n${lines.join("\n")}`];
	});

	return [
		"# Help",
		"Everything this pi bundle adds — type any command at the prompt.",
		"## Commands",
		entryLines(HELP_COMMANDS),
		"## Shortcuts",
		entryLines(HELP_SHORTCUTS),
		`## Extensions (${active.size})`,
		extensionBlocks.join("\n\n"),
		"## Running raw Pi",
		"To run Pi without this bundle start it with `pi --no-extensions` (`-ne`).",
	].join("\n\n");
}
