import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let agentDir: string;

vi.mock("@earendil-works/pi-coding-agent", () => ({
	getAgentDir: () => agentDir,
}));

const SETTINGS_FILE = "settings-extensions.json";

beforeEach(() => {
	agentDir = mkdtempSync(join(tmpdir(), "extension-preferences-"));
});

afterEach(() => {
	rmSync(agentDir, { recursive: true, force: true });
});

describe("getSetting/setSetting", () => {
	it("round-trips a value", async () => {
		const { getSetting, setSetting } = await import("./storage.js");
		setSetting("status-bar", "layout", "left,right");
		expect(getSetting("status-bar", "layout", "default")).toBe("left,right");
	});

	it("falls back to the default when unset", async () => {
		const { getSetting } = await import("./storage.js");
		expect(getSetting("status-bar", "layout", "default")).toBe("default");
	});

	it("writes atomically, leaving no leftover temp file", async () => {
		const { setSetting } = await import("./storage.js");
		setSetting("status-bar", "layout", "left,right");
		const entries = readdirSync(agentDir);
		expect(entries).toEqual([SETTINGS_FILE]);
	});

	it("backs up and resets on invalid JSON instead of throwing", async () => {
		const path = join(agentDir, SETTINGS_FILE);
		writeFileSync(path, "{not valid json");
		const { getSetting, setSetting } = await import("./storage.js");

		expect(getSetting("status-bar", "layout", "default")).toBe("default");
		setSetting("status-bar", "layout", "left,right");

		expect(getSetting("status-bar", "layout", "default")).toBe("left,right");
		const backups = readdirSync(agentDir).filter((f) => f.includes(".bak-"));
		expect(backups.length).toBe(1);
		expect(readFileSync(join(agentDir, backups[0]), "utf-8")).toBe("{not valid json");
	});

	it("backs up and resets when the parsed JSON has the wrong shape", async () => {
		const path = join(agentDir, SETTINGS_FILE);
		writeFileSync(path, JSON.stringify({ "status-bar": "not-an-object" }));
		const { getSetting, setSetting } = await import("./storage.js");

		expect(getSetting("status-bar", "layout", "default")).toBe("default");
		const backups = readdirSync(agentDir).filter((f) => f.includes(".bak-"));
		expect(backups.length).toBe(1);

		setSetting("status-bar", "layout", "left,right");
		expect(getSetting("status-bar", "layout", "default")).toBe("left,right");
	});
});
