import { describe, expect, it } from "vitest";
import { createPlanState } from "./state.js";
import { mergeRuns, runFromCompletion, runsFromDetails } from "./orchestration.js";

describe("orchestration correlation", () => {
	it("correlates foreground, detached, and async children", () => {
		const foreground = runsFromDetails({ runId: "r", mode: "parallel", results: [{ agent: "explorer", index: 2, exitCode: 0 }, { agent: "coder", index: 3, detached: true }] });
		expect(foreground.map((run) => [run.key, run.status])).toEqual([["r:2:explorer", "completed"], ["r:3:coder", "detached"]]);
		expect(runFromCompletion({ runId: "a", mode: "parallel", results: [{ agent: "explorer", index: 0, exitCode: 0 }] }, "async")[0]?.key).toBe("a:0:explorer");
	});

	it("deduplicates repeated run results", () => {
		const state = createPlanState({ cwd: "/tmp", goal: "Goal", effort: "low", sessionId: "s" });
		const run = runsFromDetails({ runId: "p", mode: "single", results: [{ agent: "coder", index: 0, exitCode: 0 }] });
		expect(mergeRuns(state, run).changed).toBe(true);
		expect(mergeRuns(state, run).changed).toBe(false);
		expect(state.orchestrationRuns).toHaveLength(1);
		expect(state.orchestrationRuns[0]?.role).toBe("coder");
	});
});
