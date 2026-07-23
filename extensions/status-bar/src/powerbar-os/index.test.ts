import { describe, expect, it, vi } from "vitest";

const { execFile } = vi.hoisted(() => ({ execFile: vi.fn() }));

vi.mock("node:child_process", () => ({ execFile }));
vi.mock("node:os", () => ({
	default: {
		cpus: () => [{ times: { idle: 80, user: 10, nice: 0, sys: 10, irq: 0 } }],
		freemem: () => 50,
		homedir: () => "/home/test",
		platform: () => "linux",
		totalmem: () => 100,
	},
}));

import createOsStats from "./index.js";

describe("powerbar OS stats", () => {
	it("emits successful network totals with accent styling", async () => {
		execFile.mockImplementation((cmd: string, _args: string[], _options: unknown, callback: Function) => {
			const output =
				cmd === "df"
					? "Filesystem 512-blocks Used Available Capacity iused ifree %iused Mounted on\n/dev/disk 1 1 1 1% 1 1 1% /\n"
					: cmd === "netstat"
						? "Name Mtu Network Address Ipkts Ierrs Ibytes Opkts Oerrs Obytes Coll\nen0 1500 <Link#4> aa:bb 1 0 2048 1 0 1024 0\n"
						: "";
			callback(null, output);
		});
		const handlers = new Map<string, () => Promise<void>>();
		const emit = vi.fn();
		const pi = {
			events: { emit },
			on: (event: string, handler: () => Promise<void>) => handlers.set(event, handler),
		};

		createOsStats(pi as never);
		await handlers.get("session_start")!();

		await vi.waitFor(() => {
			expect(emit).toHaveBeenCalledWith("powerbar:update", {
				id: "net",
				text: "net ↓2.0K ↑1.0K",
				color: "accent",
				row: 3,
			});
		});
	});
});
