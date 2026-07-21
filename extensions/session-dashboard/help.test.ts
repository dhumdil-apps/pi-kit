import { describe, expect, it } from "vitest";
import { EXTENSION_PRESENTATIONS } from "./extensions.js";
import { HELP_COMMANDS, HELP_SHORTCUTS, renderHelp } from "./help.js";

const ALL = EXTENSION_PRESENTATIONS.map((presentation) => presentation.name);

describe("renderHelp", () => {
	it("has the /help command as its own first entry", () => {
		expect(HELP_COMMANDS[0]?.name).toBe("/help");
	});

	it("documents every command, shortcut, and active extension with its description", () => {
		const help = renderHelp(ALL);
		expect(help).toContain("# Help");
		expect(help).toContain("## Commands");
		expect(help).toContain("## Shortcuts");
		expect(help).toContain(`## Extensions (${ALL.length})`);
		for (const entry of [...HELP_COMMANDS, ...HELP_SHORTCUTS]) {
			expect(help).toContain(`\`${entry.name}\``);
		}
		for (const presentation of EXTENSION_PRESENTATIONS) {
			expect(help).toContain(`**${presentation.name}** — ${presentation.description}`);
		}
	});

	it("lists only the active extensions passed in", () => {
		const help = renderHelp(["usage-history"]);
		expect(help).toContain("## Extensions (1)");
		expect(help).toContain("**usage-history**");
		expect(help).not.toContain("**status-bar**");
	});
});
