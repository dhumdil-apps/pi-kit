# TapeThread Design

TapeThread is a lightweight semantic layer over tape anchors for long-running user intent.

It is inspired by durable threads, but it is not a cloned chat-thread model. In pi-memory-md, the durable source of truth already exists:

- pi session JSONL stores conversation history
- tape anchors mark important checkpoints
- memory markdown stores long-term curated knowledge

TapeThread only adds a small, branchable structure on top of anchors.

## Core Metaphor

```txt
anchor = commit
TapeThread = branchable tape-backed intent line
TapeThreadNode = semantic checkpoint over an anchor
HEAD = current working position
branch = alternate path from a checkpoint
```

A thread is the main concept. The tree/graph shape is only its internal organization.

## Goals

- Maintain long-running user work lines with minimal token cost
- Support branching and rollback to key decision points
- Reuse existing tape anchors instead of creating a new history store
- Keep thread context compact and explicit
- Avoid automatic memory pollution

## Non-goals

- Do not duplicate pi session history
- Do not store full conversation transcripts in thread state
- Do not add a new tape anchor type initially
- Do not automatically rewrite memory markdown every turn

## Relationship to Tape

Tape remains the timeline layer.

```txt
TapeAnchor = where something happened
TapeThreadNode = why that checkpoint matters
TapeThread = where this work line currently points
```

TapeThread uses a dedicated anchor type:

```ts
type TapeAnchorType = "session" | "handoff" | "thread";
```

A TapeThreadNode is backed by an existing `thread` anchor. The node `id` is the anchor id.

Thread anchors should use readable names:

```txt
thread/{threadName}
thread/{threadName}-{HHMMSS}-[root-node]
thread/{threadName}-{branchName}-{HHMMSS}-[node]
```

Thread creation uses `thread/{threadName}`. Top-level root nodes use `[root-node]`. Branch child nodes use `[node]` and keep the branch name in the anchor name.
The JSONL thread record remains the structured source of branch state and should make the current branch, nodes, and parent relationships obvious without replaying operations.

## Data Model

### TapeThread

```ts
type TapeThread = {
  id: string;
  name: string;
  anchorId: string;
  rootNodeIds: string[];
  headNodeId?: string;
  status: "active" | "paused" | "archived";
  routing?: TapeThreadRouting;
  createdAt: string;
  updatedAt: string;
};
```

### TapeThreadNode

```ts
type TapeThreadNode = {
  id: string; // anchor id
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
```

## Storage

Use a compact JSONL state store under the tape path.

```txt
{tapePath}/{projectName}__threads.jsonl
```

Record shape: each JSONL line is the current state of one thread. The thread name is the top-level field; the value stores the thread metadata, nodes, and explicit branch edges.

```ts
type TapeThreadBranch = {
  name: string;
  fromNodeId: string;
  toNodeId: string;
};

type TapeThreadTreeNode = {
  nodeId: string;
  children: TapeThreadTreeNode[];
};

type TapeThreadRecord = Record<
  string,
  {
    thread: TapeThread;
    nodes: TapeThreadNode[];
    branches: TapeThreadBranch[];
    tree: TapeThreadTreeNode[];
  }
>;
```

Rewrite the thread's state record for HEAD movement, archive, or node metadata updates. Do not store operation records such as `thread_created`, `node_created`, or `head_updated`.

A thread can contain multiple top-level root nodes. `branches` are named directions from one node to another, while `tree` is a derived forest view containing only node IDs.

## Configuration

TapeThread is enabled by default when tape mode is enabled. Users can explicitly disable it with:

```json
{
  "pi-memory-md": {
    "tape": {
      "enabled": true,
      "thread": false
    }
  }
}
```

Disabling TapeThread keeps normal tape anchors and tape tools available, but does not register `tape_thread` or `/memory-thread`.

## Minimal Tool Set

TapeThread exposes one tool with action-based dispatch:

```txt
tape_thread
```

Supported actions:

```txt
create
root
branch
checkout
status
update
resume
archive
search
```

### tape_thread action=create

Creates a new tape thread.

Flow:

```txt
create tape thread anchor named thread/{threadName}
create TapeThread(anchorId = anchor.id, rootNodeIds = [])
set active thread
```

## Slash Command

### /memory-thread

Natural-language command for TapeThread management.

```txt
/memory-thread <prompt>
```

Examples:

```txt
/memory-thread 后端 auth 重构
/memory-thread 删除 dashboard UI thread
/memory-thread checkout pi-memory-md tape mode
/memory-thread list threads
/memory-thread 更新当前 thread：下一步实现 checkout
```

This is the preferred user-authorized entry point for managing long-running thread lines.
The thread name remains the core semantic hint for future routing and maintenance.

Intent handling:

- Create when the user clearly asks to create/start a thread
- Delete/archive when the prompt contains clear delete/archive intent
- Checkout/switch when the prompt asks to switch or resume a thread
- Search when the prompt asks to find/search/list/show threads
- Update when the prompt asks to update current thread state
- If no clear action word exists and the prompt is just an intent/topic, ask whether to create a related thread

Create flow:

```txt
user prompt with clear create/start intent
create tape thread anchor named thread/{threadName}
create TapeThread(anchorId = anchor.id, rootNodeIds = [])
set active thread
```

Ambiguous prompt flow:

```txt
user prompt without clear action word
ask: 是否要为这个意图创建 thread？
only create after user confirms
```

The agent should not create many new threads autonomously. User-confirmed threads are the primary source of truth.

### tape_thread action=root

Creates another top-level node in the current thread and moves HEAD to it.

Flow:

```txt
current thread
create tape thread anchor named thread/{threadName}-{HHMMSS}-[root-node]
create root TapeThreadNode(id = anchor.id, parentNodeId = undefined, branchPath = [summary])
append node id to thread.rootNodeIds
update thread HEAD
```

### tape_thread action=branch

Creates a named direction from the current HEAD to a child node.

Flow:

```txt
current HEAD
create tape thread anchor named thread/{threadName}-{branchName}-{HHMMSS}-[node]
create TapeThreadNode(id = anchor.id, parentNodeId = HEAD, parentSummary = HEAD.summary, branchName, branchPath)
update thread HEAD
```

### tape_thread action=checkout

Moves HEAD to an existing node.

No node history is changed. Only `thread.headNodeId` changes in the thread state record. The thread `updatedAt` should also advance so search/list reflects recent activity.

### tape_thread action=status

Returns compact current context:

- thread name
- current path
- HEAD summary
- decisions
- next tasks
- files
- memory links

### tape_thread action=search

Searches threads by name, status, branch, summary, files, memory links, or recent update time.

With no query, it behaves like list/show and returns threads by recent update time.

## Resume Context

TapeThread should resume with a compact context, not full history.

Example:

```xml
<tape_thread>
<name>release workflow</name>
<head>backend-auth/jwt-refresh</head>
<path>
- root: release planning
- backend-auth: chose backend auth line
- jwt-refresh: implementing refresh rotation
</path>
<summary>Implementing refresh token rotation.</summary>
<decisions>
- Use rotating refresh tokens.
</decisions>
<next>
- Add middleware tests.
</next>
<files>
- server/auth.ts
</files>
<anchor id="..." />
</tape_thread>
```

Add a short instruction:

```txt
Use tape_read only if more history is needed.
```

## Maintenance Strategy

Use semi-automatic maintenance.

Update a TapeThread only when there is clear evidence:

- user explicitly switches or resumes a thread
- user creates a branch/checkpoint
- a tape anchor marks an important transition
- edited/read files clearly match an active thread

Avoid updating when relevance is ambiguous.

Suggested update fields:

```ts
type TapeThreadNodePatch = {
  summary?: string;
  decisionsAdd?: string[];
  nextAdd?: string[];
  nextRemove?: string[];
  filesAdd?: string[];
  memoryAdd?: string[];
};
```

Prefer small patches over rewriting the whole node.

## Routing Between Threads

Threads support lightweight routing hints derived from the user-defined thread name:

```ts
type TapeThreadRouting = {
  keywords?: string[];
  paths?: string[];
};
```

`name` is the primary semantic signal. `routing` is a compact helper that can be derived by the agent or updated later.

Relevance can be scored from:

- user prompt keywords
- active project file paths
- tape anchor summary/purpose
- current active thread boost

Maintenance policy:

- user-defined thread name first
- automatic routing second
- update only with high confidence
- ask the user when multiple threads match strongly
- do nothing when relevance is unclear

## Implementation Phases

### Phase 1

- Add `tape/tape-thread.ts`
- Store per-thread state records in `{tapePath}/{projectName}__threads.jsonl`
- Implement create, branch, checkout, status, search over thread nodes/tree state
- Resolve the active thread from recent non-archived state
- Add `/memory-thread <prompt>` as the user-authorized natural-language thread command
- Add `tape/tape-thread-tools.ts`
- Register tools when tape is enabled
- Add README documentation

### Phase 2

- Add archive/update/resume tools
- Add compact resume context builder
- Add routing hints
- Integrate with `/memory-review` or a future UI panel

### Phase 3

- Optional automatic suggestions after handoff anchors
- Optional branch visualization
- Optional digest from TapeThread state into memory markdown

## Final Definition

TapeThread is a branchable, low-token tape-backed intent line over tape anchors.

It lets users preserve long-running work context without turning every session into a full transcript replay.
