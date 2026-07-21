import { homedir } from "node:os";
import { visibleWidth } from "@earendil-works/pi-tui";
import { describe, expect, it, vi } from "vitest";
import sessionDashboardExtension, { RulerText, SessionContextCard, tildify } from "./index.js";

describe("tildify", () => {
	it("tildifies a path under the home directory", () => {
		const home = homedir();
		expect(tildify(`${home}/projects/foo`)).toBe("~/projects/foo");
	});

	it("tildifies the home directory itself", () => {
		expect(tildify(homedir())).toBe("~");
	});

	it("does not mistake a sibling directory that merely shares the home dir as a prefix", () => {
		const home = homedir();
		const sibling = `${home}-backup/projects/foo`;
		expect(tildify(sibling)).toBe(sibling);
	});

	it("leaves paths outside the home directory untouched", () => {
		expect(tildify("/var/log/foo")).toBe("/var/log/foo");
	});
});

describe("SessionContextCard", () => {
	const card = () => new SessionContextCard(
		[
			{ label: "project", values: ["~/.pi  main · clean"] },
			{ label: "resources", values: ["📜 ./agent/AGENTS.md", "🎓 simplify"] },
			{ label: "commands", values: ["⌨️ ! <cmd> bash · /todos progress · /flash cruise control"] },
		],
		(s) => s,
		(s) => s,
		(s) => s,
		(s) => s,
	);

	it("renders aligned labels and indented continuation values", () => {
		const rendered = card().render(72);
		expect(rendered[0]).toContain("Session context");
		expect(rendered.some((line) => line.includes("project    ~/.pi  main · clean"))).toBe(true);
		expect(rendered.some((line) => line.includes("resources  📜 ./agent/AGENTS.md"))).toBe(true);
		expect(rendered.some((line) => line.includes("           🎓 simplify"))).toBe(true);
		expect(rendered.filter((line) => line.includes("resources"))).toHaveLength(1);
	});

	it("wraps long commands without losing content", () => {
		const rendered = card().render(40);
		expect(rendered.every((line) => visibleWidth(line) <= 40)).toBe(true);
		expect(rendered.filter((line) => line.includes("commands"))).toHaveLength(1);
		expect(rendered.some((line) => line.includes("/flash"))).toBe(true);
		expect(rendered.join("\n")).not.toContain("…");
	});

	it("keeps every line within very narrow widths", () => {
		for (const width of [1, 2, 3, 4, 5, 16]) {
			const rendered = card().render(width);
			expect(rendered.every((line) => visibleWidth(line) <= width)).toBe(true);
		}
	});

	it("renders nothing when there are no sections", () => {
		const empty = new SessionContextCard([], (s) => s, (s) => s, (s) => s, (s) => s);
		expect(empty.render(80)).toEqual([]);
	});
});

describe("session dashboard startup", () => {
	it("shows a loading widget until the welcome message is ready", async () => {
		const handlers = new Map<string, (event: unknown, ctx: unknown) => Promise<void>>();
		const pendingGitCommands: Array<(value: { code: number; stdout: string }) => void> = [];
		const setWidget = vi.fn();
		const sendMessage = vi.fn();
		const pi = {
			registerMessageRenderer: vi.fn(),
			on: (event: string, handler: (event: unknown, ctx: unknown) => Promise<void>) => handlers.set(event, handler),
			exec: vi.fn(() => new Promise<{ code: number; stdout: string }>((resolve) => pendingGitCommands.push(resolve))),
			sendMessage,
		};
		const ctx = { hasUI: true, cwd: process.cwd(), ui: { setWidget } };
		sessionDashboardExtension(pi as never);

		const startup = handlers.get("session_start")?.({}, ctx);
		expect(setWidget).toHaveBeenCalledWith("session-dashboard-loading", ["Preparing session dashboard…"]);
		expect(sendMessage).not.toHaveBeenCalled();

		for (const resolve of pendingGitCommands) resolve({ code: 0, stdout: "" });
		await startup;

		expect(sendMessage).toHaveBeenCalledOnce();
		expect(setWidget).toHaveBeenLastCalledWith("session-dashboard-loading", undefined);
	});
});

describe("RulerText", () => {
	const lines = ["  __________", '|"""""""""""|', "|  1  2  π  |", "'-----------'"];

	it("renders every line verbatim when the width fits", () => {
		const ruler = new RulerText(lines, (s) => s);
		expect(ruler.render(80)).toEqual(lines);
	});

	it("clips each line to the container width instead of word-wrapping it", () => {
		const ruler = new RulerText(lines, (s) => s);
		const rendered = ruler.render(5);
		// Every line clipped to the same column — still aligned, unlike word-wrap
		// which would break the space-containing line at a different column than
		// the border lines.
		expect(rendered).toEqual(lines.map((l) => l.slice(0, 5)));
	});

	it("applies the color function to the (possibly clipped) line", () => {
		const ruler = new RulerText(["abcdef"], (s) => `[${s}]`);
		expect(ruler.render(3)).toEqual(["[abc]"]);
	});
});
