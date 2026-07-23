import { homedir } from "node:os";
import { visibleWidth } from "@earendil-works/pi-tui";
import { describe, expect, it, vi } from "vitest";
import type { UsageData } from "../usage-history/data.js";
import type { GraphModel } from "../usage-history/graph.js";
import { TOTAL_SERIES_KEY } from "../usage-history/graph.js";

const usageMocks = vi.hoisted(() => ({ collectUsageData: vi.fn<() => Promise<UsageData | null>>(() => Promise.resolve(null)) }));
vi.mock("../usage-history/data.js", async (importOriginal) => ({
	...(await importOriginal()),
	collectUsageData: usageMocks.collectUsageData,
}));

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
			{ key: TOTAL_SERIES_KEY, label: "Total", points: [1, 2], total: 3, hidden: true, firstIdx: 0, lastIdx: 1 },
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

	it("renders the Last 30 Days · Per bucket cost · by model header and a per-model legend", () => {
		const rendered = card().render(72);
		expect(rendered[0]).toContain("Last 30 Days");
		expect(rendered[0]).toContain("Per bucket cost · by model");
		expect(rendered.some((line) => line.includes("anthropic") && line.includes("100%"))).toBe(true);
	});

	it("closes the legend with Total as a markerless summary row", () => {
		const rendered = card().render(72);
		const totalIdx = rendered.findIndex((line) => line.includes("Total"));
		const seriesIdx = rendered.findIndex((line) => line.includes("anthropic"));
		expect(seriesIdx).toBeGreaterThanOrEqual(0);
		expect(totalIdx).toBeGreaterThan(seriesIdx);
		expect(rendered[totalIdx]).not.toContain("●");
		expect(rendered[totalIdx]).not.toContain("%");
	});

	it("omits the summary row when the model carries no Total series", () => {
		const rendered = card(model({ series: model().series.filter((s) => s.key !== TOTAL_SERIES_KEY) })).render(72);
		expect(rendered.some((line) => line.includes("Total"))).toBe(false);
		expect(rendered.some((line) => line.includes("anthropic"))).toBe(true);
	});

	it("shows a fallback note and no chart when there is no usage in the last 30 days", () => {
		const empty = model({
			series: [{ key: TOTAL_SERIES_KEY, label: "Total", points: [0], total: 0, hidden: false, firstIdx: -1, lastIdx: -1 }],
			groupedTotal: 0,
			yMax: 0,
		});
		const rendered = card(empty).render(72);
		expect(rendered.some((line) => line.includes("No usage in the last 30 days"))).toBe(true);
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

		const content = sendMessage.mock.calls[0]?.[0].content as string;
		expect(content).toContain("⌘ Workflow: `/handoff`");
		expect(content.indexOf("⌘ Workflow")).toBeLessThan(content.indexOf("⚡ Raw Pi"));
		expect(content).not.toContain("π Measure twice, cut once. What’s your goal?");
		expect(content.endsWith("*⚡ Raw Pi: `pi --no-extensions`*")).toBe(true);
		expect(setWidget).toHaveBeenLastCalledWith("session-dashboard-loading", undefined);
	});

	it("serializes a daily per-model 30-day graph", async () => {
		const day = 24 * 3_600_000;
		const start = Date.UTC(2026, 6, 1);
		const now = start + 30 * day;
		const emptyPeriod: UsageData["today"] = {
			providers: new Map(),
			totals: { sessions: 0, messages: 0, cost: 0, tokens: { total: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } },
			insights: { insights: [] },
		};
		usageMocks.collectUsageData.mockResolvedValueOnce({
			today: emptyPeriod,
			thisWeek: emptyPeriod,
			lastWeek: emptyPeriod,
			last30Days: emptyPeriod,
			allTime: emptyPeriod,
			hourly: new Map([
				[start + 2 * day, new Map([["openai\u0000gpt-5\u0000", { messages: 1, cost: 1, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, reasoning: 0 }]])],
				[start + 17 * day, new Map([["openai\u0000gpt-5-mini\u0000", { messages: 1, cost: 2, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, reasoning: 0 }]])],
			]),
			bounds: { todayMs: now - day, weekStartMs: now - 7 * day, lastWeekStartMs: now - 14 * day, last30DaysStartMs: start, nowMs: now },
		});
		const handlers = new Map<string, (event: unknown, ctx: unknown) => Promise<void>>();
		const sendMessage = vi.fn();
		const pi = {
			registerMessageRenderer: vi.fn(),
			registerCommand: vi.fn(),
			on: (event: string, handler: (event: unknown, ctx: unknown) => Promise<void>) => handlers.set(event, handler),
			sendMessage,
		};
		sessionDashboardExtension(pi as never);

		await handlers.get("session_start")?.({}, { hasUI: true, cwd: process.cwd(), ui: { setWidget: vi.fn() } });

		const content = sendMessage.mock.calls[0]?.[0].content as string;
		const json = content.match(/<!-- session-dashboard-usage-chart -->\n(.+)\n<!-- \/session-dashboard-usage-chart -->/)?.[1];
		const graph = JSON.parse(json ?? "") as GraphModel;
		expect(content.indexOf("<!-- session-dashboard-usage-chart -->")).toBeLessThan(content.indexOf("❓ `/help`"));
		expect(content.indexOf("❓ `/help`")).toBeLessThan(content.indexOf("⌘ Workflow"));
		expect(content.indexOf("⌘ Workflow")).toBeLessThan(content.indexOf("⚡ Raw Pi"));
		expect(graph).toMatchObject({ domainStartMs: start, domainEndMs: now, bucketMs: day });
		expect(graph.bucketStarts).toHaveLength(30);
		expect(graph.series.map((series) => series.key)).toEqual([TOTAL_SERIES_KEY, "gpt-5-mini", "gpt-5"]);
		// Hidden at build time so it neither overdraws the per-model lines nor inflates yMax.
		expect(graph.series.map((series) => series.hidden)).toEqual([true, false, false]);
	});

	it("formats context files cleanly", () => {
		const files = contextFileList(process.cwd());
		expect(Array.isArray(files)).toBe(true);
	});
});
