import type { OrchestrationRun, PlanState } from "./types.js";
import { now, roleForAgent } from "./state.js";

interface SubagentResultLike {
	agent?: unknown;
	exitCode?: unknown;
	detached?: unknown;
	finalOutput?: unknown;
	structuredOutput?: unknown;
	artifactPaths?: { outputPath?: unknown };
	savedOutputPath?: unknown;
	sessionFile?: unknown;
	usage?: unknown;
	error?: unknown;
	status?: unknown;
	summary?: unknown;
	index?: unknown;
	artifactPath?: unknown;
	sessionPath?: unknown;
}

export function orchestrationKey(runId: string, agent: string, index: number): string {
	return `${runId}:${index}:${agent}`;
}

function normalizeStatus(result: SubagentResultLike): OrchestrationRun["status"] {
	if (result.detached === true) return "detached";
	if (result.status === "completed" || result.status === "complete" || result.exitCode === 0) return "completed";
	if (result.status === "running" || result.status === "queued") return "running";
	return "failed";
}

export function runsFromDetails(details: unknown, fallbackRunId = "unknown"): OrchestrationRun[] {
	if (!details || typeof details !== "object") return [];
	const record = details as Record<string, unknown>;
	const results = Array.isArray(record.results) ? record.results as SubagentResultLike[] : [];
	const runId = typeof record.runId === "string" ? record.runId : typeof record.asyncId === "string" ? record.asyncId : fallbackRunId;
	const mode = record.mode === "single" || record.mode === "parallel" || record.mode === "chain" ? record.mode : "unknown";
	return results.flatMap((result, position) => {
		if (typeof result.agent !== "string") return [];
		const childIndex = typeof result.index === "number" ? result.index : position;
		const status = normalizeStatus(result);
		return [{
			key: orchestrationKey(runId, result.agent, childIndex),
			runId,
			childIndex,
			agent: result.agent,
			role: roleForAgent(result.agent),
			mode,
			status,
			completedAt: status === "completed" || status === "failed" ? now() : undefined,
			summary: typeof result.finalOutput === "string" ? result.finalOutput : typeof result.summary === "string" ? result.summary : undefined,
			structuredOutput: result.structuredOutput,
			artifactPath: typeof result.artifactPath === "string" ? result.artifactPath : typeof result.savedOutputPath === "string" ? result.savedOutputPath : typeof result.artifactPaths?.outputPath === "string" ? result.artifactPaths.outputPath : undefined,
			sessionPath: typeof result.sessionPath === "string" ? result.sessionPath : typeof result.sessionFile === "string" ? result.sessionFile : undefined,
			error: typeof result.error === "string" ? result.error : undefined,
			usage: result.usage,
		}];
	});
}

export function runFromCompletion(payload: unknown, source: "foreground" | "async"): OrchestrationRun[] {
	if (!payload || typeof payload !== "object") return [];
	const record = payload as Record<string, unknown>;
	if (source === "async") return runsFromDetails({ runId: record.runId || record.id, mode: record.mode, results: record.results }, String(record.runId || record.id || "async"));
	if (typeof record.agent !== "string") return [];
	const runId = typeof record.runId === "string" ? record.runId : "foreground";
	const index = typeof record.taskIndex === "number" ? record.taskIndex : 0;
	return [{ key: orchestrationKey(runId, record.agent, index), runId, childIndex: index, agent: record.agent, role: roleForAgent(record.agent), mode: record.mode === "single" || record.mode === "parallel" || record.mode === "chain" ? record.mode : "unknown", status: record.success === true ? "completed" : "failed", completedAt: now(), summary: typeof record.summary === "string" ? record.summary : undefined, error: record.success === false && typeof record.summary === "string" ? record.summary : undefined, sessionPath: typeof record.sessionFile === "string" ? record.sessionFile : undefined }];
}

export function mergeRuns(state: PlanState, incoming: OrchestrationRun[]): { changed: boolean } {
	let changed = false;
	for (const next of incoming) {
		const index = state.orchestrationRuns.findIndex((run) => run.key === next.key);
		const current = index >= 0 ? state.orchestrationRuns[index] : undefined;
		const merged = current ? { ...current, ...Object.fromEntries(Object.entries(next).filter(([, value]) => value !== undefined)) } : next;
		if (!current || JSON.stringify(current) !== JSON.stringify(merged)) {
			if (index >= 0) state.orchestrationRuns[index] = merged;
			else state.orchestrationRuns.push(merged);
			changed = true;
		}
	}
	return { changed };
}
