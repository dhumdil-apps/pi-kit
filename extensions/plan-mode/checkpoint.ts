import { basename } from "node:path";
import type { CheckResult, PlanState } from "./types.js";

export interface CommandResult { code: number | null; stdout: string; stderr: string }
export type CommandRunner = (command: string, args: string[], options?: { timeout?: number }) => Promise<CommandResult>;

export function porcelainPaths(output: string): string[] {
	return output.split("\n").filter(Boolean).map((line) => line.slice(3).split(" -> ").pop()!.trim()).filter(Boolean);
}

export function activePlanRelativePaths(state: PlanState): string[] {
	return [`.pi/plans/${basename(state.ledgerPath)}`, `.pi/plans/${basename(state.statePath)}`];
}

export function unexpectedDirtyPaths(paths: string[], state: PlanState): string[] {
	const allowed = new Set(activePlanRelativePaths(state));
	return paths.filter((path) => !allowed.has(path));
}

export async function detectGit(runner: CommandRunner): Promise<{ isGit: boolean; head?: string }> {
	const root = await runner("git", ["rev-parse", "--show-toplevel"]);
	if (root.code !== 0) return { isGit: false };
	const head = await runner("git", ["rev-parse", "HEAD"]);
	return { isGit: true, head: head.code === 0 ? head.stdout.trim() : undefined };
}

export async function runPackageChecks(runner: CommandRunner, scripts: Record<string, string>, names: string[]): Promise<CheckResult[]> {
	const checks: CheckResult[] = [];
	for (const name of names) {
		if (!scripts[name]) continue;
		const result = await runner("npm", ["run", name], { timeout: name === "test" ? 120_000 : 60_000 });
		checks.push({ name, ok: result.code === 0, output: `${result.stdout}\n${result.stderr}`.trim().slice(-8000) });
		if (result.code !== 0) break;
	}
	return checks;
}

export async function runAcceptanceChecks(runner: CommandRunner, commands: readonly string[]): Promise<CheckResult[]> {
	const checks: CheckResult[] = [];
	for (const value of commands) {
		const command = value.trim();
		if (!command) continue;
		const result = await runner("sh", ["-lc", command], { timeout: 120_000 });
		checks.push({ name: `acceptance: ${command}`, ok: result.code === 0, output: `${result.stdout}\n${result.stderr}`.trim().slice(-8000) });
		if (result.code !== 0) break;
	}
	return checks;
}

export async function applyPatch(runner: CommandRunner, patchPath: string): Promise<{ ok: boolean; stage: "check" | "apply"; output: string }> {
	const check = await runner("git", ["apply", "--3way", "--check", patchPath], { timeout: 30_000 });
	if (check.code !== 0) return { ok: false, stage: "check", output: `${check.stdout}\n${check.stderr}`.trim() };
	const apply = await runner("git", ["apply", "--3way", patchPath], { timeout: 30_000 });
	return { ok: apply.code === 0, stage: "apply", output: `${apply.stdout}\n${apply.stderr}`.trim() };
}

export function patchFailureStatus(attempts: number): "redispatched" | "blocked" {
	return attempts <= 1 ? "redispatched" : "blocked";
}
