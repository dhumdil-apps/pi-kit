import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

function emitSessionName(pi: ExtensionAPI, name: string | undefined): void {
	pi.events.emit("powerbar:update", {
		id: "session-name",
		text: name,
		color: "accent",
		row: 1,
	});
}

export default function createExtension(pi: ExtensionAPI): void {
	pi.events.emit("powerbar:register-segment", { id: "session-name", label: "Session Name" });

	pi.on("session_start", async () => emitSessionName(pi, pi.getSessionName()));
	pi.on("session_info_changed", async (event) => emitSessionName(pi, event.name));
}
