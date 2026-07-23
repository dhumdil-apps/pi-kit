import { describe, expect, it, vi } from "vitest";
import createExtension from "./index.js";
import { MODE_ENTRY_TYPE, MODE_UPDATE_EVENT } from "./mode.js";

type Mode = "plan" | "implement" | "review";

function harness() {
	const handlers = new Map<string, Array<(event?: any, ctx?: any) => any>>();
	const commands = new Map<string, { handler: (args: string, ctx: any) => Promise<void> }>();
	const emitted: Array<[string, unknown]> = [];
	const branch: any[] = [];
	const notify = vi.fn();
	let sessionName: string | undefined;
	const userMessages: string[] = [];
	const messages: any[] = [];
	const pi = {
		on: vi.fn((name: string, handler: (event?: any, ctx?: any) => any) => {
			handlers.set(name, [...(handlers.get(name) ?? []), handler]);
		}),
		registerCommand: vi.fn((name: string, command: any) => commands.set(name, command)),
		registerTool: vi.fn(),
		getSessionName: vi.fn(() => sessionName),
		setSessionName: vi.fn((name: string) => { sessionName = name; }),
		// Hidden markers are what the mode is derived from, so mirror them into the
		// branch in the shape getBranch() really returns.
		sendMessage: vi.fn((message: any) => {
			messages.push(message);
			if (message.display === false) {
				branch.push({ type: "custom_message", customType: message.customType, display: false, content: message.content, details: message.details });
			}
		}),
		sendUserMessage: vi.fn((content: string) => userMessages.push(content)),
		events: { emit: vi.fn((name: string, value: unknown) => emitted.push([name, value])), on: vi.fn() },
	};
	createExtension(pi as any);
	const newSession = vi.fn(async () => ({ cancelled: false }));
	// cwd points at a directory with no .pi/goal, so a continue switch resolves no
	// kickoff and stays a bare in-place switch — enough to exercise the flow.
	const ctx = {
		hasUI: true,
		ui: { notify },
		cwd: "/pi-kit-index-test-nonexistent",
		getContextUsage: () => undefined,
		waitForIdle: vi.fn(async () => {}),
		newSession,
		sessionManager: {
			getBranch: () => branch,
			getSessionName: () => sessionName,
			getSessionFile: () => "/sessions/current.jsonl",
		},
	};

	const inject = async (): Promise<string> => {
		const injectors = handlers.get("before_agent_start")!;
		const result = await injectors[injectors.length - 1]({ systemPrompt: "base" }, ctx);
		return (result.systemPrompt as string).replace(/\s+/g, " ");
	};

	/** Seed the mode the way a /handoff-spawned session does, then inject. */
	const promptFor = async (mode: Mode): Promise<string> => {
		branch.push({ type: "custom_message", customType: MODE_ENTRY_TYPE, display: false, content: `Workflow mode: ${mode}.`, details: { mode, origin: "boundary" } });
		return inject();
	};

	/** Switch the mode in place through /mode <mode> continue, then inject. */
	const promptAfterCommand = async (mode: Mode): Promise<string> => {
		await commands.get("mode")!.handler(`${mode} continue`, ctx);
		return inject();
	};

	const runMode = (args: string) => commands.get("mode")!.handler(args, ctx);
	return { handlers, commands, emitted, notify, userMessages, messages, promptFor, promptAfterCommand, ctx, runMode };
}

describe("agent workflow lifecycle", () => {
	it("registers a single /mode command and no agent-observing hooks", async () => {
		const { handlers, commands } = harness();
		// Flash, /forensic, and the legacy /retro + /improvements are all retired;
		// guard against reintroduction. The former per-mode selectors and /handoff
		// are folded into one /mode command.
		for (const gone of ["flash", "forensic", "retro", "improvements", "plan", "implement", "review", "handoff"]) {
			expect(commands.has(gone)).toBe(false);
		}
		expect(commands.has("mode")).toBe(true);
		// The only turn-time hooks are the system-prompt injector and the
		// post-save_plan offer (tool_execution_end arms it, agent_settled delivers
		// it). No input/tool_result/agent_start observers survive.
		expect(handlers.has("input")).toBe(false);
		expect(handlers.has("tool_result")).toBe(false);
		expect(handlers.has("agent_start")).toBe(false);
		expect(handlers.has("agent_settled")).toBe(true);
	});

	it("injects the workflow prompt on every turn with no Flash runtime block", async () => {
		const { promptFor } = harness();
		const prompt = await promptFor("plan");
		expect(prompt).toContain("<pi_workflow>");
		expect(prompt).not.toContain("workflow_runtime");
		expect(prompt).not.toContain("flash");
	});

	it("injects the shared guidance in every mode", async () => {
		for (const mode of ["plan", "implement", "review"] as const) {
			const { promptFor } = harness();
			const guidance = await promptFor(mode);
			expect(guidance).toContain("Concise and direct. Never fabricate tool results, tests, or file contents");
			expect(guidance).toContain("When unsure, say so instead of guessing");
			expect(guidance).toContain("Follow the repository's commit convention");
			expect(guidance).toContain("short imperative subject without a trailing period");
			expect(guidance).toContain("<task-name>.<status>.md");
			expect(guidance).toContain("only cross-session source of truth");
			expect(guidance).toContain("legacy unsuffixed plans and .pi/handoffs files are ignored and preserved");
			expect(guidance).toContain("current intent, Git state, diffs, and validation evidence always win");
			expect(guidance).toContain("Never update project memory unprompted");
			expect(guidance).toContain("read it and its immediate callers or tests");
			expect(guidance).toContain("Never weaken a test, assertion, or check to make it pass");
			expect(guidance).toContain("a failing check is information about the change");
		}
	});

	it("injects exactly one mode flow per turn", async () => {
		const { promptFor } = harness();
		const plan = await promptFor("plan");
		expect(plan).toContain("Session mode: PLAN");
		expect(plan).not.toContain("Session mode: IMPLEMENT");
		expect(plan).not.toContain("Session mode: REVIEW");
		const implement = await promptFor("implement");
		expect(implement).toContain("Session mode: IMPLEMENT");
		expect(implement).not.toContain("Session mode: PLAN");
		const review = await promptFor("review");
		expect(review).toContain("Session mode: REVIEW");
		expect(review).not.toContain("Session mode: IMPLEMENT");
	});

	it("plan mode terminates at a saved plan plus discovery handoff and never implements", async () => {
		const { promptFor } = harness();
		const guidance = await promptFor("plan");
		expect(guidance).toContain("measure twice, cut once");
		expect(guidance).toContain("operation=save_plan");
		expect(guidance).toContain(".pi/goal/<task-name>.discovery.md");
		expect(guidance).toContain("This session does not implement");
		expect(guidance).toContain("run /mode implement to execute the first slice");
		expect(guidance).toContain("current evidence wins over stale discovery");
		expect(guidance).toContain("never switch or simulate another mode yourself");
		// The old single-flow glue that continued straight into implementation is gone.
		expect(guidance).not.toContain("update_plan status=active");
		expect(guidance).not.toContain("phase=implementation");
	});

	it("plan mode keeps proportional exploration and conversational discovery", async () => {
		const { promptFor } = harness();
		const guidance = await promptFor("plan");
		expect(guidance).toContain("Explore on every task, regardless of size");
		expect(guidance).toContain("only the questioning scales down, never the investigation");
		expect(guidance).toContain("only for genuine open choices that exploration surfaced");
		expect(guidance).toContain("present the plan directly without ceremonial questions");
		expect(guidance).toContain("settled and open topics, and what comes next");
		expect(guidance).toContain("No invented metrics");
		expect(guidance).not.toContain("planning percentage");
		expect(guidance).not.toContain("estimated batches remaining");
		expect(guidance).toContain("external dependency, integration, or new abstraction");
		expect(guidance).toContain("explicitly choose reuse, adapt, or build");
	});

	it("plan mode keeps verification-first planning and repository hygiene", async () => {
		const { promptFor } = harness();
		const guidance = await promptFor("plan");
		expect(guidance).toContain("git status --short");
		expect(guidance).toContain("matching the requested goal is a continuation");
		expect(guidance).toContain("separate completed work must be");
		expect(guidance).toContain("separate unfinished work must be finished");
		expect(guidance).toContain("Never commit or stash automatically");
		expect(guidance).toContain("never absorb unrelated work merely because");
		expect(guidance).toContain("implementation step as change → verification");
		expect(guidance).toContain("name the specific manual acceptance check");
		expect(guidance).toContain("never claim the user's acceptance on their behalf");
		expect(guidance).toContain("public interfaces, persistence, dependencies, security, or migrations");
		expect(guidance).toContain("independently reviewable and committable checklist slices");
		expect(guidance).toContain("observable invariant that must remain true");
		expect(guidance).toContain("verify both producer and consumer behavior");
		expect(guidance).toContain("Proceed or revise?");
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
	});

	it("implement mode resumes a saved plan and executes exactly one slice", async () => {
		const { promptFor } = harness();
		const guidance = await promptFor("implement");
		expect(guidance).toContain(".pi/goal/*.todo.md");
		expect(guidance).toContain(".pi/goal/<task-name>.discovery.md");
		expect(guidance).toContain("operation=set_name");
		expect(guidance).toContain("operation=resume");
		expect(guidance).toContain("request fresh explicit approval");
		expect(guidance).toContain("update_plan status=active");
		expect(guidance).toContain("exactly one approved slice");
		expect(guidance).toContain("cheapest relevant baseline check when feasible");
		expect(guidance).toContain("do not misattribute them to the new change");
		expect(guidance).toContain("rank plausible hypotheses with a falsification check for each");
		expect(guidance).toContain("verify the root cause with evidence before fixing it");
		expect(guidance).toContain("Close out with a concise outcome summary");
		expect(guidance).toContain("List follow-ups or next steps only when genuine ones exist");
		expect(guidance).toContain("reporting every skipped or failed check");
		expect(guidance).toContain("re-plan with /mode plan in a fresh session");
	});

	it("implement mode ends with one inline simplification pass and points review at /review", async () => {
		const { promptFor } = harness();
		const guidance = await promptFor("implement");
		expect(guidance).toContain("exactly one simplification pass");
		expect(guidance).toContain("reading it as a reviewer rather than its author");
		expect(guidance).toContain("remove dead code");
		expect(guidance).toContain("search for an existing equivalent before keeping a new helper");
		expect(guidance).toContain("one caller or a hypothetical future");
		expect(guidance).toContain("temporary scaffolding that is not a requirement");
		expect(guidance).toContain("must not change approved observable behavior");
		expect(guidance).toContain("rerun affected checks after it");
		expect(guidance).toContain("recommend running /mode review in a fresh session");
		// The review pass is skill-free and lives in Review mode only.
		expect(guidance).not.toContain("review skill");
	});

	it("requires fresh approval for any substantive IMPLEMENTATION feedback", async () => {
		const { promptFor } = harness();
		const guidance = await promptFor("implement");
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

	it("review mode is a skill-free falsification pass without expanding scope", async () => {
		const { promptFor } = harness();
		const guidance = await promptFor("review");
		expect(guidance).toContain("Fresh-eyes verification");
		expect(guidance).toContain("treat the implementation as unproven and try to falsify it");
		expect(guidance).toContain("never expands scope or implements new work");
		expect(guidance).toContain(".pi/goal/<task-name>.discovery.md");
		// Intent is reconstructed before reading the diff (anti-rationalization).
		expect(guidance).toContain("reconstruct from the approved plan alone");
		expect(guidance).toContain("BEFORE reading the diff");
		expect(guidance).toContain("rationalizing it");
		expect(guidance).toContain("assuming the happy path hides a defect");
		expect(guidance).toContain("would fail if the change were reverted");
		expect(guidance).toContain("briefly regress the single riskiest new behavior");
		expect(guidance).toContain("blocking, important, or optional with claim, evidence, impact, and verification path");
		expect(guidance).toContain("unsupported suspicion is an uncertainty, not a finding");
		expect(guidance).toContain("as findings, not as a rewrite pass");
		expect(guidance).toContain("Fix only clear in-scope blocking and important findings");
		expect(guidance).toContain("do not apply optional taste changes");
		expect(guidance).toContain("fresh Plan session");
		expect(guidance).toContain("naming the strongest remaining risk");
		expect(guidance).toContain("every skipped or failed check");
		expect(guidance).toContain("If there are no findings, say so plainly");
		expect(guidance).toContain("never claim this is an independent human review");
		// Fully skill-free: the review procedure is the flow itself.
		expect(guidance).not.toContain("review skill");
	});

	it("routes a re-plan through update_plan and points at the handoff command", async () => {
		const { promptFor } = harness();
		const guidance = await promptFor("plan");
		expect(guidance).toContain("this is a re-plan");
		expect(guidance).toContain("instead of save_plan");
		expect(guidance).toContain("operation=update_plan status=todo with the complete revised plan");
		expect(guidance).toContain("Do not transition the plan out of todo");
		expect(guidance).toContain("/mode implement");
	});

	it("never lets implement mode pick between several pending plans silently", async () => {
		const { promptFor } = harness();
		const guidance = await promptFor("implement");
		expect(guidance).toContain("If more than one pending plan exists");
		expect(guidance).toContain("ask the user which task to execute; never pick one silently");
	});

	it("scopes review to the slice and records its verdict in the plan", async () => {
		const { promptFor } = harness();
		const guidance = await promptFor("review");
		expect(guidance).toContain("normally the slice just implemented");
		expect(guidance).toContain("uncommitted diff against HEAD");
		expect(guidance).toContain("Widen to the full task diff");
		expect(guidance).toContain("only when the user asks for it or the plan is being closed as done");
		expect(guidance).toContain("operation=set_name with the plan's task name, then operation=resume");
		expect(guidance).toContain("Record that verdict in the plan");
		expect(guidance).toContain("current status unchanged");
		expect(guidance).toContain("blocking, important, and optional counts");
	});

	it("adds the in-place caveats only when the mode was switched mid-session", async () => {
		const boundary = harness();
		const boundaryImplement = await boundary.promptFor("implement");
		expect(boundaryImplement).not.toContain("in_place_switch");

		const inplace = harness();
		const inplaceImplement = await inplace.promptAfterCommand("implement");
		expect(inplaceImplement).toContain("switched into IMPLEMENT in place");
		expect(inplaceImplement).toContain("that approval carries forward");
		expect(inplaceImplement).toContain("does not need re-reading");
		// The flow itself is unchanged by the origin.
		expect(inplaceImplement).toContain("Session mode: IMPLEMENT");

		const inplaceReview = await harness().promptAfterCommand("review");
		expect(inplaceReview).toContain("switched into REVIEW in place");
		expect(inplaceReview).toContain("author-side pass, not a fresh-eyes review");
		expect(await harness().promptAfterCommand("plan")).not.toContain("in_place_switch");
	});

	it("primes /mode implement in the editor after a successful save_plan", async () => {
		const { handlers } = harness();
		const arm = handlers.get("tool_execution_end")![0];
		const deliver = handlers.get("agent_settled")![0];
		const setEditorText = vi.fn();
		const notify = vi.fn();
		const ctx = { hasUI: true, ui: { notify, setEditorText, getEditorText: () => "" } };

		await arm({ toolName: "manage_task", isError: false, result: { details: { operation: "save_plan" } } });
		await deliver({}, ctx);
		expect(setEditorText).toHaveBeenCalledWith("/mode implement");
		expect(notify).toHaveBeenCalledWith(expect.stringContaining("Plan saved"), "info");

		// The offer is one-shot: a second settle with nothing armed does nothing.
		setEditorText.mockClear();
		notify.mockClear();
		await deliver({}, ctx);
		expect(setEditorText).not.toHaveBeenCalled();
		expect(notify).not.toHaveBeenCalled();
	});

	it("does not prime after a failed save_plan, an update_plan, or another tool", async () => {
		const { handlers } = harness();
		const arm = handlers.get("tool_execution_end")![0];
		const deliver = handlers.get("agent_settled")![0];
		const setEditorText = vi.fn();
		const ctx = { hasUI: true, ui: { notify: vi.fn(), setEditorText, getEditorText: () => "" } };

		await arm({ toolName: "manage_task", isError: true, result: { details: { operation: "save_plan" } } });
		await arm({ toolName: "manage_task", isError: false, result: { details: { operation: "update_plan" } } });
		await arm({ toolName: "manage_todo_list", isError: false, result: { details: { operation: "save_plan" } } });
		await arm({ toolName: "manage_task", isError: false, result: undefined });
		await deliver({}, ctx);
		expect(setEditorText).not.toHaveBeenCalled();
	});

	it("leaves a non-empty editor untouched but still announces the saved plan", async () => {
		const { handlers } = harness();
		const arm = handlers.get("tool_execution_end")![0];
		const deliver = handlers.get("agent_settled")![0];
		const setEditorText = vi.fn();
		const notify = vi.fn();
		const ctx = { hasUI: true, ui: { notify, setEditorText, getEditorText: () => "already typing" } };

		await arm({ toolName: "manage_task", isError: false, result: { details: { operation: "save_plan" } } });
		await deliver({}, ctx);
		expect(setEditorText).not.toHaveBeenCalled();
		expect(notify).toHaveBeenCalledWith(expect.stringContaining("Plan saved"), "info");
	});

	it("includes the ask-first memory policy in every mode", async () => {
		const { promptFor } = harness();
		const guidance = await promptFor("implement");
		expect(guidance).toContain("apply them only after the user confirms");
		expect(guidance).toContain("treat project memory as temporary fallback state");
		expect(guidance).toContain("fixed at the root cause");
		expect(guidance).toContain("only a recurring pattern or one confirmed by the user is durable");
	});
});

describe("/mode command routing", () => {
	it("switches mode in place on an explicit continue, persisting an in-place marker", async () => {
		const { runMode, emitted, notify } = harness();
		await runMode("implement continue");
		expect(emitted).toContainEqual([MODE_UPDATE_EVENT, "implement"]);
		expect(notify).toHaveBeenCalledWith(expect.stringContaining("implement"), "info");
	});

	it("routes an explicit fresh placement to the handoff path", async () => {
		const { runMode, ctx } = harness();
		await runMode("implement fresh");
		// No plan resolves on disk, so the handoff path notifies its resolution
		// error and never spawns — a warning that the in-place path would never
		// emit, proving fresh routed to openHandoffSession rather than a switch.
		expect(ctx.newSession).not.toHaveBeenCalled();
		expect(ctx.ui.notify).toHaveBeenCalledWith(expect.stringContaining("Plan session first"), "warning");
	});

	it("warns with usage on an unknown mode and does nothing", async () => {
		const { runMode, notify, emitted } = harness();
		await runMode("simplify");
		expect(notify).toHaveBeenCalledWith(expect.stringContaining("/mode"), "warning");
		expect(emitted.some(([name]) => name === MODE_UPDATE_EVENT)).toBe(false);
	});

	it("guides an argument-less headless invocation through a displayed message", async () => {
		const { commands, messages } = harness();
		await commands.get("mode")!.handler("", { hasUI: false, ui: { notify: vi.fn() }, sessionManager: { getBranch: () => [] } });
		const displayed = messages.find((message) => message.display === true);
		expect(displayed?.content).toContain("Name a mode when headless");
	});
});
