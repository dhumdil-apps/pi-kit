import type { ExtensionAPI, Theme } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { Type } from "typebox";
import type { MemoryMdSettings } from "../types.js";
import { formatTimeSuffix } from "../utils.js";
import { mutatesTapeThread, shouldBlockTapeThreadAction } from "./tape-gate.js";
import type { TapeService } from "./tape-service.js";
import type { TapeThreadNodePatch, TapeThreadStatusView } from "./tape-thread.js";
import type { RenderState } from "./tape-types.js";

function renderText(text: string): Text {
  return new Text(text, 0, 0);
}

const unavailableResult = {
  content: [{ type: "text" as const, text: "Tape runtime is unavailable." }],
  details: { unavailable: true },
};

function threadActionBlockedResult(trigger: "direct" | "manual", reason: string) {
  return {
    content: [{ type: "text" as const, text: reason }],
    details: { disabled: true, handoffMode: "manual", allowedTriggers: ["manual"], trigger },
  };
}

function getResultText(result: { content: Array<{ type: string; text?: string }> }): string {
  return result.content[0]?.text ?? "";
}

function formatThreadStatus(status: TapeThreadStatusView | null): string {
  if (!status) return "No active thread.";
  const path = status.path.map((node) => node.branchName ?? node.summary).join(" > ");
  return [
    `Thread: ${status.thread.name}`,
    `Status: ${status.thread.status}`,
    `HEAD: ${status.head?.id ?? "none"}`,
    `Path: ${path || "none"}`,
    status.head?.summary ? `Summary: ${status.head.summary}` : undefined,
    status.head?.parentNodeId ? `Parent: ${status.head.parentNodeId}` : undefined,
    status.head?.parentSummary ? `Parent summary: ${status.head.parentSummary}` : undefined,
  ]
    .filter(Boolean)
    .join("\n");
}

function formatSearchResults(results: TapeThreadStatusView[]): string {
  if (results.length === 0) return "No threads found.";
  return results
    .map((item) => {
      const head = item.head ? ` head=${item.head.id}` : "";
      const path = item.path.map((node) => node.branchName ?? node.summary).join(" > ");
      return `- ${item.thread.name} [${item.thread.status}]${head}\n  id=${item.thread.id}\n  path=${path || "none"}\n  summary=${item.head?.summary ?? ""}`;
    })
    .join("\n");
}

function createThread(tapeService: TapeService, name: string) {
  if (!name) throw new Error("Thread name is required");
  return tapeService.getThreadStore().createThread(name);
}

function branchThread(tapeService: TapeService, branchName: string, threadId?: string) {
  if (!branchName) throw new Error("Branch name is required");
  const current = tapeService.getThreadStore().status(threadId);
  if (!current) throw new Error(threadId ? `Thread not found: ${threadId}` : "No active thread");
  return tapeService.getThreadStore().createBranch(branchName, current.thread.id);
}

function createNode(
  tapeService: TapeService,
  summary: string,
  branchName?: string,
  threadId?: string,
  trigger: "direct" | "manual" = "direct",
) {
  if (!summary) throw new Error("Node summary is required");
  const current = tapeService.getThreadStore().status(threadId);
  if (!current) throw new Error(threadId ? `Thread not found: ${threadId}` : "No active thread");
  const branchSuffix = branchName ? `-${branchName}` : "";
  const anchor = tapeService.createAnchor(
    `thread/${current.thread.name}${branchSuffix}-${formatTimeSuffix()}-[node]`,
    "thread",
    {
      summary,
      trigger,
    },
  );
  return tapeService.getThreadStore().createNode(anchor.id, summary, branchName, current.thread.id);
}

function createRootNode(
  tapeService: TapeService,
  summary: string,
  threadId?: string,
  trigger: "direct" | "manual" = "direct",
) {
  if (!summary) throw new Error("Root node summary is required");
  const current = tapeService.getThreadStore().status(threadId);
  if (!current) throw new Error(threadId ? `Thread not found: ${threadId}` : "No active thread");
  const anchor = tapeService.createAnchor(`thread/${current.thread.name}-${formatTimeSuffix()}-[root-node]`, "thread", {
    summary,
    trigger,
  });
  return tapeService.getThreadStore().createRootNode(anchor.id, summary, current.thread.id);
}

function formatActionResult(action: string, result: unknown): string {
  if (action === "resume") return result as string;
  if (action === "archive") return `Archived thread: ${(result as { name: string }).name}`;
  if (action === "search") return formatSearchResults(result as TapeThreadStatusView[]);
  return formatThreadStatus(result as TapeThreadStatusView | null);
}

function formatActionDetails(action: string, result: unknown): unknown {
  if (action === "resume") return { context: result };
  if (action === "search") return { results: result };
  return result ?? {};
}

const ThreadActionUnion = Type.Union([
  Type.Literal("create"),
  Type.Literal("root"),
  Type.Literal("branch"),
  Type.Literal("node"),
  Type.Literal("checkout"),
  Type.Literal("status"),
  Type.Literal("update"),
  Type.Literal("resume"),
  Type.Literal("archive"),
  Type.Literal("search"),
]);

export function registerAllTapeThreadTools(
  pi: ExtensionAPI,
  getTapeService: () => TapeService | null,
  getSettings: () => MemoryMdSettings,
  consumeThreadTrigger: () => "manual" | null = () => null,
): void {
  pi.registerTool({
    name: "tape_thread",
    label: "Tape Thread",
    description: "Manage TapeThread with action=create/root/branch/node/checkout/status/update/resume/archive/search",
    parameters: Type.Object({
      action: Type.Unsafe({ ...ThreadActionUnion, description: "Thread action" }),
      name: Type.Optional(Type.String({ description: "Thread name for create" })),
      summary: Type.Optional(Type.String({ description: "Thread or node summary" })),
      branchName: Type.Optional(Type.String({ description: "Branch name" })),
      nodeId: Type.Optional(Type.String({ description: "Node id for checkout" })),
      threadId: Type.Optional(Type.String({ description: "Thread id, defaults to active thread" })),
      query: Type.Optional(Type.String({ description: "Search query" })),
      includeArchived: Type.Optional(Type.Boolean({ description: "Include archived threads in search" })),
      decisionsAdd: Type.Optional(Type.Array(Type.String(), { description: "Decisions to add" })),
      nextAdd: Type.Optional(Type.Array(Type.String(), { description: "Next tasks to add" })),
      nextRemove: Type.Optional(Type.Array(Type.String(), { description: "Next tasks to remove exactly" })),
      filesAdd: Type.Optional(Type.Array(Type.String(), { description: "Relevant files to add" })),
      memoryAdd: Type.Optional(Type.Array(Type.String(), { description: "Memory links to add" })),
    }),
    async execute(_id, params) {
      const tapeService = getTapeService();
      if (!tapeService) return unavailableResult as never;

      const { action, name, summary, branchName, nodeId, threadId, query, includeArchived, ...patch } =
        params as TapeThreadNodePatch & {
          action: string;
          name?: string;
          summary?: string;
          branchName?: string;
          nodeId?: string;
          threadId?: string;
          query?: string;
          includeArchived?: boolean;
        };
      const trigger = mutatesTapeThread(action) ? (consumeThreadTrigger() ?? "direct") : "direct";
      const blockedReason = shouldBlockTapeThreadAction(getSettings(), action, trigger);
      if (blockedReason) return threadActionBlockedResult(trigger, blockedReason) as never;

      const threadStore = tapeService.getThreadStore();
      let result: unknown;
      switch (action) {
        case "create":
          result = createThread(tapeService, name?.trim() ?? "");
          break;
        case "root":
          result = createRootNode(tapeService, summary?.trim() ?? "", threadId?.trim(), trigger);
          break;
        case "branch":
          result = branchThread(tapeService, branchName?.trim() ?? "", threadId?.trim());
          break;
        case "node":
          result = createNode(
            tapeService,
            summary?.trim() ?? "",
            branchName?.trim() || undefined,
            threadId?.trim(),
            trigger,
          );
          break;
        case "checkout":
          if (!nodeId?.trim()) throw new Error("Node id is required");
          result = threadStore.checkout(nodeId.trim(), threadId?.trim());
          break;
        case "status":
          result = threadStore.status(threadId?.trim());
          break;
        case "update":
          result = threadStore.updateHead({ ...patch, summary: summary?.trim() }, threadId?.trim());
          break;
        case "resume":
          result = threadStore.buildResumeContext(threadId?.trim());
          break;
        case "archive":
          result = threadStore.archive(threadId?.trim());
          break;
        case "search":
          result = threadStore.search(query?.trim(), includeArchived);
          break;
        default:
          throw new Error(`Unsupported TapeThread action: ${action}`);
      }

      return {
        content: [{ type: "text", text: formatActionResult(action, result) }],
        details: formatActionDetails(action, result),
      };
    },
    renderCall(args, theme) {
      const target = args.name ?? args.branchName ?? args.nodeId ?? args.threadId ?? args.query ?? "active";
      return renderText(
        theme.fg("toolTitle", theme.bold("tape_thread ")) + theme.fg("accent", `${args.action}:${target}`),
      );
    },
    renderResult(result, state: RenderState, theme: Theme) {
      if (state.isPartial) return renderText(theme.fg("warning", "Managing thread..."));
      return renderText(theme.fg("toolOutput", getResultText(result)));
    },
  });
}
