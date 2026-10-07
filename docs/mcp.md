# Connecting an AI agent through MCP

TheCMS has an MCP server at `<API base>/mcp` (for example `http://localhost:3000/api/v1/mcp`). An agent signed in with your personal access token can read content and create or edit drafts as you; if you are a project Admin or Owner, it can also add languages, content types and fields. It can never publish, unpublish, archive or delete anything, change a published version, change or remove existing fields, models or languages, or change settings, users, keys, webhooks, tokens or the shop. A person reviews drafts and publishes them in the admin.

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
| `create_language` | Admin, Owner | Add a content language after the existing ones; the default stays |
| `create_content_type` | Admin, Owner | New content type, with the same validation as the admin |
| `add_content_type_fields` | Admin, Owner | Append fields to a content type; existing fields are never changed |

Shared fields (the same in every language version, such as numbers or images) can only be changed through MCP while no other version of the entry is published or archived, because a change is copied to every version; a new language version always keeps the source's shared values. Field names the content type does not have are refused.

Model tools only add, because renaming, changing or removing fields, models and languages can lose content; that stays in the admin. Viewers get the read tools only. Requests are limited to 120 per minute per token.
