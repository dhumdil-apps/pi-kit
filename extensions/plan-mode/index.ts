import type { ExtensionAPI, ExtensionContext, SessionStartEvent } from "@earendil-works/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { askUserFancy } from "../ask-user/index.js";
import { getSetting } from "../extension-settings/index.js";
import { activePlanRelativePaths, detectGit, porcelainPaths, runAcceptanceChecks, runPackageChecks, unexpectedDirtyPaths } from "./checkpoint.js";
import { latestPlanLink, loadPlan, persistPlan } from "./ledger.js";
import { classifyTriage, createPlanState, forkPlanState, now, readyGate, todosFromMarkdown, transition } from "./state.js";
import type { Checkpoint, CheckResult, Effort, PlanState, PlanTodo, TodoStatus } from "./types.js";
import { REVIEW_TODO_PATTERN, STATE_VERSION } from "./types.js";

const STATUS_KEY = "plan-mode";
const EXTENSION_NAME = "plan-mode";
const SPINNER_FRAMES = ["◐", "◓", "◑", "◒"];

function assistantText(messages: unknown[]): string {
	for (let index = messages.length - 1; index >= 0; index--) {
		const item = messages[index] as { role?: string; content?: unknown };
		if (item?.role !== "assistant") continue;
		if (typeof item.content === "string") return item.content;
		if (Array.isArray(item.content)) return item.content.filter((part): part is { type: string; text: string } => !!part && typeof part === "object" && (part as { type?: string }).type === "text" && typeof (part as { text?: unknown }).text === "string").map((part) => part.text).join("\n");
	}
	return "";
}

function isPlanResponse(text: string): boolean {
	return /(?:^|\n)\s*(?:#{1,3}\s*)?plan\b:?/i.test(text) || /<!--\s*plan-ready\s*-->/i.test(text);
}

function parseStringSetting(id: string, fallback: string): string {
	return getSetting(EXTENSION_NAME, id, fallback) ?? fallback;
}

export default function planMode(pi: ExtensionAPI): void {
	let state: PlanState | undefined;
	let active = false;
	let currentCwd = "";
	let effort: Effort = "low";
	let checkpointing = false;
	let spinnerTimer: ReturnType<typeof setInterval> | undefined;
	let spinnerFrame = 0;
	const orchestrationEnabled = () => parseStringSetting("orchestration", "on") === "on";

	const command = async (program: string, args: string[], options?: { timeout?: number }) => {
		const result = await pi.exec(program, args, { cwd: currentCwd, timeout: options?.timeout ?? 30_000 });
		return { code: result.code, stdout: result.stdout, stderr: result.stderr };
	};

	const notify = (ctx: ExtensionContext, message: string, type: "info" | "warning" | "error" = "info") => {
		if (ctx.hasUI) ctx.ui.notify(message, type);
		else pi.sendMessage({ customType: `plan-notification-${type}`, content: `${type === "error" ? "❌" : type === "warning" ? "⚠️" : "ℹ️"} **Plan Mode**: ${message}`, display: true }, { triggerTurn: false });
	};

	const sendUserMessage = (ctx: ExtensionContext, message: string) => {
		pi.sendUserMessage(message, ctx.isIdle() ? undefined : { deliverAs: "followUp" });
	};

	const stopSpinner = () => {
		if (!spinnerTimer) return;
		clearInterval(spinnerTimer);
		spinnerTimer = undefined;
	};

	const powerbarText = (): { icon: string; text: string; color: string } | undefined => {
		if (!active && !state) return undefined;
		if (!state) return { icon: SPINNER_FRAMES[spinnerFrame++ % SPINNER_FRAMES.length], text: "Plan · Awaiting goal", color: "warning" };
		const completed = state.todos.filter((todo) => todo.status === "completed").length;
		switch (state.phase) {
			case "awaiting-goal": return { icon: SPINNER_FRAMES[spinnerFrame++ % SPINNER_FRAMES.length], text: "Plan · Awaiting goal", color: "warning" };
			case "triage": return { icon: SPINNER_FRAMES[spinnerFrame++ % SPINNER_FRAMES.length], text: "Plan · Triage", color: "warning" };
			case "discovering": return { icon: SPINNER_FRAMES[spinnerFrame++ % SPINNER_FRAMES.length], text: "Plan · Discovering", color: "warning" };
			case "deciding": return { icon: "?", text: "Plan · Deciding", color: "warning" };
			case "planning": return { icon: SPINNER_FRAMES[spinnerFrame++ % SPINNER_FRAMES.length], text: "Plan · Planning", color: "warning" };
			case "ready": return { icon: "✔", text: "Plan · Ready", color: "warning" };
			case "executing": return { icon: "●", text: `Plan · Executing ${completed}/${state.todos.length}`, color: "accent" };
			case "reviewing": return { icon: "◆", text: "Plan · Reviewing", color: "accent" };
			case "blocked": return { icon: "!", text: "Plan · Blocked", color: "error" };
			case "complete": return { icon: "✔", text: "Plan · Complete", color: "success" };
		}
	};

	const refreshStatus = (ctx: ExtensionContext) => {
		const segment = powerbarText();
		if (!segment) {
			stopSpinner();
			if (ctx.hasUI) ctx.ui.setStatus(STATUS_KEY, undefined);
			pi.events.emit("powerbar:update", { id: "plan-mode", text: undefined });
			return;
		}
		const animated = !state || ["awaiting-goal", "triage", "discovering", "planning"].includes(state.phase);
		if (animated && ctx.hasUI && !spinnerTimer) {
			spinnerTimer = setInterval(() => {
				const next = powerbarText();
				if (next) pi.events.emit("powerbar:update", { id: "plan-mode", ...next });
			}, 500);
			(spinnerTimer as { unref?: () => void }).unref?.();
		} else if (!animated) stopSpinner();
		if (ctx.hasUI) ctx.ui.setStatus(STATUS_KEY, ctx.ui.theme.fg(segment.color as never, segment.text));
		pi.events.emit("powerbar:update", { id: "plan-mode", ...segment });
	};

	const persist = async () => {
		if (state) await persistPlan(state);
	};

	const appendLink = () => {
		if (!state) return;
		pi.appendEntry("plan-mode", { version: STATE_VERSION, ledger: state.ledgerPath, state: state.statePath });
	};

	const initializeGoal = async (ctx: ExtensionContext, goal: string) => {
		state = createPlanState({ cwd: ctx.cwd, goal, effort, sessionId: ctx.sessionManager.getSessionId() });
		const git = await detectGit(command);
		state.gitMode = git.isGit ? "git" : "non-git";
		state.baseCommit = git.head;
		await persist();
		appendLink();
		refreshStatus(ctx);
	};

	const loadLinkedPlan = async (ctx: ExtensionContext, link: { state: string }, warningPrefix = "") => {
		const loaded = await loadPlan(link.state, { cwd: ctx.cwd, sessionId: ctx.sessionManager.getSessionId() });
		if (loaded.warning) notify(ctx, `${warningPrefix}${loaded.warning}`, "warning");
		if (!loaded.state) return false;
		state = loaded.state;
		active = state.phase !== "complete";
		effort = state.effort;
		await persist();
		refreshStatus(ctx);
		return true;
	};

	const reconstructSession = async (event: SessionStartEvent, ctx: ExtensionContext) => {
		currentCwd = ctx.cwd;
		const link = latestPlanLink(ctx.sessionManager.getEntries());
		if (event.reason === "fork" && link) {
			const loaded = await loadPlan(link.state, { cwd: ctx.cwd, sessionId: ctx.sessionManager.getSessionId() });
			if (loaded.state) {
				state = forkPlanState(loaded.state, { cwd: ctx.cwd, sessionId: ctx.sessionManager.getSessionId() });
				await persist();
				appendLink();
				active = state.phase !== "complete";
				refreshStatus(ctx);
				return;
			}
		}
		if (link && await loadLinkedPlan(ctx, link)) return;
		state = undefined;
		active = ctx.hasUI && parseStringSetting("auto-start", "on") === "on";
		effort = parseStringSetting("default-effort", "low") === "high" ? "high" : "low";
		refreshStatus(ctx);
	};

	const scripts = async (): Promise<Record<string, string>> => {
		try { return (JSON.parse(await readFile(join(currentCwd, "package.json"), "utf8")) as { scripts?: Record<string, string> }).scripts ?? {}; }
		catch { return {}; }
	};

	const runChecks = async (full: boolean, acceptance: readonly string[] = []): Promise<CheckResult[]> => {
		const project = await runPackageChecks(command, await scripts(), full ? ["lint", "typecheck", "test", "build"] : ["lint", "typecheck"]);
		if (project.some((check) => !check.ok) || full) return project;
		return [...project, ...await runAcceptanceChecks(command, acceptance)];
	};

	const ensureCleanForExecution = async (): Promise<{ ok: boolean; reason?: string }> => {
		if (!state || state.gitMode === "non-git") return { ok: true };
		const result = await command("git", ["status", "--porcelain", "--untracked-files=all"]);
		if (result.code !== 0) return { ok: false, reason: result.stderr || "git status failed" };
		const unexpected = unexpectedDirtyPaths(porcelainPaths(result.stdout), state);
		return unexpected.length ? { ok: false, reason: `Execution requires a clean worktree. Clean these paths first: ${unexpected.join(", ")}` } : { ok: true };
	};

	const completePlanIfDone = async (ctx: ExtensionContext) => {
		if (!state || !state.todos.length || !state.todos.every((todo) => todo.status === "completed")) return;
		transition(state, "complete");
		active = false;
		await persist();
		refreshStatus(ctx);
		notify(ctx, "All plan steps are complete.");
	};

	const checkpoint = async (ctx: ExtensionContext, todo: PlanTodo, previousStatus: TodoStatus) => {
		if (!state || checkpointing || (state.phase !== "executing" && state.phase !== "reviewing")) return;
		checkpointing = true;
		try {
			const reviewTodo = REVIEW_TODO_PATTERN.test(todo.title);
			const checks = reviewTodo ? await runChecks(true) : await runChecks(false, todo.acceptanceChecks);
			const failed = checks.find((check) => !check.ok);
			const dirty = state.gitMode === "git" ? porcelainPaths((await command("git", ["status", "--porcelain", "--untracked-files=all"])).stdout) : [];
			const planFiles = activePlanRelativePaths(state);
			const changed = dirty.filter((path) => !planFiles.includes(path));
			const record: Checkpoint = { todoId: todo.id, todoTitle: todo.title, timestamp: now(), files: changed, checks, status: "skipped" };
			if (failed) {
				record.status = "failed";
				record.reason = `${failed.name} failed.`;
				todo.status = previousStatus;
				state.checkpoints.push(record);
				state.lastError = record.reason;
				transition(state, "blocked");
				await persist();
				refreshStatus(ctx);
				return;
			}
			state.validation = checks;
			state.checkpoints.push(record);
			await persist();
			if (state.gitMode === "git" && (changed.length || planFiles.length)) {
				const scoped = [...changed, ...planFiles];
				const add = await command("git", ["add", "--", ...scoped]);
				if (add.code !== 0) throw new Error(add.stderr || "git add failed");
				const commit = await command("git", ["commit", "-m", `plan(${state.slug}): complete step ${todo.id} — ${todo.title.slice(0, 60)}`]);
				if (commit.code !== 0) throw new Error(commit.stderr || "git commit failed");
				const revision = await command("git", ["rev-parse", "HEAD"]);
				record.status = "committed";
				record.commit = revision.stdout.trim();
			} else {
				record.status = "skipped";
				record.reason = state.gitMode === "non-git" ? "Non-git project; checkpoint commit disabled." : "No implementation files changed.";
			}
			await persist();
			await completePlanIfDone(ctx);
		} catch (error) {
			if (state) {
				todo.status = previousStatus;
				state.lastError = error instanceof Error ? error.message : String(error);
				transition(state, "blocked");
				await persist();
			}
			refreshStatus(ctx);
			notify(ctx, state?.lastError || "Checkpoint failed.", "error");
		} finally { checkpointing = false; }
	};

	const beginExecution = async (ctx: ExtensionContext) => {
		if (!state) return;
		if (state.phase !== "ready" && state.phase !== "blocked") return notify(ctx, `Plan cannot execute from phase ${state.phase}.`, "warning");
		const gate = orchestrationEnabled() ? readyGate(state) : { ok: true as const };
		if (!gate.ok) return notify(ctx, gate.reason || "Plan is not ready.", "warning");
		const clean = await ensureCleanForExecution();
		if (!clean.ok) {
			state.lastError = clean.reason;
			transition(state, "blocked");
			await persist();
			refreshStatus(ctx);
			return notify(ctx, clean.reason!, "warning");
		}
		state.todos = todosFromMarkdown(state.planMarkdown);
		transition(state, "executing");
		active = false;
		await persist();
		refreshStatus(ctx);
		sendUserMessage(ctx, `Execute the approved plan in ${state.ledgerPath}. You are the architect: implement each step yourself, validate after each step, then update the parent manage_todo_list.`);
	};

	pi.registerTool({
		name: "plan_triage",
		label: "Plan Triage",
		description: "Classify the active plan goal before discovery. Trivial is allowed only for one known local file with obvious validation and no ambiguity, architecture, security, or external research.",
		parameters: Type.Object({ classification: Type.Union([Type.Literal("trivial"), Type.Literal("standard"), Type.Literal("deep")]), reason: Type.String() }),
		async execute(_id, params, _signal, _update, ctx) {
			if (!state) return { content: [{ type: "text" as const, text: "No active plan goal." }], isError: true, details: { classification: "none" } };
			const triage = classifyTriage({ effort: state.effort, enabled: parseStringSetting("quick-triage", "on") === "on", proposed: params.classification, reason: params.reason });
			state.triage = { ...triage, timestamp: now() };
			transition(state, triage.classification === "trivial" ? "planning" : "discovering");
			await persist();
			refreshStatus(ctx);
			return { content: [{ type: "text" as const, text: triage.classification === "trivial" ? "Trivial path accepted. Explore read-only and produce a concise inline plan." : `Triage recorded as ${triage.classification}. Read the relevant code, ask unresolved decisions with ask_user, then write the plan inline.` }], details: triage };
		},
	});

	pi.registerTool({
		name: "plan_record_review_decision",
		label: "Record Review Decision",
		description: "Persist the architect's classification and rationale for the Plan Mode review phase.",
		parameters: Type.Object({ required: Type.Array(Type.String()), optional: Type.Array(Type.String()), rejected: Type.Array(Type.String()), rationale: Type.String() }),
		async execute(_id, params) {
			if (!state || state.phase !== "reviewing") return { content: [{ type: "text" as const, text: "Review decisions can be recorded only in the reviewing phase." }], isError: true, details: { ok: false } };
			state.review.classification = params;
			state.review.findings = [`Rationale: ${params.rationale}`, ...params.required.map((item) => `Required: ${item}`), ...params.optional.map((item) => `Optional: ${item}`), ...params.rejected.map((item) => `Rejected: ${item}`)];
			await persist();
			return { content: [{ type: "text" as const, text: `Recorded ${params.required.length} required, ${params.optional.length} optional, and ${params.rejected.length} rejected review findings.` }], details: { ok: true } };
		},
	});

	pi.on("tool_call", async (event) => {
		if (!state || state.phase === "complete") return;
		if (event.toolName === "ask_user" && (state.phase === "discovering" || state.phase === "planning")) {
			transition(state, "deciding");
			await persist();
			if (lastContext) refreshStatus(lastContext);
		}
		if (event.toolName === "manage_todo_list" && (event.input as { operation?: string }).operation === "write") {
			if (!["executing", "reviewing"].includes(state.phase)) return { block: true, reason: `Plan Mode creates todos automatically from the approved plan when execution starts. Skip manage_todo_list while ${state.phase}; write or refine the plan draft instead.` };
		}
		return undefined;
	});

	pi.on("tool_result", async (event, ctx) => {
		if (!state) return;
		if (event.toolName === "ask_user") {
			const details = event.details as { question?: string; response?: { selections?: string[]; text?: string } } | undefined;
			const answer = details?.response?.selections?.join(", ") || details?.response?.text;
			if (details?.question && answer) {
				state.decisions.push({ timestamp: now(), question: details.question, answer });
				if (state.phase === "deciding") transition(state, "planning");
				await persist();
			}
		}
		if (event.toolName !== "manage_todo_list") return;
		const details = event.details as { operation?: string; todos?: PlanTodo[] } | undefined;
		if (details?.operation !== "write" || !Array.isArray(details.todos)) return;
		const before = new Map(state.todos.map((todo) => [todo.id, todo.status]));
		state.todos = details.todos.map((todo) => ({ ...state!.todos.find((item) => item.id === todo.id), ...todo }));
		const reviewTodo = state.todos.find((todo) => REVIEW_TODO_PATTERN.test(todo.title));
		if (reviewTodo?.status === "in-progress" && before.get(reviewTodo.id) !== "in-progress") {
			const fullChecks = await runChecks(true);
			state.validation = fullChecks;
			if (fullChecks.some((check) => !check.ok)) {
				state.lastError = "Full validation failed before review.";
				transition(state, "blocked");
			} else {
				transition(state, "reviewing");
				state.review.round = 1;
				sendUserMessage(ctx, `Review the implementation in ${state.ledgerPath} with fresh eyes: reread the diff against the plan's goal and validation sections. Classify findings as required, optional, or rejected with plan_record_review_decision, fix required findings inline, then re-run the checks before completing the review todo.`);
			}
		}
		await persist();
		refreshStatus(ctx);
		const newlyCompleted = state.todos.find((todo) => todo.status === "completed" && before.get(todo.id) !== "completed");
		if (newlyCompleted) await checkpoint(ctx, newlyCompleted, before.get(newlyCompleted.id) || "in-progress");
	});

	let lastContext: ExtensionContext | undefined;
	pi.on("turn_start", async (_event, ctx) => { lastContext = ctx; currentCwd = ctx.cwd; });

	pi.on("before_agent_start", async (event, ctx) => {
		lastContext = ctx;
		currentCwd = ctx.cwd;
		if (!active && !state) return;
		if (!state) await initializeGoal(ctx, event.prompt.trim() || "Untitled plan");
		if (!state) return;
		if (!orchestrationEnabled() && state.phase !== "executing" && state.phase !== "reviewing") {
			return { systemPrompt: `${event.systemPrompt}\n\n[PLAN MODE — INLINE]\nExplore read-only and produce a concise implementation plan for ${state.goal}. Do not edit. End with <!-- plan-ready -->. Ledger: ${state.ledgerPath}` };
		}
		if (state.phase === "executing" || state.phase === "reviewing") return { systemPrompt: `${event.systemPrompt}\n\n[PLAN ARCHITECT — ${state.phase.toUpperCase()}]\nYou are the architect: you own the plan, every decision, and all validation. Implement each step yourself, validate after each step, then update the parent manage_todo_list. Plan ledger: ${state.ledgerPath}` };
		return { systemPrompt: `${event.systemPrompt}\n\n[PLAN ARCHITECT — READ ONLY]\nDo not edit, write, install, commit, or run mutating shell commands. Plan ledger: ${state.ledgerPath}\nExploration scope: prefer targeted reads of specific files over broad searches. If project memory names a source root, go straight to it. Any search must stay inside the working directory or that source root, excluding vendored/cache dirs (node_modules, agent/git, agent/sessions). Never run home-directory-wide or filesystem-wide find/rg.\nDo not use manage_todo_list while planning — todos are created automatically from the approved plan when execution starts.\n1. Call plan_triage exactly once when phase is triage. Trivial requires one known file, obvious validation, and no ambiguity, architecture, security, or external research; otherwise choose standard/deep.\n2. Read the relevant code inline yourself.\n3. Ask unresolved user decisions with ask_user.\n4. Write the plan yourself in your response: a Goal section, a "Plan:" heading with a numbered task list, a Validation section, and a Risks section. End with <!-- plan-ready -->.\nCurrent phase: ${state.phase}. Triage: ${state.triage?.classification || "pending"}.` };
	});

	pi.on("agent_end", async (event, ctx) => {
		lastContext = ctx;
		if (!state || !active) return;
		const text = assistantText(event.messages as unknown[]);
		if (!isPlanResponse(text)) return;
		state.planMarkdown = text;
		const gate = orchestrationEnabled() ? readyGate(state) : { ok: true as const };
		if (!gate.ok) {
			state.lastError = gate.reason;
			if (state.phase !== "planning") transition(state, "planning");
			await persist();
			refreshStatus(ctx);
			notify(ctx, `${gate.reason} The displayed draft is not executable.`, "warning");
			sendUserMessage(ctx, `Continue orchestration for ${state.ledgerPath}. ${gate.reason}`);
			return;
		}
		if (state.phase !== "planning") transition(state, "planning");
		state.todos = todosFromMarkdown(state.planMarkdown);
		transition(state, "ready");
		await persist();
		refreshStatus(ctx);
		await showActions(ctx);
	});

	const showActions = async (ctx: ExtensionContext) => {
		if (!state) return;
		if (!ctx.hasUI) return pi.sendMessage({ customType: "plan-actions-reminder", content: "Plan ready. Run `/plan execute` or `/plan off`.", display: true }, { triggerTurn: false });
		const result = await askUserFancy(ctx, { question: "Plan mode — next action", options: [{ title: "Execute", description: "Start orchestrated implementation" }, { title: "Refine", description: "Add feedback and return to planning" }, { title: "Save", description: "Persist the ledger now" }, { title: "Exit", description: "End this plan" }], allowFreeform: false });
		if (result?.kind !== "selection") return;
		const choice = result.selections[0];
		if (choice === "Execute") return beginExecution(ctx);
		if (choice === "Refine") {
			const note = await askUserFancy(ctx, { question: "How should the plan be refined?", options: [], allowFreeform: true });
			const text = note?.kind === "freeform" ? note.text : note?.kind === "selection" ? note.comment : undefined;
			if (text) {
				state.decisions.push({ timestamp: now(), question: "Plan refinement", answer: text });
				transition(state, "planning");
				await persist();
				sendUserMessage(ctx, `Refine the plan using this feedback: ${text}`);
			}
			return;
		}
		if (choice === "Save") return persist().then(() => notify(ctx, `Saved ${state!.ledgerPath}`));
		if (choice === "Exit") {
			transition(state, "complete");
			active = false;
			await persist();
			refreshStatus(ctx);
		}
	};

	pi.registerCommand("plan", {
		description: "Orchestrated plan workflow: /plan, /plan deep, /plan execute, /plan save, /plan off, /plan resume <slug>, /plan status",
		handler: async (args, ctx) => {
			lastContext = ctx;
			currentCwd = ctx.cwd;
			const input = args.trim();
			if (input === "off" || input === "exit") {
				active = false;
				if (state && state.phase !== "complete") transition(state, "complete");
				await persist();
				refreshStatus(ctx);
				return;
			}
			if (input === "status") return notify(ctx, state ? `${state.slug}: ${state.phase}; ${state.todos.filter((todo) => todo.status === "completed").length}/${state.todos.length} todos.` : "Awaiting a plan goal.");
			if (input === "save") return state ? persist().then(() => notify(ctx, `Saved ${state!.ledgerPath}`)) : notify(ctx, "No plan to save.", "warning");
			if (input === "execute") return beginExecution(ctx);
			if (input.startsWith("resume ")) {
				const slug = input.slice(7).trim();
				const loaded = await loadLinkedPlan(ctx, { state: join(ctx.cwd, ".pi", "plans", `${slug}.state.json`) }, "Resume: ");
				if (loaded) appendLink();
				return;
			}
			if (input === "deep") {
				effort = "high";
				state = undefined;
				active = true;
				refreshStatus(ctx);
				return notify(ctx, "Deep planning armed. Send the goal next.");
			}
			if (!input) {
				if (state?.phase === "ready") return showActions(ctx);
				effort = "low";
				state = undefined;
				active = true;
				refreshStatus(ctx);
				return notify(ctx, "Quick planning armed. Send the goal next.");
			}
			notify(ctx, "Use /plan, /plan deep, /plan execute, /plan save, /plan off, /plan resume <slug>, or /plan status.", "warning");
		},
	});

	pi.events.emit("powerbar:register-segment", { id: "plan-mode", label: "Plan Mode" });
	pi.events.emit("pi-extension-settings:register", { name: EXTENSION_NAME, settings: [
		{ id: "auto-start", label: "Auto-start planning", defaultValue: "on", values: ["on", "off"] },
		{ id: "default-effort", label: "Default planning effort", defaultValue: "low", values: ["low", "high"] },
		{ id: "orchestration", label: "Enforce plan-ready gate", defaultValue: "on", values: ["on", "off"] },
		{ id: "quick-triage", label: "Allow trivial quick-plan escape", defaultValue: "on", values: ["on", "off"] },
	] });

	pi.on("session_start", async (event, ctx) => { lastContext = ctx; await reconstructSession(event, ctx); });
	pi.on("session_shutdown", async (_event, ctx) => {
		stopSpinner();
		if (ctx.hasUI) ctx.ui.setStatus(STATUS_KEY, undefined);
		pi.events.emit("powerbar:update", { id: "plan-mode", text: undefined });
		lastContext = undefined;
	});
}
