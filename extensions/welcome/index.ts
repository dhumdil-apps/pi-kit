import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { getSetting } from "../extension-settings/index.js";

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
    const autoPlan = getSetting("plan-mode", "auto-start", "on") === "on";

    const nextSteps = autoPlan
      ? `🧭 **Plan mode is ACTIVE (quick)** — describe your goal and I will explore read-only, ask focused questions, and propose a plan with an Execute/Refine menu.
• Prefer thorough planning: \`/plan deep\` • Skip planning this session: \`/plan off\``
      : `🧭 Auto-planning is off. Start it with \`/plan\` (quick) or \`/plan deep\` (thorough).`;

    const welcomeText = `
\`\`\`
${BANNER}
\`\`\`

📂 **Project**: \`${cwd}\` · branch \`${branch}\` · ${dirtyCount === 0 ? "clean" : `${dirtyCount} modified`}${activePlan === "None" ? "" : `\n• **Active Plan**: ${activePlan}`}

${nextSteps}

🧩 **Extensions**
• **plan-mode** — auto-planning with review phase; \`/plan deep|off|execute|resume|status\`
• **permission-gate** — confirms only destructive commands (\`rm -rf\`, \`git reset --hard\`, \`sudo\`…)
• **memory** — \`.pi/MEMORY.md\` decisions & learnings, injected each turn; \`/memory\` to view
• **manage-todo-list** — live task progress widget; \`/todos\`
• **subagents** — delegate to focused child sessions (\`subagent\` tool); \`/subagents\`
• **web-access** — \`web_search\` / \`fetch_content\` tools, zero-config
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
