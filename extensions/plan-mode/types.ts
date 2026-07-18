export const STATE_VERSION = 2;
export const REVIEW_TODO_TITLE = "Review and simplify the changes";
export const REVIEW_TODO_PATTERN = /review.*simplif|simplif.*review/i;

export type Phase =
	| "awaiting-goal"
	| "triage"
	| "discovering"
	| "deciding"
	| "planning"
	| "ready"
	| "executing"
	| "reviewing"
	| "blocked"
	| "complete";

export type Effort = "low" | "medium" | "high";
export type TriageClass = "trivial" | "standard" | "deep";
export type TodoStatus = "not-started" | "in-progress" | "completed";

export interface PlanTodo {
	id: number;
	title: string;
	description: string;
	status: TodoStatus;
	dependencies?: number[];
	files?: string[];
	acceptanceChecks?: string[];
}

export interface CheckResult {
	name: string;
	ok: boolean;
	output: string;
}

export interface Checkpoint {
	todoId: number;
	todoTitle: string;
	timestamp: string;
	files: string[];
	checks: CheckResult[];
	status: "committed" | "blocked" | "failed" | "skipped";
	commit?: string;
	reason?: string;
}

export interface PlanDecision {
	timestamp: string;
	question: string;
	answer: string;
}

export interface ReviewState {
	promptSent: boolean;
	round: number;
	findings: string[];
	classification?: {
		required: string[];
		optional: string[];
		rejected: string[];
		rationale?: string;
	};
}

export interface PlanState {
	version: 2;
	slug: string;
	ledgerPath: string;
	statePath: string;
	sessionId: string;
	parentPlan?: string;
	createdAt: string;
	updatedAt: string;
	phase: Phase;
	goal: string;
	effort: Effort;
	triage?: { classification: TriageClass; reason: string; timestamp: string };
	planMarkdown: string;
	decisions: PlanDecision[];
	todos: PlanTodo[];
	checkpoints: Checkpoint[];
	validation: CheckResult[];
	review: ReviewState;
	gitMode: "git" | "non-git";
	baseCommit?: string;
	lastError?: string;
}

export interface LegacyPlanStateV1 {
	version?: 1;
	slug?: string;
	createdAt?: string;
	updatedAt?: string;
	phase?: "exploring" | "ready" | "executing" | "blocked" | "complete";
	goal?: string;
	effort?: Effort;
	planMarkdown?: string;
	todos?: PlanTodo[];
	checkpoints?: Checkpoint[];
	baseCommit?: string;
	lastError?: string;
}

export interface PlanLink {
	version: 2;
	ledger: string;
	state: string;
}
