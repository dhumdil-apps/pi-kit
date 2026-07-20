import {
	CustomEditor,
	DynamicBorder,
	type ExtensionAPI,
	type ExtensionContext,
	type KeybindingsManager,
} from "@earendil-works/pi-coding-agent";
import { Container, Spacer, Text, type EditorTheme, type TUI } from "@earendil-works/pi-tui";

export type CancelDecision = "cancel" | "keep-running";

export function decisionForSelection(selectedIndex: number): CancelDecision {
	return selectedIndex === 0 ? "cancel" : "keep-running";
}

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

class CancelConfirmation extends Container {
	private selectedIndex = 0;
	private readonly options = ["Confirm cancellation", "Keep running"] as const;
	private readonly optionList = new Container();

	constructor(
		private readonly tui: TUI,
		private readonly theme: ExtensionContext["ui"]["theme"],
		private readonly keybindings: KeybindingsManager,
		private readonly done: (decision: CancelDecision) => void,
	) {
		super();
		const red = (text: string) => theme.fg("error", text);
		this.addChild(new DynamicBorder(red));
		this.addChild(new Spacer(1));
		this.addChild(new Text(red(theme.bold("⚠ Cancel running agent?")), 1, 0));
		this.addChild(new Spacer(1));
		this.addChild(new Text(theme.fg("text", "The agent is still running. Confirm to stop its current operation."), 1, 0));
		this.addChild(new Spacer(1));
		this.addChild(this.optionList);
		this.addChild(new Spacer(1));
		this.addChild(new Text(theme.fg("muted", "↑↓ navigate  ·  Enter select  ·  Esc keep running"), 1, 0));
		this.addChild(new Spacer(1));
		this.addChild(new DynamicBorder(red));
		this.renderOptions();
	}

	private renderOptions(): void {
		this.optionList.clear();
		for (let index = 0; index < this.options.length; index++) {
			const option = this.options[index];
			const selected = index === this.selectedIndex;
			const color = index === 0 ? "error" : "success";
			this.optionList.addChild(
				new Text(
					selected
						? this.theme.fg(color, `${this.theme.bold("→")} ${this.theme.bold(option)}`)
						: `  ${this.theme.fg(color, option)}`,
					1,
					0,
				),
			);
		}
	}

	handleInput(data: string): void {
		if (this.keybindings.matches(data, "tui.select.cancel")) {
			this.done("keep-running");
			return;
		}
		if (this.keybindings.matches(data, "tui.select.up")) {
			this.selectedIndex = Math.max(0, this.selectedIndex - 1);
			this.renderOptions();
			this.tui.requestRender();
			return;
		}
		if (this.keybindings.matches(data, "tui.select.down")) {
			this.selectedIndex = Math.min(this.options.length - 1, this.selectedIndex + 1);
			this.renderOptions();
			this.tui.requestRender();
			return;
		}
		if (this.keybindings.matches(data, "tui.select.confirm")) {
			this.done(decisionForSelection(this.selectedIndex));
			return;
		}

		// Consume other keys mapped to app.interrupt while the modal is open.
		if (this.keybindings.matches(data, "app.interrupt")) return;
	}
}

export default function cancelGuard(pi: ExtensionAPI): void {
	const state = new CancelGuardState();
	let activeContext: ExtensionContext | undefined;
	let dismissDialog: (() => void) | undefined;

	const finishDialog = (decision: CancelDecision): void => {
		if (!state.isDialogOpen) return;
		state.closeDialog();
		dismissDialog = undefined;
		if (decision === "cancel" && state.isAgentRunning) activeContext?.abort();
	};

	const showConfirmation = (): void => {
		if (!activeContext || !state.requestConfirmation()) return;
		const ctx = activeContext;
		void ctx.ui
			.custom<CancelDecision>(
				(tui, theme, keybindings, done) => {
					let completed = false;
					const finish = (decision: CancelDecision) => {
						if (completed) return;
						completed = true;
						done(decision);
					};
					dismissDialog = () => finish("keep-running");
					return new CancelConfirmation(tui, theme, keybindings, finish);
				},
				{ overlay: true, overlayOptions: { anchor: "center", width: 58, maxHeight: 14 } },
			)
			.then(finishDialog)
			.catch(() => finishDialog("keep-running"));
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
