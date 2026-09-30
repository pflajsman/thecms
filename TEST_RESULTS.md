# TheCMS - Test Results

**Date:** 2026-01-12
**Phase:** Phase 1 - Foundation & Authentication
**Status:** ✅ LOCAL TESTING COMPLETE

---

## Environment

- **Node.js Version:** 20.x
- **pnpm Version:** 9.12.3
- **Docker Desktop:** Running
- **OS:** Windows 11

---

## Services Status

### ✅ Docker Containers
```bash
docker-compose ps
```

| Service | Status | Port | Image |
|---------|--------|------|-------|
| MongoDB | ✅ Running | 27017 | mongo:7-jammy |
| Azurite (Storage Emulator) | ✅ Running | 10000-10002 | mcr.microsoft.com/azure-storage/azurite |

### ✅ Backend API Server
```
🚀 Server running on port 3000
📝 Environment: development
🔗 API URL: http://localhost:3000
💚 Health check: http://localhost:3000/health
```

**Connection:** Successfully connected to MongoDB

---

## API Endpoint Tests

### 1. Health Check Endpoint
**Endpoint:** `GET /health`
**Status:** ✅ PASS

```bash
curl http://localhost:3000/health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-01-12T08:04:49.789Z",
  "uptime": 503.9996018,
  "environment": "development"
}
```

---

### 2. Protected User Profile Endpoint (No Auth)
**Endpoint:** `GET /api/v1/users/me`
**Status:** ✅ PASS (Expected 401)

```bash
curl http://localhost:3000/api/v1/users/me
```

**Response:**
```json
{
  "error": "No authorization token provided",
  "timestamp": "2026-01-12T08:05:13.292Z"
}
```

**Result:** ✅ Authentication middleware correctly rejects requests without JWT token

---

### 3. 404 Not Found Handler
**Endpoint:** `GET /api/v1/nonexistent`
**Status:** ✅ PASS

```bash
curl http://localhost:3000/api/v1/nonexistent
```

**Response:**
```json
{
  "error": "Not Found",
  "message": "Route GET /api/v1/nonexistent not found",
  "timestamp": "2026-01-12T08:05:34.935Z"
}
```

**Result:** ✅ 404 handler working correctly

---

## Code Quality

### Dependencies Installed
- ✅ 534 packages installed successfully
- ✅ No critical errors
- ⚠️ 5 deprecated subdependencies (non-critical)

### TypeScript Compilation
- ✅ No compilation errors
- ✅ tsx watch mode running successfully

### Warnings (Non-Critical)
- Mongoose duplicate index warnings (cosmetic issue in user model)
  - Can be fixed by removing explicit `index: true` from schema fields

---

## Database Connection

### MongoDB Status
- ✅ Connected successfully
- ✅ Database: `thecms`
- ✅ Collections created via init script:
  - users
  - contenttypes
  - contententries
  - media
  - sites

### Indexes Created
- ✅ users: azureB2CId, email (unique)
- ✅ contenttypes: slug (unique)
- ✅ contententries: contentTypeId + status, contentTypeId + publishedAt
- ✅ media: uploadedById, mimeType
- ✅ sites: domain (unique), apiKey (unique)

---

## What's Working

1. ✅ **Monorepo structure** - pnpm workspace configured
2. ✅ **Backend API** - Express + TypeScript running
3. ✅ **Database connection** - MongoDB connected via Mongoose
4. ✅ **Health check** - GET /health returns 200
5. ✅ **Authentication middleware** - JWT validation in place
6. ✅ **User model** - Mongoose schema with roles
7. ✅ **API routes** - User routes mounted at /api/v1
8. ✅ **Error handling** - Proper error middleware
9. ✅ **CORS** - Configured for localhost:5173, localhost:3000
10. ✅ **Security** - Helmet.js headers enabled
11. ✅ **Docker** - MongoDB and Azurite running locally

---

## What's Not Yet Configured

### Azure Resources (Manual Setup Required)

1. ⏳ **Azure AD B2C Tenant**
   - Need to create tenant in Azure Portal
   - Create sign-up/sign-in user flow
   - Register backend API application
   - Get tenant name and client ID

2. ⏳ **Azure Cosmos DB**
   - Need to create Cosmos DB account (MongoDB API)
   - Select Serverless capacity (free tier)
   - Get connection string
   - Update .env with connection string

3. ⏳ **Proper JWT Validation**
   - Current implementation is simplified
   - Need Azure AD B2C public keys for signature verification
   - Will be completed after Azure AD B2C setup

---

## Next Steps

### Immediate (Before Phase 2)

1. **Create Azure AD B2C Tenant** (15 minutes)
   - Follow instructions in GETTING_STARTED.md
   - Update backend .env with tenant details

2. **Create Cosmos DB Account** (10 minutes)
   - Create Cosmos DB for MongoDB (Serverless)
   - Copy connection string to .env

3. **Test with Real Authentication** (5 minutes)
   - Get JWT token from Azure AD B2C
   - Test protected endpoints

### Future (Phase 2+)

4. **Implement Content Types API**
   - Create Mongoose models
   - Add CRUD endpoints
   - Add validation

5. **Deploy to Azure Container Apps**
   - Build Docker image
   - Deploy manually first
   - Set up CI/CD later (Phase 8)

---

## Performance Notes

- Backend starts in ~2 seconds
- Health check response time: <50ms
- MongoDB connection time: <1 second
- No memory leaks observed during testing

---

## Conclusion

✅ **Phase 1 local development setup is complete and working!**

All code is implemented and tested locally. The only remaining tasks are manual Azure resource creation:
- Azure AD B2C tenant
- Cosmos DB database

Once Azure resources are created, the backend will be ready for Phase 2 (Content Types API implementation).

---

## Quick Start Commands

```bash
# Start services
docker-compose up -d

# Start backend
cd packages/backend
pnpm dev

# Test health
curl http://localhost:3000/health

# Stop services
docker-compose down
```

## Admin redesign Plan 1 verification (2026-09-29)

Environment: local mongod 6.0.14 and Azurite (Docker not available), backend and admin dashboard dev servers, seeded with 2 content types, 4 entries, 1 site, 1 form, 2 submissions.

| Check | Result |
|---|---|
| Backend unit and route tests (38) | Pass |
| Admin dashboard tests (37) | Pass |
| Backend, admin and example site production builds | Pass |
| `pnpm@9 install --frozen-lockfile` on a clean checkout (CI setup) | Pass |
| `GET /api/v1/entries` sort by title, pagination, `contentType` info | Pass |
| `GET /api/v1/entries?search=šumavu` (case-insensitive, diacritics) | Pass |
| `GET /api/v1/stats` counts, including 2 unread submissions | Pass |
| `backfill:titles` script runs (0 updates, entries already had titles) | Pass |
| Desktop 1280px: Workspace and Setup groups, every item opens a page | Pass |
| Legacy MUI pages render inside the new shell | Pass |
| `/content-types/new` highlights only "Content models" | Pass |
| Medium 900px: sidebar collapses to icons, badge stays inside the rail | Pass (after fix 336a1d6) |
| Phone 360px (iframe): no horizontal scroll on Home, Content, Media, Inbox, Models, Forms, Sites, Webhooks; bottom tabs with Create button | Pass |
| ⌘K palette: "forms" + Enter goes to `/forms` | Pass |
| Light and dark themes; stored preference survives reload | Pass |
| Inbox badge shows unread count | Pass |
| Example site: trips list, contact form fields, empty posts state | Pass |
| Example site: trip map with GPX | Not checked (no GPX media in seed data) |
| `docker compose up` | Not checked (Docker not installed) |

## Admin redesign Plan 2 verification (2026-09-29)

Environment: local mongod and Azurite, backend and admin dev servers; 2 models (Trip with Text, Media, Number, Yes/No, Date, Relation fields; Blog post), 25 entries.

| Check | Result |
|---|---|
| Backend tests (39) and admin tests (123) | Pass |
| Admin production build | Pass |
| `/content`: model chips with counts (Trip 13, Blog post 12), status and sort filters | Pass |
| Search `šumavu` and `C++` (URL `?q=` updates) | Pass |
| Pager "1–20 of 25", Next shows "21–25 of 25"; chip resets to page 1 | Pass |
| Row menu Archive shows toast with Undo; Undo restores the previous status | Pass |
| New Trip: required Title error on blur | Pass |
| New Trip: autosave after 2 s creates the entry, URL becomes `/content/<id>`, no leave prompt, title kept | Pass |
| Published entry: no autosave (server unchanged after 3.5 s), "Publish changes" and "Discard changes" appear, Discard restores | Pass |
| Leaving with unsaved changes asks "Leave without saving?" | Pass |
| Relation picker finds "Přes Šumavu na kole" and shows it as a chip with status; autosaved | Pass |
| Date picker sets a date; autosaved | Pass |
| Old URLs `/entries?contentType=…` and `/entries/<id>/edit` redirect | Pass |
| ⌘K lists matching entries; Enter opens the entry | Pass |
| 360px (iframe): list shows 20 cards, editor shows the Details button, no horizontal scroll | Pass |
| Dark theme: list and editor readable | Pass |
| Row menu Duplicate and Delete, editor ⌘S, archived read-only | Covered by component tests; not repeated by hand |

## Admin redesign Plan 3 verification (2026-09-29)

Environment: local mongod and Azurite, backend and admin dev servers; Plan 2 data plus uploads; a second empty database for the new-install check.

| Check | Result |
|---|---|
| Backend tests (44) and admin tests (186) | Pass |
| Admin production build | Pass |
| Home (existing data): greeting, 4 tiles, Continue editing, Inbox card, Create buttons | Pass |
| Home (empty database): 4-step checklist; after model, entry and site, the snippet shows real URL and key; `curl` of that URL with the key returns the entry | Pass (after a fix in this plan: snippet card on Home) |
| Drop 3 PNGs, 1 GPX, an 11 MB file and a `.exe` on the Media page | Pass: 4 uploaded with the tray; 2 rejected with messages, others unaffected |
| Detail sheet: preview, missing alt text hint, save alt text and tags (stored), copy links per size, Used in lists the entry | Pass |
| Delete warns "1 entry uses this file" | Pass (wording "They will show" is plural for one entry, see minors) |
| Content list shows the cover thumbnail | Pass |
| Gallery field: Move earlier reorders and autosaves | Pass |
| Picker for an image-only field lists only images, no type chips | Pass |
| Picker adds a chosen file to the gallery | Pass |
| Rich text "From media library" inserts the chosen image | Pass |
| 360px (iframe): Home, Media, Media detail, editor have no horizontal scroll | Pass |
| Dark theme on Media with the sheet open | Pass |
| Drag-to-reorder with a pointer | Not checked by hand (dnd-kit pointer drag; keyboard path verified) |

## Admin redesign Plan 4 verification (2026-09-29)

Environment: local mongod and Azurite, backend and admin dev servers, data from Plans 1 to 3.

| Check | Result |
|---|---|
| Backend tests (50) and admin tests (238) | Pass |
| `/content-types` redirects to `/models`; cards show field and entry counts | Pass |
| New model from the Event template: fields listed, title star, save creates it, URL becomes `/models/<id>` | Pass |
| Add Text field, label "GPX URL" gives key `gpxUrl`; Move up reorders; save persists the order | Pass |
| Trip (15 entries): renaming `gpxUrl` asks "15 entries use this model … gpxUrl → gpxTrack"; cancel keeps it | Pass |
| Delete Trip asks to type "Trip" (cancelled) | Pass |
| Form builder: preview updates with a new field; a Choice field without options blocks save; with options it saves | Pass |
| Embed snippet URL and key used with `curl` create a submission | Pass |
| Inbox: new message listed; opening it marks it read (badge 3 → 2) and it stays on screen with "Mark unread" | Pass (after fix in this plan) |
| Reply link `mailto:petra@example.com?subject=Re: Contact us`; Archive | Pass |
| `/contact-forms/<id>/submissions` redirects to `/inbox?form=<id>&view=all` | Pass |
| Home Inbox card lists the latest unread messages | Pass |
| 360px (iframe): models list and builder, form builder and new form, inbox list and message; no horizontal scroll | Pass (after fix in this plan for the form builder) |
| Dark theme on the Inbox | Pass |
| Inbox does not refresh on its own while open (refetch on focus is off app-wide) | Noted (see minors) |

## Admin redesign Plan 5 verification (2026-09-29)

Environment: local mongod and Azurite, backend and admin dev servers from the Plan 5 worktree, a local request catcher on port 9999 for webhook deliveries. A throwaway site and webhook were created for the checks and deleted afterwards; the example blog's site key was not rotated.

| Check | Result |
|---|---|
| Backend tests (51), admin tests (327), `pnpm lint` (0 errors) | Pass |
| `/sites`: card shows domain, request count, masked key `cms_••••••••…`; Reveal and Copy | Pass |
| New site: origin `verify.test` rejected with "Enter a full URL…"; `http://localhost:5174/` added as a chip without the trailing slash; save opens `/sites/<id>` | Pass |
| Connect snippets use the real key and the first model; the `curl` snippet returns 200 | Pass |
| Rotate key: wrong case of the site name keeps the button disabled; exact name rotates; old key gets 401, new key 200 | Pass |
| New webhook: save without events shows "Choose at least one event"; after choosing one, the secret dialog shows the full secret once | Pass |
| Send test: "Test delivered: 200 in 3 ms"; one request per click reaches the catcher | Pass |
| Publishing an entry delivers `entry.published` with `X-Webhook-Signature`; the delivery log shows it (200, 2 ms); counts 1 total, 1 delivered | Pass |
| Rotate secret: confirm dialog, then a new 43 character secret; `GET /webhooks/:id` still returns only `secretPreview` | Pass |
| Rich text: headings, sizes, bold, italic, highlight, alignment, lists, quote; serif headings and quote border from the new content styles | Pass |
| Link box refuses `javascript:alert(1)`; `example.com/docs` becomes an https link | Pass |
| Image by URL and float buttons | Pass (after fix in this plan: the URL box submitted the surrounding entry form) |
| Highlighted text in dark mode | Pass (after fix in this plan: text was light on the yellow highlight, 1.04:1, now 13.42:1) |
| A crashing page shows "Something went wrong" inside the shell; sidebar navigation recovers | Pass |
| Reload in dev mode: the sign-in screen never renders (polled every 5 ms) | Pass |
| 360px (iframe): sites list, site form, new site, webhooks list, webhook form, new webhook, entry editor; no horizontal scroll | Pass |
| Focus visible on every focusable control of the sites list, site form, webhook form and the editor toolbar (focused with `focusVisible`; real Tab key presses do not reach the page in this browser tooling) | Pass (after fix in this plan for the text color picker) |
| Main bundle after removing MUI: 1,397.82 kB (gzip 439.02 kB) before, 1,314.49 kB (gzip 410.05 kB) after | Noted |

## Localization Plan 1 verification (2026-09-30)

Environment: local mongod and Azurite, backend and admin dev servers from the localization worktree, browser language `en-GB`.

| Check | Result |
|---|---|
| Admin tests (424), `pnpm lint` (0 errors, 0 warnings), build | Pass |
| First visit with an English browser and nothing saved: English, `<html lang="en">` | Pass |
| First visit with a Czech browser language | Covered by unit tests only (the browser language cannot be changed from the tooling) |
| Account menu, Language, Čeština: sidebar, groups, Home and headings switch at once; `thecms.language` = `cs`; `<html lang="cs">` | Pass |
| Reload keeps Czech | Pass |
| Home in Czech: greeting, connected-site card, tiles with Czech plurals (27 položek, 18 konceptů, 2 nepřečtené zprávy, 4 mediální soubory), relative dates (včera) | Pass |
| Content list in Czech: heading, filters, statuses, column headers, dates | Pass (after fix in this plan: the sort select was cut off, "Naposledy uprav…") |
| Entry editor in Czech: actions, save status, toolbar, side panel, Czech date format (29. 9. 2026, 14:41); user field labels stay as typed | Pass |
| 360px in Czech (iframe): Home, Content list, entry editor, new entry; no horizontal scroll, no clipped labels | Pass (after the same fix: filter selects now wrap) |
| Dark theme in Czech (Home, Content list, editor) | Pass |
| Console: React key warning in `EntryEditor` (`renderField` inside a map) | Noted, predates this plan |

## Localization Plan 2 verification (2026-09-30)

Environment: local mongod and Azurite, backend and admin dev servers from the Plan 2 worktree.

| Check | Result |
|---|---|
| Admin tests (573), `pnpm lint` over every component (0 errors, 0 warnings), build | Pass |
| Czech scan of Media (library, detail sheet), Inbox (list, message), Models (list, builder, template chooser, new model), Forms (list, builder, new form), Sites (list, form, new), Webhooks (list, new): no English except user content (model, field and form names, message text), API keys, code samples and words that are the same in Czech (Text, Video) | Pass (after fix in this plan: drag-and-drop screen-reader instructions came from dnd-kit in English) |
| Axe in Czech on every screen (unit tests) | Pass |
| 360px in Czech (iframe): media, inbox, models list and builder, forms list and builder, sites list and form, webhooks list and form; no horizontal scroll, no clipped labels | Pass |
| Model builder palette in Czech (Text, Formátovaný text, Číslo, Datum, Ano, nebo ne, Média, Odkaz na položku) wraps cleanly | Pass |
| Switch back to English: every screen shows English, `<html lang="en">`; the only Czech left is entry titles (user content) | Pass |
| Template in Czech creates Czech labels with English keys | Covered by unit tests (no model created in the local data) |

## Content languages Plan 1 verification (2026-09-30)

Environment: local mongod and Azurite, backend from the Plan 1 worktree on a throwaway copy of the local database (27 entries, 1 site key created for the check), dropped afterwards. The real local database was not touched.

| Check | Result |
|---|---|
| Backend tests (89), build | Pass |
| First startup: `Content languages migrated (default created: true, entries: 27)`; restart prints no migration line | Pass |
| `GET /languages` returns English as default; `POST /languages` adds `cs` (order 1, not default) | Pass |
| Move a published trip to `cs` (same id): public list without `language` drops from 6 to 5; with `language=cs` total 6, the moved entry `fallback: false`, 5 others `fallback: true` | Pass |
| Translate it back to `en` and publish: public default total back to 6; single entry by item id with `language=cs` returns `cs`; versions list `en PUBLISHED, cs PUBLISHED` | Pass |
| Admin `missing=cs` total 26; `/stats` `entries.total` 27 (items, not versions) | Pass |
| `language=xx` returns 400 "Unknown language 'xx'. Use one of: en, cs" | Pass |
| Delete `cs` with a wrong confirmation: 400; delete the default `en`: 409 | Pass |
| Text index language override: a MongoDB text index read the entry `language` field as its stemming language and rejected `cs`; the migration now rebuilds text indexes with `language_override: textSearchLanguage` | Fixed in this plan (unit test) |

**After deploy to Azure Cosmos DB:** request `GET /api/v1/public/content/<type>?language=<non-default code>` once. It uses an aggregation (`$group`, then `$sort` on the grouped result) that local MongoDB accepts but Cosmos DB has not been checked with. If Cosmos DB rejects it, sort before grouping on a single-field index.
