/**
 * manage_todo_list tool — replicates GitHub Copilot's manage_todo_list.
 *
 * Single tool with two operations:
 * - read:  Return the current todo list
 * - write: Replace the entire todo list (complete replacement, not partial)
 */

import type {
  Theme,
  ExtensionContext,
  AgentToolUpdateCallback,
  AgentToolResult,
  ToolRenderResultOptions,
} from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { Type, type Static } from "@sinclair/typebox";
import type { TodoDetails } from "./types.js";
import type { TodoStateManager } from "./state-manager.js";
import { progressBar, STATUS_ICONS } from "./ui/todo-widget.js";

// --- Schema ---

const TodoItemSchema = Type.Object({
  id: Type.Number({ description: "Unique identifier for the todo. Use sequential numbers starting from 1." }),
  title: Type.String({ description: "Concise action-oriented todo label (3-7 words). Displayed in UI." }),
  description: Type.String({
    description: "Detailed context, requirements, or implementation notes. Include file paths, specific methods, or acceptance criteria.",
  }),
  status: Type.Union([Type.Literal("not-started"), Type.Literal("in-progress"), Type.Literal("completed")], {
    description: "not-started: Not begun | in-progress: Currently working (only one at a time) | completed: Fully finished with no blockers",
  }),
});

export const ManageTodoListParams = Type.Object({
  operation: Type.Union([Type.Literal("write"), Type.Literal("read"), Type.Literal("phase")], {
    description:
      "write: Replace the todo list. read: Retrieve current state. phase: Update only the GOAL/MEASURE/CUT workflow phase.",
  }),
  phase: Type.Optional(
    Type.Union([Type.Literal("goal"), Type.Literal("measure"), Type.Literal("cut")], {
      description: "Required for phase operation. Tracks workflow independently from implementation todos.",
    }),
  ),
  todoList: Type.Optional(
    Type.Array(TodoItemSchema, {
      description:
        "Complete array of all todo items (required for write operation, ignored for read). Must include ALL items - both existing and new.",
    })
  ),
});

export type ManageTodoListInput = Static<typeof ManageTodoListParams>;

// --- Tool Description ---

export const TOOL_DESCRIPTION = `Track the high-level workflow phase and a structured local todo list.

Workflow phases:
- goal: session starting point and project overview
- measure: discovery, questions, rubric, and plan approval
- cut: implementation, validation, review, documentation, and follow-up learning

Use operation=phase at each transition. Phase updates never create or replace todos.
The local todo list is independent of the workflow phase and may track discovery, planning, implementation, and validation work.

When to use this tool:
- Complex multi-step work requiring planning and tracking
- When user provides multiple tasks or requests (numbered/comma-separated)
- After receiving new instructions that require multiple steps
- BEFORE starting work on any todo (mark as in-progress)
- IMMEDIATELY after completing each todo (mark completed individually)
- When breaking down larger tasks into smaller actionable steps
- To give users visibility into your progress and planning

When NOT to use:
- Single, trivial tasks that can be completed in one step
- Purely conversational/informational requests
- When just reading files or performing simple searches

CRITICAL workflow:
1. Plan tasks by writing todo list with specific, actionable items
2. Mark todo(s) as in-progress before starting work
3. Complete the work for that specific todo
4. Mark that todo as completed IMMEDIATELY
5. Move to next todo and repeat

Todo states:
- not-started: Todo not yet begun
- in-progress: Currently working (only one at a time)
- completed: Finished successfully

IMPORTANT: Mark todos completed as soon as they are done. Do not batch completions.`;

// --- Tool Factory ---

export function createManageTodoListTool(
  state: TodoStateManager,
  onUpdate: (operation: Extract<ManageTodoListInput["operation"], "phase" | "write">) => void
) {
  return {
    name: "manage_todo_list",
    label: "Todo List",
    description: TOOL_DESCRIPTION,
    parameters: ManageTodoListParams,

    async execute(
      _toolCallId: string,
      params: ManageTodoListInput,
      _signal: AbortSignal | undefined,
      _onStreamUpdate: AgentToolUpdateCallback<TodoDetails | undefined> | undefined,
      _ctx: ExtensionContext
    ) {
      if (params.operation === "read") {
        const todos = state.read();
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ phase: state.getPhase(), todos }, null, 2),
            },
          ],
          details: { operation: "read", todos, phase: state.getPhase() } as TodoDetails,
        };
      }

      if (params.operation === "phase") {
        if (!params.phase) {
          return {
            content: [{ type: "text" as const, text: "Error: phase is required for phase operation." }],
            details: { operation: "phase", todos: state.read(), phase: state.getPhase(), error: "phase required" } as TodoDetails,
            isError: true,
          };
        }
        state.setPhase(params.phase);
        onUpdate("phase");
        return {
          content: [{ type: "text" as const, text: `Workflow phase changed to ${params.phase.toUpperCase()}.` }],
          details: { operation: "phase", todos: state.read(), phase: state.getPhase() } as TodoDetails,
        };
      }

      // --- write ---
      const todoList = params.todoList;
      if (!todoList || !Array.isArray(todoList)) {
        return {
          content: [{ type: "text" as const, text: "Error: todoList is required for write operation." }],
          details: { operation: "write", todos: state.read(), phase: state.getPhase(), error: "todoList required" } as TodoDetails,
          isError: true,
        };
      }

      const validation = state.validate(todoList);
      if (!validation.valid) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Validation failed:\n${validation.errors.map((e) => `  - ${e}`).join("\n")}`,
            },
          ],
          details: { operation: "write", todos: state.read(), phase: state.getPhase(), error: validation.errors.join("; ") } as TodoDetails,
          isError: true,
        };
      }

      state.write(todoList);
      onUpdate("write");

      const stats = state.getStats();
      const todos = state.read();

      let message = `Todos have been modified successfully. ${stats.completed}/${stats.total} completed. Ensure that you continue to use the todo list to track your progress. Please proceed with the current tasks if applicable.`;
      
      if (todoList.length < 3) {
        message += `\n\nWarning: Small todo list (<3 items). This task might not need a todo list.`;
      }

      return {
        content: [
          {
            type: "text" as const,
            text: message,
          },
        ],
        details: { operation: "write", todos, phase: state.getPhase() } as TodoDetails,
      };
    },

    renderCall(args: ManageTodoListInput, theme: Theme) {
      let text = theme.fg("toolTitle", theme.bold("manage_todo_list "));
      text += theme.fg("muted", args.operation);

      if (args.operation === "phase" && args.phase) {
        text += theme.fg("dim", ` (${args.phase.toUpperCase()})`);
      }

      if (args.operation === "write" && args.todoList) {
        const count = args.todoList.length;
        text += theme.fg("dim", ` (${count} item${count !== 1 ? "s" : ""})`);
      }

      return new Text(text, 0, 0);
    },

    renderResult(
      result: AgentToolResult<TodoDetails | undefined>,
      { expanded }: ToolRenderResultOptions,
      theme: Theme
    ) {
      const details = result.details;
      if (!details) {
        const first = result.content[0];
        return new Text(first && "text" in first ? first.text : "", 0, 0);
      }

      if (details.error) {
        return new Text(theme.fg("error", `✗ ${details.error}`), 0, 0);
      }

      if (details.operation === "phase") {
        return new Text(theme.fg("success", `Phase set to ${details.phase.toUpperCase()}`), 0, 0);
      }

      const todos = details.todos;
      const completed = todos.filter((t) => t.status === "completed").length;
      const total = todos.length;

      if (total === 0) {
        return new Text(theme.fg("dim", "No todos"), 0, 0);
      }

      let text = progressBar(completed, total, theme, total) + theme.fg("muted", ` ${completed}/${total} completed`);

      if (expanded) {
        for (const todo of todos) {
          const iconChar = STATUS_ICONS[todo.status] ?? "?";
          const icon =
            todo.status === "completed"
              ? theme.fg("success", iconChar)
              : todo.status === "in-progress"
                ? theme.fg("warning", iconChar)
                : theme.fg("dim", iconChar);
          const title =
            todo.status === "completed"
              ? theme.fg("dim", todo.title)
              : todo.status === "in-progress"
                ? theme.fg("warning", todo.title)
                : theme.fg("muted", todo.title);
          text += `\n${theme.fg("accent", "▍ ")}${icon} ${theme.fg("accent", `${todo.id}.`)} ${title}`;
        }
      }

      return new Text(text, 0, 0);
    },
  };
}
