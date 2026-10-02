import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { UserRole } from '../../models/user.model';
import { registerReadTools } from './read-tools';
import { registerWriteTools } from './write-tools';
import type { McpContext } from './tool';

/** A server for one request, with the tools the token owner's role allows. */
export function createMcpServer(ctx: McpContext): McpServer {
  const server = new McpServer(
    { name: 'thecms', version: '1.0.0' },
    { instructions: 'TheCMS content. You can read content and create or edit drafts. Publishing and deleting are done by people in the admin.' }
  );
  registerReadTools(server, ctx);
  if (ctx.user.role !== UserRole.VIEWER) registerWriteTools(server, ctx);
  return server;
}
