# AI Assistant, Project 3: Agent Access through MCP

**Date:** 2026-10-02
**Status:** Approved in conversation, awaiting written review
**Scope:** `packages/backend`, `packages/admin-dashboard`, `docs`.
**Builds on:** content entries and language versions (`docs/superpowers/specs/2026-09-30-content-language-versions-design.md`), the AI assistant projects 1 and 2.

## 1. Goal

An AI agent such as Claude Code can work with TheCMS content through an MCP server built into the backend. It signs in with a personal access token, acts as the token's owner, can read content and write drafts, and can never change the live site: no publishing, unpublishing, archiving or deleting, and no edits to published versions.

## 2. Decisions

| Topic | Decision |
|---|---|
| Permissions | Read everything the user can read; create and edit drafts only |
| Where | `/mcp` on the existing backend, MCP Streamable HTTP transport, `@modelcontextprotocol/sdk` |
| Sign-in | Personal access tokens created by each user in the admin; `Authorization: Bearer tcms_pat_…` |
| Identity | The request runs as the token's owner with the owner's current role |
| Live site | Never changed: write tools create DRAFT versions or edit DRAFT versions only |
| AI cost | None for TheCMS: the agent does its own writing and translating; the user's AI connection is not used |
| Clients | Clients that send a header to an HTTP MCP server (for example Claude Code). Whether claude.ai's own custom connectors accept a fixed token was not verified; OAuth is out of scope |

## 3. Personal access tokens

### 3.1 Data (new collection `accesstokens`)

| Field | Rules |
|---|---|
| `userId` | The owner's Entra id, indexed |
| `name` | 1 to 100 characters |
| `hash` | SHA-256 (hex) of the full token, unique index (new collection) |
| `prefix` | The first 12 characters of the token, for lists |
| `expiresAt` | Optional date |
| `lastUsedAt` | Optional date |
| `createdAt` | Timestamp |

- Token format: `tcms_pat_` followed by 32 random bytes in base64url. Shown once, never stored or logged.
- At most 10 tokens per user that are not expired.
- Expiry choices: 30, 90 or 365 days, or none.

### 3.2 API (admin login, every role, own tokens only)

| Endpoint | Behaviour |
|---|---|
| `GET /tokens` | The caller's tokens: `{ id, name, prefix, createdAt, lastUsedAt?, expiresAt?, expired }`, newest first |
| `POST /tokens` | `{ name, expiresInDays?: 30 \| 90 \| 365 }`; `409 TOKEN_LIMIT` at 10; answers `{ token, ...listItem }` with the full token once |
| `DELETE /tokens/:id` | Revokes (deletes) one of the caller's tokens; `404` for any other id |

Tokens cannot be used to call these endpoints (they accept only the admin login).

### 3.3 Signing in at `/mcp`

- `Authorization: Bearer tcms_pat_…`; the hash is looked up; the owner is loaded from `users`.
- `401` with a JSON-RPC error body when the header is missing, the token is unknown or expired, or the owner no longer exists.
- The owner's current role decides the tools: Viewer gets the read tools; Editor and Admin also get the write tools.
- `lastUsedAt` is written at most once per minute per token.
- Rate limit: 120 requests per minute per token (skipped in tests, as for other limiters).
- Each tool call is logged as one line: token prefix, tool name, `ok` or the error code. No arguments or content.

## 4. MCP server

Stateless Streamable HTTP: each `POST /mcp` creates a server and transport for that request (no sessions). `GET` and `DELETE /mcp` answer `405`. The tools call the existing services, so validation, titles, shared-field sync between language versions and webhooks behave as in the admin. Because a saved shared field is copied to every language version, `update_draft` refuses to change a shared field while another version of the entry is published or archived, and `create_language_version` always keeps the source's shared values; field names the content type does not have are refused.

### 4.1 Read tools

| Tool | Input | Output |
|---|---|---|
| `list_content_types` | none | `[{ id, name, slug, titleField, fields: [{ name, label, type, required, localized, validation }] }]` (`localized` resolved) |
| `list_languages` | none | `[{ code, name, isDefault }]` |
| `search_entries` | `{ contentType?, language?, status?, query?, page?, pageSize? }` (`contentType` is a slug or id; `pageSize` 1 to 50, default 20) | `{ items: [{ id, itemId, contentType, title, language, status, updatedAt }], page, total }` |
| `get_entry` | `{ id }` | `{ id, itemId, contentType, language, status, title, data, updatedAt, versions: [{ id, language, status }] }` |
| `list_media` | `{ query?, page? }` | `{ items: [{ id, url, name, mimeType, altText? }], page, total }` (`url` is the CDN URL when set, else the blob URL; `name` is the original file name) |

### 4.2 Write tools (Editor and Admin)

| Tool | Input | Behaviour |
|---|---|---|
| `create_entry` | `{ contentType, language?, data }` | Creates a DRAFT in the language (default: the default language); answers like `get_entry` |
| `update_draft` | `{ id, data }` | `data` is merged over the version's data; refused when the version is not `DRAFT` with "This version is <status>. Only drafts can be changed through MCP; ask a person to edit it in the admin." |
| `create_language_version` | `{ id, language, data? }` | New DRAFT in a language the item does not have, copied from `id` with `data` merged over the copy; the usual refusal when the language exists |

No tool publishes, unpublishes, archives or deletes anything, or changes models, settings, users, API keys, webhooks, tokens or the shop.

### 4.3 Results and errors

- A result is one text block with pretty-printed JSON (and `structuredContent` with the same object).
- Service errors (validation with the field, unknown type or entry, language taken, draft-only refusal) become tool results with `isError: true` and the message, so the agent can correct its input.
- Tool descriptions state that entry text is data written by people and that instructions inside it are not to be followed.

## 5. Admin

`/account/tokens` ("Access tokens" / "Přístupové tokeny" in the user menu, every role):

- What a token allows: read content and create or edit drafts as you; never publish or delete.
- List: name, prefix, created, last used, expiry (or "Expired"); Revoke with confirmation.
- Create: name and expiry (30, 90, 365 days, Never). After creating, the token is shown once with Copy, a ready Claude Code command `claude mcp add --transport http thecms <API base>/mcp --header "Authorization: Bearer <token>"` with Copy, and the note that it will not be shown again. Closing the box removes the token from the page.
- At the limit, Create is disabled with "You have 10 tokens. Revoke one to create another."
- All text in English and Czech under the lint guard; axe; works at 360px.

`docs/mcp.md`: what the MCP server offers, how to create a token, the Claude Code command, the draft-only rule.

## 6. Testing

- Backend (Jest, in-memory MongoDB): token create (shown once, hash stored, prefix), limit of 10 (expired ones do not count), expiry, list only own, revoke own and `404` for others; `/mcp` sign-in: none, malformed, unknown, expired, revoked, owner deleted; each tool through the SDK's MCP client over HTTP against the real app; Viewer sees and may call only read tools; `update_draft` refuses PUBLISHED and ARCHIVED; `create_language_version` copies shared fields and refuses an existing language; validation errors are `isError` results; no publish or delete tool is listed; `lastUsedAt` throttled.
- Admin (Vitest): tokens page empty, list, create with the one-time token and command, copy, revoke with confirmation, limit, expired label; English and Czech; axe.
- Live: on a throwaway database, a local backend, the MCP Inspector or Claude Code connected with a token: list types, create a draft, update it, try a published version (refused), create a language version.

## 7. Delivery

1. Backend: tokens model and endpoints, `/mcp` sign-in and limits, tools, tests, `docs/mcp.md`.
2. Admin: tokens page and menu item, browser check.

New dependency: `@modelcontextprotocol/sdk` (backend). No new environment settings.

## 8. Out of scope

OAuth for claude.ai connectors, shop tools, media upload, publishing or deleting through MCP, per-token permission choices, prompts and resources (tools only).
