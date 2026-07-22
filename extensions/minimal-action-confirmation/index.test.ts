import { mkdtempSync, symlinkSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { describe, expect, it, vi } from "vitest";

vi.mock("../extension-preferences/index.js", () => ({ getSetting: () => "on" }));

import createPermissionGate, { bashUsesGuardedWebCommand, confirmGatedAction, vendoredDirForBash } from "./index.js";

function makeGate() {
	let toolCall: ((event: unknown, ctx: unknown) => Promise<unknown>) | undefined;
	const pi = {
		events: { emit: vi.fn() },
		on: vi.fn((event: string, handler: (toolEvent: unknown, ctx: unknown) => Promise<unknown>) => {
			if (event === "tool_call") toolCall = handler;
		}),
		sendMessage: vi.fn(),
	};
	createPermissionGate(pi as never);
	return { toolCall: toolCall!, pi };
}

describe("confirmGatedAction", () => {
	it("approves Proceed and collects optional denial guidance", async () => {
		const approveUi = { select: vi.fn().mockResolvedValue("Proceed"), input: vi.fn() };
		await expect(confirmGatedAction({ ui: approveUi }, "Run it")).resolves.toEqual({ approved: true });

		const denyUi = {
			select: vi.fn().mockResolvedValue("Deny with guidance"),
			input: vi.fn().mockResolvedValue("Use the local copy"),
		};
		await expect(confirmGatedAction({ ui: denyUi }, "Run it")).resolves.toEqual({
			approved: false,
			guidance: "Use the local copy",
		});
	});
});

describe("bashUsesGuardedWebCommand", () => {
	it("recognizes curl commands, wrappers, environment prefixes, and executable paths", () => {
		expect(bashUsesGuardedWebCommand("curl https://example.com")).toBe(true);
		expect(bashUsesGuardedWebCommand("/usr/bin/curl https://example.com")).toBe(true);
		expect(bashUsesGuardedWebCommand("command curl https://example.com")).toBe(true);
		expect(bashUsesGuardedWebCommand("env TOKEN=value curl https://example.com")).toBe(true);
		expect(bashUsesGuardedWebCommand("printf ready | curl https://example.com")).toBe(true);
	});

	it("does not gate unrelated shell commands or curl mentioned as data", () => {
		expect(bashUsesGuardedWebCommand("wget https://example.com")).toBe(false);
		expect(bashUsesGuardedWebCommand("printf curl")).toBe(false);
	});
});

describe("vendoredDirForBash", () => {
	it("does not treat find filter operands as vendored reads", () => {
		expect(vendoredDirForBash("find pi-kit/extensions/session-dashboard -maxdepth 2 -type f -not -path '*/node_modules/*' -print")).toBeUndefined();
		expect(vendoredDirForBash("find . -path '*/node_modules/*' -prune -o -type f -print")).toBeUndefined();
	});

	it("does not treat common tool exclusion filters as vendored reads", () => {
		expect(vendoredDirForBash("rg -g '!node_modules/**' needle .")).toBeUndefined();
		expect(vendoredDirForBash("rg --glob='!node_modules/**' needle .")).toBeUndefined();
		expect(vendoredDirForBash("grep -r --exclude-dir node_modules needle .")).toBeUndefined();
		expect(vendoredDirForBash("grep -r --exclude-dir=node_modules needle .")).toBeUndefined();
		expect(vendoredDirForBash("tree -I node_modules .")).toBeUndefined();
		expect(vendoredDirForBash("tree --ignore=node_modules .")).toBeUndefined();
	});

	it("continues to identify effective vendored paths", () => {
		expect(vendoredDirForBash("find node_modules/untrusted-package -type f")).toBe("node_modules/untrusted-package");
		expect(vendoredDirForBash("rg needle node_modules/untrusted-package")).toBe("node_modules/untrusted-package");
	});

	it("keeps trusted package scopes exempt", () => {
		expect(vendoredDirForBash("sed -n '1,20p' node_modules/@earendil-works/pi-ai/index.ts")).toBeUndefined();
	});

	it("allows filter-only commands and blocks direct reads headlessly", async () => {
		let toolCall: ((event: unknown, ctx: unknown) => Promise<unknown>) | undefined;
		const pi = {
			events: { emit: vi.fn() },
			on: vi.fn((event: string, handler: (toolEvent: unknown, ctx: unknown) => Promise<unknown>) => {
				if (event === "tool_call") toolCall = handler;
			}),
			sendMessage: vi.fn(),
		};
		createPermissionGate(pi as never);

		const context = { cwd: process.cwd(), hasUI: false };
		await expect(toolCall?.({ toolName: "bash", input: { command: "find extensions/session-dashboard -not -path '*/node_modules/*' -type f" } }, context)).resolves.toBeUndefined();
		await expect(toolCall?.({ toolName: "bash", input: { command: "find node_modules/untrusted-package -type f" } }, context)).resolves.toMatchObject({ block: true });
		expect(pi.sendMessage).toHaveBeenCalledTimes(1);
	});

	it("blocks curl headlessly", async () => {
		let toolCall: ((event: unknown, ctx: unknown) => Promise<unknown>) | undefined;
		const pi = {
			events: { emit: vi.fn() },
			on: vi.fn((event: string, handler: (toolEvent: unknown, ctx: unknown) => Promise<unknown>) => {
				if (event === "tool_call") toolCall = handler;
			}),
			sendMessage: vi.fn(),
		};
		createPermissionGate(pi as never);

		await expect(
			toolCall?.({ toolName: "bash", input: { command: "curl https://example.com" } }, { cwd: process.cwd(), hasUI: false }),
		).resolves.toMatchObject({ block: true });
		expect(pi.sendMessage).toHaveBeenCalledWith(
			expect.objectContaining({ content: expect.stringContaining("blocked (no UI to confirm)") }),
			expect.anything(),
		);
	});

	it("allows an interactively approved curl call", async () => {
		let toolCall: ((event: unknown, ctx: unknown) => Promise<unknown>) | undefined;
		const pi = {
			events: { emit: vi.fn() },
			on: vi.fn((event: string, handler: (toolEvent: unknown, ctx: unknown) => Promise<unknown>) => {
				if (event === "tool_call") toolCall = handler;
			}),
			sendMessage: vi.fn(),
		};
		createPermissionGate(pi as never);
		const ui = { select: vi.fn().mockResolvedValue("Proceed"), input: vi.fn() };

		await expect(
			toolCall?.({ toolName: "bash", input: { command: "curl https://example.com" } }, { cwd: process.cwd(), hasUI: true, ui }),
		).resolves.toBeUndefined();
		expect(ui.select).toHaveBeenCalledWith(
			expect.stringContaining("Access the web via guarded shell command"),
			expect.arrayContaining(["Proceed", "Deny"]),
		);
	});

	it("does not mistake a sibling with the project path as a prefix for the project", async () => {
		let toolCall: ((event: unknown, ctx: unknown) => Promise<unknown>) | undefined;
		const pi = {
			events: { emit: vi.fn() },
			on: vi.fn((event: string, handler: (toolEvent: unknown, ctx: unknown) => Promise<unknown>) => {
				if (event === "tool_call") toolCall = handler;
			}),
			sendMessage: vi.fn(),
		};
		createPermissionGate(pi as never);
		await expect(
			toolCall?.(
				{ toolName: "write", input: { path: "/tmp/project-copy/file.ts" } },
				{ cwd: "/tmp/project", hasUI: false },
			),
		).resolves.toMatchObject({ block: true });
	});
});

describe("gate bypass regressions", () => {
	it("catches a destructive command invoked via an absolute/relative binary path", async () => {
		const { toolCall } = makeGate();
		await expect(
			toolCall({ toolName: "bash", input: { command: "/bin/rm -rf /tmp/whatever" } }, { cwd: process.cwd(), hasUI: false }),
		).resolves.toMatchObject({ block: true });
	});

	it("catches a destructive command hidden after a literal newline", async () => {
		const { toolCall } = makeGate();
		await expect(
			toolCall(
				{ toolName: "bash", input: { command: "printf hi\nrm -rf ./project-files" } },
				{ cwd: process.cwd(), hasUI: false },
			),
		).resolves.toMatchObject({ block: true });
	});

	it("catches git branch force-delete regardless of flag order", async () => {
		const { toolCall } = makeGate();
		await expect(
			toolCall(
				{ toolName: "bash", input: { command: "git branch --force --delete some-branch" } },
				{ cwd: process.cwd(), hasUI: false },
			),
		).resolves.toMatchObject({ block: true });
	});

	it("expands ~ before judging a write/edit path as in-project", async () => {
		const { toolCall } = makeGate();
		await expect(
			toolCall(
				{ toolName: "write", input: { path: "~/.ssh/authorized_keys" } },
				{ cwd: process.cwd(), hasUI: false },
			),
		).resolves.toMatchObject({ block: true });
	});

	it("treats an unresolved shell variable path as escaping the project, not exempt", async () => {
		const { toolCall } = makeGate();
		await expect(
			toolCall(
				{ toolName: "bash", input: { command: "find $HOME -name secret" } },
				{ cwd: process.cwd(), hasUI: false },
			),
		).resolves.toMatchObject({ block: true });
	});

	it("catches a write that lexically resolves in-project but escapes via a symlink", async () => {
		const root = mkdtempSync(join(tmpdir(), "gate-project-"));
		const outside = mkdtempSync(join(tmpdir(), "gate-outside-"));
		symlinkSync(outside, join(root, "escape"));

		const { toolCall } = makeGate();
		await expect(
			toolCall({ toolName: "write", input: { path: "escape/passwd" } }, { cwd: root, hasUI: false }),
		).resolves.toMatchObject({ block: true });
	});

	it("exempts trusted @earendil-works packages and .pi/agent git/cache paths from read and search gates", async () => {
		const { toolCall } = makeGate();
		await expect(
			toolCall(
				{ toolName: "read", input: { path: "~/.pi/agent/git/github.com/dhumdil-apps/pi-kit/skills/simplify/SKILL.md" } },
				{ cwd: process.cwd(), hasUI: false },
			),
		).resolves.toBeUndefined();

		await expect(
			toolCall(
				{
					toolName: "bash",
					input: {
						command:
							"find /Users/martin-peter.lakatos/.nvm/versions/node/v26.2.0/lib/node_modules/@earendil-works/pi-coding-agent/examples -type f",
					},
				},
				{ cwd: process.cwd(), hasUI: false },
			),
		).resolves.toBeUndefined();
	});
});
