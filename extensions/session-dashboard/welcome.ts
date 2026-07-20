export const DASHBOARD_INVITATION =
	"> **Describe your goal.** I’ll enter discovery, ask focused questions until we’re aligned, propose a plan, then shape it after approval. Finally, we’ll validate and polish it.";

export interface WelcomeParts {
	panel: string;
	sections: string[];
	extensionDeck: string;
}

/** Assemble the interactive welcome message without coupling layout tests to Pi. */
export function renderWelcomeText({ panel, sections, extensionDeck }: WelcomeParts): string {
	return `
\`\`\`
${panel}
\`\`\`

${sections.join("\n")}

${extensionDeck}

⌨️ \`! <cmd>\` bash · \`/todos\` progress · \`/flash\` cruise control · \`/retro\` reflect · \`escape\` confirm cancel

${DASHBOARD_INVITATION}
`.trim();
}
