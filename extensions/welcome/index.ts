import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { getSetting } from "../extension-settings/index.js";
import { collectUsageData } from "../usage-extension/data.js";

async function git(pi: ExtensionAPI, cwd: string, args: string[]) {
  try {
    const res = await pi.exec("git", args, { cwd, timeout: 5000 });
    return res.code === 0 ? res.stdout.trim() : "";
  } catch {
    return "";
  }
}

interface PlanState {
  goal: string;
  phase: string;
  todos: Array<{ status: string }>;
}

function formatUsdSpend(cost: number): string {
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  if (cost < 1) return `$${cost.toFixed(2)}`;
  if (cost < 100) return `$${cost.toFixed(1)}`;
  return `$${Math.round(cost)}`;
}

async function getActivePlan(cwd: string): Promise<string> {
  try {
    const planDir = join(cwd, ".pi", "plans");
    const files = await readdir(planDir).catch(() => [] as string[]);
    const stateFiles = files.filter(f => f.endsWith(".state.json"));
    for (const file of stateFiles) {
      const content = await readFile(join(planDir, file), "utf8").catch(() => "");
      if (!content) continue;
      const state = JSON.parse(content) as PlanState;
      if (!["complete", "awaiting-goal"].includes(state.phase)) {
        const completed = state.todos.filter(t => t.status === "completed").length;
        const total = state.todos.length;
				const statusStr = state.phase === "blocked" ? "⚠️ Blocked" : `🧭 ${state.phase[0].toUpperCase()}${state.phase.slice(1)}`;
        return `[${statusStr}] ${state.goal} (${completed}/${total} steps)`;
      }
    }
  } catch {}
  return "None";
}

const BANNER = [
  "┌─────────────────────────────┐",
  "│  ██████╗  ██╗   pi-bundle   │",
  "│  ██╔══██╗ ██║   ─────────   │",
  "│  ██████╔╝ ██║   plan first, │",
  "│  ██╔═══╝  ██║   then build  │",
  "│  ╚═╝      ╚═╝               │",
  "└─────────────────────────────┘",
].join("\n");

export default function welcomeExtension(pi: ExtensionAPI): void {
  pi.on("session_start", async (_event, ctx) => {
    // Purely decorative banner: in headless/print mode it would land after the
    // prompt and trigger a spurious extra turn, so interactive sessions only.
    if (!ctx.hasUI) return;
    const cwd = ctx.cwd;
    const branch = await git(pi, cwd, ["rev-parse", "--abbrev-ref", "HEAD"]) || "unknown";
    const dirtyOutput = await git(pi, cwd, ["status", "--porcelain"]);
    const dirtyCount = dirtyOutput ? dirtyOutput.split("\n").filter(Boolean).length : 0;
    const activePlan = await getActivePlan(cwd);
    const usage = await collectUsageData().catch(() => null);
    const usageSummary = usage
      ? `📊 **Usage (USD)**: Today ${formatUsdSpend(usage.today.totals.cost)} · 30 days ${formatUsdSpend(usage.last30Days.totals.cost)} · All time ${formatUsdSpend(usage.allTime.totals.cost)}`
      : "";
    const autoPlan = getSetting("plan-mode", "auto-start", "on") === "on";

    const nextSteps = autoPlan
      ? `🧭 **Plan mode is ACTIVE (quick)** — describe your goal. A truly local, unambiguous change stays inline; standard work runs read → decisions → an inline plan draft → approval.
• Thorough planning: \`/plan deep\` • Skip planning: \`/plan off\` • Resume: \`/plan resume <slug>\``
      : `🧭 Auto-planning is off. Start it with \`/plan\` (quick) or \`/plan deep\` (thorough).`;

    const welcomeText = `
\`\`\`
${BANNER}
\`\`\`

📂 **Project**: \`${cwd}\` · branch \`${branch}\` · ${dirtyCount === 0 ? "clean" : `${dirtyCount} modified`}${activePlan === "None" ? "" : `\n• **Active Plan**: ${activePlan}`}${usageSummary ? `\n${usageSummary}` : ""}

${nextSteps}

🧩 **Extensions**
• **plan-mode** — persistent orchestrated plans, scoped checkpoints, validation, and one review/fix pass; \`/plan deep|off|execute|resume|status\`
• **permission-gate** — confirms only destructive commands (\`rm -rf\`, \`git reset --hard\`, \`sudo\`…)
• **memory** — \`.pi/MEMORY.md\` decisions & learnings, injected each turn; \`/memory\` to view
• **manage-todo-list** — live task progress widget; \`/todos\`
• **web-access** — \`web_search\` / \`fetch_content\`; defaults to automatic cited summaries
• **powerbar** — status footer: git, tokens, context %, quota; \`/extension-settings\` to tune
• **usage** — historical spend & token analytics; \`/usage\`
• **ask-user** — the question/confirm modal used across plan mode and the gate

ℹ️ *\`! <cmd>\` runs bash directly · \`ctrl+c\`/\`ctrl+d\` clear/exit · \`escape\` cancels a running tool.*
`;

    pi.sendMessage(
      {
        customType: "welcome",
        content: welcomeText.trim(),
        display: true,
      },
      { triggerTurn: false }
    );
  });
}
