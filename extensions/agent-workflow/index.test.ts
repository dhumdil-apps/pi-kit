import { describe, expect, it, vi } from "vitest";
import createExtension from "./index.js";

function harness() {
	const handlers = new Map<string, (event?: any) => any>();
	const commands = new Map<string, { handler: (args: string, ctx: any) => Promise<void> }>();
	const emitted: Array<[string, unknown]> = [];
	const messages: string[] = [];
	const pi = {
		on: vi.fn((name: string, handler: (event?: any) => any) => handlers.set(name, handler)),
		registerCommand: vi.fn((name: string, command: any) => commands.set(name, command)),
		sendUserMessage: vi.fn((message: string) => messages.push(message)),
		events: { emit: vi.fn((name: string, value: unknown) => emitted.push([name, value])) },
	};
	createExtension(pi as any);
	return { handlers, commands, emitted, messages };
}

describe("agent workflow lifecycle", () => {
	it("activates Flash, exposes runtime guidance, and brakes on ordinary input", async () => {
		const { handlers, commands, emitted, messages } = harness();
		await commands.get("flash")!.handler("", {});
		expect(messages.at(-1)).toContain("[workflow-command:flash]");
		expect(emitted.at(-1)?.[1]).toMatchObject({ id: "flash", text: "flash", transient: true });

		const active = await handlers.get("before_agent_start")!({ systemPrompt: "base" });
		expect(active.systemPrompt).toContain('flash="active"');
		handlers.get("input")!({ source: "user" });
		expect(emitted.at(-1)?.[1]).toEqual({ id: "flash", text: undefined });
		const stopped = await handlers.get("before_agent_start")!({ systemPrompt: "base" });
		expect(stopped.systemPrompt).toContain('flash="off"');
	});

	it("does not brake Flash for extension-authored input and clears it at agent end", async () => {
		const { handlers, commands, emitted } = harness();
		await commands.get("flash")!.handler("", {});
		handlers.get("input")!({ source: "extension" });
		const active = await handlers.get("before_agent_start")!({ systemPrompt: "base" });
		expect(active.systemPrompt).toContain('flash="active"');
		handlers.get("agent_end")!();
		expect(emitted.at(-1)?.[1]).toEqual({ id: "flash", text: undefined });
	});

	it("injects bounded session evidence for reflection commands", async () => {
		const { commands, messages } = harness();
		const ctx = { sessionManager: { getBranch: () => [] } };
		await commands.get("retro")!.handler("", ctx);
		expect(messages.at(-1)).toContain("[workflow-command:retro]");
		expect(messages.at(-1)).toContain("<session_evidence>");
		await commands.get("forensic")!.handler("raw", ctx);
		expect(messages.at(-1)).toContain("[workflow-command:forensic:raw]");
		expect(messages.at(-1)).toContain('raw="true"');
	});

	it("injects command ownership and pre-commit inspection discipline", async () => {
		const { handlers } = harness();
		const prompt = await handlers.get("before_agent_start")!({ systemPrompt: "base" });
		expect(prompt.systemPrompt).toContain("repository or package manifest that owns the command");
		expect(prompt.systemPrompt).toContain("git status --short");
		expect(prompt.systemPrompt).toContain("Separate pre-existing changes");
		expect(prompt.systemPrompt).toContain("before planning changes");
		expect(prompt.systemPrompt).toContain("never silently overwrite or absorb them");
		expect(prompt.systemPrompt).toContain("state the conflict and selected resolution");
	});
});
