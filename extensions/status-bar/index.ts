/**
 * Status Bar entry point.
 *
 * Composes the powerbar core with every producer sub-extension. The core is
 * initialized FIRST so it is subscribed to "powerbar:register-segment" before
 * any producer emits its registration at init time; otherwise those emits
 * would be lost. (This ordering was previously provided implicitly by the
 * loader scanning the `src/` directory alphabetically — `powerbar/` sorted
 * ahead of the `powerbar-*` producers. Composing here makes it explicit and
 * removes the directory-scan dependency.)
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import powerbarContext from "./src/powerbar-context/index.js";
import powerbarGit from "./src/powerbar-git/index.js";
import powerbarModel from "./src/powerbar-model/index.js";
import powerbarOs from "./src/powerbar-os/index.js";
import powerbarProvider from "./src/powerbar-provider/index.js";
import powerbarSession from "./src/powerbar-session/index.js";
import powerbarSub from "./src/powerbar-sub/index.js";
import powerbarTokens from "./src/powerbar-tokens/index.js";
import powerbarCore from "./src/powerbar/index.js";

export default function createExtension(pi: ExtensionAPI): void {
	// Core must run before producers so its register-segment listener is live.
	powerbarCore(pi);

	powerbarSession(pi);
	powerbarGit(pi);
	powerbarModel(pi);
	powerbarProvider(pi);
	powerbarTokens(pi);
	powerbarContext(pi);
	powerbarSub(pi);
	powerbarOs(pi);
}
