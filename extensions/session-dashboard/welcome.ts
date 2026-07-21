export const QUICK_REF_START = "<!-- session-dashboard-quick-ref -->";
export const QUICK_REF_END = "<!-- /session-dashboard-quick-ref -->";
export const USAGE_CHART_START = "<!-- session-dashboard-usage-chart -->";
export const USAGE_CHART_END = "<!-- /session-dashboard-usage-chart -->";

export interface WelcomeParts {
	extensionDeck: string;
	/** Serialized GraphModel (JSON) for the "This Week" cost chart, or "" to omit. */
	usageChart?: string;
	/** Slim dir + loaded context-files lines, rendered as plain markdown. */
	contextInfo?: string;
}

/**
 * Assemble the interactive welcome message. The quick-reference card is static,
 * so its markers are empty delimiters that only mark where the renderer inserts
 * the component; only the dynamic pieces (extension deck, usage chart,
 * context info) carry content.
 */
export function renderWelcomeText({ extensionDeck, usageChart, contextInfo }: WelcomeParts): string {
	const sections = [extensionDeck];
	if (usageChart) sections.push(`${USAGE_CHART_START}\n${usageChart}\n${USAGE_CHART_END}`);
	if (contextInfo) sections.push(contextInfo);
	sections.push(`${QUICK_REF_START}\n${QUICK_REF_END}`);
	return sections.filter(Boolean).join("\n\n").trim();
}
