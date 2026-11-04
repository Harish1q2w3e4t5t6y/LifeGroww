// Serves /.well-known/oauth-protected-resource (and /mcp variant) via vercel.json.
import type { IncomingMessage, ServerResponse } from "node:http";
import { envFromProcess, handleProtectedResourceMetadata } from "../server/mcp/http.js";

export default function handler(req: IncomingMessage, res: ServerResponse) {
  handleProtectedResourceMetadata(req, res, envFromProcess());
}
