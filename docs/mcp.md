# Connecting an AI agent through MCP

TheCMS has an MCP server at `<API base>/mcp` (for example `http://localhost:3000/api/v1/mcp`). An agent signed in with your personal access token can read content and create or edit drafts as you. It can never publish, unpublish, archive or delete anything, change a published version, or change models, settings, users, keys, webhooks, tokens or the shop. A person reviews drafts and publishes them in the admin.

## Create a token

In the admin, open the user menu, **Access tokens**, and create one. Copy it when it is shown: it is not shown again. Revoke it there when you no longer need it. Each user can have 10 tokens.

## Claude Code

    claude mcp add --transport http thecms <API base>/mcp --header "Authorization: Bearer <token>"

Other MCP clients that can send a header to a Streamable HTTP server work the same way. Connecting from claude.ai's own connectors was not tried; they may need OAuth, which TheCMS does not offer yet.

## Tools

| Tool | Who | What it does |
|---|---|---|
| `list_content_types` | everyone | Models with fields; `localized` tells translated from shared fields |
| `list_languages` | everyone | Content languages |
| `search_entries` | everyone | Find language versions by type, language, status, title text |
| `get_entry` | everyone | One version with its fields and its language versions |
| `list_media` | everyone | Media library files |
| `create_entry` | Editor, Admin | New entry as a draft |
| `update_draft` | Editor, Admin | Change fields of a draft |
| `create_language_version` | Editor, Admin | New draft in a missing language |

Viewers get the read tools only. Requests are limited to 120 per minute per token.
