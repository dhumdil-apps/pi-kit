import { describe, expect, it, vi } from "vitest";

vi.mock("../../../extension-settings/settings/storage.js", () => ({
	getSetting: vi.fn(() => "on"),
	setSetting: vi.fn(),
}));

import { getSetting } from "../../../extension-settings/settings/storage.js";
import { enforceExecutionPolicy, SUBAGENTS_DISABLED_MESSAGE, subagentExecutionEnabled } from "./execution-policy.ts";

describe("serial-only execution policy", () => {
	it("allows single foreground agent execution and management actions", () => {
		expect(() => enforceExecutionPolicy({ agent: "explorer", task: "x" })).not.toThrow();
		expect(() => enforceExecutionPolicy({ chain: [{ agent: "explorer", task: "a" }, { agent: "coder", task: "b" }] })).not.toThrow();
		expect(() => enforceExecutionPolicy({ action: "list" })).not.toThrow();
		expect(() => enforceExecutionPolicy({ action: "status", id: "abc" })).not.toThrow();
	});

	it("rejects parallel tasks, async, model overrides, and parallel chain steps", () => {
		expect(() => enforceExecutionPolicy({ tasks: [{ agent: "explorer", task: "x" }] })).toThrow(/parallel tasks are disabled/);
		expect(() => enforceExecutionPolicy({ agent: "coder", task: "x", async: true })).toThrow(/async\/background runs are disabled/);
		expect(() => enforceExecutionPolicy({ agent: "coder", task: "x", model: "openai/gpt-5" })).toThrow(/model overrides are disabled/);
		expect(() => enforceExecutionPolicy({ chain: [{ agent: "explorer", task: "a" }, { parallel: [{ agent: "coder" }] }] })).toThrow(/parallel\/expand fan-out/);
		expect(() => enforceExecutionPolicy({ chain: [{ agent: "coder", task: "a", model: "openai/gpt-5" }] })).toThrow(/model override/);
	});

	it("rejects scheduling launches but allows schedule inspection actions", () => {
		expect(() => enforceExecutionPolicy({ action: "schedule", agent: "coder", schedule: "+10m" })).toThrow(/scheduled runs always launch async/);
		expect(() => enforceExecutionPolicy({ action: "schedule-list" })).not.toThrow();
		expect(() => enforceExecutionPolicy({ action: "schedule-status", id: "x" })).not.toThrow();
	});

	it("rejects a new spawn while another run is active", () => {
		const state = { subagentInProgress: true, asyncJobs: new Map() } as never;
		expect(() => enforceExecutionPolicy({ agent: "explorer", task: "x" }, state)).toThrow(/another subagent run is still active/);
	});

	it("blocks execution entirely when the kill switch is off", () => {
		vi.mocked(getSetting).mockReturnValueOnce("off");
		expect(subagentExecutionEnabled()).toBe(false);
		vi.mocked(getSetting).mockReturnValueOnce("off");
		expect(() => enforceExecutionPolicy({ agent: "explorer", task: "x" })).toThrow(SUBAGENTS_DISABLED_MESSAGE);
		expect(() => enforceExecutionPolicy({ action: "list" })).not.toThrow();
	});
});
