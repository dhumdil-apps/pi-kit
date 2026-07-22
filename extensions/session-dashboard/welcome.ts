export const USAGE_CHART_START = "<!-- session-dashboard-usage-chart -->";
export const USAGE_CHART_END = "<!-- /session-dashboard-usage-chart -->";

export interface WelcomeParts {
	welcome: string;
	/** Serialized GraphModel (JSON) for the "This Week" cost chart, or "" to omit. */
	usageChart?: string;
	/** Slim dir + loaded context-files + workflow-command lines, plain markdown. */
	contextInfo?: string;
}

/** Assemble the interactive welcome message from its (already-styled) pieces. */
export function renderWelcomeText({ welcome, usageChart, contextInfo }: WelcomeParts): string {
	const sections = [welcome];
	if (usageChart) sections.push(`${USAGE_CHART_START}\n${usageChart}\n${USAGE_CHART_END}`);
	if (contextInfo) sections.push(contextInfo);
	return sections.filter(Boolean).join("\n\n").trim();
}
