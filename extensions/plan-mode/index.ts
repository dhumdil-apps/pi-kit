import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { askUserFancy } from "../ask-user/index";

const STATE_VERSION = 1;
const STATUS_KEY = "plan-mode";

type Phase = "exploring" | "ready" | "executing" | "blocked" | "complete";
type TodoStatus = "not-started" | "in-progress" | "completed";

interface PlanTodo {
  id: number;
  title: string;
  description: string;
  status: TodoStatus;
}

interface Checkpoint {
  todoId: number;
  todoTitle: string;
  timestamp: string;
  files: string[];
  checks: Array<{ name: string; ok: boolean; output: string }>;
  status: "committed" | "blocked" | "failed" | "skipped";
  commit?: string;
  reason?: string;
}

interface PlanState {
  version: number;
  slug: string;
  createdAt: string;
  updatedAt: string;
  phase: Phase;
  goal: string;
  effort: "low" | "medium" | "high";
  planMarkdown: string;
  baselineDirtyPaths: string[];
  todos: PlanTodo[];
  checkpoints: Checkpoint[];
  lastError?: string;
}

function slugify(input: string): string {
  const slug = input.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  return slug || `plan-${new Date().toISOString().slice(0, 10)}`;
}

function now(): string { return new Date().toISOString(); }

function textFromMessage(message: unknown): string {
  const item = message as { role?: string; content?: unknown };
  if (item.role !== "assistant") return "";
  if (typeof item.content === "string") return item.content;
  if (!Array.isArray(item.content)) return "";
  return item.content
    .filter((part): part is { type: string; text: string } => !!part && typeof part === "object" && (part as { type?: string }).type === "text" && typeof (part as { text?: unknown }).text === "string")
    .map((part) => part.text)
    .join("\n");
}

function isPlanResponse(text: string): boolean {
  return /(?:^|\n)\s*(?:#{1,3}\s*)?plan\b:?/i.test(text) || /<!--\s*plan-ready\s*-->/i.test(text);
}

function extractTodos(markdown: string): PlanTodo[] {
  const section = markdown.match(/(?:^|\n)\s*(?:#{1,3}\s*)?plan\b:?\s*\n([\s\S]*)/i)?.[1] ?? "";
  const todos: PlanTodo[] = [];
  for (const match of section.matchAll(/^\s*(\d+)[.)]\s+(.+)$/gm)) {
    const title = match[2].replace(/[*`]/g, "").trim();
    if (title.length > 3) todos.push({ id: todos.length + 1, title: title.slice(0, 100), description: title, status: "not-started" });
  }
  return todos;
}

async function git(pi: ExtensionAPI, cwd: string, args: string[]) {
  return pi.exec("git", args, { cwd, timeout: 30_000 });
}

async function dirtyPaths(pi: ExtensionAPI, cwd: string): Promise<string[]> {
  const result = await git(pi, cwd, ["status", "--porcelain"]);
  if (result.code !== 0) return [];
  return result.stdout.split("\n").filter(Boolean).map((line) => line.slice(3).split(" -> ").pop()!.trim()).filter(Boolean);
}

export default function planMode(pi: ExtensionAPI): void {
  let state: PlanState | undefined;
  let active = false;
  let currentCwd = "";
  let checkpointing = false;
  let effort: "low" | "medium" | "high" = "medium";

  const emitPowerbarStatus = (exploring: boolean) => {
    const completed = state?.todos.filter((todo) => todo.status === "completed").length ?? 0;
    const blocked = state?.phase === "blocked";
    pi.events.emit("powerbar:update", {
      id: "plan-mode",
      icon: exploring ? "◌" : blocked ? "!" : "●",
      text: exploring ? `Plan · ${state?.effort ?? effort}` : blocked ? "Plan · Blocked" : `Plan · Executing ${completed}/${state?.todos.length ?? 0}`,
      color: blocked ? "error" : exploring ? "warning" : "accent",
    });
  };

  const planDir = () => join(currentCwd, ".pi", "plans");
  const markdownPath = () => join(planDir(), `${state!.slug}.md`);
  const statePath = () => join(planDir(), `${state!.slug}.state.json`);

  const notify = (ctx: ExtensionContext, message: string, type: "info" | "warning" | "error" = "info") => {
    if (ctx.hasUI) {
      ctx.ui.notify(message, type);
    } else {
      pi.sendMessage(
        {
          customType: `plan-notification-${type}`,
          content: `${type === "error" ? "❌" : type === "warning" ? "⚠️" : "ℹ️"} **Plan Mode**: ${message}`,
          display: true,
        },
        { triggerTurn: false }
      );
    }
  };

  /** Commands and plan-end UI can run while the current agent turn is still settling. */
  const sendUserMessage = (ctx: ExtensionContext, message: string) => {
    if (ctx.isIdle()) pi.sendUserMessage(message);
    else pi.sendUserMessage(message, { deliverAs: "followUp" });
  };

  const clearPlanDisplay = (ctx: ExtensionContext) => {
    if (ctx.hasUI) {
      ctx.ui.setStatus(STATUS_KEY, undefined);
      ctx.ui.setWorkingMessage();
      ctx.ui.setWorkingIndicator();
    }
    pi.events.emit("powerbar:update", { id: "plan-mode", text: undefined });
  };

  const setStatus = (ctx: ExtensionContext) => {
    const completed = state?.todos.filter((todo) => todo.status === "completed").length ?? 0;
    const phase = state?.phase;
    const exploring = active;
    const executing = phase === "executing";
    const blocked = phase === "blocked";
    if (!exploring && !executing && !blocked) return clearPlanDisplay(ctx);

    const text = exploring ? `Plan · ${state?.effort ?? effort}` : blocked ? "Plan · Blocked" : `Plan · Executing ${completed}/${state?.todos.length ?? 0}`;
    const color = blocked ? "error" : exploring ? "warning" : "accent";
    if (ctx.hasUI) {
      ctx.ui.setStatus(STATUS_KEY, ctx.ui.theme.fg(color, text));
      ctx.ui.setWorkingIndicator();
    }
    emitPowerbarStatus(exploring);
  };

  const persist = async () => {
    if (!state) return;
    state.updatedAt = now();
    await mkdir(planDir(), { recursive: true });
    const header = `# Plan: ${state.goal}\n\n`;
    const body = state.planMarkdown.startsWith("#") ? state.planMarkdown : `${header}${state.planMarkdown}`;
    await writeFile(markdownPath(), body, "utf8");
    await writeFile(statePath(), `${JSON.stringify(state, null, 2)}\n`, "utf8");
  };

  const createState = async (goal: string) => {
    const slug = slugify(goal);
    state = {
      version: STATE_VERSION, slug, createdAt: now(), updatedAt: now(), phase: "exploring", goal, effort,
      planMarkdown: "", baselineDirtyPaths: [], todos: [], checkpoints: [],
    };
    await persist();
  };

  const runChecks = async (): Promise<Checkpoint["checks"]> => {
    const checks: Checkpoint["checks"] = [];
    let scripts: Record<string, string> = {};
    try { scripts = JSON.parse(await readFile(join(currentCwd, "package.json"), "utf8")).scripts ?? {}; } catch { return checks; }
    for (const name of ["lint", "typecheck", "test", "build"]) {
      if (!scripts[name]) continue;
      const result = await pi.exec("npm", ["run", name], { cwd: currentCwd, timeout: name === "test" ? 120_000 : 60_000 });
      const output = `${result.stdout}\n${result.stderr}`.trim().slice(-8000);
      checks.push({ name, ok: result.code === 0, output });
      if (result.code !== 0) break;
    }
    return checks;
  };

  const checkpoint = async (ctx: ExtensionContext, todo: PlanTodo, previousStatus: TodoStatus) => {
    if (!state || checkpointing || state.phase !== "executing") return;
    checkpointing = true;
    try {
      const dirty = await dirtyPaths(pi, currentCwd);
      const planFiles = [".pi/plans/" + basename(markdownPath()), ".pi/plans/" + basename(statePath())];
      const changed = dirty.filter((path) => !planFiles.includes(path));
      const overlappingBaseline = changed.filter((path) => state!.baselineDirtyPaths.includes(path));
      const record: Checkpoint = { todoId: todo.id, todoTitle: todo.title, timestamp: now(), files: changed, checks: [], status: "skipped" };
      if (overlappingBaseline.length > 0) {
        record.status = "blocked";
        record.reason = `Refusing automatic commit: pre-existing modified paths overlap this step: ${overlappingBaseline.join(", ")}`;
        state.phase = "blocked";
        state.lastError = record.reason;
        state.checkpoints.push(record);
        todo.status = previousStatus;
        await persist();
        setStatus(ctx);
        notify(ctx, record.reason, "warning");
        return;
      }
      record.checks = await runChecks();
      const failed = record.checks.find((check) => !check.ok);
      if (failed) {
        record.status = "failed";
        record.reason = `${failed.name} failed; checkpoint was not committed.`;
        state.phase = "blocked";
        state.lastError = record.reason;
        state.checkpoints.push(record);
        todo.status = previousStatus;
        await persist();
        setStatus(ctx);
        notify(ctx, record.reason, "error");
        return;
      }
      state.checkpoints.push(record);
      await persist();
      const scoped = [...changed, ...planFiles];
      if (scoped.length === planFiles.length) {
        record.status = "skipped";
        record.reason = "No implementation files changed for this todo.";
        await persist();
        
        const allCompleted = state.todos.every((t) => t.status === "completed");
        if (allCompleted) {
          state.phase = "complete";
          active = false;
          await persist();
          setStatus(ctx);
          notify(ctx, "All plan steps are complete! Plan execution finished.");
        }
        return;
      }
      const add = await git(pi, currentCwd, ["add", "--", ...scoped]);
      if (add.code !== 0) throw new Error(add.stderr || "git add failed");
      const commit = await git(pi, currentCwd, ["commit", "-m", `plan(${state.slug}): complete step ${todo.id} — ${todo.title.slice(0, 60)}`]);
      if (commit.code !== 0) throw new Error(commit.stderr || "git commit failed");
      const revision = await git(pi, currentCwd, ["rev-parse", "HEAD"]);
      record.status = "committed";
      record.commit = revision.stdout.trim();
      await persist();
      notify(ctx, `Checkpoint committed for todo ${todo.id}: ${record.commit.slice(0, 8)}`);

      const allCompleted = state.todos.every((t) => t.status === "completed");
      if (allCompleted) {
        state.phase = "complete";
        active = false;
        await persist();
        setStatus(ctx);
        notify(ctx, "All plan steps are complete! Plan execution finished.");
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      if (state) {
        state.phase = "blocked";
        state.lastError = `Checkpoint failed: ${reason}`;
        state.checkpoints.push({ todoId: todo.id, todoTitle: todo.title, timestamp: now(), files: [], checks: [], status: "failed", reason });
        todo.status = previousStatus;
        await persist();
      }
      setStatus(ctx);
      notify(ctx, `Checkpoint failed: ${reason}`, "error");
    } finally { checkpointing = false; }
  };

  const beginExecution = async (ctx: ExtensionContext) => {
    if (!state) return;
    const resuming = state.phase === "blocked" || state.phase === "executing";
    state.phase = "executing";
    active = false;
    if (!resuming) {
      state.todos = extractTodos(state.planMarkdown);
    }
    state.baselineDirtyPaths = await dirtyPaths(pi, currentCwd);
    await persist();
    setStatus(ctx);
    if (resuming) {
      sendUserMessage(ctx, `Resume executing the saved plan at ${markdownPath()}. Use manage_todo_list to continue tracking progress. Complete the remaining steps.`);
    } else {
      sendUserMessage(ctx, `Execute the saved plan at ${markdownPath()}. First use manage_todo_list to replace the current list with the saved plan steps. Keep exactly one step in-progress. After each successful step, mark it completed immediately; the plan extension will run project checks and create a scoped Git checkpoint automatically. Stop if a checkpoint reports a failure or blocked state.`);
    }
  };

  const showPlanActions = async (ctx: ExtensionContext) => {
    if (!ctx.hasUI) {
      pi.sendMessage(
        {
          customType: "plan-actions-reminder",
          content: `**Plan generated and saved!**\n\nRun \`/plan execute\` to start implementing the plan, or \`/plan off\` to exit planning mode.`,
          display: true,
        },
        { triggerTurn: false }
      );
      return;
    }
    const result = await askUserFancy(ctx, {
      question: "Plan mode — next action",
      options: [
        { title: "Execute", description: "Start implementing the plan" },
        { title: "Refine", description: "Provide feedback to refine the plan" },
        { title: "Save", description: "Save the current plan to disk" },
        { title: "Exit", description: "Exit planning mode" }
      ],
      allowFreeform: false,
    });
    if (!result || result.kind !== "selection" || result.selections.length === 0) return;
    const choice = result.selections[0];
    if (choice === "Execute") {
      if (!state || (state.phase !== "ready" && state.phase !== "blocked")) notify(ctx, "A ready or blocked saved plan is required before execution.", "warning");
      else await beginExecution(ctx);
      return;
    }
    if (choice === "Refine") {
      if (!state) { notify(ctx, "Send the goal first, then refine the saved plan.", "warning"); return; }
      const note = await ctx.ui.editor("How should the plan be refined?", "");
      if (note?.trim()) sendUserMessage(ctx, `Refine the saved plan. Remain in read-only exploration mode. User feedback: ${note.trim()}`);
      return;
    }
    if (choice === "Save") {
      if (!state) notify(ctx, "Send the goal first so there is a plan to save.", "warning");
      else { await persist(); notify(ctx, `Saved ${markdownPath()}`); }
      return;
    }
    if (choice === "Exit") {
      active = false;
      if (state && (state.phase === "exploring" || state.phase === "executing" || state.phase === "blocked")) {
        state.phase = "complete";
      }
      if (state) await persist();
      setStatus(ctx);
      notify(ctx, "Plan mode exited.");
    }
  };

  const chooseEffort = async (ctx: ExtensionContext) => {
    if (!ctx.hasUI) return;
    const result = await askUserFancy(ctx, {
      question: "Start plan exploration",
      options: [
        { title: "Quick", description: "Low effort planning" },
        { title: "Deep", description: "Thorough investigation" }
      ],
      allowFreeform: false,
    });
    if (!result || result.kind !== "selection" || result.selections.length === 0) {
      clearPlanDisplay(ctx);
      return;
    }
    const choice = result.selections[0];
    effort = choice === "Quick" ? "low" : "high";
    state = undefined;
    active = true;
    setStatus(ctx);
    notify(ctx, "Plan mode enabled. Send your goal or idea in the next message.");
  };

  pi.registerCommand("plan", {
    description: "Read-only exploration and recoverable plan workflow: /plan, /plan save, /plan execute, /plan off, /plan resume <slug>",
    handler: async (args, ctx) => {
      currentCwd = ctx.cwd;
      const input = args.trim();
      if (input === "off" || input === "exit") {
        active = false;
        if (state && (state.phase === "exploring" || state.phase === "executing" || state.phase === "blocked")) {
          state.phase = "complete";
        }
        if (state) await persist();
        setStatus(ctx);
        notify(ctx, "Plan exploration/execution disabled.");
        return;
      }
      if (input.startsWith("resume ")) {
        const slug = slugify(input.slice(7));
        try {
          state = JSON.parse(await readFile(join(planDir(), `${slug}.state.json`), "utf8")) as PlanState;
          effort = state.effort ?? "medium";
          active = state.phase === "exploring" || state.phase === "ready";
          setStatus(ctx);
          notify(ctx, `Resumed ${slug} (${state.phase}).`);
          if (active) sendUserMessage(ctx, `Resume planning from ${markdownPath()}. Read the saved plan and state, then continue read-only exploration.`);
        } catch { notify(ctx, `No saved plan named ${slug}.`, "error"); }
        return;
      }
      if (input === "status") {
        notify(ctx, state ? `${state.slug}: ${state.phase}; ${state.todos.filter((todo) => todo.status === "completed").length}/${state.todos.length} todos complete.` : "No active plan.");
        return;
      }
      if (input === "save") {
        if (!state) notify(ctx, "No active plan to save.", "warning");
        else { await persist(); notify(ctx, `Saved ${markdownPath()}`); }
        return;
      }
      if (input === "execute") {
        if (!state || (state.phase !== "ready" && state.phase !== "blocked")) {
          notify(ctx, "A ready or blocked saved plan is required before execution.", "warning");
        } else {
          await beginExecution(ctx);
        }
        return;
      }
      if (!input) {
        if (state && (state.phase === "ready" || state.phase === "blocked" || state.phase === "executing" || active)) {
          await showPlanActions(ctx);
        } else {
          await chooseEffort(ctx);
        }
        return;
      }
      notify(ctx, "Use /plan with no arguments, then send the goal as your next normal message.", "warning");
    },
  });

  pi.on("before_agent_start", async (event, ctx) => {
    // Execution must explicitly supersede any plan-only context left by an older
    // plan extension or a queued follow-up turn. Without this handoff, models can
    // correctly but unhelpfully refuse the execution kickoff as a plan-mode write.
    if (state?.phase === "executing") {
      return {
        systemPrompt: `${event.systemPrompt}\n\n[PLAN EXECUTION HANDOFF]\nThe exploration phase is over. You are now authorized and expected to implement the saved plan. Any earlier plan-mode/read-only instruction is superseded for this turn. Use edit, write, bash, Git, and manage_todo_list as needed. Follow the execution kickoff, keep one todo in progress, and report blockers rather than refusing solely because planning previously occurred.`,
      };
    }
    if (!active) return;
    if (!state) {
      currentCwd = ctx.cwd;
      await createState(event.prompt.trim() || "Untitled plan");
      setStatus(ctx);
    }
    const effortLevel = state?.effort ?? effort;
    const effortPrompt = effortLevel === "low"
      ? "For this quick exploration, provide a high-level plan targeting only core files. Keep evidence gathering fast and focused, and avoid exhaustive edge-case analysis."
      : "For this deep discovery, perform an exceptionally thorough investigation. Inspect test files, build configurations, and dependencies. Analyze side-effects and plan a detailed verification strategy.";

    return { systemPrompt: `${event.systemPrompt}\n\n[PLAN MODE — EXPLORATION ONLY]\nYou are investigating and planning, never implementing. Do not edit, write, delete, install, commit, or run mutating shell commands. Inspect code and documentation, identify goal gaps, and use ask_user for clarification. Ask one focused question normally; for tightly related discovery use one ask_user questions batch of 1-4 questions, each choice carrying low/medium/high confidence and a concise rationale. Gather evidence before questions. Ask in rounds; do not analyze answers until the full batch returns. End a final proposal with Goal, Evidence, Assumptions, Plan, Validation, Risks, and the exact marker <!-- plan-ready -->.\n\n${effortPrompt}` };
  });

  pi.on("context", async (event) => {
    if (state?.phase !== "executing") return;
    return {
      messages: event.messages.filter((message) => {
        const candidate = message as { customType?: string };
        // Legacy @devkade/pi-plan persisted this hidden context in sessions.
        // It must not override the explicit execution handoff after migration.
        return candidate.customType !== "plan-mode-context";
      }),
    };
  });

  pi.on("agent_end", async (event, ctx) => {
    currentCwd = ctx.cwd;
    if (!active || !state) return;
    const text = [...event.messages].reverse().map(textFromMessage).find(Boolean) ?? "";
    if (!isPlanResponse(text)) return;
    state.planMarkdown = text;
    state.todos = extractTodos(text);
    state.phase = "ready";
    await persist();
    setStatus(ctx);
    await showPlanActions(ctx);
  });

  pi.on("tool_result", async (event, ctx) => {
    if (!state || state.phase !== "executing" || event.toolName !== "manage_todo_list") return;
    const details = event.details as { operation?: string; todos?: PlanTodo[] } | undefined;
    if (details?.operation !== "write" || !Array.isArray(details.todos)) return;
    const before = new Map(state.todos.map((todo) => [todo.id, todo.status]));
    state.todos = details.todos.map((todo) => ({ ...todo }));
    await persist();
    setStatus(ctx);
    const newlyCompleted = state.todos.find((todo) => todo.status === "completed" && before.get(todo.id) !== "completed");
    if (newlyCompleted) {
      await checkpoint(ctx, newlyCompleted, before.get(newlyCompleted.id) || "in-progress");
    } else {
      const allCompleted = state.todos.every((t) => t.status === "completed");
      if (allCompleted) {
        state.phase = "complete";
        active = false;
        await persist();
        setStatus(ctx);
        notify(ctx, "All plan steps are complete! Plan execution finished.");
      }
    }
  });

  pi.events.emit("powerbar:register-segment", { id: "plan-mode", label: "Plan Mode" });
  pi.on("session_start", async (_event, ctx) => { currentCwd = ctx.cwd; setStatus(ctx); });
  pi.on("session_shutdown", async (_event, ctx) => { clearPlanDisplay(ctx); });
}
