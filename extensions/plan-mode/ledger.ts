import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { LegacyPlanStateV1, PlanLink, PlanState } from "./types.js";
import { STATE_VERSION } from "./types.js";
import { migrateV1, now } from "./state.js";

function list(items: string[], empty = "_None._"): string {
	return items.length ? items.map((item) => `- ${item}`).join("\n") : empty;
}

export function renderLedger(state: PlanState): string {
	const runs = state.orchestrationRuns.map((run) => `- ${run.role} \`${run.agent}\` — ${run.status}${run.summary ? `: ${run.summary.slice(0, 240)}` : ""}`);
	const decisions = state.decisions.map((decision) => `- **${decision.question}** — ${decision.answer}`);
	const progress = state.todos.map((todo) => `- [${todo.status === "completed" ? "x" : todo.status === "in-progress" ? "-" : " "}] ${todo.id}. ${todo.title}`);
	const checkpoints = state.checkpoints.map((checkpoint) => `- Todo ${checkpoint.todoId}: ${checkpoint.status}${checkpoint.commit ? ` (\`${checkpoint.commit.slice(0, 10)}\`)` : ""}${checkpoint.reason ? ` — ${checkpoint.reason}` : ""}`);
	return `---\nversion: ${state.version}\ncreated: ${state.createdAt}\nupdated: ${state.updatedAt}\nphase: ${state.phase}\nsession: ${state.sessionId}\n${state.parentPlan ? `parentPlan: ${state.parentPlan}\n` : ""}---\n\n# ${state.goal}\n\n## Goal\n\n${state.goal}\n\n## Triage\n\n${state.triage ? `**${state.triage.classification}** — ${state.triage.reason}` : "_Pending._"}\n\n## Evidence and Agent Handoffs\n\n${list(runs)}\n\n## Decisions\n\n${list(decisions)}\n\n## Approved Plan\n\n${state.planMarkdown.trim() || "_Pending plan draft._"}\n\n## Progress\n\n${list(progress)}\n\n## Checkpoints\n\n${list(checkpoints)}\n\n## Validation\n\n${list(state.validation.map((check) => `${check.ok ? "PASS" : "FAIL"} ${check.name}${check.output ? ` — ${check.output.slice(-240)}` : ""}`))}\n\n## Review\n\n${list(state.review.findings)}\n\n## Risks and Blockers\n\n${state.lastError ? `- ${state.lastError}` : list([])}\n`;
}

async function atomicWrite(path: string, content: string): Promise<void> {
	await mkdir(dirname(path), { recursive: true });
	const temp = `${path}.${process.pid}.${Date.now()}.tmp`;
	await writeFile(temp, content, "utf8");
	await rename(temp, path);
}

export async function persistPlan(state: PlanState): Promise<void> {
	state.updatedAt = now();
	await atomicWrite(state.ledgerPath, renderLedger(state));
	await atomicWrite(state.statePath, `${JSON.stringify(state, null, 2)}\n`);
}

export async function loadPlan(path: string, input: { cwd: string; sessionId: string }): Promise<{ state?: PlanState; warning?: string }> {
	try {
		const raw = JSON.parse(await readFile(path, "utf8")) as PlanState | LegacyPlanStateV1;
		if (raw.version === STATE_VERSION) return { state: raw as PlanState };
		if (raw.version === undefined || raw.version === 1) return { state: migrateV1(raw as LegacyPlanStateV1, input), warning: "Migrated a version-1 plan state." };
		return { warning: `Unsupported plan state version ${String((raw as { version?: unknown }).version)}; ignored.` };
	} catch (error) {
		return { warning: `Could not load plan state: ${error instanceof Error ? error.message : String(error)}` };
	}
}

export function latestPlanLink(entries: ReadonlyArray<unknown>): PlanLink | undefined {
	for (let index = entries.length - 1; index >= 0; index--) {
		const entry = entries[index] as { type?: string; customType?: string; data?: unknown };
		if (entry?.type !== "custom" || entry.customType !== "plan-mode" || !entry.data || typeof entry.data !== "object") continue;
		const data = entry.data as Record<string, unknown>;
		if (data.version === 2 && typeof data.ledger === "string" && typeof data.state === "string") return data as unknown as PlanLink;
	}
	return undefined;
}
