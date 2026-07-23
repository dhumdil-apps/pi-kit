/**
 * The /mode picker — a small two-step arrow selector shown via ctx.ui.custom,
 * modeled on interrupt-confirmation's CancelConfirmation overlay.
 *
 * Step 1 picks the mode (the active one is highlighted and marked "current").
 * Step 2 — only for implement/review — picks placement: continue in this
 * session or hand off to a fresh one. Both steps show the live context readout,
 * so a filling context nudges toward a fresh session. plan has no step 2: it is
 * always the same-session default.
 */

import { type ContextUsage, DynamicBorder, type ExtensionContext, type KeybindingsManager, type Theme } from "@earendil-works/pi-coding-agent";
import { Container, Spacer, Text, type TUI } from "@earendil-works/pi-tui";
import { contextUsageText } from "./context-usage.js";
import { WORKFLOW_MODES, type WorkflowMode } from "./mode.js";

export type Placement = "continue" | "fresh";

export interface ModeSelection {
	mode: WorkflowMode;
	placement: Placement;
}

/** Concise one-line descriptor per mode, shown beside each option. */
const MODE_HINT: Record<WorkflowMode, string> = {
	plan: "explore & plan",
	implement: "execute one slice",
	review: "fresh-eyes check",
};

interface Choice {
	value: string;
	label: string;
	hint?: string;
	badge?: string;
}

/** A single-column arrow selector. done(null) means the user cancelled. */
class SelectOverlay extends Container {
	private selectedIndex: number;
	private readonly optionList = new Container();

	constructor(
		private readonly tui: TUI,
		private readonly theme: Theme,
		private readonly keybindings: KeybindingsManager,
		private readonly spec: { title: string; subtitle?: string; choices: Choice[]; initialIndex?: number },
		private readonly done: (value: string | null) => void,
	) {
		super();
		this.selectedIndex = spec.initialIndex ?? 0;
		const accent = (text: string) => theme.fg("accent", text);
		this.addChild(new DynamicBorder(accent));
		this.addChild(new Spacer(1));
		this.addChild(new Text(accent(theme.bold(spec.title)), 1, 0));
		if (spec.subtitle) {
			this.addChild(new Spacer(1));
			this.addChild(new Text(spec.subtitle, 1, 0));
		}
		this.addChild(new Spacer(1));
		this.addChild(this.optionList);
		this.addChild(new Spacer(1));
		this.addChild(new Text(theme.fg("muted", "↑↓ navigate  ·  Enter select  ·  Esc cancel"), 1, 0));
		this.addChild(new Spacer(1));
		this.addChild(new DynamicBorder(accent));
		this.renderOptions();
	}

	private renderOptions(): void {
		this.optionList.clear();
		for (let index = 0; index < this.spec.choices.length; index++) {
			const choice = this.spec.choices[index];
			const selected = index === this.selectedIndex;
			const badge = choice.badge ? this.theme.fg("success", ` ${choice.badge}`) : "";
			const hint = choice.hint ? `  ${this.theme.fg("muted", choice.hint)}` : "";
			const label = selected
				? `${this.theme.fg("accent", `${this.theme.bold("→")} ${this.theme.bold(choice.label)}`)}${badge}${hint}`
				: `  ${choice.label}${badge}${hint}`;
			this.optionList.addChild(new Text(label, 1, 0));
		}
	}

	handleInput(data: string): void {
		if (this.keybindings.matches(data, "tui.select.cancel")) {
			this.done(null);
			return;
		}
		if (this.keybindings.matches(data, "tui.select.up")) {
			this.selectedIndex = Math.max(0, this.selectedIndex - 1);
			this.renderOptions();
			this.tui.requestRender();
			return;
		}
		if (this.keybindings.matches(data, "tui.select.down")) {
			this.selectedIndex = Math.min(this.spec.choices.length - 1, this.selectedIndex + 1);
			this.renderOptions();
			this.tui.requestRender();
			return;
		}
		if (this.keybindings.matches(data, "tui.select.confirm")) {
			this.done(this.spec.choices[this.selectedIndex].value);
		}
	}
}

/** Show one SelectOverlay and resolve with the chosen value, or undefined if cancelled. */
function selectOne(
	ctx: ExtensionContext,
	spec: (theme: Theme) => { title: string; subtitle?: string; choices: Choice[]; initialIndex?: number },
): Promise<string | undefined> {
	return ctx.ui
		.custom<string | null>(
			(tui, theme, keybindings, done) => {
				let completed = false;
				const finish = (value: string | null) => {
					if (completed) return;
					completed = true;
					done(value);
				};
				return new SelectOverlay(tui, theme, keybindings, spec(theme), finish);
			},
			{ overlay: true, overlayOptions: { anchor: "center", width: 64, maxHeight: 16 } },
		)
		.then((value) => value ?? undefined)
		.catch(() => undefined);
}

/** Live context readout for the picker header, or a neutral note when unknown. */
function contextSubtitle(usage: ContextUsage | undefined, theme: Theme): string {
	return contextUsageText(usage, theme) ?? theme.fg("muted", "ctx —");
}

/**
 * Run the mode picker. Returns the chosen mode and placement, or undefined if
 * the user cancelled at any step. plan resolves immediately as a same-session
 * switch; implement/review ask continue-vs-fresh. Pass `mode` to skip step 1
 * (the mode is already known, e.g. the post-plan `/mode implement` prompt).
 */
export async function runModePicker(
	ctx: ExtensionContext,
	options: { current: WorkflowMode; usage: ContextUsage | undefined; mode?: WorkflowMode },
): Promise<ModeSelection | undefined> {
	let mode = options.mode;
	if (!mode) {
		const modeValue = await selectOne(ctx, (theme) => ({
			title: "Session mode",
			subtitle: contextSubtitle(options.usage, theme),
			initialIndex: Math.max(0, WORKFLOW_MODES.indexOf(options.current)),
			choices: WORKFLOW_MODES.map((choice) => ({
				value: choice,
				label: choice,
				hint: MODE_HINT[choice],
				badge: choice === options.current ? "current" : undefined,
			})),
		}));
		if (!modeValue) return undefined;
		mode = modeValue as WorkflowMode;
	}

	// plan is the same-session default; no continue-vs-fresh choice.
	if (mode === "plan") return { mode, placement: "continue" };

	const placement = await selectOne(ctx, (theme) => ({
		title: mode === "implement" ? "Implement" : "Review",
		subtitle: contextSubtitle(options.usage, theme),
		initialIndex: 0,
		choices: [
			{ value: "continue", label: "Continue in this session", hint: "reuse this context" },
			{ value: "fresh", label: "Fresh session", hint: "lean context — recommended" },
		],
	}));
	if (!placement) return undefined;
	return { mode, placement: placement as Placement };
}
