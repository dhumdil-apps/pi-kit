import { describe, expect, it } from "vitest";
import { detectProvider } from "./detection.js";

describe("detectProvider", () => {
	it("does not misdetect AWS Bedrock (provider: amazon-bedrock) as Kiro", () => {
		expect(detectProvider({ provider: "amazon-bedrock", id: "claude-3-5-sonnet" })).toBeUndefined();
	});

	it("still detects kiro from its own provider token", () => {
		expect(detectProvider({ provider: "kiro", id: "whatever" })).toBe("kiro");
	});

	it("detects anthropic from provider token", () => {
		expect(detectProvider({ provider: "anthropic", id: "claude-sonnet" })).toBe("anthropic");
	});

	it("falls back to model tokens only when provider is unset", () => {
		expect(detectProvider({ id: "claude-sonnet" })).toBe("anthropic");
		expect(detectProvider({ provider: "some-custom-gateway", id: "claude-sonnet" })).toBeUndefined();
	});
});
