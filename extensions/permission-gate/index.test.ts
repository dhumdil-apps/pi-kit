import { describe, expect, it, vi } from "vitest";

const { askUserFancyMock } = vi.hoisted(() => ({ askUserFancyMock: vi.fn() }));

vi.mock("../extension-settings/index.js", () => ({ getSetting: () => "on" }));
vi.mock("../ask-user/index", () => ({ askUserFancy: askUserFancyMock }));

import createPermissionGate, { bashUsesGuardedWebCommand, vendoredDirForBash } from "./index.js";

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
		expect(vendoredDirForBash("find pi-bundle/extensions/welcome -maxdepth 2 -type f -not -path '*/node_modules/*' -print")).toBeUndefined();
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
		await expect(toolCall?.({ toolName: "bash", input: { command: "find extensions/welcome -not -path '*/node_modules/*' -type f" } }, context)).resolves.toBeUndefined();
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
		askUserFancyMock.mockResolvedValueOnce({ kind: "selection", selections: ["Proceed"] });
		createPermissionGate(pi as never);

		await expect(
			toolCall?.({ toolName: "bash", input: { command: "curl https://example.com" } }, { cwd: process.cwd(), hasUI: true }),
		).resolves.toBeUndefined();
		expect(askUserFancyMock).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({ question: expect.stringContaining("Access the web via guarded shell command") }),
		);
	});
});
