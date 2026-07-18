/**
 * Parent thinking-level provider.
 *
 * Serial-only policy: children always run at the parent session's thinking
 * level. The extension entry point registers a provider backed by
 * `pi.getThinkingLevel()`; child-spawn code reads it when computing the
 * effective thinking for a run. Agent frontmatter `thinking:` no longer
 * diverges a child from the parent — only an explicit sanitization override
 * (e.g. forcing thinking off for Anthropic forks) wins over the parent level.
 */

export type ParentThinkingLevel = string;

let provider: (() => ParentThinkingLevel | undefined) | undefined;

export function setParentThinkingProvider(fn: (() => ParentThinkingLevel | undefined) | undefined): void {
	provider = fn;
}

export function getParentThinkingLevel(): ParentThinkingLevel | undefined {
	try {
		const level = provider?.();
		return typeof level === "string" && level.trim() ? level : undefined;
	} catch {
		return undefined;
	}
}
