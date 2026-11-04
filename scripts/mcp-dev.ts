// Local MCP server for testing: npm run mcp:dev  → http://localhost:8787/mcp
// Uses the same handlers as the Vercel functions and reads .env.local.
import { createServer, type IncomingMessage } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import {
  envFromProcess,
  handleAuthorizationServerMetadata,
  handleMcp,
  handleProtectedResourceMetadata,
  MCP_PATH,
  PROTECTED_RESOURCE_PATH,
} from "../server/mcp/http.js";

for (const file of [".env.local", ".env"]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  if (chunks.length === 0) return undefined;
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return undefined;
  }
}

const port = Number(process.env.MCP_PORT || 8787);
const env = envFromProcess();

createServer(async (req, res) => {
  const path = new URL(req.url || "/", "http://localhost").pathname;
  try {
    if (path === MCP_PATH) return await handleMcp(req, res, await readJson(req), env);
    if (path === PROTECTED_RESOURCE_PATH || path === `${PROTECTED_RESOURCE_PATH}${MCP_PATH}`) {
      return handleProtectedResourceMetadata(req, res, env);
    }
    if (path === "/.well-known/oauth-authorization-server") return await handleAuthorizationServerMetadata(req, res, env);
    res.writeHead(404).end("Not found");
  } catch (err) {
    console.error(err);
    if (!res.headersSent) res.writeHead(500).end("Internal error");
  }
}).listen(port, () => console.log(`Lifegrow MCP server on http://localhost:${port}${MCP_PATH}`));
