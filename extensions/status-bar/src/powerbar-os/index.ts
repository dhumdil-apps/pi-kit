/**
 * Powerbar OS Stats Producer
 *
 * Polls OS-level stats every 10 seconds and emits powerbar segments:
 * - "cpu":  CPU busy % as a bar (delta of os.cpus() times between polls)
 * - "ram":  memory used % as a bar (vm_stat on macOS, os.freemem elsewhere)
 * - "disk": SSD used % as a bar (df on the home volume)
 * - "net":  cumulative download/upload since boot (netstat -ib totals)
 */

import { execFile } from "node:child_process";
import os from "node:os";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const POLL_INTERVAL_MS = 10_000;
const EXEC_TIMEOUT_MS = 2_000;
// OS metrics are compact indicators: render one partial-height block per item
// instead of a row of mini-blocks.
const BAR_SEGMENTS = 1;

const LABELS: Record<string, string> = {
	cpu: "cpu",
	ram: "ram",
	disk: "ssd",
	net: "net",
};

function getColor(pct: number): string {
	if (pct > 80) return "error";
	if (pct > 60) return "warning";
	return "accent";
}

// Disks routinely sit high, so alert later than CPU/RAM.
function getDiskColor(pct: number): string {
	if (pct > 90) return "error";
	if (pct > 75) return "warning";
	return "accent";
}

function humanBytes(bytes: number): string {
	const units = ["B", "K", "M", "G", "T"];
	let value = bytes;
	let i = 0;
	while (value >= 1024 && i < units.length - 1) {
		value /= 1024;
		i++;
	}
	const rounded = value >= 100 || i === 0 ? Math.round(value).toString() : value.toFixed(1);
	return `${rounded}${units[i]}`;
}

function run(cmd: string, args: string[]): Promise<string> {
	return new Promise((resolve, reject) => {
		execFile(cmd, args, { timeout: EXEC_TIMEOUT_MS }, (error, stdout) => {
			if (error) reject(error);
			else resolve(stdout);
		});
	});
}

interface CpuSample {
	idle: number;
	total: number;
}

function sampleCpu(): CpuSample {
	let idle = 0;
	let total = 0;
	for (const cpu of os.cpus()) {
		idle += cpu.times.idle;
		total += cpu.times.user + cpu.times.nice + cpu.times.sys + cpu.times.idle + cpu.times.irq;
	}
	return { idle, total };
}

function cpuPercent(prev: CpuSample, curr: CpuSample): number | undefined {
	const totalDelta = curr.total - prev.total;
	if (totalDelta <= 0) return undefined;
	const idleDelta = curr.idle - prev.idle;
	return Math.round(100 * (1 - idleDelta / totalDelta));
}

async function ramPercent(): Promise<number | undefined> {
	if (os.platform() === "darwin") {
		// os.freemem() undercounts available memory on macOS; derive used
		// memory from vm_stat (active + wired + compressed pages).
		const stdout = await run("vm_stat", []);
		const pageSizeMatch = stdout.match(/page size of (\d+) bytes/);
		const pageSize = pageSizeMatch ? Number.parseInt(pageSizeMatch[1], 10) : 16384;
		const page = (name: string): number => {
			const match = stdout.match(new RegExp(`${name}:\\s+(\\d+)`));
			return match ? Number.parseInt(match[1], 10) : 0;
		};
		const usedPages = page("Pages active") + page("Pages wired down") + page("Pages occupied by compressor");
		const used = usedPages * pageSize;
		return Math.round((used / os.totalmem()) * 100);
	}
	return Math.round((1 - os.freemem() / os.totalmem()) * 100);
}

async function diskPercent(): Promise<number | undefined> {
	const stdout = await run("df", ["-k", os.homedir()]);
	const lines = stdout.trim().split("\n");
	if (lines.length < 2) return undefined;
	const match = lines[lines.length - 1].match(/(\d+)%/);
	return match ? Number.parseInt(match[1], 10) : undefined;
}

interface NetTotals {
	down: number;
	up: number;
}

async function netTotals(): Promise<NetTotals | undefined> {
	// netstat -ib repeats each interface once per address; use only the
	// <Link#N> row (one per interface). Interfaces without a MAC address
	// omit the Address column, so index the counters from the end of the
	// row: ... Ibytes Opkts Oerrs Obytes Coll.
	const stdout = await run("netstat", ["-ib"]);
	const seen = new Set<string>();
	let down = 0;
	let up = 0;
	for (const line of stdout.trim().split("\n").slice(1)) {
		const cols = line.split(/\s+/);
		const name = cols[0];
		if (!name || name.startsWith("lo") || seen.has(name)) continue;
		if (!cols[2]?.startsWith("<Link")) continue;
		const ibytes = Number.parseInt(cols[cols.length - 5], 10);
		const obytes = Number.parseInt(cols[cols.length - 2], 10);
		if (Number.isNaN(ibytes) || Number.isNaN(obytes)) continue;
		seen.add(name);
		down += ibytes;
		up += obytes;
	}
	return seen.size > 0 ? { down, up } : undefined;
}

export default function createExtension(pi: ExtensionAPI): void {
	pi.events.emit("powerbar:register-segment", { id: "cpu", label: "CPU" });
	pi.events.emit("powerbar:register-segment", { id: "ram", label: "RAM" });
	pi.events.emit("powerbar:register-segment", { id: "disk", label: "Disk (SSD)" });
	pi.events.emit("powerbar:register-segment", { id: "net", label: "Network" });

	let timer: ReturnType<typeof setInterval> | undefined;
	let prevCpu: CpuSample | undefined;
	let polling = false;

	function emitBar(id: string, pct: number, color: string): void {
		pi.events.emit("powerbar:update", {
			id,
			text: LABELS[id],
			suffix: `${pct}%`,
			bar: pct,
			barSegments: BAR_SEGMENTS,
			color,
		});
	}

	function emitPlaceholder(id: "cpu" | "ram" | "disk"): void {
		emitBar(id, 0, getColor(0));
	}

	async function poll(): Promise<void> {
		if (polling) return;
		polling = true;
		try {
			const currCpu = sampleCpu();
			if (prevCpu) {
				const pct = cpuPercent(prevCpu, currCpu);
				if (pct !== undefined) emitBar("cpu", pct, getColor(pct));
				else emitPlaceholder("cpu");
			} else {
				emitPlaceholder("cpu");
			}
			prevCpu = currCpu;

			const [ram, disk, net] = await Promise.allSettled([ramPercent(), diskPercent(), netTotals()]);
			if (ram.status === "fulfilled" && ram.value !== undefined) {
				emitBar("ram", ram.value, getColor(ram.value));
			} else emitPlaceholder("ram");
			if (disk.status === "fulfilled" && disk.value !== undefined) {
				emitBar("disk", disk.value, getDiskColor(disk.value));
			} else emitPlaceholder("disk");
			if (net.status === "fulfilled" && net.value !== undefined) {
				pi.events.emit("powerbar:update", {
					id: "net",
					text: `${LABELS.net} ↓${humanBytes(net.value.down)} ↑${humanBytes(net.value.up)}`,
					color: "muted",
				});
			}
		} finally {
			polling = false;
		}
	}

	pi.on("session_start", async () => {
		if (!timer) {
			timer = setInterval(() => void poll(), POLL_INTERVAL_MS);
			timer.unref?.();
		}
		prevCpu = sampleCpu();
		emitPlaceholder("cpu");
		emitPlaceholder("ram");
		emitPlaceholder("disk");
		void poll();
	});

	pi.on("session_shutdown", async () => {
		if (timer) {
			clearInterval(timer);
			timer = undefined;
		}
		prevCpu = undefined;
		for (const id of Object.keys(LABELS)) {
			pi.events.emit("powerbar:update", { id, text: undefined });
		}
	});
}
