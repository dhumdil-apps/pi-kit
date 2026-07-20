import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { collectUsageData } from "../usage-extension/data.js";

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

const BANNER = [
  "┌────────────────────────────────┐",
  "│  ██████╗  ██╗   pi-bundle      │",
  "│  ██╔══██╗ ██║   ─────────      │",
  "│  ██████╔╝ ██║   measure twice, │",
  "│  ██╔═══╝  ██║   cut once       │",
  "│  ╚═╝      ╚═╝                  │",
  "└────────────────────────────────┘",
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
    const usage = await collectUsageData().catch(() => null);
    const usageSummary = usage
      ? `📊 **Usage (USD)**: Today ${formatUsdSpend(usage.today.totals.cost)} · 30 days ${formatUsdSpend(usage.last30Days.totals.cost)} · All time ${formatUsdSpend(usage.allTime.totals.cost)}`
      : "";

    const welcomeText = `
\`\`\`
${BANNER}
\`\`\`

📂 **Project**: \`${cwd}\` · branch \`${branch}\` · ${dirtyCount === 0 ? "clean" : `${dirtyCount} modified`}${usageSummary ? `\n${usageSummary}` : ""}

🧭 **Your flow**

\`GOAL\` → \`EXPLORE\` → \`ALIGN\` → \`BUILD\` → \`REVIEW\`
*Describe the outcome — I’ll read first, ask before deciding, validate the work, then simplify the result. Web research always asks first.*

🧩 **On duty**
\`Safety\` permission gate · \`Context\` memory · \`Progress\` todos · \`Research\` web · \`Status\` powerbar · \`Spend\` usage · \`Decisions\` ask-user

⌨️ \`! <cmd>\` bash · \`/todos\` progress · \`/memory\` decisions · \`/extension-settings\` settings · \`escape\` cancel
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
