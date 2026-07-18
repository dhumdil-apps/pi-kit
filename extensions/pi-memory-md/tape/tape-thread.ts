import fs from "node:fs";
import path from "node:path";
import { escapeXml, nowIso, toTimestamp } from "../utils.js";

export type TapeThreadStatus = "active" | "paused" | "archived";

export type TapeThreadRouting = {
  keywords?: string[];
  paths?: string[];
};

export type TapeThread = {
  id: string;
  name: string;
  rootNodeIds: string[];
  headNodeId?: string;
  status: TapeThreadStatus;
  routing?: TapeThreadRouting;
  createdAt: string;
  updatedAt: string;
};

export type TapeThreadNode = {
  id: string;
  threadId: string;
  parentNodeId?: string;
  parentSummary?: string;
  branchName?: string;
  branchPath: string[];
  summary: string;
  decisions?: string[];
  next?: string[];
  files?: string[];
  memory?: string[];
  createdAt: string;
  updatedAt: string;
};

export type TapeThreadNodePatch = {
  summary?: string;
  decisionsAdd?: string[];
  nextAdd?: string[];
  nextRemove?: string[];
  filesAdd?: string[];
  memoryAdd?: string[];
};

export type TapeThreadBranch = {
  name: string;
  fromNodeId: string;
  toNodeIds: string[];
};

export type TapeThreadTreeNode = {
  nodeId: string;
  children: TapeThreadTreeNode[];
};

export type TapeThreadRecordValue = {
  thread: TapeThread;
  nodes: TapeThreadNode[];
  branches: TapeThreadBranch[];
  tree: TapeThreadTreeNode[];
};

export type TapeThreadRecord = Record<string, TapeThreadRecordValue>;

export type TapeThreadView = {
  threads: Map<string, TapeThread>;
  nodes: Map<string, TapeThreadNode>;
  branches: Map<string, TapeThreadBranch[]>;
};

export type TapeThreadStatusView = {
  thread: TapeThread;
  head?: TapeThreadNode;
  path: TapeThreadNode[];
};

function parseThreadRecord(line: string): TapeThreadRecord | null {
  try {
    const parsed = JSON.parse(line) as TapeThreadRecord;
    return typeof parsed === "object" && parsed !== null && !("type" in parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function buildThreadTree(thread: TapeThread, nodes: TapeThreadNode[]): TapeThreadTreeNode[] {
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const childrenByParent = new Map<string, TapeThreadNode[]>();

  for (const node of nodes) {
    if (!node.parentNodeId) continue;
    childrenByParent.set(node.parentNodeId, [...(childrenByParent.get(node.parentNodeId) ?? []), node]);
  }

  const buildNode = (node: TapeThreadNode): TapeThreadTreeNode => ({
    nodeId: node.id,
    children: (childrenByParent.get(node.id) ?? []).map(buildNode),
  });

  return thread.rootNodeIds.flatMap((nodeId) => {
    const node = nodesById.get(nodeId);
    return node ? [buildNode(node)] : [];
  });
}

function toThreadRecord(thread: TapeThread, nodes: TapeThreadNode[], branches: TapeThreadBranch[]): TapeThreadRecord {
  return {
    [thread.name]: {
      thread,
      nodes,
      branches,
      tree: buildThreadTree(thread, nodes),
    },
  };
}

function includesText(value: unknown, needle: string): boolean {
  if (value === undefined || value === null) return false;
  return JSON.stringify(value).toLowerCase().includes(needle);
}

function mergeUnique(current: string[] | undefined, additions: string[] | undefined): string[] | undefined {
  if (!additions?.length) return current;
  return [...new Set([...(current ?? []), ...additions.map((item) => item.trim()).filter(Boolean)])];
}

function applyNodePatch(node: TapeThreadNode, patch: Partial<TapeThreadNode>): TapeThreadNode {
  return {
    ...node,
    ...Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined)),
    decisions: mergeUnique(node.decisions, patch.decisions),
    next: patch.next ?? node.next,
    files: mergeUnique(node.files, patch.files),
    memory: mergeUnique(node.memory, patch.memory),
  };
}

function assertNonEmpty(value: string, fieldName: string): void {
  if (value.trim().length === 0) throw new Error(`${fieldName} is required`);
}

function assertMutableThread(thread: TapeThread): void {
  if (thread.status === "archived") throw new Error(`Thread is archived: ${thread.name}`);
}

function normalizeThread(
  thread: TapeThread & { rootNodeId?: string; anchorId?: string },
  nodes: TapeThreadNode[],
): TapeThread {
  const rootNodeIds =
    thread.rootNodeIds ??
    (thread.rootNodeId ? [thread.rootNodeId] : nodes.filter((node) => !node.parentNodeId).map((node) => node.id));
  const { rootNodeId: _rootNodeId, anchorId: _anchorId, ...normalized } = thread;
  return { ...normalized, rootNodeIds };
}

function normalizeBranch(branch: TapeThreadBranch & { toNodeId?: string }): TapeThreadBranch {
  return {
    name: branch.name,
    fromNodeId: branch.fromNodeId,
    toNodeIds: branch.toNodeIds ?? (branch.toNodeId ? [branch.toNodeId] : []),
  };
}

function applyRecord(view: TapeThreadView, record: TapeThreadRecord): void {
  for (const value of Object.values(record)) {
    const thread = normalizeThread(value.thread, value.nodes);
    view.threads.set(thread.id, thread);
    view.branches.set(thread.id, value.branches.map(normalizeBranch));
    for (const node of value.nodes) view.nodes.set(node.id, node);
  }
}

export class TapeThreadStore {
  private readonly filePath: string;

  constructor(tapeBasePath: string, projectName: string) {
    fs.mkdirSync(tapeBasePath, { recursive: true });
    this.filePath = path.join(tapeBasePath, `${projectName}__threads.jsonl`);
  }

  createThread(name: string): TapeThreadStatusView {
    assertNonEmpty(name, "Thread name");
    const view = this.load();
    if ([...view.threads.values()].some((thread) => thread.name === name))
      throw new Error(`Thread already exists: ${name}`);

    const timestamp = nowIso();
    const thread: TapeThread = {
      id: crypto.randomUUID(),
      name,
      rootNodeIds: [],
      status: "active",
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    view.threads.set(thread.id, thread);
    view.branches.set(thread.id, []);
    this.save(view);
    return { thread, path: [] };
  }

  createRootNode(anchorId: string, summary: string, threadId?: string): TapeThreadStatusView {
    assertNonEmpty(anchorId, "Anchor id");
    assertNonEmpty(summary, "Root node summary");
    const view = this.load();
    const thread = this.resolveThread(view, threadId);
    assertMutableThread(thread);

    const timestamp = nowIso();
    const node: TapeThreadNode = {
      id: anchorId,
      threadId: thread.id,
      branchPath: [summary],
      summary,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    const updatedThread = {
      ...thread,
      rootNodeIds: [...thread.rootNodeIds, node.id],
      headNodeId: node.id,
      updatedAt: timestamp,
    };
    view.threads.set(updatedThread.id, updatedThread);
    view.nodes.set(node.id, node);
    this.save(view);
    return { thread: updatedThread, head: node, path: [node] };
  }

  createBranch(branchName: string, threadId?: string): TapeThreadStatusView {
    assertNonEmpty(branchName, "Branch name");
    const view = this.load();
    const thread = this.resolveThread(view, threadId);
    assertMutableThread(thread);
    const parent = thread.headNodeId ? view.nodes.get(thread.headNodeId) : undefined;
    if (!parent) throw new Error(`Thread has no HEAD node: ${thread.name}`);

    const branches = view.branches.get(thread.id) ?? [];
    if (branches.some((branch) => branch.fromNodeId === parent.id && branch.name === branchName)) {
      throw new Error(`Branch already exists from HEAD: ${branchName}`);
    }

    const timestamp = nowIso();
    const updatedThread = { ...thread, updatedAt: timestamp };
    view.threads.set(updatedThread.id, updatedThread);
    view.branches.set(thread.id, [...branches, { name: branchName, fromNodeId: parent.id, toNodeIds: [] }]);
    this.save(view);
    return { thread: updatedThread, head: parent, path: this.buildPath(view.nodes, parent) };
  }

  createNode(anchorId: string, summary: string, branchName?: string, threadId?: string): TapeThreadStatusView {
    assertNonEmpty(anchorId, "Anchor id");
    assertNonEmpty(summary, "Node summary");
    const view = this.load();
    const thread = this.resolveThread(view, threadId);
    assertMutableThread(thread);
    const parent = thread.headNodeId ? view.nodes.get(thread.headNodeId) : undefined;
    if (!parent) throw new Error(`Thread has no HEAD node: ${thread.name}`);

    const timestamp = nowIso();
    const node: TapeThreadNode = {
      id: anchorId,
      threadId: thread.id,
      parentNodeId: parent.id,
      parentSummary: parent.summary,
      branchName,
      branchPath: [...parent.branchPath, branchName ?? summary],
      summary,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    const updatedThread = { ...thread, headNodeId: node.id, updatedAt: timestamp };
    view.threads.set(updatedThread.id, updatedThread);
    view.nodes.set(node.id, node);
    if (branchName) this.attachNodeToBranch(view, thread.id, parent.id, branchName, node.id);
    this.save(view);
    return { thread: updatedThread, head: node, path: this.buildPath(view.nodes, node) };
  }

  checkout(nodeId: string, threadId?: string): TapeThreadStatusView {
    const view = this.load();
    const node = view.nodes.get(nodeId);
    if (!node) throw new Error(`Thread node not found: ${nodeId}`);
    const thread = this.resolveThread(view, threadId ?? node.threadId);
    assertMutableThread(thread);
    if (node.threadId !== thread.id) throw new Error(`Node does not belong to thread: ${thread.name}`);

    const timestamp = nowIso();
    const updatedThread = { ...thread, headNodeId: node.id, updatedAt: timestamp };
    view.threads.set(updatedThread.id, updatedThread);
    this.save(view);
    return {
      thread: updatedThread,
      head: node,
      path: this.buildPath(view.nodes, node),
    };
  }

  archive(threadId?: string): TapeThread {
    const view = this.load();
    const thread = this.resolveThread(view, threadId);
    const timestamp = nowIso();
    const archived = { ...thread, status: "archived" as const, updatedAt: timestamp };
    view.threads.set(archived.id, archived);
    this.save(view);
    return archived;
  }

  updateHead(patch: TapeThreadNodePatch, threadId?: string): TapeThreadStatusView {
    const view = this.load();
    const thread = this.resolveThread(view, threadId);
    assertMutableThread(thread);
    const head = thread.headNodeId ? view.nodes.get(thread.headNodeId) : undefined;
    if (!head) throw new Error(`Thread has no HEAD node: ${thread.name}`);

    const timestamp = nowIso();
    const nextValues = mergeUnique(head.next, patch.nextAdd)?.filter((item) => !patch.nextRemove?.includes(item));
    const nodePatch: Partial<TapeThreadNode> = {
      ...(patch.summary !== undefined ? { summary: patch.summary } : {}),
      ...(patch.decisionsAdd?.length ? { decisions: mergeUnique(head.decisions, patch.decisionsAdd) } : {}),
      ...(nextValues !== undefined ? { next: nextValues } : {}),
      ...(patch.filesAdd?.length ? { files: mergeUnique(head.files, patch.filesAdd) } : {}),
      ...(patch.memoryAdd?.length ? { memory: mergeUnique(head.memory, patch.memoryAdd) } : {}),
    };

    const updatedHead = applyNodePatch(head, { ...nodePatch, updatedAt: timestamp });
    const updatedThread = { ...thread, updatedAt: timestamp };
    view.threads.set(updatedThread.id, updatedThread);
    view.nodes.set(updatedHead.id, updatedHead);
    this.save(view);
    return {
      thread: updatedThread,
      head: updatedHead,
      path: this.buildPath(view.nodes, updatedHead),
    };
  }

  status(threadId?: string): TapeThreadStatusView | null {
    const view = this.load();
    const thread = this.resolveOptionalThread(view, threadId);
    if (!thread) return null;
    const head = thread.headNodeId ? view.nodes.get(thread.headNodeId) : undefined;
    return { thread, head, path: head ? this.buildPath(view.nodes, head) : [] };
  }

  buildResumeContext(threadId?: string): string {
    const status = this.status(threadId);
    if (!status) return "<tape_thread />\nUse tape_read only if more history is needed.";

    const lines = [
      "<tape_thread>",
      `<name>${escapeXml(status.thread.name)}</name>`,
      status.head ? `<head>${escapeXml(status.head.branchPath.join("/"))}</head>` : undefined,
      "<path>",
      ...status.path.map((node) => `- ${escapeXml(node.branchName ?? node.summary)}: ${escapeXml(node.summary)}`),
      "</path>",
      status.head?.summary ? `<summary>${escapeXml(status.head.summary)}</summary>` : undefined,
      this.renderList("decisions", status.head?.decisions),
      this.renderList("next", status.head?.next),
      this.renderList("files", status.head?.files),
      this.renderList("memory", status.head?.memory),
      status.head ? `<anchor id="${status.head.id}" />` : undefined,
      "</tape_thread>",
      "Use tape_read only if more history is needed.",
    ];
    return lines.filter(Boolean).join("\n");
  }

  search(query?: string, includeArchived = false): TapeThreadStatusView[] {
    const view = this.load();
    const needle = query?.trim().toLowerCase();
    const results = [...view.threads.values()]
      .filter((thread) => includeArchived || thread.status !== "archived")
      .map((thread) => {
        const head = thread.headNodeId ? view.nodes.get(thread.headNodeId) : undefined;
        return { thread, head, path: head ? this.buildPath(view.nodes, head) : [] };
      })
      .filter((item) => {
        if (!needle) return true;
        const threadNodes = [...view.nodes.values()].filter((node) => node.threadId === item.thread.id);
        return includesText(item, needle) || includesText(threadNodes, needle);
      })
      .sort((left, right) => toTimestamp(right.thread.updatedAt) - toTimestamp(left.thread.updatedAt));
    return results;
  }

  load(): TapeThreadView {
    const view: TapeThreadView = { threads: new Map(), nodes: new Map(), branches: new Map() };
    if (!fs.existsSync(this.filePath)) return view;

    const lines = fs
      .readFileSync(this.filePath, "utf-8")
      .split("\n")
      .filter((line) => line.trim());
    for (const line of lines) {
      const record = parseThreadRecord(line);
      if (record) applyRecord(view, record);
    }
    return view;
  }

  clear(): void {
    if (fs.existsSync(this.filePath)) fs.unlinkSync(this.filePath);
  }

  private resolveOptionalThread(view: TapeThreadView, threadId?: string): TapeThread | null {
    if (threadId) return view.threads.get(threadId) ?? null;
    return this.search()[0]?.thread ?? null;
  }

  private resolveThread(view: TapeThreadView, threadId?: string): TapeThread {
    const thread = this.resolveOptionalThread(view, threadId);
    if (!thread) throw new Error(threadId ? `Thread not found: ${threadId}` : "No active thread");
    return thread;
  }

  private attachNodeToBranch(
    view: TapeThreadView,
    threadId: string,
    fromNodeId: string,
    branchName: string,
    nodeId: string,
  ): void {
    const branches = view.branches.get(threadId) ?? [];
    const index = branches.findIndex((branch) => branch.fromNodeId === fromNodeId && branch.name === branchName);
    const branch = branches[index] ?? { name: branchName, fromNodeId, toNodeIds: [] };
    const updatedBranch = { ...branch, toNodeIds: [...new Set([...branch.toNodeIds, nodeId])] };
    const updatedBranches =
      index === -1 ? [...branches, updatedBranch] : branches.map((item, i) => (i === index ? updatedBranch : item));
    view.branches.set(threadId, updatedBranches);
  }

  private buildPath(nodes: Map<string, TapeThreadNode>, node: TapeThreadNode): TapeThreadNode[] {
    const pathNodes: TapeThreadNode[] = [];
    let current: TapeThreadNode | undefined = node;
    while (current) {
      pathNodes.unshift(current);
      current = current.parentNodeId ? nodes.get(current.parentNodeId) : undefined;
    }
    return pathNodes;
  }

  private renderList(tag: string, values?: string[]): string | undefined {
    if (!values?.length) return undefined;
    return [`<${tag}>`, ...values.map((value) => `- ${escapeXml(value)}`), `</${tag}>`].join("\n");
  }

  private save(view: TapeThreadView): void {
    const records = [...view.threads.values()]
      .sort((left, right) => toTimestamp(right.updatedAt) - toTimestamp(left.updatedAt))
      .map((thread) => {
        const nodes = [...view.nodes.values()]
          .filter((node) => node.threadId === thread.id)
          .sort((left, right) => toTimestamp(left.createdAt) - toTimestamp(right.createdAt));
        return JSON.stringify(toThreadRecord(thread, nodes, view.branches.get(thread.id) ?? []));
      });

    fs.writeFileSync(this.filePath, `${records.join("\n")}${records.length ? "\n" : ""}`, "utf-8");
  }
}
