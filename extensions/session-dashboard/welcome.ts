export const HERO_QUOTE = "**Measure twice, cut once**";
export const DASHBOARD_INVITATION =
	"> **Describe your goal.** I’ll enter discovery, ask focused questions until we’re aligned, propose a plan, then shape it after approval. Finally, we’ll validate and polish it.";
export const RULER_START = "<!-- session-dashboard-ruler -->";
export const RULER_END = "<!-- /session-dashboard-ruler -->";
export const SESSION_CONTEXT_START = "<!-- session-dashboard-context -->";
export const SESSION_CONTEXT_END = "<!-- /session-dashboard-context -->";

export interface SessionContextSection {
	label: string;
	values: string[];
}

export interface WelcomeParts {
	rulerPanel: string;
	extensionDeck: string;
	sessionContext: SessionContextSection[];
}

export function parseSessionContext(content: string): SessionContextSection[] {
	const sections: SessionContextSection[] = [];
	for (const line of content.split("\n")) {
		const separator = line.indexOf("\t");
		if (separator < 0) continue;
		const label = line.slice(0, separator);
		const value = line.slice(separator + 1);
		if (label) sections.push({ label, values: [value] });
		else sections.at(-1)?.values.push(value);
	}
	return sections;
}

function renderSessionContext(sections: SessionContextSection[]): string {
	return sections
		.flatMap(({ label, values }) => values.map((value, index) => `${index === 0 ? label : ""}\t${value}`))
		.join("\n");
}

/** Assemble the interactive welcome message without coupling layout tests to Pi. */
export function renderWelcomeText({ rulerPanel, extensionDeck, sessionContext }: WelcomeParts): string {
	return `
${HERO_QUOTE}
${RULER_START}
${rulerPanel}
${RULER_END}

${DASHBOARD_INVITATION}

${extensionDeck}

${SESSION_CONTEXT_START}
${renderSessionContext(sessionContext)}
${SESSION_CONTEXT_END}
`.trim();
}
