import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { LanguagesService } from '../languages/languages.service';
import { registerTool, type McpContext } from './tool';

export function registerReadTools(server: McpServer, ctx: McpContext): void {
  registerTool(server, ctx, 'list_languages', { description: 'Content languages of this TheCMS installation, in order. isDefault marks the default language.' }, async () => ({
    languages: (await LanguagesService.list()).map((l) => ({ code: l.code, name: l.name, isDefault: l.isDefault })),
  }));
}
