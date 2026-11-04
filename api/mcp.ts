// Vercel function for the MCP endpoint (served at /mcp via vercel.json).
import type { IncomingMessage, ServerResponse } from "node:http";
import { envFromProcess, handleMcp } from "../server/mcp/http.js";

export default async function handler(req: IncomingMessage & { body?: unknown }, res: ServerResponse) {
  await handleMcp(req, res, req.body, envFromProcess());
}
