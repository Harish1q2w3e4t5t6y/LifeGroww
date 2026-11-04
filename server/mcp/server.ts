// Builds the MCP server (tool list + handlers) for one signed-in user.
// Storage is passed in, so the same server runs on Vercel, in the local dev
// script and in tests.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import {
  addTask,
  deleteTask,
  getHabitDay,
  listTasks,
  setHabitCheck,
  setTaskCompleted,
  updateTask,
  type UserData,
} from "./store.js";

export interface UserDataRepository {
  load(): Promise<UserData>;
  save(data: UserData): Promise<void>;
}

const quadrant = z
  .enum(["q1", "q2", "q3", "q4"])
  .describe(
    "Eisenhower Matrix box: q1 = Do (important & urgent), q2 = Schedule (important, not urgent), " +
      "q3 = Delegate (urgent, not important), q4 = Delete (neither).",
  );
const workspace = z
  .enum(["personal", "professional"])
  .describe("Which workspace the task lives in. The app has a Personal and a Professional matrix.");
const priority = z.enum(["low", "medium", "high"]);
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
  .describe("A calendar date as YYYY-MM-DD, in the user's own time zone.");
const dueDate = z
  .string()
  .describe("Due date. Either YYYY-MM-DD or a full ISO date-time.");

function ok(payload: unknown): CallToolResult {
  return { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }] };
}

function fail(err: unknown): CallToolResult {
  const message = err instanceof Error ? err.message : String(err);
  return { isError: true, content: [{ type: "text", text: message }] };
}

const SERVER_INSTRUCTIONS = `This server manages the user's Lifegrow / Productivity Studio data: tasks laid out on an Eisenhower Matrix (two workspaces, personal and professional) and a daily habit tracker.
- Call list_tasks before changing a task so you have its id.
- Quadrants: q1 Do, q2 Schedule, q3 Delegate, q4 Delete.
- Pass dates in the user's local time zone as YYYY-MM-DD.
- Some tasks are linked to a habit (recurring tasks); completing one also ticks the habit for that day, and the other way round.`;

export function createLifegrowMcpServer(repo: UserDataRepository): McpServer {
  const server = new McpServer(
    { name: "lifegrow", title: "Lifegrow Productivity Studio", version: "1.0.0" },
    { instructions: SERVER_INSTRUCTIONS },
  );

  // Every write tool: load the latest row, apply one change, save it back.
  async function mutate<T>(change: (data: UserData) => { data: UserData } & T): Promise<T> {
    const current = await repo.load();
    const { data, ...rest } = change(current);
    await repo.save(data);
    return rest as T;
  }

  async function run(fn: () => Promise<unknown>): Promise<CallToolResult> {
    try {
      return ok(await fn());
    } catch (err) {
      // Bad ids / dates come back to ChatGPT as a tool error it can read and fix.
      return fail(err);
    }
  }

  server.registerTool(
    "list_tasks",
    {
      title: "List tasks",
      description:
        "List the user's tasks with their ids. By default returns only open (not completed) tasks from both workspaces.",
      inputSchema: {
        workspace: workspace.optional(),
        quadrant: quadrant.optional(),
        status: z
          .enum(["open", "done", "all"])
          .optional()
          .describe("open = not completed (default), done = completed, all = both."),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async (args) =>
      run(async () => {
        const tasks = listTasks(await repo.load(), args);
        return { count: tasks.length, tasks };
      }),
  );

  server.registerTool(
    "add_task",
    {
      title: "Add task",
      description: "Add a new task to one of the four Eisenhower Matrix boxes.",
      inputSchema: {
        title: z.string().min(1).max(500),
        quadrant,
        workspace: workspace.default("personal"),
        description: z.string().max(5000).optional(),
        due_date: dueDate.optional(),
        priority: priority.optional().describe("Defaults to low, like the app."),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    async (args) =>
      run(() =>
        mutate((data) =>
          addTask(data, {
            title: args.title,
            quadrant: args.quadrant,
            workspace: args.workspace,
            description: args.description,
            dueDate: args.due_date,
            priority: args.priority,
          }),
        ),
      ),
  );

  server.registerTool(
    "update_task",
    {
      title: "Update task",
      description:
        "Change a task: rename it, move it to another box or workspace, set priority, due date, description or status. " +
        "Pass null for description or due_date to clear them.",
      inputSchema: {
        id: z.string().describe("Task id from list_tasks."),
        title: z.string().min(1).max(500).optional(),
        quadrant: quadrant.optional(),
        workspace: workspace.optional(),
        priority: priority.optional(),
        description: z.string().max(5000).nullable().optional(),
        due_date: dueDate.nullable().optional(),
        status: z.enum(["pending", "in_progress", "done"]).optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ id, due_date, ...rest }) =>
      run(() => mutate((data) => updateTask(data, id, { ...rest, dueDate: due_date }))),
  );

  server.registerTool(
    "complete_task",
    {
      title: "Complete task",
      description:
        "Mark a task as done (or not done again with completed=false). If the task is linked to a habit, the habit is ticked for that day too.",
      inputSchema: {
        id: z.string().describe("Task id from list_tasks."),
        completed: z.boolean().default(true),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ id, completed }) => run(() => mutate((data) => setTaskCompleted(data, id, completed))),
  );

  server.registerTool(
    "delete_task",
    {
      title: "Delete task",
      description: "Permanently remove a task. Ask the user before deleting.",
      inputSchema: { id: z.string().describe("Task id from list_tasks.") },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async ({ id }) => run(() => mutate((data) => deleteTask(data, id))),
  );

  server.registerTool(
    "get_habits",
    {
      title: "Get habits for a day",
      description: "Show the user's habits for one day and which ones are done, plus mood, sleep and notes if logged.",
      inputSchema: { date: isoDate },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ date }) => run(async () => getHabitDay(await repo.load(), date)),
  );

  server.registerTool(
    "check_habit",
    {
      title: "Tick or untick a habit",
      description:
        "Mark a habit done (or not done) for a day. Get habit ids from get_habits. If the habit has a linked recurring task, that task is completed too.",
      inputSchema: {
        habit_id: z.string(),
        date: isoDate,
        done: z.boolean().default(true),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ habit_id, date, done }) => run(() => mutate((data) => setHabitCheck(data, habit_id, date, done))),
  );

  return server;
}
