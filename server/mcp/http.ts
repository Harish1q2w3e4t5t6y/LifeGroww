// HTTP layer for the MCP server: sign-in check, OAuth discovery documents,
// and the Streamable HTTP transport. Framework-free (plain Node req/res) so the
// same code runs as a Vercel function and in scripts/mcp-dev.ts.
//
// Sign-in: ChatGPT signs the user in through Supabase Auth's built-in OAuth 2.1
// server. The access token it then sends is a normal Supabase user token, so
// every database call below runs as that user and the existing row-level
// security on `user_data` keeps each person to their own row.

import type { IncomingMessage, ServerResponse } from "node:http";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { createLifegrowMcpServer, type UserDataRepository } from "./server.js";
import { normalizeUserData, type UserData } from "./store.js";

export interface McpEnv {
  supabaseUrl: string;
  supabaseAnonKey: string;
  /** Public origin of the site, e.g. https://lifegrow.example.com. Worked out from the request if unset. */
  publicUrl?: string;
}

export function envFromProcess(): McpEnv {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
  return {
    supabaseUrl: supabaseUrl.replace(/\/+$/, ""),
    supabaseAnonKey,
    publicUrl: process.env.MCP_PUBLIC_URL?.replace(/\/+$/, ""),
  };
}

export const MCP_PATH = "/mcp";
export const PROTECTED_RESOURCE_PATH = "/.well-known/oauth-protected-resource";

function publicOrigin(req: IncomingMessage, env: McpEnv): string {
  if (env.publicUrl) return env.publicUrl;
  const header = (name: string) => {
    const v = req.headers[name];
    return (Array.isArray(v) ? v[0] : v)?.split(",")[0].trim();
  };
  const host = header("x-forwarded-host") || header("host") || "localhost";
  const isLocal = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host);
  const proto = header("x-forwarded-proto") || (isLocal ? "http" : "https");
  return `${proto}://${host}`;
}

function resourceMetadataUrl(req: IncomingMessage, env: McpEnv): string {
  return `${publicOrigin(req, env)}${PROTECTED_RESOURCE_PATH}${MCP_PATH}`;
}

function setCors(res: ServerResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, Accept, Mcp-Session-Id, Mcp-Protocol-Version");
  res.setHeader("Access-Control-Expose-Headers", "WWW-Authenticate, Mcp-Session-Id");
}

function sendJson(res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) {
  res.writeHead(status, { "Content-Type": "application/json", ...headers });
  res.end(JSON.stringify(body));
}

function checkEnv(res: ServerResponse, env: McpEnv): boolean {
  if (env.supabaseUrl && env.supabaseAnonKey) return true;
  sendJson(res, 500, { error: "server_misconfigured", error_description: "SUPABASE_URL / SUPABASE_ANON_KEY are not set." });
  return false;
}

/** RFC 9728 Protected Resource Metadata: tells ChatGPT which server signs users in. */
export function handleProtectedResourceMetadata(req: IncomingMessage, res: ServerResponse, env: McpEnv) {
  setCors(res);
  if (req.method === "OPTIONS") return void res.writeHead(204).end();
  if (!checkEnv(res, env)) return;
  sendJson(
    res,
    200,
    {
      resource: `${publicOrigin(req, env)}${MCP_PATH}`,
      authorization_servers: [`${env.supabaseUrl}/auth/v1`],
      bearer_methods_supported: ["header"],
      resource_name: "Lifegrow Productivity Studio",
    },
    { "Cache-Control": "public, max-age=300" },
  );
}

/**
 * Some MCP clients still look for the authorization server's metadata on the
 * MCP server's own origin. Pass Supabase's document through so they find it.
 */
export async function handleAuthorizationServerMetadata(req: IncomingMessage, res: ServerResponse, env: McpEnv) {
  setCors(res);
  if (req.method === "OPTIONS") return void res.writeHead(204).end();
  if (!checkEnv(res, env)) return;
  try {
    const upstream = await fetch(`${env.supabaseUrl}/.well-known/oauth-authorization-server/auth/v1`);
    const text = await upstream.text();
    res.writeHead(upstream.status, { "Content-Type": "application/json", "Cache-Control": "public, max-age=300" });
    res.end(text);
  } catch (err) {
    sendJson(res, 502, { error: "upstream_unavailable", error_description: String(err) });
  }
}

function bearerToken(req: IncomingMessage): string | null {
  const header = req.headers.authorization;
  const match = header ? /^Bearer\s+(.+)$/i.exec(header) : null;
  return match ? match[1].trim() : null;
}

function unauthorized(req: IncomingMessage, res: ServerResponse, env: McpEnv, error?: string, description?: string) {
  const parts = [`resource_metadata="${resourceMetadataUrl(req, env)}"`];
  if (error) parts.push(`error="${error}"`);
  if (description) parts.push(`error_description="${description.replace(/"/g, "'")}"`);
  sendJson(
    res,
    401,
    { error: error ?? "unauthorized", error_description: description ?? "Sign in to Lifegrow to use this server." },
    { "WWW-Authenticate": `Bearer ${parts.join(", ")}` },
  );
}

/** Reads and writes the signed-in user's single `user_data` row. */
export function supabaseRepository(client: SupabaseClient, userId: string): UserDataRepository {
  let rowExists = false;
  return {
    async load() {
      const { data, error } = await client
        .from("user_data")
        .select("tasks, habits, settings")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw new Error(`Could not load your data: ${error.message}`);
      rowExists = !!data;
      return normalizeUserData(data as Partial<UserData> | null);
    },
    async save(data) {
      // Only tasks and habits are ever changed from ChatGPT; leave settings
      // (recurring configs, theme, ...) exactly as the app last wrote them.
      const { error } = rowExists
        ? await client.from("user_data").update({ tasks: data.tasks, habits: data.habits }).eq("user_id", userId)
        : await client.from("user_data").insert({ user_id: userId, tasks: data.tasks, habits: data.habits, settings: data.settings });
      if (error) throw new Error(`Could not save your change: ${error.message}`);
      rowExists = true;
    },
  };
}

export async function handleMcp(
  req: IncomingMessage & { auth?: AuthInfo },
  res: ServerResponse,
  parsedBody: unknown,
  env: McpEnv,
) {
  setCors(res);
  if (req.method === "OPTIONS") return void res.writeHead(204).end();
  if (!checkEnv(res, env)) return;

  const token = bearerToken(req);
  if (!token) return unauthorized(req, res, env);

  const client = createClient(env.supabaseUrl, env.supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data: userData, error: userError } = await client.auth.getUser(token);
  if (userError || !userData?.user) {
    return unauthorized(req, res, env, "invalid_token", "The access token is invalid or has expired.");
  }

  // Each request is handled on its own (no sessions), which suits serverless.
  if (req.method !== "POST") {
    return sendJson(res, 405, { jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed." }, id: null }, { Allow: "POST, OPTIONS" });
  }

  req.auth = { token, clientId: "chatgpt", scopes: [], extra: { userId: userData.user.id } };
  const server = createLifegrowMcpServer(supabaseRepository(client, userData.user.id));
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  res.on("close", () => {
    void transport.close();
    void server.close();
  });
  await server.connect(transport);
  await transport.handleRequest(req, res, parsedBody);
}
