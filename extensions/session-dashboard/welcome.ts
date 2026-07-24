export const USAGE_CHART_START = "<!-- session-dashboard-usage-chart -->";
export const USAGE_CHART_END = "<!-- /session-dashboard-usage-chart -->";

export interface WelcomeParts {
	welcome?: string;
	/** Serialized GraphModel (JSON) for the "Last 30 Days" cost chart, or "" to omit. */
	usageChart?: string;
	/** Slim dir and loaded context-files line, plain markdown. */
	contextInfo?: string;
	/** Short de-emphasised hint, plain markdown. */
	tip?: string;
}

/** Assemble the interactive welcome message from its (already-styled) pieces. */
export function renderWelcomeText({ welcome, usageChart, contextInfo, tip }: WelcomeParts): string {
	const sections: string[] = [];
	if (contextInfo) sections.push(contextInfo);
	if (usageChart) sections.push(`${USAGE_CHART_START}\n${usageChart}\n${USAGE_CHART_END}`);
	if (tip) sections.push(tip);
	if (welcome) sections.push(welcome);
	return sections.join("\n\n").trim();
}
