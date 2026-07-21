export const DASHBOARD_INVITATION =
	"> **Describe your goal.** I’ll enter discovery, ask focused questions until we’re aligned, propose a plan, then shape it after approval. Finally, we’ll validate and polish it.";
export const RULER_START = "<!-- session-dashboard-ruler -->";
export const RULER_END = "<!-- /session-dashboard-ruler -->";

export interface WelcomeParts {
	rulerPanel: string;
	infoPanel: string;
	sections: string[];
	extensionDeck: string;
}

/** Assemble the interactive welcome message without coupling layout tests to Pi. */
export function renderWelcomeText({ rulerPanel, infoPanel, sections, extensionDeck }: WelcomeParts): string {
	return `
${RULER_START}
${rulerPanel}
${RULER_END}

${sections.join("\n")}

${extensionDeck}

\`\`\`
${infoPanel}
\`\`\`

⌨️ \`! <cmd>\` bash · \`/todos\` progress · \`/flash\` cruise control · \`/retro\` reflect · \`escape\` confirm cancel

${DASHBOARD_INVITATION}
`.trim();
}
