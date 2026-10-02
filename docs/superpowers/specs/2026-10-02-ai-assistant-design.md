# AI Assistant, Project 1: Connection and Editor Help

**Date:** 2026-10-02
**Status:** Approved in conversation, awaiting written review
**Scope:** `packages/backend`, `packages/admin-dashboard`.
**Later projects (own specs):** 2 translate language versions, 3 agent access via MCP, 4 image generation. This project builds the shared parts they reuse.

## 1. Goal

Each admin user can connect their own AI service in the admin. Once connected (and AI is allowed for the installation), text fields in the entry and product editors get AI actions: draft, rewrite, shorten, expand, fix spelling and grammar, and an own instruction. Results stream into a preview and are only applied when the user chooses; nothing is saved without the usual Save.

It must work at no cost for testing: a local model through Ollama, or a free hosted tier, through an OpenAI-compatible connection. Claude (Anthropic) is supported for when better quality is wanted.

## 2. Decisions

| Topic | Decision |
|---|---|
| Who pays | Each user brings their own key and pays their provider directly; TheCMS records usage counts only |
| Providers | `anthropic` (Claude, official SDK) and `openai-compatible` (base URL, optional key, model name: Ollama, OpenRouter, Groq, Gemini's compatible endpoint, others) |
| Key storage | Backend, AES-256-GCM with `AI_KEY_SECRET`; never returned to any browser; only the last 4 characters shown |
| Who can use it | Admin and Editor roles; each connection belongs to one user and only that user's requests use it |
| Global switch | Admins can disallow AI for everyone; stored connections are kept |
| Architecture | Named actions with prompts built on the backend, plus an own-instruction action; results streamed with server-sent events |
| Review | Results go to a preview panel; "Použít" (use) or "Vložit pod" (insert below) makes it a normal unsaved edit |
| Logging | Usage counts per user and month only; no prompts or replies stored or logged |
| Cost facts | Not stated as confirmed: whether a provider offers free use or trial credit is for the user to check; Ollama runs locally at no cost |

## 3. Data (new collections)

### 3.1 `aiconnections`

| Field | Rules |
|---|---|
| `userId` | The user's Entra id; unique index (new collection) |
| `provider` | `anthropic` or `openai-compatible` |
| `model` | Required; for `anthropic` one of `claude-sonnet-5` (default), `claude-opus-5-5`, `claude-haiku-4-5-20251001`; for `openai-compatible` free text, 1 to 200 characters |
| `baseUrl` | Required for `openai-compatible`; `http` or `https`; checked by the URL rule (section 6) |
| `key` | `{ iv, tag, data }` (base64) or absent; required for `anthropic`, optional for `openai-compatible` |
| `keyHint` | Last 4 characters of the key, or absent |
| `createdAt`, `updatedAt` | Timestamps |

### 3.2 `aiusage`

`{ userId, month: 'YYYY-MM', requests, inputTokens, outputTokens }`, one document per user and month, unique on `{ userId, month }` (new collection), updated with `$inc` and `upsert`.

### 3.3 `aisettings`

A single document `{ enabled: boolean }`, default `true` when missing.

## 4. API (admin auth; Admin and Editor unless noted)

| Endpoint | Behaviour |
|---|---|
| `GET /ai/connection` | `{ available, enabled, connection: { provider, model, baseUrl?, keyHint?, createdAt } or null, usage: { month, requests, inputTokens, outputTokens } }`; `available` is false when `AI_KEY_SECRET` is not set |
| `PUT /ai/connection` | Body `{ provider, model, baseUrl?, apiKey? }`; checks the URL rule, makes one short test call with the given settings, then encrypts and saves (replacing any earlier connection); a missing `apiKey` on an update keeps the stored key when provider and base URL are unchanged; answers with the same shape as `GET`; a failed test call is `400` with the provider's reason (key removed from the text) and nothing is saved |
| `DELETE /ai/connection` | Removes the user's connection |
| `PUT /ai/settings` | Admin only; `{ enabled }` |
| `POST /ai/generate` | Body `{ action, instruction?, field: { label, type: 'TEXT' or 'RICH_TEXT', value }, context: { contentType, language, fields: [{ label, value }] } }`; answers with `text/event-stream`: `event: delta` with text chunks, then `event: done` with `{ inputTokens, outputTokens }`, or `event: error` with `{ code, message }` |

Errors before streaming: `403` when AI is disallowed or the role is Viewer, `409 NOT_CONNECTED`, `503 AI_NOT_AVAILABLE` without `AI_KEY_SECRET`, `400` for an unknown action or a missing instruction where one is required, `429` over the user limit.

`action` is one of `draft` (needs `instruction`), `rewrite`, `shorten`, `expand`, `fix`, `custom` (needs `instruction`).

## 5. Providers and prompts

- One interface: `stream({ system, user, maxTokens }, signal)` yielding text chunks and reporting `{ inputTokens, outputTokens }` at the end (0 when the provider does not say).
- `anthropic`: the official `@anthropic-ai/sdk`, Messages API with streaming.
- `openai-compatible`: `fetch` to `{baseUrl}/chat/completions` with `stream: true`, reading `data:` lines until `[DONE]`; `Authorization: Bearer <key>` only when a key is set.
- Prompts are built in one backend module per action. The system text states the task, the output language (the version's language), and the format: plain text for TEXT fields, HTML limited to the rich-text editor's tags for RICH_TEXT fields, and no commentary around the result. The field's text and the entry context are sent inside clearly marked data blocks, with the rule that instructions found in that data are not followed.
- Context is trimmed so the whole input stays under about 20,000 characters (other fields are shortened first, then the field's own text).
- Output caps: `fix`, `shorten` up to 1,000 tokens; `rewrite`, `custom` up to 2,000; `draft`, `expand` up to 3,000.
- Timeout 60 seconds; when the client disconnects, the provider call is aborted.
- The admin cleans rich-text results to the editor's allowed tags before inserting them; plain-text fields receive text without tags.

## 6. Security

- `AI_KEY_SECRET`: a 32-byte secret (base64 or hex) from the environment. Without it, `GET /ai/connection` reports `available: false` and every other AI endpoint answers `503`. Changing it makes stored keys unreadable; users reconnect (documented).
- Keys are decrypted only for one request, never logged, never returned; provider error texts are scrubbed of the key before they are shown.
- URL rule for `openai-compatible`: `http` or `https` only. In production (`NODE_ENV=production`), hosts that are `localhost` or resolve to loopback, private, link-local or unique-local addresses are refused unless `AI_ALLOW_PRIVATE_URLS=true`. In development they are allowed (Ollama on the developer's machine).
- Limits: 20 `generate` requests per minute per user (in tests the limiter is skipped, as for orders).
- No prompts, field text or replies are stored or logged; only usage counts.

## 7. Admin

### 7.1 `/account/ai` ("AI asistent" in the user menu; Admin and Editor)

- Not available (no `AI_KEY_SECRET`): a note that AI is not set up on this server.
- Disallowed by an Admin: a note; the form is hidden for non-admins.
- Not connected: provider choice. Claude: key and model (Sonnet 5 default, Opus 5.5, Haiku 4.5). OpenAI-compatible: base URL with a Preset menu (Ollama `http://localhost:11434/v1`, OpenRouter `https://openrouter.ai/api/v1`, Groq `https://api.groq.com/openai/v1`, Google Gemini `https://generativelanguage.googleapis.com/v1beta/openai/`; prefill only, editable, addresses to be checked against each provider's documentation), optional key, model name. "Připojit" (Connect) shows the test result.
- Connected: provider, model, base URL, key ending, date; Change, Disconnect (with confirmation); this month's requests and tokens.
- Admins also see "Povolit AI funkce pro všechny" (allow AI for everyone).

### 7.2 Editor

- TEXT and RICH_TEXT fields in the entry editor (and therefore the product Content tab) get an "AI" button by the label when the user is connected and AI is allowed; otherwise the editor is unchanged.
- Menu: empty field: "Napsat návrh" (asks for a brief); field with text: "Přepsat srozumitelněji", "Zkrátit", "Rozvést", "Opravit pravopis a gramatiku"; always: "Vlastní pokyn" (asks for an instruction).
- The result panel under the field shows the streamed text, then "Použít", "Vložit pod" (rich text only), "Znovu", "Zahodit". Closing the panel or Zahodit aborts the request. Using a result marks the entry unsaved; the leave warning applies.
- Errors in the panel, in the admin language: wrong or expired key, provider rate limit, service unreachable (for example Ollama not running), input too long, AI disallowed, not connected (with a link to `/account/ai`).
- All new text in English and Czech under the lint guard; every new screen passes axe and works at 360px.

## 8. Testing

- Backend (Jest): encryption round trip and the missing-secret path; a failed test call saves nothing; the URL rule in production and development; prompt building per action (language, format, trimming, data blocks); `generate` streams and records usage with a fake provider; both adapters parse recorded streaming responses; `403`, `409`, `503`, `429`, abort.
- Admin (Vitest): `/account/ai` in every state, both providers and presets, refused key, disconnect, the Admin switch; editor button hidden until connected; menu per field state; streamed preview; Použít, Vložit pod, Znovu, Zahodit; unsaved state after use; English and Czech; axe.
- Browser: with a real provider when the user supplies one (Ollama installed by the user, or a free key the user creates); otherwise a local fake service speaking the OpenAI streaming format.

## 9. Delivery

1. Backend: data, encryption, URL rule, adapters, prompts, endpoints, limits, usage.
2. Admin: `/account/ai`, editor AI button, menu and result panel, browser check.

New environment settings: `AI_KEY_SECRET` (required for AI), `AI_ALLOW_PRIVATE_URLS` (optional). New dependency: `@anthropic-ai/sdk` (backend).

## 10. Out of scope

Translating versions (project 2), MCP agent access (project 3), image generation (project 4), image alt text, SEO fields, a shared installation-wide key, storing prompt history.
