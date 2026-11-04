// @vitest-environment node
import { describe, it, expect, beforeEach } from "vitest";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createLifegrowMcpServer, type UserDataRepository } from "../../server/mcp/server";
import { normalizeUserData, setTaskCompleted, setHabitCheck, updateTask, type UserData } from "../../server/mcp/store";
import { handleMcp, handleProtectedResourceMetadata } from "../../server/mcp/http";
import type { Task, RecurringConfig } from "@/lib/types";

function memoryRepo(initial: UserData) {
  const state = { data: initial, saves: 0 };
  const repo: UserDataRepository = {
    async load() {
      return structuredClone(state.data);
    },
    async save(data) {
      state.data = structuredClone(data);
      state.saves++;
    },
  };
  return { repo, state };
}

async function connect(repo: UserDataRepository) {
  const server = createLifegrowMcpServer(repo);
  const [clientT, serverT] = InMemoryTransport.createLinkedPair();
  await server.connect(serverT);
  const client = new Client({ name: "test", version: "1" });
  await client.connect(clientT);
  return client;
}

function parse(result: Awaited<ReturnType<Client["callTool"]>>) {
  const content = result.content as Array<{ type: string; text: string }>;
  return JSON.parse(content[0].text);
}

const task = (over: Partial<Task>): Task => ({
  id: "t1",
  title: "Write report",
  quadrant: "q1",
  completed: false,
  status: "pending",
  priority: "low",
  createdAt: "2026-11-01T09:00:00.000Z",
  ...over,
});

describe("MCP tools", () => {
  let mem: ReturnType<typeof memoryRepo>;
  let client: Client;

  beforeEach(async () => {
    mem = memoryRepo(
      normalizeUserData({
        tasks: { personal: [task({ id: "p1", title: "Buy milk", quadrant: "q3" })], professional: [task({ id: "w1" })] },
        settings: { theme: "dark", recurringConfigs: [] },
      }),
    );
    client = await connect(mem.repo);
  });

  it("lists the seven tools with read-only hints on readers", async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(
      ["add_task", "check_habit", "complete_task", "delete_task", "get_habits", "list_tasks", "update_task"],
    );
    expect(tools.find((t) => t.name === "list_tasks")?.annotations?.readOnlyHint).toBe(true);
    expect(tools.find((t) => t.name === "delete_task")?.annotations?.destructiveHint).toBe(true);
  });

  it("list_tasks returns open tasks from both workspaces, tagged with workspace", async () => {
    const out = parse(await client.callTool({ name: "list_tasks", arguments: {} }));
    expect(out.count).toBe(2);
    expect(out.tasks.map((t: { id: string; workspace: string }) => `${t.workspace}:${t.id}`).sort()).toEqual([
      "personal:p1",
      "professional:w1",
    ]);
  });

  it("add_task saves a task shaped like the app's own", async () => {
    const out = parse(
      await client.callTool({ name: "add_task", arguments: { title: "  Plan trip ", quadrant: "q2", workspace: "personal" } }),
    );
    expect(out.task).toMatchObject({ title: "Plan trip", quadrant: "q2", completed: false, status: "pending", priority: "low", workspace: "personal" });
    expect(mem.state.saves).toBe(1);
    const saved = mem.state.data.tasks.personal.find((t) => t.id === out.task.id)!;
    expect(saved).not.toHaveProperty("workspace");
    expect(saved.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("complete_task marks done and sets completedAt; completed=false undoes it", async () => {
    let out = parse(await client.callTool({ name: "complete_task", arguments: { id: "w1" } }));
    expect(out.task).toMatchObject({ completed: true, status: "done" });
    expect(out.task.completedAt).toBeTruthy();
    out = parse(await client.callTool({ name: "complete_task", arguments: { id: "w1", completed: false } }));
    expect(out.task).toMatchObject({ completed: false, status: "pending" });
    expect(mem.state.data.tasks.professional[0]).not.toHaveProperty("completedAt");
  });

  it("update_task can move a task to the other workspace and clear the due date", async () => {
    await client.callTool({ name: "update_task", arguments: { id: "p1", due_date: "2026-11-10" } });
    const out = parse(
      await client.callTool({ name: "update_task", arguments: { id: "p1", workspace: "professional", due_date: null, quadrant: "q1" } }),
    );
    expect(out.task).toMatchObject({ workspace: "professional", quadrant: "q1" });
    expect(mem.state.data.tasks.personal).toHaveLength(0);
    expect(mem.state.data.tasks.professional.find((t) => t.id === "p1")).not.toHaveProperty("dueDate");
  });

  it("delete_task removes it; unknown ids come back as a readable tool error", async () => {
    await client.callTool({ name: "delete_task", arguments: { id: "p1" } });
    expect(mem.state.data.tasks.personal).toHaveLength(0);
    const res = await client.callTool({ name: "delete_task", arguments: { id: "nope" } });
    expect(res.isError).toBe(true);
    expect((res.content as Array<{ text: string }>)[0].text).toMatch(/No task with id "nope"/);
    expect(mem.state.saves).toBe(1);
  });

  it("get_habits seeds an unseen month from the latest habit list", async () => {
    mem.state.data.habits.months["2026-10"] = { habits: [{ id: "run", name: "Run", emoji: "🏃" }], days: {} };
    const out = parse(await client.callTool({ name: "get_habits", arguments: { date: "2026-11-04" } }));
    expect(out.habits).toEqual([{ id: "run", name: "Run", emoji: "🏃", done: false }]);
  });

  it("check_habit ticks a habit and creates the month the way the app does", async () => {
    const out = parse(await client.callTool({ name: "check_habit", arguments: { habit_id: "gym", date: "2026-11-04" } }));
    expect(out.day.habits.find((h: { id: string }) => h.id === "gym").done).toBe(true);
    const month = mem.state.data.habits.months["2026-11"];
    expect(month.habits.length).toBeGreaterThan(0);
    expect(month.days[4].checks.gym).toBe(true);
  });

  it("rejects malformed dates before touching data", async () => {
    const res = await client.callTool({ name: "check_habit", arguments: { habit_id: "gym", date: "2026-02-30" } });
    expect(res.isError).toBe(true);
    expect(mem.state.saves).toBe(0);
  });
});

describe("habit ↔ recurring task linking", () => {
  const config: RecurringConfig = {
    id: "rc1",
    habitId: "gym",
    workspace: "personal",
    quadrant: "q2",
    taskName: "Gym",
    schedule: "daily",
    enabled: true,
    startDate: "2026-11-01",
  };

  it("completing a linked task ticks the habit for that date", () => {
    const data = normalizeUserData({
      tasks: { personal: [task({ id: "r1", title: "Gym", recurringConfigId: "rc1", recurringDate: "2026-11-04" })] },
      settings: { recurringConfigs: [config] },
    });
    const { data: next } = setTaskCompleted(data, "r1", true);
    expect(next.habits.months["2026-11"].days[4].checks.gym).toBe(true);
  });

  it("ticking a linked habit completes that day's task", () => {
    const data = normalizeUserData({
      tasks: { personal: [task({ id: "r1", title: "Gym", recurringConfigId: "rc1", recurringDate: "2026-11-04" })] },
      settings: { recurringConfigs: [config] },
    });
    const { data: next } = setHabitCheck(data, "gym", "2026-11-04", true);
    expect(next.tasks.personal[0]).toMatchObject({ completed: true, status: "done" });
  });

  it("update_task status=done goes through the same habit sync", () => {
    const data = normalizeUserData({
      tasks: { personal: [task({ id: "r1", title: "Gym", recurringConfigId: "rc1", recurringDate: "2026-11-04" })] },
      settings: { recurringConfigs: [config] },
    });
    const { data: next, task: t } = updateTask(data, "r1", { status: "done" });
    expect(t).toMatchObject({ completed: true, status: "done" });
    expect(next.habits.months["2026-11"].days[4].checks.gym).toBe(true);
  });
});

describe("HTTP layer", () => {
  const env = { supabaseUrl: "https://abc.supabase.co", supabaseAnonKey: "anon" };
  let server: Server;
  let base: string;

  beforeEach(async () => {
    server = createServer((req, res) => {
      const path = new URL(req.url || "/", "http://x").pathname;
      if (path.startsWith("/.well-known/oauth-protected-resource")) return handleProtectedResourceMetadata(req, res, env);
      return void handleMcp(req, res, undefined, env);
    });
    await new Promise<void>((r) => server.listen(0, r));
    base = `http://localhost:${(server.address() as AddressInfo).port}`;
    return () => new Promise<void>((r) => server.close(() => r()));
  });

  it("asks for sign-in with a pointer to the resource metadata", async () => {
    const res = await fetch(`${base}/mcp`, { method: "POST", body: "{}" });
    expect(res.status).toBe(401);
    expect(res.headers.get("www-authenticate")).toBe(
      `Bearer resource_metadata="${base}/.well-known/oauth-protected-resource/mcp"`,
    );
  });

  it("publishes Supabase as the authorization server", async () => {
    const res = await fetch(`${base}/.well-known/oauth-protected-resource/mcp`);
    expect(await res.json()).toMatchObject({
      resource: `${base}/mcp`,
      authorization_servers: ["https://abc.supabase.co/auth/v1"],
    });
  });
});

describe("end to end over HTTP (fake Supabase)", () => {
  // A stand-in for Supabase: answers the sign-in check and the user_data reads/writes.
  let row: Record<string, unknown> | null;
  let writes: Array<{ method: string; body: unknown }>;
  let supa: Server;
  let mcp: Server;
  let mcpUrl: string;

  const readBody = async (req: import("node:http").IncomingMessage) => {
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    return chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : undefined;
  };

  beforeEach(async () => {
    row = { tasks: { personal: [task({ id: "p1" })], professional: [] }, habits: { months: {}, theme: "dark" }, settings: { theme: "light" } };
    writes = [];
    supa = createServer(async (req, res) => {
      const url = new URL(req.url || "/", "http://x");
      const authed = req.headers.authorization === "Bearer good-token";
      if (url.pathname === "/auth/v1/user") {
        res.writeHead(authed ? 200 : 401, { "content-type": "application/json" });
        return res.end(JSON.stringify(authed ? { id: "u1", aud: "authenticated", email: "a@b.c" } : { msg: "bad jwt" }));
      }
      if (url.pathname === "/rest/v1/user_data") {
        if (!authed) return void res.writeHead(401).end();
        if (req.method === "GET") {
          res.writeHead(200, { "content-type": "application/json" });
          return res.end(JSON.stringify(row ? [row] : []));
        }
        const body = await readBody(req);
        writes.push({ method: req.method!, body });
        row = { ...(row ?? {}), ...(body as object) };
        return void res.writeHead(204).end();
      }
      res.writeHead(404).end();
    });
    await new Promise<void>((r) => supa.listen(0, r));
    const env = { supabaseUrl: `http://localhost:${(supa.address() as AddressInfo).port}`, supabaseAnonKey: "anon" };

    // Like Vercel: the JSON body is already parsed before the handler runs.
    mcp = createServer(async (req, res) => handleMcp(req, res, await readBody(req), env));
    await new Promise<void>((r) => mcp.listen(0, r));
    mcpUrl = `http://localhost:${(mcp.address() as AddressInfo).port}/mcp`;
    return async () => {
      await new Promise<void>((r) => mcp.close(() => r()));
      await new Promise<void>((r) => supa.close(() => r()));
    };
  });

  it("initializes, lists tasks, adds one and writes only tasks/habits", async () => {
    const { StreamableHTTPClientTransport } = await import("@modelcontextprotocol/sdk/client/streamableHttp.js");
    const client = new Client({ name: "e2e", version: "1" });
    await client.connect(
      new StreamableHTTPClientTransport(new URL(mcpUrl), { requestInit: { headers: { Authorization: "Bearer good-token" } } }),
    );

    const listed = parse(await client.callTool({ name: "list_tasks", arguments: {} }));
    expect(listed.tasks.map((t: { id: string }) => t.id)).toEqual(["p1"]);

    const added = parse(await client.callTool({ name: "add_task", arguments: { title: "From ChatGPT", quadrant: "q2" } }));
    expect(added.task).toMatchObject({ title: "From ChatGPT", workspace: "personal" });
    expect(writes).toHaveLength(1);
    expect(writes[0].method).toBe("PATCH");
    expect(Object.keys(writes[0].body as object).sort()).toEqual(["habits", "tasks"]);
    expect((row!.settings as { theme: string }).theme).toBe("light");
    await client.close();
  });
});
