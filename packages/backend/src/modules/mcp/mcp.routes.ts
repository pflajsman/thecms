import { Router, type IRouter, type RequestHandler } from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { mcpLimiter } from '../../middleware/rateLimit.middleware';
import { mcpAuth, rpcError, type McpRequest } from './mcp-auth';
import { createMcpServer } from './mcp-server';
import { runInProject } from '../../utils/project-context';

const router: IRouter = Router();

// One request is one call: a JSON-RPC batch (up to 100 calls in the SDK) would slip past the per-request limit.
const refuseBatch: RequestHandler = (req, res, next) => {
  if (Array.isArray(req.body)) {
    res.status(400).json(rpcError(-32600, 'Batch requests are not supported; send one request at a time'));
    return;
  }
  next();
};

// Stateless: every POST gets its own server and transport, so no session survives between requests.
router.post('/', refuseBatch, mcpAuth, mcpLimiter, async (req, res, next) => {
  const { mcp } = req as McpRequest;
  try {
    const server = createMcpServer({ tokenPrefix: mcp!.prefix, user: mcp!.user, role: mcp!.role });
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on('close', () => {
      void transport.close();
      void server.close();
    });
    await server.connect(transport);
    // Every tool call works in the token's project.
    await runInProject(mcp!.projectId, () => transport.handleRequest(req, res, req.body));
  } catch (error) {
    next(error);
  }
});

router.all('/', mcpAuth, (_req, res) => {
  res.status(405).set('Allow', 'POST').json(rpcError(-32000, 'Use POST for MCP requests'));
});

export default router;
