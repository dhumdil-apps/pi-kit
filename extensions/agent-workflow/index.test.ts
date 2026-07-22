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
		expect(handlers.has("tool_result")).toBe(false);
		const ctx = { sessionManager: { getBranch: () => [] } };
		await commands.get("retro")!.handler("", ctx);
		expect(messages.at(-1)).toContain("[workflow-command:retro]");
		expect(messages.at(-1)).toContain("<session_evidence>");
		await commands.get("forensic")!.handler("raw", ctx);
		expect(messages.at(-1)).toContain("[workflow-command:forensic:raw]");
		expect(messages.at(-1)).toContain('raw="true"');
	});

	it("injects command ownership and pre-commit inspection discipline", async () => {
		const { handlers } = harness();
		const prompt = await handlers.get("before_agent_start")!({ systemPrompt: "base" });
		expect(prompt.systemPrompt).toContain("repository or package manifest that owns the command");
		expect(prompt.systemPrompt).toContain("git status --short");
		expect(prompt.systemPrompt).toContain("Separate pre-existing changes");
		expect(prompt.systemPrompt).toContain("before planning changes");
		expect(prompt.systemPrompt).toContain("never silently overwrite or absorb them");
		expect(prompt.systemPrompt).toContain("state the conflict and selected resolution");
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
