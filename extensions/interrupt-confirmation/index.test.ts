import { describe, expect, it, vi } from "vitest";

// The real CustomEditor needs a live TUI. Stubbing it lets the test build the
// registered editor and drive the interrupt key through the actual guard logic.
vi.mock("@earendil-works/pi-coding-agent", () => ({
	CustomEditor: class {
		constructor(..._args: unknown[]) {}
		isShowingAutocomplete(): boolean {
			return false;
		}
		handleInput(_data: string): void {}
	},
}));

const { CONFIRM, KEEP_RUNNING, CancelGuardState, default: cancelGuard } = await import("./index.js");

function harness() {
	const handlers = new Map<string, (event?: any, ctx?: any) => any>();
	const pi = { on: vi.fn((name: string, handler: any) => handlers.set(name, handler)) };
	cancelGuard(pi as any);

	let editorFactory: any;
	const abort = vi.fn();
	let resolveSelect: ((choice: string | undefined) => void) | undefined;
	const select = vi.fn(
		(_title: string, _options: string[], opts?: { signal?: AbortSignal }) =>
			new Promise<string | undefined>((resolve) => {
				resolveSelect = resolve;
				opts?.signal?.addEventListener("abort", () => resolve(undefined), { once: true });
			}),
	);
	const ctx = { mode: "tui", abort, ui: { select, setEditorComponent: vi.fn((factory: any) => { editorFactory = factory; }) } };

	handlers.get("session_start")!({}, ctx);

	/** Run the agent, then press the interrupt key so the prompt opens. */
	const interrupt = () => {
		handlers.get("agent_start")!({}, ctx);
		const editor = editorFactory({}, {}, { matches: () => true });
		editor.handleInput("\x1b");
	};

	return {
		ctx,
		select,
		abort,
		interrupt,
		answer: async (choice: string | undefined) => {
			resolveSelect?.(choice);
			await Promise.resolve();
			await Promise.resolve();
		},
		endAgent: () => handlers.get("agent_end")!({}, ctx),
	};
}

describe("CancelGuardState", () => {
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

describe("cancel guard prompt", () => {
	it("asks through the native selector with the destructive option first", () => {
		const h = harness();
		h.interrupt();
		expect(h.select).toHaveBeenCalledTimes(1);
		const [title, options] = h.select.mock.calls[0];
		expect(title).toContain("Cancel running agent?");
		expect(options).toEqual([CONFIRM, KEEP_RUNNING]);
	});

	it("aborts the agent only when cancellation is confirmed", async () => {
		const h = harness();
		h.interrupt();
		await h.answer(CONFIRM);
		expect(h.abort).toHaveBeenCalledTimes(1);
	});

	it("keeps the agent running when the prompt is dismissed", async () => {
		const h = harness();
		h.interrupt();
		await h.answer(undefined);
		expect(h.abort).not.toHaveBeenCalled();
	});

	it("closes the prompt when the agent finishes mid-decision", async () => {
		const h = harness();
		h.interrupt();
		h.endAgent();
		await h.answer(KEEP_RUNNING);
		expect(h.abort).not.toHaveBeenCalled();
	});
});
