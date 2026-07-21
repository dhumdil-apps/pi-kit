import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";
import { ManageTodoListParams } from "./tool.js";

describe("manage_todo_list phase schema", () => {
  it.each(["goal", "planning", "implementation"])('accepts the %s phase', (phase) => {
    expect(Value.Check(ManageTodoListParams, { operation: "phase", phase })).toBe(true);
  });

  it.each(["measure", "cut"])('rejects legacy %s phase input', (phase) => {
    expect(Value.Check(ManageTodoListParams, { operation: "phase", phase })).toBe(false);
  });
});
