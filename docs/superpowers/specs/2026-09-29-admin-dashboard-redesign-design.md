# Admin Dashboard Redesign: Design Spec

**Date:** 2026-09-29
**Status:** Draft for review
**Scope:** `packages/admin-dashboard` plus four small, backward-compatible backend additions in `packages/backend`

## 1. Intent

TheCMS is intended to become a product that other people install and use, not only a personal CMS. The admin dashboard must therefore be:

- **Intuitive for first-time users:** a guided first run, sensible empty states, templates instead of blank screens.
- **Fast for daily use:** one place to find any content, keyboard shortcuts, no unnecessary navigation.
- **Safe:** no silent failures, no lost edits, confirmation before destructive or breaking actions.
- **Responsive:** fully usable on a phone, not only readable.

### Success criteria

1. A new user can go from sign-in to a published entry and a working API call in about 5 minutes, following the Home checklist alone.
2. Any entry can be found from the Content list or the ⌘K palette without first choosing a content type.
3. No edit can be lost by navigating away, closing the tab or saving (save keeps the user in the editor).
4. Every mutation gives visible feedback (success toast or inline error with retry).
5. Every screen works at 360px width without horizontal scrolling.
6. WCAG AA contrast in light and dark themes; all actions reachable by keyboard.
7. The public API and the example site (`examples/`) keep working unchanged.

### Problems in the current dashboard this fixes

- Entries list: pagination state exists but has no control, so entries beyond the first 20 cannot be reached.
- Entries can only be listed after selecting a content type; no cross-type view or search.
- Entry rows display raw `key: value` pairs instead of a title.
- Editor: no unsaved-changes guard, Save navigates away, no Publish in edit mode, validation only on the server.
- Dashboard is static navigation tiles with no data.
- Native `confirm()` dialogs; failures only logged to the console; no toasts.
- Field builder: the "drag" handle only moves a field up; field names are forced to lowercase (the cause of `gpxUrl` being stored as `gpxurl`); Relation fields are a raw ID text box.
- No admin UI for webhooks, although the API exists.
- Monochrome MUI default styling, no dark mode, raw enum labels (`PUBLISHED`).

## 2. Decisions

| Topic | Decision |
|---|---|
| Audience | Product for others (newcomers and daily editors) |
| Visual direction | "Warm editorial": paper tones, serif headings, deep green primary accent, rounded surfaces; light and dark themes |
| UI stack | Migrate from MUI to Tailwind CSS v4 + shadcn/ui (Radix primitives) |
| Navigation | Two groups: Workspace (Home, Content, Media, Inbox) and Setup (Content models, Forms, Sites & API keys, Webhooks) |
| Entry editor | Canvas with fields plus a right side panel (status, cover, metadata, danger actions) |
| Backend | Small targeted additions only; no breaking changes |
| E-shop | Out of scope; sub-project 2 with its own spec. This design reserves a module-driven navigation for it |

## 3. Visual system

- **Tokens:** defined once as CSS variables in `src/styles/tokens.css`, with a light and a dark set. Tailwind v4 `@theme` maps them to utilities. Starting palette (from the approved mockup, refined during implementation to meet AA):
  - Light: background `#fbf8f3`, surface `#ffffff`, sidebar `#f3ede3`, border `#ebe3d6`, text `#2b2620`, muted text `#6b6257`, primary `#1f6f5c`, danger `#b3401f`.
  - Dark: warm charcoal equivalents (background around `#1c1916`, surface `#24201c`, text `#f3ede3`), same hue family for primary.
  - Status colors: Published (green on pale green), Draft (amber on pale amber), Archived (neutral), Unread (terracotta).
- **Typography:** serif for page titles, entry titles and large numbers (Newsreader); Inter for everything else. Self-hosted via `@fontsource`.
- **Shape and density:** 8 to 10px radius on cards and inputs, pill-shaped primary buttons and chips, comfortable spacing on touch sizes (min 40px targets on mobile).
- **Theme switching:** follows the OS by default; a toggle in the avatar menu overrides it (stored in `localStorage`, wrapped in try/catch).
- **Status labels:** human-readable ("Published", "Draft", "Archived"), never raw enums.

## 4. Information architecture and shell

### Module registry

`src/modules/registry.ts` exports a list of modules:

```ts
interface AppModule {
  id: string;                 // 'content'
  label: string;              // 'Content'
  icon: LucideIcon;
  group: 'workspace' | 'setup';
  path: string;               // '/content'
  routes: RouteObject[];
  mobileTab?: boolean;        // shown in the bottom tab bar
  badge?: () => UseQueryResult<number>; // e.g. unread count
  commands?: Command[];       // entries for the ⌘K palette
}
```

The sidebar, mobile bottom tabs, router and ⌘K palette are all derived from this list. Adding the future Commerce group means adding modules, not editing the shell.

### Desktop shell

- Left sidebar (collapsible to icons at medium widths): product name, search trigger (`⌘K`), Workspace group, Setup group, user menu at the bottom (name, theme toggle, sign out).
- Main area: breadcrumb, `PageHeader` (serif title, optional description, primary action on the right), content.

### Mobile shell (below 768px)

- Top bar with page title and search icon.
- Bottom tab bar: Home, Content, central **+** (create entry or upload media), Media, Inbox.
- Setup modules are reached from the avatar menu.

### Command palette (⌘K / Ctrl+K)

- Search entries by title (via `GET /entries?search=`), jump to any module, run actions ("New Trip", "Upload media", "New content model").

### Route map

| New path | Replaces |
|---|---|
| `/` | `/` |
| `/content`, `/content/new?type=`, `/content/:id` | `/entries`, `/entries/new`, `/entries/:id/edit` |
| `/media` | `/media` |
| `/inbox`, `/inbox/:submissionId` | `/contact-forms/:formId/submissions` |
| `/models`, `/models/new`, `/models/:id` | `/content-types/...` |
| `/forms`, `/forms/new`, `/forms/:id` | `/contact-forms/...` |
| `/sites`, `/sites/new`, `/sites/:id` | `/sites/...` |
| `/webhooks`, `/webhooks/new`, `/webhooks/:id` | (new) |

Old paths redirect to the new ones. Filter, sort and page state for lists live in the URL query string.

## 5. Screens

### 5.1 Home

Two states, chosen from `GET /stats`:

- **New install** (no content model or no site yet): a setup checklist.
  1. Sign in (done).
  2. Create a content model (templates: Blog post, Page, Event; or from scratch).
  3. Write your first entry.
  4. Connect a site (creates a site and shows a copy-paste fetch snippet with the real API URL and key).
  Steps tick automatically from stats. The checklist can be dismissed.
- **Active install:** greeting, stat tiles (entries, drafts, unread messages, media), "Continue editing" (most recently updated drafts), "Inbox" (latest unread), quick-create buttons for each content model plus "Upload media".

### 5.2 Content list

- One list across all content types.
- Filter chips by type (with counts) and a status dropdown; search box; sort by last edited (default), title or created date.
- Rows: thumbnail (first media field, if any), title (serif), type, "edited X ago", status pill. Row click opens the editor. Row menu: publish or unpublish, archive, duplicate, delete.
- Pagination: page controls on desktop, "Load more" on mobile. Shows "1 to 20 of N".
- **+ New** is a split button: default opens a type chooser; the menu lists content models directly.
- Empty states: no models yet (link to create one from a template); no entries (create the first one); no results for filters (clear filters).

### 5.3 Entry editor (layout A)

- **Top bar:** back to Content, breadcrumb with the type name, save state indicator ("Saved", "Saving…", "Unsaved changes", "Save failed, retry"), secondary button, primary button.
- **Canvas:** the title field rendered large (serif), then the other fields in model order. Fields placed side by side on wide screens when both are short (Number, Date, Boolean).
- **Side panel:** status with history hint (for example "Published 12 Sep"), the first media field as cover, metadata (created, edited, ID with copy), Archive and Delete. On mobile the panel becomes a "Details" bottom sheet.
- **Buttons by state:**
  - New or Draft: "Save draft" and "Publish".
  - Published with no changes: "Unpublish" (in the menu) and a disabled "Published" state.
  - Published with changes: "Publish changes" (primary) and "Discard changes".
  - Archived: "Restore to draft".
- **Autosave:** drafts only, 2 seconds after the last change, and on blur. Published entries never autosave, because updates to a published entry are live immediately.
- **Saving never navigates away.** A toast confirms; `⌘S` / `Ctrl+S` saves.
- **Unsaved-changes guard:** React Router blocker plus `beforeunload`.
- **Validation:** a zod schema generated from the model's fields using the same rules as `packages/backend/src/modules/content-entries/validation.helper.ts` (required, minLength, maxLength, min, max, pattern). Errors show under the field as the user types after first blur, and on save the editor scrolls to the first error. Server errors are mapped back to fields when the response identifies one; otherwise shown in a banner.
- **Field controls:**
  - Text: input; shows a character counter when `maxLength` is set.
  - Rich text: TipTap with a restyled toolbar (existing extensions kept, including media insertion via the shared media picker).
  - Number: numeric input with min and max.
  - Date: shadcn date picker (react-day-picker).
  - Boolean: switch with label and description.
  - Media: thumbnails with drag-to-reorder when multiple; drop files directly onto the field to upload; "Choose from library" opens the shared picker. Respects `allowedMimeTypes` and `multiple`.
  - Relation: searchable combobox over `GET /entries`, filtered by `allowedContentTypes`, showing title, type and status; supports `multiple`.
- **Duplicate:** creates a new draft with the same data and title suffixed " (copy)".

### 5.4 Media library

- Masonry grid of thumbnails; filter chips (All, Images, Documents, Video); search; sort by newest.
- Drop files anywhere on the page to upload; multiple concurrent uploads with a progress tray.
- Clicking an item opens a detail drawer: large preview, file info (dimensions, size, type), alt text (with a "missing alt text" hint on images), description, tags, copy URL per variant, **Used in** list (from `GET /media/:id/usage`), delete (confirmation warns when the item is in use).
- The same `MediaGrid` component powers the picker dialog used by Media fields and the rich text editor (replacing today's two separate implementations).

### 5.5 Inbox

- Two-pane layout on desktop (list and reading pane); list then detail screen on mobile.
- Filter by form; tabs for Unread, All and Archived.
- Reading pane: submitted fields, time, email delivery status (shows the error if the notification email failed), actions Mark read or unread, Archive, Delete, and **Reply** (a `mailto:` link using the first Email-type field of the submission, when present).
- Opening a message marks it read.
- The unread count is the Inbox badge in the sidebar and tab bar.

### 5.6 Content models (builder)

- List of models as cards: name, slug, field count, entry count, last updated.
- **New model:** choose a template (Blog post, Page, Event) or "Start from scratch". Templates are defined in the frontend as field lists; nothing is created until the user saves.
- **Builder:** field list on the left with drag handles (dnd-kit, keyboard accessible), "Add field" palette (Text, Rich text, Number, Date, Yes/No, Media, Reference). Selecting a field opens the inspector on the right (a bottom sheet on mobile):
  - Label; API key generated from the label in camelCase (editable; locked icon once the model has entries).
  - Description (help text shown in the editor).
  - Required; type-specific rules (length, range, pattern, allowed file types, multiple, allowed content types).
  - "Use as title" (sets `titleField`; the star icon in the list).
- **Guardrails:**
  - Renaming the API key or deleting a field on a model with entries opens a confirmation stating the entry count and that sites reading this field will stop receiving it.
  - Deleting a model with entries is blocked unless the user types the model name.
- Existing lowercase keys are left as they are; no automatic renaming.

### 5.7 Forms

- List of forms with submission counts and active state.
- Builder with the same list plus inspector pattern as content models, for form field types (Text, Email, Textarea, Select, Number, Checkbox, Date).
- Live preview of the rendered form next to the builder (stacked on mobile).
- Settings: name, slug, recipient email, linked site, active toggle.
- "Embed" panel with the public endpoints and a fetch example for submitting.

### 5.8 Sites & API keys

- Site cards: name, domain, active state, request count, last request time.
- API key masked, with Reveal and Copy. Rotate requires typing the site name and warns that the old key stops working immediately.
- Allowed origins editor (chips).
- "Connect your site" panel: JavaScript `fetch` and `curl` snippets using the real API URL, key and the first content model slug.

### 5.9 Webhooks (new screen)

- List: URL, events count, active state, last delivery result.
- Create and edit: URL, event checkboxes grouped by area (entries, media, forms), linked site (optional), active toggle, secret (reveal, copy, rotate via `POST /webhooks/:id/rotate-secret`).
- **Send test** (`POST /webhooks/:id/test`) with the result shown inline.
- **Delivery log** (`GET /webhooks/:id/logs`): time, event, status code, duration, expandable response body.

### 5.10 Sign-in and loading

- Sign-in screen in the new visual style; keeps the existing MSAL and local auth flow in `AuthContext`.
- App-level loading uses a skeleton shell, not a centered "Loading…" text.

## 6. Shared UX patterns

- **Feedback:** every mutation shows a Sonner toast on success; failures show a toast with the server message and, where it makes sense, an inline retry.
- **Undo:** archive and unpublish from lists show a toast with Undo (re-runs the inverse action).
- **Confirmation:** shadcn `AlertDialog` replaces `confirm()`. Irreversible actions with wide impact (delete model with entries, rotate API key) require typing the resource name.
- **Loading:** skeletons shaped like the final content.
- **Empty states:** icon, one sentence, one primary action.
- **Errors:** page-level load errors render inline with a Retry button; a route-level error boundary catches render errors.
- **Keyboard:** `⌘K` palette, `⌘S` save, `N` new entry on the Content list, `Esc` closes drawers and dialogs; visible focus rings everywhere.
- **Dates:** relative for recent ("2h ago"), absolute on hover and for older items; formatted with `date-fns` in the browser locale.
- **Accessibility:** WCAG AA contrast in both themes, labelled controls, focus management in dialogs and drawers (Radix), reduced-motion respected.

## 7. Backend changes

All additions; no existing endpoint changes its request or response shape. Public (`/api/v1/public/*`) endpoints are untouched.

### 7.1 `GET /api/v1/entries`

Admin-authenticated list across content types.

- Query: `contentTypeId` (optional, repeatable), `status` (optional), `search` (optional), `sortBy` (`updatedAt` default, `createdAt`, `title`), `sortOrder`, `page`, `limit` (max 100).
- Response: the existing `PaginatedResponse<ContentEntry>` shape, each entry including `title` and a minimal `contentType` (`id`, `name`, `slug`).
- Search: case-insensitive prefix and substring match on the stored `title` (escaped regex), not `$text`. Reason: Azure Cosmos DB for MongoDB has limited `$text` support; this choice avoids depending on it. (Not verified against the production Cosmos instance; this is a precaution.)

### 7.2 Title field

- Content type gets optional `titleField: string` (must name a Text field of that type; validated in the zod schema). If unset, the first Text field is used.
- Content entry gets `title: string` (indexed), set on create and update from the resolved title field. Empty values fall back to "Untitled".
- When a model's `titleField` changes, its entries' `title` values are recomputed in the update handler.
- One-off script `src/scripts/backfill-entry-titles.ts` fills `title` for existing entries (same style as `sync-indexes.ts`).

### 7.3 `GET /api/v1/stats`

Returns counts for Home and badges:

```json
{
  "entries": { "total": 23, "draft": 4, "published": 18, "archived": 1 },
  "contentTypes": 3,
  "media": 61,
  "sites": 1,
  "submissions": { "unread": 3 }
}
```

### 7.4 `GET /api/v1/media/:id/usage`

Returns entries that reference the media item: id, title, content type name, status. Matches the media id in Media fields and in rich text HTML (image `src` containing the media URL or id). Used for "Used in" and delete warnings.

### Explicitly unchanged

- Webhooks: test, logs and rotate-secret endpoints already exist.
- Field name rules: the backend already accepts camelCase (`/^[a-zA-Z][a-zA-Z0-9_]*$/`); only the admin changes.

## 8. Frontend architecture

### Stack

- Kept: React 19, Vite, TypeScript, React Router 7, TanStack Query 5, axios (`src/lib/api.ts`), MSAL, TipTap 3 (headless).
- Added: Tailwind CSS v4, shadcn/ui (Radix), lucide-react icons, react-hook-form, zod, dnd-kit, cmdk, sonner, react-day-picker, `@fontsource` fonts.
- Removed at the end: `@mui/material`, `@mui/icons-material`, `@mui/x-date-pickers`, `@emotion/*`.

### Structure

```
src/
  app/              router, providers, shell (Sidebar, MobileTabs, TopBar, CommandPalette)
  modules/          registry.ts
  features/
    home/ content/ media/ inbox/ models/ forms/ sites/ webhooks/
      pages/  components/  api.ts (query hooks + keys)
  components/
    ui/             shadcn components
    common/         PageHeader, EmptyState, StatusPill, ConfirmDialog, DataList,
                    MediaGrid, FieldInspector, SaveIndicator
  lib/              api client, format, entry-schema (fields -> zod), hooks (useAutosave, useUnsavedGuard, useHotkey)
  styles/           tokens.css, globals.css
  types/            existing shared types (extended with title, titleField)
```

Each feature folder owns its queries. Query keys come from one factory per feature so invalidation is consistent. Services in `src/services/*` are folded into the feature `api.ts` files.

### Key units

- `lib/entry-schema.ts`: `buildEntrySchema(fields: Field[]) => ZodObject`. Pure, unit-tested.
- `lib/hooks/useAutosave.ts`: debounced save with state machine (`idle`, `dirty`, `saving`, `saved`, `error`); disabled for published entries.
- `lib/hooks/useUnsavedGuard.ts`: router blocker plus `beforeunload`.
- `components/common/DataList.tsx`: column definitions render a table on desktop and cards on mobile.
- `components/common/MediaGrid.tsx`: shared grid for the library page and picker dialog (select mode).

## 9. Migration plan (outline for the implementation plan)

All work on a feature branch; the app is usable after every step.

1. **Foundation:** Tailwind v4 and shadcn setup, tokens and fonts, module registry, new shell (sidebar, mobile tabs, top bar, command palette skeleton), sign-in screen, toasts. Old MUI pages render inside the new shell during migration (MUI `CssBaseline` removed; any conflicts with Tailwind preflight fixed per page).
2. **Content:** backend 7.1 and 7.2 (with backfill script), Content list, entry editor, entry schema, autosave, unsaved guard, relation picker.
3. **Home:** backend 7.3, both Home states, setup checklist.
4. **Media:** backend 7.4, library, detail drawer, shared picker, uploads.
5. **Content models:** builder, templates, guardrails, camelCase keys, title field.
6. **Inbox and Forms.**
7. **Sites & API keys, Webhooks.**
8. **Cleanup:** remove MUI and Emotion, old routes become redirects, accessibility and responsive pass, bundle size check.

## 10. Testing

- **Dashboard:** add Vitest and React Testing Library.
  - Unit: `buildEntrySchema` (every rule, every field type), `useAutosave` state transitions and the published-entry rule, module registry to nav derivation, camelCase key generation.
  - Component: entry editor save, publish and "publish changes" flows; unsaved guard; Content list filters and pagination write to the URL.
- **Backend:** Jest (already configured) with `mongodb-memory-server`.
  - `GET /entries` filtering, sorting, pagination and search.
  - Title computation on create, update and `titleField` change; backfill script.
  - `GET /stats` counts; `GET /media/:id/usage` for field and rich text references.
- **Manual check per step:** run the app, verify the changed screens at desktop width and at 360px, in light and dark themes.
- **Compatibility check:** the example site (`examples/`) still loads posts, trips, pages and the contact form against the changed backend.

## 11. Out of scope

- E-shop (sub-project 2; the module registry is its extension point, and the Inbox two-pane pattern is intended for Orders).
- Roles and permissions, entry version history, scheduled publishing, live preview.
- Localizing the admin UI (English only).
- Renaming existing lowercase field keys.
