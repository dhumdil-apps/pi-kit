---
name: pi-subagents
description: |
  Delegate work serially to the two builtin subagents: explorer (read-only
  exploration, research, and review) and coder (write/edit implementation).
  Only load this skill when subagent execution is enabled (it is OFF by
  default — check the subagent tool description first; when disabled, work
  inline and skip this skill). The parent session is the architect — it owns
  the plan and all decisions, and delegates to protect its own context window.
  One child at a time, always foreground, always on the parent's model and
  thinking level.
---

# Pi Subagents

**Check the kill switch first.** Subagent execution is disabled by default. If the `subagent` tool description says execution is DISABLED, or an execution call returns the disabled message, stop here: do all work inline in this session and do not plan around delegation. The user enables it via /extension-settings → pi-subagents → enabled.

This skill is for the main parent session only. Do not inject or follow it inside spawned child subagents. Children never launch their own subagents.

## The model

The parent session is the **architect**: it keeps the big picture, makes every product/architecture/scope decision, and validates all work. It delegates for one reason — to protect its own context window. Exploring a large codebase or grinding through mechanical edits pollutes the architect's context and loses focus from the goal; a child absorbs that cost and returns only the distilled result.

Two builtin agents exist:

- **explorer** — read-only. Explores the codebase, researches focused questions, reviews diffs/plans/implementations. Never modifies anything. Returns compressed findings with file/line evidence.
- **coder** — write/edit only. Implements exactly the delegated change. Does not run checks or tests; the architect validates after it returns.

## Rules

- **Serial only.** Run at most one subagent at a time, always foreground. Never pass `tasks` (parallel), `async: true`, or chain steps with `parallel`/`expand`. Wait for each child to finish and read its result before deciding the next step.
- **Same model, same thinking.** Children always inherit the parent's model and thinking level. Do not pass `model` overrides.
- **Delegate to save context, not to decide.** Give each child a self-contained task with the exact scope, relevant file paths, and what to return. A child result is input to the architect's judgment, never the final word.
- **One writer.** Only `coder` edits files, and only one `coder` run exists at a time. The architect applies its own judgment (and its own edits, when small) between runs.
- **Validate in the parent.** After a `coder` run, the architect runs the checks/tests itself, or delegates a review to `explorer`.

## When to delegate vs. work inline

Delegate to `explorer` when understanding the target means reading many files whose contents you don't need verbatim afterward. Delegate to `coder` when the change is well-specified and mechanical enough that a fresh context with the task description can execute it. Work inline when the task is small, when you already hold the needed context, or when subagents are disabled.

## Tool usage

- `{ action: "list" }` — discover executable agents before launching.
- `{ agent: "explorer" | "coder", task: "..." }` — the only execution form: single agent, foreground.
- `{ action: "status", id: "..." }` — inspect a run.
- Management actions (`get`, `create`, `update`, `delete`, `eject`, `disable`, `enable`, `reset`, `doctor`) work as before for agent authoring.

Slash commands for humans: `/run` (single agent), `/subagent-cost`, `/subagents-doctor`.

## Task shape

Every delegated task should contain: the goal in one sentence; the exact files or areas in scope; constraints (what not to touch); and the expected return (findings format for explorer, changed-files report for coder). Do not rely on the child seeing the parent conversation — fresh context is the default and the point.
