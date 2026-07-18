import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { latestPlanLink, loadPlan, persistPlan } from "./ledger.js";
import { createPlanState } from "./state.js";

describe("plan ledger", () => {
	it("atomically persists markdown and JSON and restores a session link", async () => {
		const cwd = await mkdtemp(join(tmpdir(), "plan-ledger-"));
		const state = createPlanState({ cwd, goal: "Atomic ledger", effort: "low", sessionId: "one" });
		await persistPlan(state);
		expect((await readFile(state.ledgerPath, "utf8"))).toContain("# Atomic ledger");
		expect(JSON.parse(await readFile(state.statePath, "utf8")).version).toBe(2);
		expect(latestPlanLink([{ type: "custom", customType: "plan-mode", data: { version: 2, ledger: state.ledgerPath, state: state.statePath } }])?.state).toBe(state.statePath);
	});

	it("migrates v1 and ignores corrupt or newer state without overwriting it", async () => {
		const cwd = await mkdtemp(join(tmpdir(), "plan-migrate-"));
		const path = join(cwd, "old.json");
		await writeFile(path, JSON.stringify({ version: 1, slug: "old", goal: "Legacy", phase: "ready" }));
		const migrated = await loadPlan(path, { cwd, sessionId: "new" });
		expect(migrated.state?.version).toBe(2);
		expect(migrated.state?.phase).toBe("ready");
		await writeFile(path, JSON.stringify({ version: 99 }));
		expect((await loadPlan(path, { cwd, sessionId: "new" })).state).toBeUndefined();
		await writeFile(path, "not json");
		expect((await loadPlan(path, { cwd, sessionId: "new" })).warning).toMatch(/Could not load/);
	});
});
