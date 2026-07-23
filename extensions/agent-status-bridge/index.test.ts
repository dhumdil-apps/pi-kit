import { describe, expect, it } from "vitest";
import { testing } from "./index.js";

describe("agent status bridge", () => {
  it("has no endpoint when no environment or discovery file exists", () => {
    expect(testing.resolveEndpoint({}, "/definitely-missing")).toBeUndefined();
  });

  it("prefers generic environment configuration", () => {
    expect(testing.resolveEndpoint({ AGENT_STATUS_URL: "http://127.0.0.1:1", AGENT_STATUS_TOKEN: "token" })).toEqual({
      url: "http://127.0.0.1:1",
      token: "token",
    });
  });
});
