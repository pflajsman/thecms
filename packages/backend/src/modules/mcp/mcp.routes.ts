import { Router, type IRouter } from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { mcpLimiter } from '../../middleware/rateLimit.middleware';
import { mcpAuth, rpcError, type McpRequest } from './mcp-auth';
import { createMcpServer } from './mcp-server';

const router: IRouter = Router();

// Stateless: every POST gets its own server and transport, so no session survives between requests.
router.post('/', mcpAuth, mcpLimiter, async (req, res, next) => {
  const { mcp } = req as McpRequest;
  try {
    const server = createMcpServer({ tokenPrefix: mcp!.prefix, user: mcp!.user });
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on('close', () => {
      void transport.close();
      void server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    next(error);
  }
});

router.all('/', mcpAuth, (_req, res) => {
  res.status(405).set('Allow', 'POST').json(rpcError(-32000, 'Use POST for MCP requests'));
});

export default router;
