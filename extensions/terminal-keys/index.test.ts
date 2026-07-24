import { describe, expect, it } from "vitest";
import { rewriteKey, shouldRewriteNewline } from "./index.js";

describe("shouldRewriteNewline", () => {
	it("enables the rewrite in VS Code, where a bare newline can only be ctrl+j", () => {
		expect(shouldRewriteNewline("auto", "vscode", false)).toBe(true);
	});

	it("enables the rewrite under the Kitty protocol, where it is a no-op", () => {
		expect(shouldRewriteNewline("auto", "ghostty", true)).toBe(true);
	});

	it("stays out of the way on an unproven legacy terminal", () => {
		expect(shouldRewriteNewline("auto", "Apple_Terminal", false)).toBe(false);
		expect(shouldRewriteNewline("auto", undefined, false)).toBe(false);
	});

	it("honours the explicit overrides", () => {
		expect(shouldRewriteNewline("always", undefined, false)).toBe(true);
		expect(shouldRewriteNewline("off", "vscode", true)).toBe(false);
	});
});

describe("rewriteKey", () => {
	it("submits on ctrl+enter reported as CSI u", () => {
		expect(rewriteKey("\x1b[13;5u", false)).toBe("\r");
	});

	it("submits on ctrl+enter reported as modifyOtherKeys", () => {
		expect(rewriteKey("\x1b[27;5;13~", false)).toBe("\r");
	});

	it("turns a lone ctrl+j into shift+enter", () => {
		expect(rewriteKey("\n", true)).toBe("\x1b[13;2u");
	});

	it("leaves Enter alone", () => {
		expect(rewriteKey("\r", true)).toBeUndefined();
	});

	it("leaves a bracketed paste alone even though it contains newlines", () => {
		expect(rewriteKey("\x1b[200~first\nsecond\x1b[201~", true)).toBeUndefined();
	});

	it("leaves a multi-line chunk alone", () => {
		expect(rewriteKey("a\nb", true)).toBeUndefined();
	});

	it("leaves the newline untouched when the rewrite is disabled", () => {
		expect(rewriteKey("\n", false)).toBeUndefined();
	});

	it("leaves ordinary typing alone", () => {
		expect(rewriteKey("x", true)).toBeUndefined();
	});
});
