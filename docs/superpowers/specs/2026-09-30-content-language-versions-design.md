# Content Language Versions: Design

**Date:** 2026-09-30
**Status:** Approved in conversation, awaiting written review
**Scope:** `packages/backend`, `packages/admin-dashboard`, the example site config. Public API changes are additive.

## 1. Goal

An entry can exist in several content languages. Each language version has its own title, translated fields and publishing status; shared fields (images, numbers, dates, yes/no, references) are the same in every language. Sites ask the public API for a language and get the default language as a fallback.

The admin UI languages (English and Czech, done earlier) are a separate concern and do not change here.

## 2. Decisions

| Topic | Decision |
|---|---|
| Languages | Configurable list per installation, one default |
| Default after migration | English (`en`). Existing entries become English versions even though their text is Czech; the owner moves them with "Change language" |
| Storage | One entry document per language version: existing collection gains `language` and `itemId` |
| Fallback | Public API returns the requested language's published version, else the default language's published version, marked `fallback: true` |
| No language parameter | Default language (existing sites unchanged) |
| Translated vs shared | Per field `localized` flag; default on for TEXT and RICH_TEXT, off for the rest |

## 3. Data model

### 3.1 Languages (new collection `languages`)

| Field | Type | Rules |
|---|---|---|
| `code` | string | Lowercase, matches `^[a-z]{2,3}(-[a-z0-9]{2,8})?$` (for example `en`, `cs`, `de-at`), unique |
| `name` | string | 1 to 50 characters (for example `Čeština`) |
| `isDefault` | boolean | Exactly one language has `true` |
| `order` | number | Display order |

Rules: the default language and the last remaining language cannot be deleted. Changing the default is allowed after confirmation. Deleting a language deletes its versions after typed confirmation.

### 3.2 Entries (existing collection `contententries`)

New fields:

| Field | Type | Rules |
|---|---|---|
| `language` | string | Required, one of the configured codes, indexed |
| `itemId` | ObjectId | Required, indexed; groups the versions of one entry |

New unique index `{ itemId: 1, language: 1 }`. Each version keeps its own `title`, `status`, `publishedAt`, `createdAt`, `updatedAt`, `createdBy`, `updatedBy`. Every sort used by the admin and public lists stays served by a single-field index (Cosmos DB rule from the production fix).

### 3.3 Field definitions

Each field in a content model gets `localized?: boolean`. When absent: `true` for TEXT and RICH_TEXT, `false` otherwise.

- Saving a version writes its shared fields to every other version of the same item.
- Turning a field from translated to shared copies the default-language version's value (or, without one, the oldest version's) to all versions; the model builder warns before saving.
- Turning a field from shared to translated keeps each version's current value.

### 3.4 References

RELATION values store item ids. After migration every existing entry id is also its item id, so stored references stay valid. Validation checks that the item exists (any version).

### 3.5 Migration

Runs automatically at backend startup and is idempotent; also available as `pnpm --filter @thecms/backend migrate:languages`.

1. If `languages` is empty, create `{ code: 'en', name: 'English', isDefault: true, order: 0 }`.
2. For every entry without `language`: set `language` to the default code and `itemId` to its own `_id`.
3. Create the new indexes.

## 4. Admin API (additive)

| Endpoint | Behaviour |
|---|---|
| `GET /languages` | List in order |
| `POST /languages` | Create `{ code, name }`; `409` when the code exists |
| `PUT /languages/:code` | Rename |
| `PUT /languages/:code/default` | Make default |
| `DELETE /languages/:code?confirm=<code>` | Delete with its versions; `400` without the matching `confirm`; `409` for the default or last language |
| `POST /entries` (existing) | Accepts optional `language` (defaults to the default language) |
| `GET /entries` (existing) | New `language` filter and `missing=<code>` (items with no version in that language); response items gain `language`, `itemId`, `languages: string[]` (codes of all versions of the item) |
| `GET /entries/:id/versions` | Every version of the entry's item: `{ id, language, status, title, updatedAt }` |
| `POST /entries/:id/versions` | `{ language }`: new DRAFT version copied from `:id` (translated and shared fields); `409` when the language exists |
| `PUT /entries/:id/language` | `{ language }`: move the version to another language; `409` when taken |
| `GET /stats` (existing) | `entries.total` counts items (distinct `itemId`); status counts count versions |

Errors keep the existing `{ success: false, error, details? }` shape.

## 5. Public API (additive)

- `GET /public/content/:type`, `GET /public/content/:type/:id`, `GET /public/search` accept `?language=<code>`. Missing: default language. Unknown code: `400` listing valid codes.
- Per item the response uses the published version in the requested language, else the published version in the default language, else the item is left out (`404` for the single-entry endpoint).
- Response items gain `language` and `fallback: boolean`. Existing fields are unchanged.
- `/public/content/:type/:id` accepts an item id or a version id.
- Lists choose one version per item in a single aggregation before sorting and paging, so totals and page sizes are correct. The plan verifies this pipeline against Cosmos DB rules.

## 6. Webhooks

Events stay per version (`entry.published` and so on). Payloads gain `language` and `itemId`.

## 7. Admin UI

- **Setup, Languages page:** list with code, name and default badge; add, rename, make default (confirm), delete (typed confirm, shows the number of versions that will be deleted).
- **Entry editor:** language switcher in the top bar listing every configured language with its version's status or "Missing"; choosing a missing language offers "Translate to <language>" (creates a copy). Shared fields show a "Same in all languages" hint. Side panel "Languages" section lists the versions and offers "Change language" for the current version, with a warning when the entry would have no version in the default language. Switching language uses the unsaved-changes guard.
- **Content list:** language filter ("All languages" shows every version), "Missing in <language>" filter, a language badge per row and the other languages the item has.
- **Model builder:** "Translated" switch per field with the defaults above and the warning from 3.3.
- **Home:** entry counts per item.
- All new UI text is translated (English and Czech) and covered by the lint guard.

## 8. Example site

`examples/*` reads `VITE_CONTENT_LANGUAGE` and passes it as `language=`. After migration everything is English; once versions are moved to Czech, either set the site to `cs` or make Czech the default.

## 9. Error handling

- Two requests creating the same language version: the unique index rejects the second with `409`; the admin shows "This language already exists".
- A version whose language was deleted cannot exist (deleting a language deletes its versions).
- Moving the only version of an item away from the default language makes the item invisible to sites that request the default language without a matching version; the "Change language" dialog says so before confirming.

## 10. Testing

- Backend (Jest, in-memory MongoDB): migration idempotence and preserved ids; languages rules; versions endpoints and `409`s; shared-field sync; field `localized` changes; public fallback with correct totals and paging; unknown language `400`; webhook payloads; the Cosmos sort/index test extended to every new query.
- Admin (Vitest): Languages page; editor language switcher, Translate, Change language, unsaved guard; Content list filters; model builder switch; Czech and English.
- Browser: on local data, move an entry from English to Czech, publish, read it through the public API with and without `language=cs`; example site with `VITE_CONTENT_LANGUAGE`.

## 11. Delivery

1. **Backend:** languages module, entry fields and migration, versions endpoints, shared-field sync, public API language and fallback, webhooks.
2. **Admin and example site:** Languages page, editor, Content list, model builder, Home counts, example site config, browser verification.

## 12. Out of scope

- Machine translation.
- Per-language URL slugs for entries (entries have no slugs today).
- `Accept-Language` header negotiation in the public API.
- Translation workflow states (review, approval) beyond draft and published.
- Marking a translation as outdated when its source changes.
