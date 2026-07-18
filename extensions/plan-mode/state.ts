import { existsSync } from "node:fs";
import { basename, join } from "node:path";
import type { LegacyPlanStateV1, Phase, PlanState, PlanTodo, TriageClass } from "./types.js";
import { REVIEW_TODO_PATTERN, REVIEW_TODO_TITLE, STATE_VERSION } from "./types.js";

const TRANSITIONS: Record<Phase, ReadonlySet<Phase>> = {
	"awaiting-goal": new Set(["triage", "complete"]),
	triage: new Set(["discovering", "planning", "complete"]),
	discovering: new Set(["deciding", "planning", "blocked", "complete"]),
	deciding: new Set(["discovering", "planning", "blocked", "complete"]),
	planning: new Set(["ready", "discovering", "deciding", "blocked", "complete"]),
	ready: new Set(["planning", "executing", "complete"]),
	executing: new Set(["reviewing", "blocked", "complete"]),
	reviewing: new Set(["executing", "blocked", "complete"]),
	blocked: new Set(["discovering", "planning", "executing", "reviewing", "complete"]),
	complete: new Set(),
};

export function transition(state: PlanState, next: Phase): void {
	if (state.phase === next) return;
	if (!TRANSITIONS[state.phase].has(next)) throw new Error(`Invalid plan transition: ${state.phase} -> ${next}`);
	state.phase = next;
}

export function now(): string {
	return new Date().toISOString();
}

export function slugify(input: string, max = 52): string {
	return input.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, max) || "untitled-plan";
}

export function timestampPrefix(date = new Date()): string {
	const pad = (value: number, width = 2) => String(value).padStart(width, "0");
	return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}-${pad(date.getMilliseconds(), 3)}`;
}

export function createPlanPaths(cwd: string, goal: string, date = new Date()): { slug: string; ledgerPath: string; statePath: string } {
	const dir = join(cwd, ".pi", "plans");
	const base = `${timestampPrefix(date)}-${slugify(goal)}`;
	let slug = base;
	let collision = 2;
	while (existsSync(join(dir, `${slug}.md`)) || existsSync(join(dir, `${slug}.state.json`))) slug = `${base}-${collision++}`;
	return { slug, ledgerPath: join(dir, `${slug}.md`), statePath: join(dir, `${slug}.state.json`) };
}

export function createPlanState(input: { cwd: string; goal: string; effort: "low" | "medium" | "high"; sessionId: string; date?: Date }): PlanState {
	const paths = createPlanPaths(input.cwd, input.goal, input.date);
	const createdAt = (input.date ?? new Date()).toISOString();
	return {
		version: STATE_VERSION,
		...paths,
		sessionId: input.sessionId,
		createdAt,
		updatedAt: createdAt,
		phase: "triage",
		goal: input.goal,
		effort: input.effort,
		planMarkdown: "",
		decisions: [],
		todos: [],
		checkpoints: [],
		validation: [],
		review: { promptSent: false, round: 0, findings: [] },
		gitMode: "non-git",
	};
}

export function forkPlanState(parent: PlanState, input: { cwd: string; sessionId: string; date?: Date }): PlanState {
	const paths = createPlanPaths(input.cwd, parent.goal, input.date);
	const timestamp = (input.date ?? new Date()).toISOString();
	return { ...structuredClone(parent), ...paths, sessionId: input.sessionId, parentPlan: parent.ledgerPath, createdAt: timestamp, updatedAt: timestamp };
}

export function classifyTriage(input: { effort: "low" | "medium" | "high"; enabled: boolean; proposed?: TriageClass; reason?: string }): { classification: TriageClass; reason: string } {
	if (input.effort === "high") return { classification: "deep", reason: input.reason || "Deep planning was explicitly selected." };
	if (!input.enabled) return { classification: "standard", reason: "Quick triage is disabled." };
	if (input.proposed === "trivial" && input.reason?.trim()) return { classification: "trivial", reason: input.reason.trim() };
	return { classification: "standard", reason: input.reason?.trim() || "The task was not proven to meet every trivial-task criterion." };
}

export function readyGate(state: PlanState): { ok: boolean; reason?: string } {
	if (state.triage?.classification === "trivial") return { ok: true };
	const markdown = state.planMarkdown;
	if (!markdown.trim()) return { ok: false, reason: "Write the plan draft in the response before marking it ready." };
	if (!/(?:^|\n)\s*(?:#{1,3}\s*)?goal\b:?/i.test(markdown)) return { ok: false, reason: "The plan must contain a Goal section." };
	if (todosFromMarkdown(markdown).length === 0) return { ok: false, reason: "The plan must contain a numbered task list under a 'Plan:' heading." };
	if (!/(?:^|\n)\s*(?:#{1,3}\s*)?validation\b:?/i.test(markdown)) return { ok: false, reason: "The plan must contain a Validation section." };
	return { ok: true };
}

export function todosFromMarkdown(markdown: string): PlanTodo[] {
	const section = markdown.match(/(?:^|\n)\s*(?:#{1,3}\s*)?plan\b:?\s*\n([\s\S]*)/i)?.[1] ?? "";
	const todos: PlanTodo[] = [];
	for (const match of section.matchAll(/^\s*(\d+)[.)]\s+(.+)$/gm)) {
		const title = match[2].replace(/[*`]/g, "").trim();
		if (title.length > 3) todos.push({ id: todos.length + 1, title: title.slice(0, 100), description: title, status: "not-started" });
	}
	if (todos.length > 0 && !todos.some((todo) => REVIEW_TODO_PATTERN.test(todo.title))) todos.push({ id: todos.length + 1, title: REVIEW_TODO_TITLE, description: REVIEW_TODO_TITLE, status: "not-started" });
	return todos;
}

export function migrateV1(raw: LegacyPlanStateV1, input: { cwd: string; sessionId: string }): PlanState {
	const goal = raw.goal || "Migrated plan";
	const slug = raw.slug || `${timestampPrefix()}-${slugify(goal)}`;
	const phaseMap = { exploring: "planning", ready: "ready", executing: "executing", blocked: "blocked", complete: "complete" } as const;
	return {
		...createPlanState({ cwd: input.cwd, goal, effort: raw.effort || "medium", sessionId: input.sessionId }),
		slug,
		ledgerPath: join(input.cwd, ".pi", "plans", `${slug}.md`),
		statePath: join(input.cwd, ".pi", "plans", `${slug}.state.json`),
		createdAt: raw.createdAt || now(),
		updatedAt: raw.updatedAt || now(),
		phase: phaseMap[raw.phase || "exploring"],
		planMarkdown: raw.planMarkdown || "",
		todos: raw.todos || [],
		checkpoints: raw.checkpoints || [],
		baseCommit: raw.baseCommit,
		lastError: raw.lastError,
		triage: { classification: "trivial", reason: "Migrated legacy single-agent plan.", timestamp: now() },
	};
}

export function isPlanFile(path: string, state: PlanState): boolean {
	return path === `.pi/plans/${basename(state.ledgerPath)}` || path === `.pi/plans/${basename(state.statePath)}`;
}
