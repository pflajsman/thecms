import type { NextFunction, Request, Response } from 'express';
import { TokensService, type ResolvedToken } from '../tokens/tokens.service';

export interface McpRequest extends Request {
  mcp?: ResolvedToken;
}

/** JSON-RPC error body: MCP clients read errors in this shape. */
export const rpcError = (code: number, message: string) => ({ jsonrpc: '2.0', error: { code, message }, id: null });

/** Signs the request in with a personal access token; anything else is 401. */
export async function mcpAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization ?? '';
    const resolved = header.startsWith('Bearer ') ? await TokensService.resolve(header.slice(7).trim()) : null;
    if (!resolved) {
      res.status(401).set('WWW-Authenticate', 'Bearer').json(rpcError(-32001, 'A valid personal access token is required'));
      return;
    }
    (req as McpRequest).mcp = resolved;
    next();
  } catch (error) {
    next(error);
  }
}
