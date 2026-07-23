import { describe, expect, it, vi } from "vitest";
import { MODE_UPDATE_EVENT } from "../agent-workflow/mode.js";
import createExtension from "./index.js";

function harness() {
  const handlers = new Map<string, Array<(event: unknown, ctx: unknown) => Promise<void>>>();
  const listeners = new Map<string, Array<(value: unknown) => void>>();
  const pi = {
    on: vi.fn((name: string, handler: (event: unknown, ctx: unknown) => Promise<void>) => {
      handlers.set(name, [...(handlers.get(name) ?? []), handler]);
    }),
    events: {
      on: vi.fn((name: string, listener: (value: unknown) => void) => {
        listeners.set(name, [...(listeners.get(name) ?? []), listener]);
      }),
    },
    registerTool: vi.fn(),
    registerCommand: vi.fn(),
    sendMessage: vi.fn(),
  };
  createExtension(pi as any);
  return { handlers, listeners };
}

describe("progress tracker workflow mode", () => {
  it("rerenders the persistent indicator when workflow mode changes", async () => {
    const { handlers, listeners } = harness();
    const widgets: Array<[string, any]> = [];
    const ctx = {
      isIdle: () => true,
      getContextUsage: () => ({ tokens: 84_000, contextWindow: 1_000_000, percent: 8.4 }),
      sessionManager: { getBranch: () => [] },
      ui: {
        setWorkingVisible: () => {},
        setWidget: (id: string, factory: unknown) => widgets.push([id, factory]),
      },
    };

    await handlers.get("session_start")![0]({}, ctx);
    listeners.get(MODE_UPDATE_EVENT)![0]("review");

    const [, factory] = widgets.findLast(([id]) => id === "workflow-phase")!;
    const component = factory({ requestRender: () => {} }, { fg: (color: string, text: string) => `[${color}]${text}` });
    expect(component.render(80)).toEqual(["[accent]● REVIEW · [accent]ctx [accent]▰[dim]▱▱▱ [accent]8% (84.0k / 1.0M)"]);
  });
});
