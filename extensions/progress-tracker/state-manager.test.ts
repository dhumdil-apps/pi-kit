import { describe, expect, it } from "vitest";
import { CLEAR_ENTRY_TYPE, TodoStateManager } from "./state-manager.js";

describe("TodoStateManager workflow phase", () => {
  it("starts at goal and changes independently from todos", () => {
    const state = new TodoStateManager();
    expect(state.getPhase()).toBe("goal");

    state.write([{ id: 1, title: "Implement feature", description: "Do the work", status: "in-progress" }]);
    state.setPhase("implementation");

    expect(state.getPhase()).toBe("implementation");
    expect(state.read()).toHaveLength(1);
  });

  it("reconstructs the latest persisted phase and todo state", () => {
    const state = new TodoStateManager();
    state.loadFromSession({
      sessionManager: {
        getBranch: () => [
          {
            type: "message",
            message: {
              role: "toolResult",
              toolName: "manage_todo_list",
              details: { operation: "phase", phase: "planning", todos: [] },
            },
          },
          {
            type: "message",
            message: {
              role: "toolResult",
              toolName: "manage_todo_list",
              details: {
                operation: "write",
                phase: "implementation",
                todos: [{ id: 1, title: "Validate", description: "Run checks", status: "completed" }],
              },
            },
          },
        ],
      },
    } as any);

    expect(state.getPhase()).toBe("implementation");
    expect(state.getStats().completed).toBe(1);
  });

  it("maps legacy persisted phase values and ignores malformed ones", () => {
    const legacy = new TodoStateManager();
    legacy.loadFromSession({
      sessionManager: {
        getBranch: () => [
          { type: "message", message: { role: "toolResult", toolName: "manage_todo_list", details: { phase: "measure", todos: [] } } },
          { type: "message", message: { role: "toolResult", toolName: "manage_todo_list", details: { phase: "cut", todos: [] } } },
        ],
      },
    } as any);
    expect(legacy.getPhase()).toBe("implementation");

    const malformed = new TodoStateManager();
    malformed.loadFromSession({
      sessionManager: {
        getBranch: () => [{ type: "message", message: { role: "toolResult", toolName: "manage_todo_list", details: { phase: "unknown", todos: [] } } }],
      },
    } as any);
    expect(malformed.getPhase()).toBe("goal");
  });

  it("rejects more than one in-progress todo", () => {
    const state = new TodoStateManager();
    const result = state.validate([
      { id: 1, title: "First", description: "First task", status: "in-progress" },
      { id: 2, title: "Second", description: "Second task", status: "in-progress" },
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Only one todo may be in progress at a time");
  });

  it("replays a clear marker (as sent by index.ts's /todos clear) so the cleared list is not resurrected", () => {
    const fresh = new TodoStateManager();
    fresh.loadFromSession({
      sessionManager: {
        getBranch: () => [
          {
            type: "message",
            message: {
              role: "toolResult",
              toolName: "manage_todo_list",
              details: {
                operation: "write",
                phase: "implementation",
                todos: [{ id: 1, title: "Do thing", description: "Do the thing", status: "in-progress" }],
              },
            },
          },
          {
            type: "custom_message",
            customType: CLEAR_ENTRY_TYPE,
            content: "",
            display: false,
          },
        ],
      },
    } as any);

    expect(fresh.read()).toHaveLength(0);
  });

  it("a write after a clear marker still wins on replay", () => {
    const fresh = new TodoStateManager();
    fresh.loadFromSession({
      sessionManager: {
        getBranch: () => [
          {
            type: "message",
            message: {
              role: "toolResult",
              toolName: "manage_todo_list",
              details: { operation: "write", todos: [{ id: 1, title: "Old", description: "d", status: "completed" }] },
            },
          },
          {
            type: "custom_message",
            customType: CLEAR_ENTRY_TYPE,
            content: "",
            display: false,
          },
          {
            type: "message",
            message: {
              role: "toolResult",
              toolName: "manage_todo_list",
              details: { operation: "write", todos: [{ id: 2, title: "New", description: "d", status: "not-started" }] },
            },
          },
        ],
      },
    } as any);

    expect(fresh.read()).toEqual([{ id: 2, title: "New", description: "d", status: "not-started" }]);
  });
});
