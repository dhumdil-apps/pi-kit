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
	it("activates Flash, exposes runtime guidance, and brakes on ordinary input", async () => {
		const { handlers, commands, emitted, messages } = harness();
		await commands.get("flash")!.handler("", {});
		expect(messages.at(-1)).toContain("[workflow-command:flash]");
		expect(emitted.at(-1)?.[1]).toMatchObject({ id: "flash", text: "flash", transient: true });

		const active = await handlers.get("before_agent_start")!({ systemPrompt: "base" });
		expect(active.systemPrompt).toContain('flash="active"');
		handlers.get("input")!({ source: "user" });
		expect(emitted.at(-1)?.[1]).toEqual({ id: "flash", text: undefined });
		const stopped = await handlers.get("before_agent_start")!({ systemPrompt: "base" });
		expect(stopped.systemPrompt).toContain('flash="off"');
	});

	it("does not brake Flash for extension-authored input and clears it once the agent settles", async () => {
		const { handlers, commands, emitted } = harness();
		await commands.get("flash")!.handler("", {});
		handlers.get("input")!({ source: "extension" });
		const active = await handlers.get("before_agent_start")!({ systemPrompt: "base" });
		expect(active.systemPrompt).toContain('flash="active"');
		handlers.get("agent_settled")!();
		expect(emitted.at(-1)?.[1]).toEqual({ id: "flash", text: undefined });
	});

	it("does not clear Flash on a plain agent_end (pi may still auto-retry/auto-compact)", async () => {
		const { handlers, commands, emitted } = harness();
		await commands.get("flash")!.handler("", {});
		const before = emitted.length;
		handlers.get("agent_end")?.();
		// agent_end has no registered handler in this extension at all — Flash
		// state is untouched by it.
		expect(emitted.length).toBe(before);
		const active = await handlers.get("before_agent_start")!({ systemPrompt: "base" });
		expect(active.systemPrompt).toContain('flash="active"');
	});

	it("injects bounded session evidence for reflection commands", async () => {
		const { handlers, commands, messages } = harness();
		expect(commands.has("retro")).toBe(false);
		expect(commands.has("improvements")).toBe(false);
		expect(handlers.has("tool_result")).toBe(false);
		const ctx = { sessionManager: { getBranch: () => [] } };
		await commands.get("forensic")!.handler("raw", ctx);
		expect(messages.at(-1)).toContain("[workflow-command:forensic:raw]");
		expect(messages.at(-1)).toContain('raw="true"');
	});

	it("injects universal communication and commit-message defaults", async () => {
		const { handlers } = harness();
		const prompt = await handlers.get("before_agent_start")!({ systemPrompt: "base" });
		const guidance = (prompt.systemPrompt as string).replace(/\s+/g, " ");
		expect(guidance).toContain("summarize the diff or show focused snippets");
		expect(guidance).toContain("instead of pasting whole files unless the user requests them");
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
		expect(guidance).toContain("state the conflict and selected resolution");
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

	it("discusses tool-output pressure only when retrospective evidence marks it material", async () => {
		const { handlers } = harness();
		const prompt = await handlers.get("before_agent_start")!({ systemPrompt: "base" });
		const guidance = (prompt.systemPrompt as string).replace(/\s+/g, " ");
		expect(guidance).toContain("tool_output_metrics material=true");
		expect(guidance).toContain("one concrete bounded-output adjustment");
		expect(guidance).toContain("Otherwise omit tool-output efficiency");
		expect(guidance).toContain("only a recurring pattern or one confirmed by the user is durable");
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
	});

	it("requires fresh approval for any substantive IMPLEMENTATION feedback", async () => {
		const { handlers } = harness();
		const prompt = await handlers.get("before_agent_start")!({ systemPrompt: "base" });
		const guidance = (prompt.systemPrompt as string).replace(/\s+/g, " ");
		const feedbackRule = guidance.slice(
			guidance.indexOf("When Flash is off"),
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
		expect(feedbackRule).toContain("ordinary user input brakes Flash first");

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

		const feedback = guidance.indexOf("ordinary user feedback during IMPLEMENTATION");
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
