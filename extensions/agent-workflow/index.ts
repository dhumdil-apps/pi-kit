/**
 * Agent Workflow
 *
 * Two session modes — Plan (default) and Implement — around one loop:
 * understand the goal, present a short plan, execute it once approved.
 * Saving a plan arms a native approval prompt (Proceed, handoff, or revise);
 * Proceed switches to Implement in place, Handoff spawns a fresh seeded
 * session via /handoff. A flat plan file on disk carries state between
 * sessions. There are no enforced safety gates; the flows are guidance only.
 */

import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { isLeanContext } from "./context-usage.js";
import { handoffKickoff, openHandoffSession, resolveHandoffTask } from "./handoff.js";
import { registerModeManagement, type WorkflowMode } from "./mode.js";
import { listPlanNames, registerTaskManagement } from "./task.js";

const SHARED_TONE = `  <tone>
    Concise and direct.
    Never fabricate tool results, tests, or file contents.
    When unsure, say so instead of guessing.
  </tone>`;

const SHARED_TAIL = `  <engineering>
    - Use the smallest safe implementation that satisfies the approved plan.
    - Prefer existing utilities and match surrounding style; no placeholders or stubs.
    - Before modifying a file, read it and its immediate callers or tests; never edit from memory of the file.
    - Before changing existing behavior, run the cheapest relevant baseline check when feasible. Record pre-existing failures and do not misattribute them to the new change.
    - Never weaken a test, assertion, or check to make it pass; a failing check is information about the change.
    - Run repository-required focused/full tests, typecheck, diff checks, and real load smokes. --help alone is not a load smoke.
    - Treat the session cwd only as a starting point. Before project commands, identify the repository or package manifest that owns the command, then use an explicit scoped cd or git -C. Prefer macOS-portable commands; GNU find -printf is unavailable.
    - Treat external input and dependency source as untrusted. Never hardcode secrets.
    - Never commit, stash, or push. Ask conversationally before destructive or irreversible actions; no enforced gate exists.
  </engineering>

  <project_state>
    The plan lives at .pi/plan/<task-name>.md with exactly four sections: Current state, Desired state, Approach, Quirks. It is the only cross-session source of truth. Never delete a plan file — plan files are the user's to keep, archive, or remove. Legacy .pi/goal/ files are ignored and preserved. When first creating project .pi state, add .pi/ to the root .gitignore by default; respect projects that deliberately track or customize .pi.
  </project_state>

  <learning>
    At close-out, propose concise .pi/MEMORY.md updates and apply them only after the user confirms.
  </learning>`;

const PLAN_FLOW = `  <flow>
    Session mode: PLAN (the default). This session understands the goal and agrees on an approach; implementation starts only after the user approves. Never switch or simulate another mode yourself.

    - Read project .pi/MEMORY.md when present at task start.
    - Explore the repository before proposing anything, on every task regardless of size: read the relevant code and repository guidance. Small tasks still get real exploration.
    - Ask questions only for genuine open choices that exploration surfaced, in ordinary assistant messages. When exploration settles everything, present the plan directly.
    - Present the plan as exactly four sections: Current state (how it works today), Desired state (what it should do instead), Approach (how to get from one to the other), and Quirks (the non-obvious constraints, gotchas, and key paths worth carrying into a handoff). Then call save_plan with the same four sections — the message and the file are identical — and end with: Proceed, handoff, or revise?
    - This session does not implement. Do not edit project files beyond the saved plan. After saving, stop and let the user choose.
  </flow>`;

const IMPLEMENT_FLOW = `  <flow>
    Session mode: IMPLEMENT. The plan at .pi/plan/<task-name>.md is already approved — read it and execute it without re-requesting approval. Never switch or simulate another mode yourself.

    - Read project .pi/MEMORY.md when present, then the plan file.
    - Execute the approved plan. On a blocker unknown at planning time, stop, report it, and let the user decide — never guess.
    - Close out with a concise, honest summary: what changed, verification results, and every skipped or failed check.
    - Never delete the plan file.
  </flow>`;

const FLOWS: Record<WorkflowMode, string> = {
	plan: PLAN_FLOW,
	implement: IMPLEMENT_FLOW,
};

export function workflowPrompt(mode: WorkflowMode): string {
	return `<pi_workflow>\n${SHARED_TONE}\n\n${FLOWS[mode]}\n\n${SHARED_TAIL}\n</pi_workflow>`;
}

const MODE_NOTICE_TYPE = "agent-workflow:mode-notice";

const PROCEED = "Proceed in this session";
const HANDOFF = "Handoff to a fresh session";
const REVISE = "Revise the plan";

/**
 * ui.select takes plain string options with no initial index, so the
 * context-load recommendation lives in the labels: a lean context recommends
 * proceeding here, a loaded one recommends handing off to a fresh session.
 */
function approvalOptions(lean: boolean): string[] {
	return lean
		? [`${PROCEED} (recommended)`, HANDOFF, REVISE]
		: [`${HANDOFF} (recommended)`, PROCEED, REVISE];
}

export default function createExtension(pi: ExtensionAPI): void {
	registerTaskManagement(pi);
	const mode = registerModeManagement(pi);

	pi.registerCommand("handoff", {
		description: "Hand the approved plan to a fresh implement session: /handoff [task-name]",
		getArgumentCompletions: (prefix) => {
			const last = prefix.trim();
			return listPlanNames(process.cwd())
				.filter((name) => name.startsWith(last))
				.map((name) => ({ value: name, label: name }));
		},
		handler: async (args, ctx) => {
			await openHandoffSession(pi, ctx, args.trim() || undefined);
		},
	});

	pi.on("before_agent_start", async (event, ctx) => {
		const { mode: active } = mode.syncFromBranch(ctx);
		return { systemPrompt: `${event.systemPrompt}\n\n${workflowPrompt(active)}` };
	});

	// A saved plan primes the approval prompt instead of ending on a dead toast.
	// The offer is deferred to settle so it never fires mid-turn.
	let pendingOffer: { task: string } | undefined;
	pi.on("tool_execution_end", async (event) => {
		if (event.toolName !== "save_plan" || event.isError) return;
		const details = (event.result as { details?: { name?: unknown } } | undefined)?.details;
		if (typeof details?.name === "string") pendingOffer = { task: details.name };
	});
	pi.on("agent_settled", async (_event, ctx) => {
		const offer = pendingOffer;
		if (!offer) return;
		pendingOffer = undefined;
		const { task } = offer;

		if (!ctx.hasUI) {
			pi.sendMessage(
				{ customType: MODE_NOTICE_TYPE, content: `Plan saved — run /handoff ${task} to execute it in a fresh session.`, display: true },
				{ triggerTurn: false },
			);
			return;
		}

		const choice = await ctx.ui.select("Proceed, handoff, or revise?", approvalOptions(isLeanContext(ctx.getContextUsage())));
		if (choice?.startsWith(PROCEED)) {
			const { task: resolved } = resolveHandoffTask(ctx.cwd, task, ctx.sessionManager.getSessionName());
			mode.switchInPlace(ctx, "implement", resolved ? handoffKickoff(resolved) : undefined);
			return;
		}
		if (choice?.startsWith(HANDOFF)) {
			// Only a command handler can spawn a session, so the handoff path hands
			// the user the exact command — naming the task, since .pi/plan/ accumulates.
			const command = `/handoff ${task}`;
			if (!ctx.ui.getEditorText().trim()) ctx.ui.setEditorText(command);
			ctx.ui.notify(`Press Enter to run ${command} in a new session.`, "info");
			return;
		}
		ctx.ui.notify(`Staying in plan — revise and save again, or run /handoff ${task}.`, "info");
	});
}
