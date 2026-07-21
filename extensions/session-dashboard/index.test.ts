import { homedir } from "node:os";
import { describe, expect, it } from "vitest";
import { RulerText, tildify } from "./index.js";

describe("tildify", () => {
	it("tildifies a path under the home directory", () => {
		const home = homedir();
		expect(tildify(`${home}/projects/foo`)).toBe("~/projects/foo");
	});

	it("tildifies the home directory itself", () => {
		expect(tildify(homedir())).toBe("~");
	});

	it("does not mistake a sibling directory that merely shares the home dir as a prefix", () => {
		const home = homedir();
		const sibling = `${home}-backup/projects/foo`;
		expect(tildify(sibling)).toBe(sibling);
	});

	it("leaves paths outside the home directory untouched", () => {
		expect(tildify("/var/log/foo")).toBe("/var/log/foo");
	});
});

describe("RulerText", () => {
	const lines = ["  __________", '|"""""""""""|', "|  1  2  π  |", "'-----------'"];

	it("renders every line verbatim when the width fits", () => {
		const ruler = new RulerText(lines, (s) => s);
		expect(ruler.render(80)).toEqual(lines);
	});

	it("clips each line to the container width instead of word-wrapping it", () => {
		const ruler = new RulerText(lines, (s) => s);
		const rendered = ruler.render(5);
		// Every line clipped to the same column — still aligned, unlike word-wrap
		// which would break the space-containing line at a different column than
		// the border lines.
		expect(rendered).toEqual(lines.map((l) => l.slice(0, 5)));
	});

	it("applies the color function to the (possibly clipped) line", () => {
		const ruler = new RulerText(["abcdef"], (s) => `[${s}]`);
		expect(ruler.render(3)).toEqual(["[abc]"]);
	});
});
