import { describe, expect, it } from "vitest";
import { CancelGuardState, decisionForSelection } from "./index.js";

describe("CancelGuardState", () => {
	it("defaults Enter to confirming cancellation", () => {
		expect(decisionForSelection(0)).toBe("cancel");
		expect(decisionForSelection(1)).toBe("keep-running");
	});

	it("does not guard interrupts while the agent is idle", () => {
		const state = new CancelGuardState();
		expect(state.requestConfirmation()).toBe(false);
		expect(state.isDialogOpen).toBe(false);
	});

	it("opens only one confirmation while the agent is running", () => {
		const state = new CancelGuardState();
		state.isAgentRunning = true;
		expect(state.requestConfirmation()).toBe(true);
		expect(state.requestConfirmation()).toBe(false);
		expect(state.isDialogOpen).toBe(true);
	});

	it("can be safely dismissed and opened again", () => {
		const state = new CancelGuardState();
		state.isAgentRunning = true;
		state.requestConfirmation();
		state.closeDialog();
		expect(state.requestConfirmation()).toBe(true);
	});
});
