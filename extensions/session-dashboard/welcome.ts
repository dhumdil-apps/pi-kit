export const SESSION_CONTEXT_START = "<!-- session-dashboard-context -->";
export const SESSION_CONTEXT_END = "<!-- /session-dashboard-context -->";
export const USAGE_CHART_START = "<!-- session-dashboard-usage-chart -->";
export const USAGE_CHART_END = "<!-- /session-dashboard-usage-chart -->";

export interface SessionContextSection {
	label: string;
	values: string[];
}

export interface WelcomeParts {
	extensionDeck: string;
	sessionContext: SessionContextSection[];
	/** Serialized GraphModel (JSON) for the "This Week" cost chart, or "" to omit. */
	usageChart?: string;
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
export function renderWelcomeText({ extensionDeck, sessionContext, usageChart }: WelcomeParts): string {
	const sections = [extensionDeck];
	if (usageChart) sections.push(`${USAGE_CHART_START}\n${usageChart}\n${USAGE_CHART_END}`);
	sections.push(`${SESSION_CONTEXT_START}\n${renderSessionContext(sessionContext)}\n${SESSION_CONTEXT_END}`);
	return sections.filter(Boolean).join("\n\n").trim();
}
