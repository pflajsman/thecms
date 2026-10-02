import type { AddressInfo } from 'net';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { app } from '../app';

// Closed after every test, so a failing test cannot leave a server open and hang the run.
const open = new Set<() => Promise<void>>();
afterEach(async () => {
  await Promise.all([...open].map((close) => close()));
  open.clear();
});

/** An MCP client connected to the real app over HTTP, signed in with `token` when given. */
export async function connectMcp(token?: string) {
  const server = app.listen(0);
  const { port } = server.address() as AddressInfo;
  const client = new Client({ name: 'thecms-test', version: '1.0.0' });
  const transport = new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/api/v1/mcp`), {
    requestInit: token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
  });
  try {
    await client.connect(transport);
  } catch (error) {
    server.close();
    throw error;
  }
  const close = async () => {
    if (!open.delete(close)) return;
    await client.close();
    server.close();
  };
  open.add(close);
  return { client, close };
}

/** The JSON a tool answered with. */
export function result<T = Record<string, unknown>>(answer: unknown): T {
  const content = (answer as { content: { type: string; text: string }[] }).content;
  return JSON.parse(content[0].text) as T;
}
