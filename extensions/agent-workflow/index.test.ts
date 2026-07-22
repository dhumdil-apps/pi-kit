import { describe, expect, it, vi } from "vitest";
import createExtension from "./index.js";

function harness() {
	const handlers = new Map<string, (event?: any) => any>();
	const commands = new Map<string, { handler: (args: string, ctx: any) => Promise<void> }>();
	const emitted: Array<[string, unknown]> = [];
	const messages: string[] = [];
	let sessionName: string | undefined;
	const pi = {
		on: vi.fn((name: string, handler: (event?: any) => any) => handlers.set(name, handler)),
		registerCommand: vi.fn((name: string, command: any) => commands.set(name, command)),
		registerTool: vi.fn(),
		getSessionName: vi.fn(() => sessionName),
		setSessionName: vi.fn((name: string) => { sessionName = name; }),
		sendUserMessage: vi.fn((message: string) => messages.push(message)),
		events: { emit: vi.fn((name: string, value: unknown) => emitted.push([name, value])) },
	};
	createExtension(pi as any);
	return { handlers, commands, emitted, messages };
}

describe("agent workflow lifecycle", () => {
	it("registers no autonomy or retrospective commands and no runtime lifecycle hooks", async () => {
		const { handlers, commands } = harness();
		// Flash, /forensic, and the legacy /retro + /improvements are all retired;
		// guard against reintroduction. The only registered event hook is the
		// system-prompt injector.
		for (const gone of ["flash", "forensic", "retro", "improvements"]) {
			expect(commands.has(gone)).toBe(false);
		}
		expect(handlers.has("input")).toBe(false);
		expect(handlers.has("agent_settled")).toBe(false);
		expect(handlers.has("tool_result")).toBe(false);
	});

	it("injects the workflow prompt on every turn with no Flash runtime block", async () => {
		const { handlers } = harness();
		const result = await handlers.get("before_agent_start")!({ systemPrompt: "base" });
		expect(result.systemPrompt).toContain("<pi_workflow>");
		expect(result.systemPrompt).not.toContain("workflow_runtime");
		expect(result.systemPrompt).not.toContain("flash");
	});

	it("injects universal communication and commit-message defaults", async () => {
		const { handlers } = harness();
		const prompt = await handlers.get("before_agent_start")!({ systemPrompt: "base" });
		const guidance = (prompt.systemPrompt as string).replace(/\s+/g, " ");
		expect(guidance).toContain("Concise and direct. Never fabricate tool results, tests, or file contents");
		expect(guidance).toContain("Follow the repository's commit convention");
		expect(guidance).toContain("short imperative subject without a trailing period");
	});

	it("classifies dirty work and preserves user control of commits and stashes", async () => {
		const { handlers } = harness();
		const prompt = await handlers.get("before_agent_start")!({ systemPrompt: "base" });
		const guidance = (prompt.systemPrompt as string).replace(/\s+/g, " ");
		expect(guidance).toContain("repository or package manifest that owns the command");
		expect(guidance).toContain("git status --short");
		expect(guidance).toContain("matching the requested goal is a continuation");
		expect(guidance).toContain("separate completed work must be");
		expect(guidance).toContain("separate unfinished work must be finished");
		expect(guidance).toContain("Never commit or stash automatically");
		expect(guidance).toContain("never absorb unrelated work merely because");
	});

	it("keeps lifecycle plans small, verifiable, and subordinate to current evidence", async () => {
		const { handlers } = harness();
		const prompt = await handlers.get("before_agent_start")!({ systemPrompt: "base" });
		const guidance = (prompt.systemPrompt as string).replace(/\s+/g, " ");
		expect(guidance).toContain("implementation step as change → verification");
		expect(guidance).toContain("name the specific manual acceptance check");
		expect(guidance).toContain("never claim the user's acceptance on their behalf");
		expect(guidance).toContain("public interfaces, persistence, dependencies, security, or migrations");
		expect(guidance).toContain("independently reviewable and committable checklist slices");
		expect(guidance).toContain("exactly one slice");
		expect(guidance).toContain("fresh explicit approval");
		expect(guidance).toContain("<task-name>.<status>.md");
		expect(guidance).toContain("only cross-session source of truth");
		expect(guidance).toContain("legacy unsuffixed plans and .pi/handoffs files are ignored and preserved");
		expect(guidance).toContain("current intent, Git state, diffs, and validation evidence always win");
	});

	it("uses proportional evidence and the canonical review skill", async () => {
		const { handlers } = harness();
		const prompt = await handlers.get("before_agent_start")!({ systemPrompt: "base" });
		const guidance = (prompt.systemPrompt as string).replace(/\s+/g, " ");
		expect(guidance).toContain("external dependency, integration, or new abstraction");
		expect(guidance).toContain("explicitly choose reuse, adapt, or build");
		expect(guidance).toContain("observable invariant that must remain true");
		expect(guidance).toContain("verify both producer and consumer behavior");
		expect(guidance).toContain("cheapest relevant baseline check when feasible");
		expect(guidance).toContain("do not misattribute them to the new change");
		expect(guidance).toContain("rank plausible hypotheses with a falsification check for each");
		expect(guidance).toContain("verify the root cause with evidence before fixing it");
		expect(guidance).toContain("invoke the canonical review skill");
		expect(guidance).toContain("blocking and important findings");
		expect(guidance).toContain("require fresh Planning approval");
	});

	it("includes close-out guidance and ask-first memory policy", async () => {
		const { handlers } = harness();
		const prompt = await handlers.get("before_agent_start")!({ systemPrompt: "base" });
		const guidance = (prompt.systemPrompt as string).replace(/\s+/g, " ");
		expect(guidance).toContain("Close out implementation with a concise outcome summary");
		expect(guidance).toContain("List follow-ups or next steps only when genuine ones exist");
		expect(guidance).toContain("Never update project memory unprompted");
		expect(guidance).toContain("apply them only after the user confirms");
		expect(guidance).toContain("treat project memory as temporary fallback state");
		expect(guidance).toContain("fixed at the root cause");
		expect(guidance).toContain("only a recurring pattern or one confirmed by the user is durable");
		// Safety confirmations are reviewed at close-out from the session log, ask-first.
		expect(guidance).toContain("when a .pi/confirmations/<session>.md log exists");
		expect(guidance).toContain("propose a .pi/MEMORY.md entry the same ask-first way; never auto-write it");
	});

	it("scales questioning to the task without ever skipping exploration", async () => {
		const { handlers } = harness();
		const prompt = await handlers.get("before_agent_start")!({ systemPrompt: "base" });
		const guidance = (prompt.systemPrompt as string).replace(/\s+/g, " ");
		expect(guidance).toContain("Explore on every task, regardless of size");
		expect(guidance).toContain("only the questioning scales down, never the investigation");
		expect(guidance).toContain("only for genuine open choices that exploration surfaced");
		expect(guidance).toContain("present the plan directly without ceremonial questions");
		// Batch summaries are qualitative — no confabulated progress metrics.
		expect(guidance).toContain("settled and open topics, and what comes next");
		expect(guidance).toContain("No invented metrics");
		expect(guidance).not.toContain("planning percentage");
		expect(guidance).not.toContain("estimated batches remaining");
	});

	it("locks the read-before-edit, no-test-weakening, and honest-uncertainty levers", async () => {
		const { handlers } = harness();
		const prompt = await handlers.get("before_agent_start")!({ systemPrompt: "base" });
		const guidance = (prompt.systemPrompt as string).replace(/\s+/g, " ");
		expect(guidance).toContain("read it and its immediate callers or tests");
		expect(guidance).toContain("Never weaken a test, assertion, or check to make it pass");
		expect(guidance).toContain("a failing check is information about the change");
		expect(guidance).toContain("When unsure, say so instead of guessing");
	});

	it("requires fresh approval for any substantive IMPLEMENTATION feedback", async () => {
		const { handlers } = harness();
		const prompt = await handlers.get("before_agent_start")!({ systemPrompt: "base" });
		const guidance = (prompt.systemPrompt as string).replace(/\s+/g, " ");
		const feedbackRule = guidance.slice(
			guidance.indexOf("Ordinary user feedback during IMPLEMENTATION"),
			guidance.indexOf("There is no hard pre-approval execution gate"),
		);

		for (const category of [
			"outcome",
			"requirements",
			"constraints",
			"scope",
			"assumptions",
			"behavior",
			"acceptance criteria",
			"validation expectations",
			"mismatch",
		]) {
			expect(feedbackRule).toContain(category);
		}
		expect(feedbackRule).toContain("Judge the substance rather than matching examples or keywords");
		expect(feedbackRule).toContain("novel feedback counts");
		expect(feedbackRule).toContain("do not edit or use other state-changing implementation tools");
		expect(feedbackRule).toContain("even with zero questions");
		expect(feedbackRule).toContain("Earlier approval does not carry forward");

		for (const planningDimension of [
			"states and transitions",
			"boundaries",
			"timing",
			"lifecycle and recovery",
			"failure modes",
			"accessibility or fallbacks",
			"external interactions",
			"validation",
		]) {
			expect(guidance).toContain(planningDimension);
		}
		expect(guidance).toContain("Do not mechanically include dimensions that do not apply");

		const feedback = guidance.indexOf("Ordinary user feedback during IMPLEMENTATION");
		const planning = guidance.indexOf("Return to PLANNING", feedback);
		const investigate = guidance.indexOf("investigate read-only", planning);
		const changed = guidance.indexOf("identify what changed", investigate);
		const revisedPlan = guidance.indexOf("present the complete revised goal", changed);
		const freshApproval = guidance.indexOf("request fresh explicit approval", revisedPlan);
		expect(feedback).toBeGreaterThan(-1);
		expect(planning).toBeGreaterThan(feedback);
		expect(investigate).toBeGreaterThan(planning);
		expect(changed).toBeGreaterThan(investigate);
		expect(revisedPlan).toBeGreaterThan(changed);
		expect(freshApproval).toBeGreaterThan(revisedPlan);
	});
});
