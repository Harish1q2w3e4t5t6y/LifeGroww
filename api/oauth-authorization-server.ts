// Serves /.well-known/oauth-authorization-server via vercel.json (passes Supabase's document through).
import type { IncomingMessage, ServerResponse } from "node:http";
import { envFromProcess, handleAuthorizationServerMetadata } from "../server/mcp/http.js";

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  await handleAuthorizationServerMetadata(req, res, envFromProcess());
}
