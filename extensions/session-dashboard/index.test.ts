import { homedir } from "node:os";
import { visibleWidth } from "@earendil-works/pi-tui";
import { describe, expect, it, vi } from "vitest";
import type { GraphModel } from "../usage-history/graph.js";
import { TOTAL_SERIES_KEY } from "../usage-history/graph.js";
import sessionDashboardExtension, { contextFileList, tildify, UsageChartCard } from "./index.js";

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

describe("UsageChartCard", () => {
	const HOUR = 3_600_000;
	const t0 = Date.UTC(2026, 6, 20, 9, 0, 0); // fixed timestamp — no Date.now() in the model
	const model = (overrides: Partial<GraphModel> = {}): GraphModel => ({
		series: [
			{ key: TOTAL_SERIES_KEY, label: "Total", points: [1, 2], total: 3, hidden: false, firstIdx: 0, lastIdx: 1 },
			{ key: "anthropic", label: "anthropic", points: [1, 2], total: 3, hidden: false, firstIdx: 0, lastIdx: 1 },
		],
		bucketStarts: [t0, t0 + HOUR],
		bucketMs: HOUR,
		domainStartMs: t0,
		domainEndMs: t0 + 2 * HOUR,
		yMax: 2,
		groupedTotal: 3,
		...overrides,
	});
	const card = (m: GraphModel = model()) => new UsageChartCard(m, (s) => s, (s) => s, (s) => s);

	it("renders the This Week · Per bucket cost · by provider header and a per-provider legend", () => {
		const rendered = card().render(72);
		expect(rendered[0]).toContain("This Week");
		expect(rendered[0]).toContain("Per bucket cost · by provider");
		expect(rendered.some((line) => line.includes("Total"))).toBe(true);
		expect(rendered.some((line) => line.includes("anthropic") && line.includes("100%"))).toBe(true);
	});

	it("shows a fallback note and no chart when there is no usage this week", () => {
		const empty = model({
			series: [{ key: TOTAL_SERIES_KEY, label: "Total", points: [0], total: 0, hidden: false, firstIdx: -1, lastIdx: -1 }],
			groupedTotal: 0,
			yMax: 0,
		});
		const rendered = card(empty).render(72);
		expect(rendered.some((line) => line.includes("No usage yet this week"))).toBe(true);
		expect(rendered.some((line) => line.includes("anthropic"))).toBe(false);
	});

	it("keeps every line within the container width, even when narrow", () => {
		for (const width of [20, 30, 40, 72]) {
			const rendered = card().render(width);
			expect(rendered.every((line) => visibleWidth(line) <= width)).toBe(true);
		}
	});

	it("renders nothing for a non-positive width", () => {
		expect(card().render(0)).toEqual([]);
	});
});

describe("session dashboard startup", () => {
	it("shows a loading widget until the welcome message is ready", async () => {
		const handlers = new Map<string, (event: unknown, ctx: unknown) => Promise<void>>();
		const setWidget = vi.fn();
		const sendMessage = vi.fn();
		const pi = {
			registerMessageRenderer: vi.fn(),
			registerCommand: vi.fn(),
			on: (event: string, handler: (event: unknown, ctx: unknown) => Promise<void>) => handlers.set(event, handler),
			sendMessage,
		};
		const ctx = { hasUI: true, cwd: process.cwd(), ui: { setWidget } };
		sessionDashboardExtension(pi as never);

		const startup = handlers.get("session_start")?.({}, ctx);
		expect(setWidget).toHaveBeenCalledWith("session-dashboard-loading", ["Preparing session dashboard…"]);

		await startup;

		expect(sendMessage).toHaveBeenCalledWith(
			expect.objectContaining({ content: expect.stringContaining("> π Measure twice, cut once.") }),
			expect.anything(),
		);
		expect(setWidget).toHaveBeenLastCalledWith("session-dashboard-loading", undefined);
	});

	it("formats context files cleanly", () => {
		const files = contextFileList(process.cwd());
		expect(Array.isArray(files)).toBe(true);
	});
});
