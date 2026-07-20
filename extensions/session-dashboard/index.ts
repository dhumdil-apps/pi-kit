import { readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getAgentDir, loadProjectContextFiles } from "@earendil-works/pi-coding-agent";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Box, Markdown } from "@earendil-works/pi-tui";
import { collectUsageData } from "../usage-history/data.js";
import { renderExtensionDeck } from "./extensions.js";

const BUNDLE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const MAX_PANEL_ROW = 60;

async function git(pi: ExtensionAPI, cwd: string, args: string[]) {
	try {
		const res = await pi.exec("git", args, { cwd, timeout: 5000 });
		return res.code === 0 ? res.stdout.trim() : "";
	} catch {
		return "";
	}
}

function formatUsdSpend(cost: number): string {
	if (cost < 0.01) return `$${cost.toFixed(4)}`;
	if (cost < 1) return `$${cost.toFixed(2)}`;
	if (cost < 100) return `$${cost.toFixed(1)}`;
	return `$${Math.round(cost)}`;
}

function tildify(path: string): string {
	const home = homedir();
	return path.startsWith(home) ? `~${path.slice(home.length)}` : path;
}

function truncateLeft(text: string, max: number): string {
	return text.length <= max ? text : `…${text.slice(text.length - max + 1)}`;
}

interface BundleResources {
	extensions: string[];
	skills: string[];
	prompts: string[];
}

/** Name an extension entry like "./extensions/interactive-prompt/index.ts" → "interactive-prompt". */
function extensionName(entry: string): string {
	const parts = entry.split("/").filter((p) => p && p !== ".");
	const idx = parts.indexOf("extensions");
	return idx >= 0 && parts[idx + 1] ? parts[idx + 1] : (parts[0] ?? "");
}

function listSkills(dir: string): string[] {
	try {
		return readdirSync(dir, { withFileTypes: true })
			.filter((e) => e.isDirectory())
			.map((e) => e.name)
			.filter((name) => {
				try {
					readFileSync(join(dir, name, "SKILL.md"));
					return true;
				} catch {
					return false;
				}
			});
	} catch {
		return [];
	}
}

function listPrompts(dir: string): string[] {
	try {
		return readdirSync(dir)
			.filter((f) => f.endsWith(".md"))
			.map((f) => `/${basename(f, ".md")}`);
	} catch {
		return [];
	}
}

/** What this bundle registers, read live from its own package.json. */
function loadBundleResources(): BundleResources {
	try {
		const pkg = JSON.parse(readFileSync(join(BUNDLE_ROOT, "package.json"), "utf8"));
		const cfg = pkg?.pi ?? {};
		const extensions: string[] = (cfg.extensions ?? []).map(extensionName).filter(Boolean).sort();
		const skills: string[] = (cfg.skills ?? [])
			.flatMap((dir: string) => listSkills(join(BUNDLE_ROOT, dir)))
			.sort();
		const prompts: string[] = (cfg.prompts ?? [])
			.flatMap((dir: string) => listPrompts(join(BUNDLE_ROOT, dir)))
			.sort();
		return { extensions, skills, prompts };
	} catch {
		return { extensions: [], skills: [], prompts: [] };
	}
}

/** Context files exactly as pi core discovers them, formatted for display. */
function contextFileList(cwd: string): string[] {
	try {
		return loadProjectContextFiles({ cwd, agentDir: getAgentDir() }).map((f) => {
			const inProject = f.path.startsWith(`${cwd}/`);
			return inProject ? `./${f.path.slice(cwd.length + 1)}` : tildify(f.path);
		});
	} catch {
		return [];
	}
}

/** Box-drawing only inside the panel — emoji are double-width and break alignment. */
function renderPanel(rows: string[]): string {
	const width = Math.max(...rows.map((r) => r.length));
	const body = rows.map((r) => `│  ${r.padEnd(width)}  │`);
	return [`╭${"─".repeat(width + 4)}╮`, ...body, `╰${"─".repeat(width + 4)}╯`].join("\n");
}

export default function sessionDashboardExtension(pi: ExtensionAPI): void {
	pi.registerMessageRenderer("session-dashboard", (message, _options, theme) => {
		const content = typeof message.content === "string" ? message.content : message.content
			.filter((item) => item.type === "text")
			.map((item) => item.text)
			.join("\n");
		const box = new Box(1, 1, (text) => theme.bg("customMessageBg", text));
		box.addChild(
			new Markdown(content, 0, 0, {
				heading: (text) => theme.fg("mdHeading", text),
				link: (text) => theme.fg("mdLink", text),
				linkUrl: (text) => theme.fg("mdLinkUrl", text),
				code: (text) => theme.fg("mdCode", text),
				codeBlock: (text) => theme.fg("mdCodeBlock", text),
				codeBlockBorder: (text) => theme.fg("mdCodeBlockBorder", text),
				quote: (text) => theme.fg("mdQuote", text),
				quoteBorder: (text) => theme.fg("mdQuoteBorder", text),
				hr: (text) => theme.fg("mdHr", text),
				listBullet: (text) => theme.fg("mdListBullet", text),
				bold: (text) => theme.bold(text),
				italic: (text) => theme.italic(text),
				strikethrough: (text) => text,
				underline: (text) => theme.underline(text),
				highlightCode: (code) => code.split("\n").map((line) => theme.fg("mdCodeBlock", line)),
			}, { color: (text) => theme.fg("customMessageText", text) })
		);
		return box;
	});

	pi.on("session_start", async (_event, ctx) => {
		// Purely decorative banner: in headless/print mode it would land after the
		// prompt and trigger a spurious extra turn, so interactive sessions only.
		if (!ctx.hasUI) return;
		const cwd = ctx.cwd;
		const branch = (await git(pi, cwd, ["rev-parse", "--abbrev-ref", "HEAD"])) || "no git";
		const dirtyOutput = await git(pi, cwd, ["status", "--porcelain"]);
		const dirtyCount = dirtyOutput ? dirtyOutput.split("\n").filter(Boolean).length : 0;
		const usage = await collectUsageData().catch(() => null);

		const projectRow = `${truncateLeft(tildify(cwd), 34)}  ${branch} · ${
			dirtyCount === 0 ? "clean" : `${dirtyCount} modified`
		}`;
		const rows = [
			"▛▀▀▜ ▐▌",
			"▌  ▐ ▐▌   measure twice, cut once",
			"▘  ▝ ▝▘",
			"",
			`project  ${truncateLeft(projectRow, MAX_PANEL_ROW - 9)}`,
		];
		if (usage) {
			const spend = [
				`${formatUsdSpend(usage.today.totals.cost)} today`,
				`${formatUsdSpend(usage.last30Days.totals.cost)} 30d`,
				`${formatUsdSpend(usage.allTime.totals.cost)} all`,
			].join(" · ");
			rows.push(`spend    ${spend}`);
		}

		const bundle = loadBundleResources();
		const contextFiles = contextFileList(cwd);
		const sections: string[] = [];
		if (contextFiles.length > 0) {
			sections.push(`📜 **Context** · ${contextFiles.map((f) => `\`${f}\``).join(" · ")}`);
		}
		if (bundle.skills.length > 0) {
			sections.push(`🎓 **Skills** (${bundle.skills.length}) · ${bundle.skills.join(" · ")}`);
		}
		if (bundle.prompts.length > 0) {
			sections.push(`⌘ **Prompts** · ${bundle.prompts.map((p) => `\`${p}\``).join(" · ")}`);
		}

		const welcomeText = `
\`\`\`
${renderPanel(rows)}
\`\`\`

${sections.join("\n")}

## 🧭 GOAL → EXPLORE → ALIGN → BUILD → REVIEW

> **Describe the outcome.**
> I’ll read first, ask before deciding, validate the work, then simplify the result.
>

${bundle.extensions.length > 0 ? renderExtensionDeck(bundle.extensions) : ""}

⌨️ \`! <cmd>\` bash · \`/todos\` progress · \`/extension-settings\` settings · \`escape\` confirm cancel
`;

		pi.sendMessage(
			{
				customType: "session-dashboard",
				content: welcomeText.trim(),
				display: true,
			},
			{ triggerTurn: false }
		);
	});
}
