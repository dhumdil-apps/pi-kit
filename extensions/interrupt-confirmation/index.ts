import { CustomEditor, type ExtensionAPI, type ExtensionContext, type KeybindingsManager } from "@earendil-works/pi-coding-agent";
import type { EditorTheme, TUI } from "@earendil-works/pi-tui";

/**
 * ui.select returns the chosen label, so the options are named constants —
 * the same shape the workflow approval prompt uses. The destructive option
 * stays first because the selector has no initial-index parameter and the
 * user reached this prompt by pressing the interrupt key.
 */
export const CONFIRM = "Confirm cancellation";
export const KEEP_RUNNING = "Keep running";

const TITLE = "⚠ Cancel running agent?\nThe agent is still running. Confirm to stop its current operation.";

export class CancelGuardState {
	isAgentRunning = false;
	isDialogOpen = false;

	requestConfirmation(): boolean {
		if (!this.isAgentRunning || this.isDialogOpen) return false;
		this.isDialogOpen = true;
		return true;
	}

	closeDialog(): void {
		this.isDialogOpen = false;
	}
}

class CancelGuardEditor extends CustomEditor {
	constructor(
		tui: TUI,
		theme: EditorTheme,
		private readonly appKeybindings: KeybindingsManager,
		private readonly shouldGuard: () => boolean,
		private readonly showConfirmation: () => void,
	) {
		super(tui, theme, appKeybindings);
	}

	override handleInput(data: string): void {
		if (
			this.appKeybindings.matches(data, "app.interrupt") &&
			!this.isShowingAutocomplete() &&
			this.shouldGuard()
		) {
			this.showConfirmation();
			return;
		}

		super.handleInput(data);
	}
}

export default function cancelGuard(pi: ExtensionAPI): void {
	const state = new CancelGuardState();
	let activeContext: ExtensionContext | undefined;
	let dismissDialog: (() => void) | undefined;

	const finishDialog = (cancel: boolean): void => {
		if (!state.isDialogOpen) return;
		state.closeDialog();
		dismissDialog = undefined;
		if (cancel && state.isAgentRunning) activeContext?.abort();
	};

	const showConfirmation = (): void => {
		if (!activeContext || !state.requestConfirmation()) return;
		// The selector takes focus from the editor while it is open, so the
		// interrupt key cannot re-enter here; aborting the signal is how
		// agent_end closes the prompt out from under a still-deciding user.
		const controller = new AbortController();
		dismissDialog = () => controller.abort();
		void activeContext.ui
			.select(TITLE, [CONFIRM, KEEP_RUNNING], { signal: controller.signal })
			.then((choice) => finishDialog(choice === CONFIRM))
			.catch(() => finishDialog(false));
	};

	pi.on("session_start", (_event, ctx) => {
		activeContext = ctx;
		if (ctx.mode !== "tui") return;
		ctx.ui.setEditorComponent(
			(tui, theme, keybindings) =>
				new CancelGuardEditor(tui, theme, keybindings, () => state.isAgentRunning, showConfirmation),
		);
	});

	pi.on("agent_start", (_event, ctx) => {
		activeContext = ctx;
		state.isAgentRunning = true;
	});

	pi.on("agent_end", () => {
		state.isAgentRunning = false;
		dismissDialog?.();
	});
}
