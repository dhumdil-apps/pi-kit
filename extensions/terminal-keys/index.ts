/**
 * Terminal Keys
 *
 * Pi binds `tui.input.newLine` to shift+enter and ctrl+j, but a terminal has to
 * report those keys distinctly for either to work. Ghostty does, via the Kitty
 * keyboard protocol. VS Code's terminal supports neither Kitty nor Pi's
 * `modifyOtherKeys` fallback, so shift+enter arrives as a bare `\r` and ctrl+j
 * as a bare `\n` — and Pi reads a bare `\n` as Enter whenever the Kitty
 * protocol is inactive. Both newline keys therefore collapse onto submit and
 * there is no way to insert a newline at all.
 *
 * Pi packages can only ship extensions, skills, prompts, and themes — never
 * keybindings — so this is fixed where it can be: terminal input listeners run
 * before key dispatch and may rewrite the raw bytes.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { isKittyProtocolActive, matchesKey } from "@earendil-works/pi-tui";
import { getSetting } from "../extension-preferences/index.js";

const EXTENSION = "terminal-keys";

/** CSI u for shift+enter. parseKittySequence matches this whether or not the protocol was negotiated. */
const CSI_U_SHIFT_ENTER = "\x1b[13;2u";

export type NewlineMode = "auto" | "always" | "off";

/**
 * A bare `\n` means ctrl+j only on a terminal that sends `\r` for Enter. That
 * holds everywhere modern, but a terminal in line-feed newline mode would send
 * `\n` for Enter too, and rewriting there would make submitting impossible —
 * so `auto` sticks to the two cases we can prove:
 *
 * - VS Code, the terminal this exists for, which sends `\r` for Enter.
 * - Kitty protocol active, where `\n` is *already* shift+enter, making the
 *   rewrite a no-op that simply keeps the two paths identical.
 */
export function shouldRewriteNewline(mode: NewlineMode, termProgram: string | undefined, kittyActive: boolean): boolean {
	if (mode === "off") return false;
	if (mode === "always") return true;
	return termProgram === "vscode" || kittyActive;
}

/** Translate the raw chunk, or return undefined to leave it untouched. */
export function rewriteKey(data: string, rewriteNewline: boolean): string | undefined {
	// Only reported via CSI u / modifyOtherKeys, so this is never ambiguous.
	if (matchesKey(data, "ctrl+enter")) return "\r";
	// Exact whole-chunk match on purpose: a bracketed paste arrives as one
	// chunk wrapped in \x1b[200~…\x1b[201~ and full of newlines, and must not
	// be touched.
	if (rewriteNewline && data === "\n") return CSI_U_SHIFT_ENTER;
	return undefined;
}

export default function terminalKeys(pi: ExtensionAPI): void {
	pi.events.emit("pi-extension-settings:register", {
		name: EXTENSION,
		settings: [{
			id: "newline-on-ctrl-j",
			label: "Insert a newline on ctrl+j",
			description: "auto enables it in VS Code and under the Kitty keyboard protocol. Set off if your terminal sends a line feed for Enter.",
			defaultValue: "auto",
			values: ["auto", "always", "off"],
		}],
	});

	pi.on("session_start", (_event, ctx) => {
		if (ctx.mode !== "tui") return;
		const mode = getSetting(EXTENSION, "newline-on-ctrl-j", "auto") as NewlineMode;
		ctx.ui.onTerminalInput((data) => {
			// Kitty negotiation is an async handshake that can still be in flight
			// at session_start, so the probe stays inside the handler.
			const rewriteNewline = shouldRewriteNewline(mode, process.env.TERM_PROGRAM, isKittyProtocolActive());
			const rewritten = rewriteKey(data, rewriteNewline);
			return rewritten === undefined ? undefined : { data: rewritten };
		});
	});
}
