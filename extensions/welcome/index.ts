import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

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

async function getActivePlan(cwd: string): Promise<string> {
  try {
    const planDir = join(cwd, ".pi", "plans");
    const files = await readdir(planDir).catch(() => [] as string[]);
    const stateFiles = files.filter(f => f.endsWith(".state.json"));
    for (const file of stateFiles) {
      const content = await readFile(join(planDir, file), "utf8").catch(() => "");
      if (!content) continue;
      const state = JSON.parse(content) as PlanState;
      if (state.phase === "executing" || state.phase === "blocked") {
        const completed = state.todos.filter(t => t.status === "completed").length;
        const total = state.todos.length;
        const statusStr = state.phase === "blocked" ? "⚠️ Blocked" : "⚡ Executing";
        return `[${statusStr}] ${state.goal} (${completed}/${total} steps)`;
      }
    }
  } catch {}
  return "None";
}

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

    const welcomeText = `

📂 **Project Status**:
• **CWD**: \`${cwd}\`
• **Git Branch**: \`${branch}\`
• **Modified Files**: ${dirtyCount === 0 ? "_None_" : `\`${dirtyCount}\` file(s)`}
• **Active Plan**: ${activePlan === "None" ? "_None_" : activePlan}

⚡ **Quick Commands**:
• \`/plan\` — Start interactive Planning Mode (Quick or Deep)
• \`/extension-settings\` — Configure settings for all extensions
• \`/usage\` — View token and provider usage statistics
• \`! <cmd>\` — Execute a bash command directly in the shell

ℹ️ *Tip: You can use \`ctrl+c\` / \`ctrl+d\` to clear or exit, and \`escape\` to cancel a running tool.*
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
