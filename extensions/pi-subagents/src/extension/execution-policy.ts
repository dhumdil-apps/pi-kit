/**
 * Serial-only execution policy for the subagent tool.
 *
 * The parent session is the architect: it delegates to one child at a time,
 * always foreground, always on its own model and thinking level. This module
 * rejects everything that would break that invariant — parallel task fanout,
 * async/background detachment, parallel or expanding chain steps, scheduling,
 * per-call model overrides, and a second spawn while a run is still active.
 *
 * It also implements the master kill switch: subagent execution is disabled
 * unless the user has turned it on via /extension-settings (pi-subagents →
 * enabled). Management and status actions remain available either way.
 */

import { getSetting } from "../../../extension-settings/settings/storage.js";
import type { SubagentState } from "../shared/types.ts";

export const SETTINGS_EXTENSION_NAME = "pi-subagents";
export const ENABLED_SETTING_ID = "enabled";

export const SUBAGENTS_DISABLED_MESSAGE =
	"Subagent execution is disabled. Do the work inline in this session instead. "
	+ "The user can enable subagents via /extension-settings → pi-subagents → enabled.";

export const SUBAGENTS_DISABLED_TOOL_DESCRIPTION =
	"Subagent execution is DISABLED (off by default). Do all work inline in this session; "
	+ "do not attempt to launch agents, load subagent skills, or plan around delegation. "
	+ "Only management/status actions are available: list, get, status, doctor. "
	+ "The user can enable execution via /extension-settings → pi-subagents → enabled (takes effect immediately).";

const SERIAL_ONLY_PREFIX = "Serial-only subagent policy: ";

export function subagentExecutionEnabled(): boolean {
	return getSetting(SETTINGS_EXTENSION_NAME, ENABLED_SETTING_ID, "off") === "on";
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

interface PolicyCheckedParams {
	action?: unknown;
	agent?: unknown;
	task?: unknown;
	tasks?: unknown;
	chain?: unknown;
	async?: unknown;
	model?: unknown;
}

function isExecutionAttempt(params: PolicyCheckedParams): boolean {
	if (typeof params.action === "string" && params.action.length > 0) return false;
	return Boolean(params.agent) || Array.isArray(params.tasks) || Array.isArray(params.chain);
}

function hasActiveRun(state: SubagentState): boolean {
	if (state.subagentInProgress) return true;
	for (const job of state.asyncJobs.values()) {
		const jobState = (job as { state?: string }).state;
		if (jobState === "running" || jobState === "pending" || jobState === "starting") return true;
	}
	return false;
}

/**
 * Throws a descriptive error when the call violates the serial-only policy or
 * the kill switch. Call before executing a subagent tool invocation; management
 * and control actions pass through untouched (except schedule, which always
 * launches async and is therefore rejected alongside async itself).
 */
export function enforceExecutionPolicy(rawParams: unknown, state?: SubagentState): void {
	if (!isPlainObject(rawParams)) return;
	const params = rawParams as PolicyCheckedParams;
	const action = typeof params.action === "string" ? params.action : undefined;

	if (action?.startsWith("schedule") && action !== "schedule-list" && action !== "schedule-status" && action !== "schedule-cancel") {
		throw new Error(`${SERIAL_ONLY_PREFIX}scheduled runs always launch async and are disabled. Run the agent foreground with { agent, task } when the work is due.`);
	}

	if (!isExecutionAttempt(params)) return;

	if (!subagentExecutionEnabled()) {
		throw new Error(SUBAGENTS_DISABLED_MESSAGE);
	}

	if (Array.isArray(params.tasks) && params.tasks.length > 0) {
		throw new Error(`${SERIAL_ONLY_PREFIX}parallel tasks are disabled. Launch one agent at a time with { agent, task } and wait for its result before the next.`);
	}

	if (params.async === true) {
		throw new Error(`${SERIAL_ONLY_PREFIX}async/background runs are disabled. Launch the agent foreground (omit async) and wait for its result.`);
	}

	if (typeof params.model === "string" && params.model.trim()) {
		throw new Error(`${SERIAL_ONLY_PREFIX}model overrides are disabled. Children always inherit the parent session's model and thinking level; omit the model parameter.`);
	}

	if (Array.isArray(params.chain)) {
		for (const [index, step] of params.chain.entries()) {
			if (!isPlainObject(step)) continue;
			if ("parallel" in step || "expand" in step) {
				throw new Error(`${SERIAL_ONLY_PREFIX}chain step ${index} uses parallel/expand fan-out, which is disabled. Express the work as sequential single-agent steps.`);
			}
			if (typeof step.model === "string" && step.model.trim()) {
				throw new Error(`${SERIAL_ONLY_PREFIX}chain step ${index} sets a model override, which is disabled. Children always inherit the parent session's model.`);
			}
		}
	}

	if (state && hasActiveRun(state)) {
		throw new Error(`${SERIAL_ONLY_PREFIX}another subagent run is still active. Wait for it to complete (or stop it) before launching the next one.`);
	}
}
