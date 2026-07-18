import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { canStartReviewFix, classifyTriage, createPlanPaths, createPlanState, forkPlanState, readyGate, roleForAgent, timestampPrefix, todosFromMarkdown, transition } from "./state.js";

const state = () => createPlanState({ cwd: "/tmp/project", goal: "Ship feature", effort: "low", sessionId: "session", date: new Date(2026, 6, 18, 12, 3, 4, 5) });

describe("plan state", () => {
	it("accepts valid transitions and rejects invalid transitions", () => {
		const plan = state();
		transition(plan, "discovering");
		expect(plan.phase).toBe("discovering");
		expect(() => transition(plan, "executing")).toThrow(/Invalid plan transition/);
	});

	it("forces deep and requires proof for trivial triage", () => {
		expect(classifyTriage({ effort: "high", enabled: true, proposed: "trivial", reason: "small" }).classification).toBe("deep");
		expect(classifyTriage({ effort: "low", enabled: true, proposed: "trivial" }).classification).toBe("standard");
		expect(classifyTriage({ effort: "low", enabled: true, proposed: "trivial", reason: "One known file and one obvious assertion." }).classification).toBe("trivial");
	});

	it("gates readiness on a plan draft with goal, numbered tasks, and validation", () => {
		const plan = state();
		plan.triage = { classification: "standard", reason: "not trivial", timestamp: new Date().toISOString() };
		expect(readyGate(plan).ok).toBe(false);
		plan.planMarkdown = "## Goal\nShip feature\n\n## Plan\n1. Implement the change\n2. Verify behavior\n\n## Validation\n- npm test\n\n<!-- plan-ready -->";
		expect(readyGate(plan)).toEqual({ ok: true });
		plan.planMarkdown = "## Plan\n1. Implement the change";
		expect(readyGate(plan).ok).toBe(false);
	});

	it("maps agent names to explorer/coder roles", () => {
		expect(roleForAgent("explorer")).toBe("explorer");
		expect(roleForAgent("my.coder")).toBe("coder");
		expect(roleForAgent("scout")).toBe("other");
	});

	it("adds the mandatory review todo and uses local millisecond names", () => {
		const todos = todosFromMarkdown("## Plan\n1. Implement the change\n2. Verify behavior");
		expect(todos.at(-1)?.title).toMatch(/Review and simplify/);
		expect(timestampPrefix(new Date(2026, 6, 18, 12, 3, 4, 5))).toBe("20260718-120304-005");
	});

	it("suffixes a same-millisecond filename collision without overwriting", () => {
		const cwd = mkdtempSync(join(tmpdir(), "plan-name-"));
		mkdirSync(join(cwd, ".pi", "plans"), { recursive: true });
		const first = createPlanPaths(cwd, "Same goal", new Date(2026, 6, 18, 12, 3, 4, 5));
		writeFileSync(first.statePath, "{}\n");
		const second = createPlanPaths(cwd, "Same goal", new Date(2026, 6, 18, 12, 3, 4, 5));
		expect(second.slug).toBe(`${first.slug}-2`);
	});

	it("forks approved state into a new child ledger linked to its parent", () => {
		const parent = state();
		parent.phase = "ready";
		parent.planMarkdown = "## Plan\n1. Do it";
		const child = forkPlanState(parent, { cwd: "/tmp/fork", sessionId: "child", date: new Date(2026, 6, 18, 12, 4, 5, 6) });
		expect(child.parentPlan).toBe(parent.ledgerPath);
		expect(child.sessionId).toBe("child");
		expect(child.phase).toBe("ready");
		expect(child.ledgerPath).not.toBe(parent.ledgerPath);
	});

	it("limits review correction to the configured single pass", () => {
		const plan = state();
		plan.phase = "reviewing";
		expect(canStartReviewFix(plan, 1)).toBe(true);
		plan.review.fixPasses = 1;
		expect(canStartReviewFix(plan, 1)).toBe(false);
	});
});
