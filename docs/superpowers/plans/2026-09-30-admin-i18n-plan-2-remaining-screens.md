# Admin Localization, Plan 2: Remaining Screens and App-wide Guard

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Media, Inbox, Content models, Forms, Sites and Webhooks are fully usable in Czech, and the lint guard covers every component in the app so new untranslated text fails `pnpm lint`.

**Architecture:** Same pattern as Plan 1: one catalog namespace per feature, components use `useTranslation(ns)`, helpers outside components call `i18n.t` when they run (never at module load). Constants that hold copy (field type labels, templates, event groups, delivery statuses) become functions or key maps. The final task replaces the per-file lint scope with the whole `src` tree.

**Tech Stack:** i18next 26, react-i18next 17, date-fns, react-day-picker locale, eslint-plugin-i18next 6, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-30-admin-i18n-en-cs-design.md`

**Series:** Plan 2 of 2. Plan 1 (foundation, shell, Home, Content, editor) is merged on `main`.

## Global Constraints

- Languages: English (`en`, default) and Czech (`cs`). Server messages stay as sent; user content (entries, model, field, form and site names) is never translated.
- No backend or public API change.
- English catalog values equal today's English text exactly, so existing tests keep passing. Any English change is ledgered.
- Czech terms follow the spec glossary (section 6). Buttons use the infinitive. Czech quotes: `„{{name}}“`.
- Plurals: English `_one`/`_other`, Czech `_one`/`_few`/`_other`. Never `count === 1 ? '' : 's'`.
- Text built outside React is built when it is needed (at render or call time), never at module load, so a language switch updates it.
- Cross-namespace lookups use `t(key, { ns: 'common' })` (typed keys reject the `ns:` prefix inside a namespaced `t`); plain `i18n.t('ns:key')` is fine outside components.
- Never use an em dash in UI copy, code comments or docs.
- Every screen works at 360px in both languages without horizontal scrolling or clipped labels.

## Decisions (deviations from the spec, for the reviewer)

1. **Form embed snippet:** the spec expected button and success text in the snippet. The snippet is a `fetch` example with no user-facing text, so only the panel around it is translated. The example value for text fields stays `…`.
2. **Model templates** keep their field keys (`title`, `excerpt`, `coverImage`, …) in every language; only the model name, description, field labels and help text follow the admin language. A Czech user who picks "Článek blogu" gets a model named "Článek blogu" with labels "Název", "Perex", "Titulní obrázek", "Obsah" and the same keys as in English, so API consumers are unaffected.
3. **New forms** start with default fields whose labels follow the admin language (`Jméno`, `E-mail`, `Zpráva`); their keys stay `name`, `email`, `message`.
4. **Lint scope** becomes the whole app (`src/**/*.tsx` minus tests, `components/ui` and `src/test`), plus an explicit list of copy-producing `.ts` modules checked in `mode: 'all'`. The plugin does not flag strings inside object literals or arrays (verified in Plan 1), so each task's Czech render tests are the check for list constants.
5. **Two Plan 1 minors are folded in** because they are the same kind of gap: calendar screen-reader labels (react-day-picker Czech locale) and error text held in component state (`MediaField` drop error, toolbar link error) now translate at render.

## Review Focus

1. **Module-level copy frozen at import** (templates, field type labels, event groups, status maps): after switching to Czech the builder palette, event checkboxes and delivery statuses must show Czech. Tested in Tasks 3, 4 and 6.
2. **Czech plural boundaries 1, 2, 5** for the counts on these screens (files uploading, entries using a file or model, fields, submissions, events, requests). Tested in Tasks 1, 3, 4, 5, 6.
3. **Templates in Czech** create a model with Czech labels but English keys; saving must send `titleField: 'title'`. Tested in Task 3.
4. **Server messages** (for example a Zod error in a toast) must still appear exactly as sent while the surrounding UI is Czech. Tested in Task 5.
5. **Long Czech labels at 360px** on builder palettes, filter chips, card badges and dialog buttons. Checked in Task 8.

---

## File Structure

All paths are relative to `packages/admin-dashboard`.

| File | Change |
|---|---|
| `src/i18n/resources.ts` | Adds namespaces `media`, `inbox`, `models`, `forms`, `sites`, `webhooks`, `builder` |
| `src/i18n/locales/{en,cs}/<ns>.json` | New catalogs |
| `src/features/media/**` | Media library, picker, detail sheet, upload tray, filters, `media-utils` (sizes, upload errors) |
| `src/features/inbox/**` | Inbox page, message view, `inbox-utils` (Yes/No/Anonymous) |
| `src/features/builder/**` | Shared field list, inspector panel, `api-key` messages |
| `src/features/models/**` | List, builder, inspector, template chooser, `templates.ts` → `getModelTemplates()`, `model-draft` labels and validation |
| `src/features/forms/**` | List, builder, inspector, preview, embed panel, `form-draft` labels, defaults and validation |
| `src/features/sites/**` | Pages, connect snippets, `sites-utils` messages |
| `src/features/webhooks/**` | Pages, secret dialog, delivery log, `webhook-events` labels and validation |
| `eslint.config.js`, `i18n-scope.json`, `src/i18n/source-scan.test.ts` | App-wide guard |
| `src/features/content/editor/fields/DateField.tsx`, `MediaField.tsx`, `src/components/rich-text/EditorToolbar.tsx` | Plan 1 minors (Decision 5) |

---

## Task 1: Media

**Files:**
- Modify: `src/features/media/pages/MediaLibraryPage.tsx`, `src/features/media/components/{MediaFilters,MediaGrid,MediaTile,MediaPickerDialog,MediaDetailSheet,UploadTray}.tsx`, `src/features/media/{media-utils,useUploadQueue,useFileDrop}.ts`, `src/i18n/resources.ts`, catalogs `media.json` (both), `i18n-scope.json`
- Test: `src/features/media/pages/MediaLibraryPage.test.tsx`, `src/features/media/media-utils.test.ts`, `src/features/media/components/MediaPickerDialog.test.tsx`

**Interfaces:**
- Consumes: Plan 1 `i18n`, `setTestLanguage`, `formatNumber`, `formatRelative`, `formatAbsolute`.
- Produces: `formatBytes(bytes)` uses `formatNumber` (Czech decimal comma); `validateUpload`-style messages (the existing function at `media-utils.ts:50-54`) via `i18n.t('media:upload.*')`; namespace `media` added to `NAMESPACES`.

- [ ] **Step 1: Register the namespace**

In `src/i18n/resources.ts` import `./locales/{en,cs}/media.json`, add `'media'` to `NAMESPACES` and to both resource objects. Create both files with `{}`.

- [ ] **Step 2: Write the failing tests**

`src/features/media/media-utils.test.ts` (append; import `i18n` from `@/i18n`):

```ts
describe('in Czech', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('cs')
  })

  it('formats sizes with a decimal comma', () => {
    expect(formatBytes(1536 * 1024)).toBe('1,5 MB')
    expect(formatBytes(2048)).toBe('2 KB')
  })

  it('explains rejected uploads in Czech', () => {
    const big = new File(['x'], 'mapa.png', { type: 'image/png' })
    Object.defineProperty(big, 'size', { value: 11 * 1024 * 1024 })
    expect(uploadError(big)).toBe('Soubor mapa.png je větší než 10 MB.')
    expect(uploadError(new File(['x'], 'skript.exe', { type: 'application/x-msdownload' }))).toBe('Soubor skript.exe má nepodporovaný typ.')
  })
})
```

(Use the real exported name of the function at `media-utils.ts:50` in place of `uploadError` if it differs.)

`src/features/media/pages/MediaLibraryPage.test.tsx` (append; reuses `routes` and the `beforeEach` mocks; import `setTestLanguage`):

```tsx
describe('in Czech', () => {
  it('shows the library in Czech', async () => {
    await setTestLanguage('cs')
    renderRoutes(routes, { route: '/media' })
    expect(await screen.findByRole('heading', { level: 1, name: 'Média' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Nahrát/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Obrázky' })).toBeInTheDocument()
  })

  it('counts entries that use a file with Czech plurals', async () => {
    await setTestLanguage('cs')
    const use = (id: string) => ({ id, title: `E ${id}`, status: 'DRAFT' as const, contentType: { id: 't', name: 'Trip', slug: 'trip' } })
    vi.mocked(api.getMediaUsage).mockResolvedValue([use('a'), use('b')])
    renderRoutes(routes, { route: '/media?item=m1' })
    expect(await screen.findByText(/2 položky používají tento soubor/)).toBeInTheDocument()
  })
})
```

(Match the usage item shape the existing "shows where the file is used" test passes to `getMediaUsage`; the assertion text is what matters.)

`src/features/media/components/MediaPickerDialog.test.tsx` (append, reusing its render helper):

```tsx
it('labels the multi-select button with Czech plurals', async () => {
  await setTestLanguage('cs')
  expect(i18n.t('media:picker.chooseCount', { count: 1 })).toBe('Vybrat 1 soubor')
  expect(i18n.t('media:picker.chooseCount', { count: 3 })).toBe('Vybrat 3 soubory')
  expect(i18n.t('media:picker.chooseCount', { count: 5 })).toBe('Vybrat 5 souborů')
})
```

- [ ] **Step 3: Run to verify they fail**

Run: `cd packages/admin-dashboard && pnpm test -- src/features/media`
Expected: FAIL, English text; missing `media:picker.chooseCount`.

- [ ] **Step 4: Implement**

Required values in `media.json`:

| Key | en | cs |
|---|---|---|
| `title` | Media | Média |
| `upload` | Upload | Nahrát |
| `filters.image` | Images | Obrázky |
| `filters.document` | Documents | Dokumenty |
| `filters.video` | Videos | Videa |
| `filters.gpx` | GPX tracks | Trasy GPX |
| `upload.tooLarge` | {{name}} is larger than 10 MB. | Soubor {{name}} je větší než 10 MB. |
| `upload.unsupported` | {{name}} is not a supported file type. | Soubor {{name}} má nepodporovaný typ. |
| `upload.uploadingCount_one` | Uploading {{count}} file | Nahrává se {{count}} soubor |
| `upload.uploadingCount_few` | (not in en) | Nahrávají se {{count}} soubory |
| `upload.uploadingCount_other` | Uploading {{count}} files | Nahrává se {{count}} souborů |
| `upload.finished` | Uploads finished | Nahrávání dokončeno |
| `picker.choose` | Choose | Vybrat |
| `picker.chooseCount_one` | Choose {{count}} file | Vybrat {{count}} soubor |
| `picker.chooseCount_few` | (not in en) | Vybrat {{count}} soubory |
| `picker.chooseCount_other` | Choose {{count}} files | Vybrat {{count}} souborů |
| `detail.usedBy_one` | {{count}} entry uses this file. | {{count}} položka používá tento soubor. |
| `detail.usedBy_few` | (not in en) | {{count}} položky používají tento soubor. |
| `detail.usedBy_other` | {{count}} entries use this file. | {{count}} položek používá tento soubor. |

(For the tray, "Uploading 1 file…" keeps its ellipsis in the tray text and not in the toast; use two keys if the English differs, `upload.uploadingCount` for the toast and `upload.uploadingTray` with `…` for the tray.) The sentence after `usedBy` ("They will show a missing file…") is its own key. Every other text in the listed files (filters, search, sort, empty state, detail sheet labels and buttons, alt-text warning, delete confirmation, toasts, picker title and tabs, drop overlay) moves to `media.json` with its current English and a Czech translation. `formatBytes` formats the number with `formatNumber(value, { maximumFractionDigits: 1 })`; the unit (`B`, `KB`, `MB`) stays.

Add the listed `.tsx` files to `i18n-scope.json` and `media-utils.ts` to the `.ts` list (see Task 7 for the final format; until then append to `files`).

- [ ] **Step 5: Run tests, lint, build, commit**

Run: `cd packages/admin-dashboard && pnpm test && pnpm lint && pnpm build`
Expected: PASS, lint exits 0 with 0 warnings, build succeeds.

```bash
git add -A packages/admin-dashboard
git commit -m "feat(admin): translate Media"
```

---

## Task 2: Inbox

**Files:**
- Modify: `src/features/inbox/pages/InboxPage.tsx`, `src/features/inbox/components/MessageView.tsx`, `src/features/inbox/inbox-utils.ts`, `src/i18n/resources.ts`, `inbox.json` (both), `i18n-scope.json`
- Test: `src/features/inbox/pages/InboxPage.test.tsx`, `src/features/inbox/inbox-utils.test.ts`

**Interfaces:**
- Consumes: Task 1 pattern.
- Produces: namespace `inbox`; `displayFields` and `senderName` build "Yes", "No" and "Anonymous" with `i18n.t` at call time.

- [ ] **Step 1: Register the namespace** (as in Task 1 Step 1, for `inbox`).

- [ ] **Step 2: Write the failing tests**

`inbox-utils.test.ts` (append; import `i18n`):

```ts
it('shows booleans and anonymous senders in Czech', async () => {
  await i18n.changeLanguage('cs')
  const item = { id: 'x', formId: 'f', status: 'UNREAD', emailSent: true, createdAt: '', updatedAt: '', data: { agree: true, spam: false } } as unknown as InboxItem
  expect(displayFields(item).map((r) => r.value)).toEqual(['Ano', 'Ne'])
  expect(senderName(item)).toBe('Anonym')
})
```

`InboxPage.test.tsx` (append; reuses `routes`, `items` and the `beforeEach` mocks):

```tsx
describe('in Czech', () => {
  it('shows the inbox and a message in Czech, keeping the server email error as sent', async () => {
    await setTestLanguage('cs')
    renderRoutes(routes, { route: '/inbox/s1' })
    expect(await screen.findByRole('heading', { level: 1, name: 'Zprávy' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Odpovědět' })).toHaveAttribute('href', expect.stringContaining('mailto:jana@x.test'))
    expect(screen.getByText(/Oznámení e-mailem se nepodařilo odeslat: SMTP down/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Run to verify they fail**

Run: `cd packages/admin-dashboard && pnpm test -- src/features/inbox`
Expected: FAIL, English text.

- [ ] **Step 4: Implement**

Required values in `inbox.json`:

| Key | en | cs |
|---|---|---|
| `title` | Inbox | Zprávy |
| `reply` | Reply | Odpovědět |
| `emailFailed` | Notification email failed: {{error}} | Oznámení e-mailem se nepodařilo odeslat: {{error}} |
| `yes` | Yes | Ano |
| `no` | No | Ne |
| `anonymous` | Anonymous | Anonym |
| `views.unread` | Unread | Nepřečtené |
| `views.all` | All | Vše |
| `views.archived` | Archived | Archivované |

Every other text (form filter, empty and caught-up states, Older/Newer paging, mark read/unread, archive, delete confirmation, toasts, reply subject prefix `Re:`, message list labels) moves to `inbox.json`. The `Re: {{subject}}` mailto subject stays `Re:` in both languages. The server's `emailError` value is interpolated unchanged.

Add the `.tsx` files to the scope and `inbox-utils.ts` to the `.ts` list.

- [ ] **Step 5: Run tests, lint, build, commit**

Run: `cd packages/admin-dashboard && pnpm test && pnpm lint && pnpm build`
Expected: PASS.

```bash
git add -A packages/admin-dashboard
git commit -m "feat(admin): translate the Inbox"
```

---

## Task 3: Content models and the shared builder

**Files:**
- Modify: `src/features/builder/{FieldList,InspectorPanel}.tsx`, `src/features/builder/api-key.ts`, `src/features/models/pages/{ModelsListPage,ModelBuilderPage}.tsx`, `src/features/models/components/{ModelFieldInspector,TemplateChooser}.tsx`, `src/features/models/{templates,model-draft}.ts`, `src/i18n/resources.ts`, `builder.json`, `models.json` (both), `i18n-scope.json`
- Test: `src/features/models/pages/ModelsListPage.test.tsx`, `src/features/models/pages/ModelBuilderPage.test.tsx`, `src/features/models/model-draft.test.ts`, `src/features/builder/FieldList.test.tsx`, `src/features/builder/api-key.test.ts`

**Interfaces:**
- Consumes: Tasks 1 and 2 pattern.
- Produces:
  - `getModelTemplates(): ModelTemplate[]` replacing the `MODEL_TEMPLATES` constant (same shape; built with `i18n.t` on each call). Every import of `MODEL_TEMPLATES` switches to calling the function.
  - `fieldTypeLabel(type: FieldType): string` and `fieldTypeOptionLabel(type)` replacing direct reads of the two label maps in `model-draft.ts` (lines 6-13 and 72-79); built with `i18n.t` on each call.
  - `validateModelDraft` (existing name) and field-rule messages via `i18n.t('models:validation.*')`; `api-key` messages via `i18n.t('builder:key.*')`.

- [ ] **Step 1: Register namespaces** `builder` and `models` (as in Task 1 Step 1).

- [ ] **Step 2: Write the failing tests**

`ModelBuilderPage.test.tsx` (append; reuses `routes`, `trip` and the `modelsApi` mock):

```tsx
describe('in Czech', () => {
  it('creates a model from a template with Czech labels and English keys', async () => {
    await setTestLanguage('cs')
    vi.mocked(modelsApi.createModel).mockImplementation(async (body) => ({ ...trip, ...body, id: 'new1' }) as ContentType)
    renderRoutes(routes, { route: '/models/new' })
    await userEvent.click(await screen.findByRole('button', { name: /Článek blogu/ }))
    expect(screen.getByLabelText('Název')).toHaveValue('Článek blogu')
    const fields = within(screen.getByRole('list', { name: 'Pole' }))
    expect(fields.getByText('Titulní obrázek')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Uložit model' }))
    await waitFor(() => expect(modelsApi.createModel).toHaveBeenCalledWith(expect.objectContaining({ name: 'Článek blogu', slug: 'clanek-blogu', titleField: 'title' })))
    const sent = vi.mocked(modelsApi.createModel).mock.calls[0][0]
    expect(sent.fields.map((f: { name: string }) => f.name)).toEqual(['title', 'excerpt', 'coverImage', 'body'])
    expect(sent.fields[2].label).toBe('Titulní obrázek')
  })

  it('shows the field palette in Czech after switching language', async () => {
    renderRoutes(routes, { route: '/models/new?template=scratch' })
    await screen.findByRole('button', { name: 'Add Text field' })
    await setTestLanguage('cs')
    expect(screen.getByRole('button', { name: 'Přidat pole Formátovaný text' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Přidat pole Ano, nebo ne' })).toBeInTheDocument()
  })
})
```

(If the builder's slug helper does not strip diacritics, `slugify('Článek blogu')` decides the expected slug; assert whatever `slugify` returns for that input by importing it, and ledger the result.)

`ModelsListPage.test.tsx` (append):

```tsx
it('counts fields and entries with Czech plurals', async () => {
  await setTestLanguage('cs')
  vi.mocked(contentApi.listContentTypes).mockResolvedValue([tripType])
  renderRoutes([{ path: '/models', element: <ModelsListPage /> }], { route: '/models' })
  expect(await screen.findByText('3 pole · 8 položek')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Nový model' })).toHaveAttribute('href', '/models/new')
})
```

`model-draft.test.ts` (append; import `i18n`):

```ts
it('explains model errors in Czech', async () => {
  await i18n.changeLanguage('cs')
  const errors = validateModelDraft({ ...emptyDraft(), name: 'A', slug: 'A!' })
  expect(errors.name).toBe('Název musí mít alespoň 2 znaky')
  expect(errors.slug).toBe('Použijte malá písmena, číslice a pomlčky')
  expect(errors.fields).toBe('Přidejte alespoň jedno pole')
})
```

(Use the file's real draft factory and validator names in place of `emptyDraft` and `validateModelDraft`.)

`api-key.test.ts` (append):

```ts
it('explains key problems in Czech', async () => {
  await i18n.changeLanguage('cs')
  expect(keyError('1abc', [])).toBe('Začněte písmenem a používejte jen písmena, číslice a podtržítka')
  expect(keyError('title', ['title'])).toBe('Tento klíč už používá jiné pole')
})
```

(Use the real exported validator name from `api-key.ts`.)

- [ ] **Step 3: Run to verify they fail**

Run: `cd packages/admin-dashboard && pnpm test -- src/features/models src/features/builder`
Expected: FAIL, English text and English template.

- [ ] **Step 4: Implement**

Required values:

| Key | en | cs |
|---|---|---|
| `models:list.title` | Content models | Modely obsahu |
| `models:list.new` | New model | Nový model |
| `models:list.counts` | {{fields}} · {{entries}} | {{fields}} · {{entries}} |
| `models:count.fields_one` / `_few` / `_other` | {{count}} field / (not in en) / {{count}} fields | {{count}} pole / {{count}} pole / {{count}} polí |
| `models:count.entries_one` / `_few` / `_other` | {{count}} entry / (not in en) / {{count}} entries | {{count}} položka / {{count}} položky / {{count}} položek |
| `models:builder.save` | Save model | Uložit model |
| `models:builder.name` | Name | Název |
| `models:builder.fields` | Fields | Pole |
| `models:builder.addField` | Add {{type}} field | Přidat pole {{type}} |
| `models:builder.fieldOfType` | {{type}} field | Pole typu {{type}} |
| `models:types.TEXT` | Text | Text |
| `models:types.RICH_TEXT` | Rich text | Formátovaný text |
| `models:types.NUMBER` | Number | Číslo |
| `models:types.DATE` | Date | Datum |
| `models:types.BOOLEAN` | Yes or no | Ano, nebo ne |
| `models:types.MEDIA` | Media | Média |
| `models:types.RELATION` | Reference | Odkaz na položku |
| `models:templates.blogPost.name` | Blog post | Článek blogu |
| `models:templates.blogPost.fields.title` | Title | Název |
| `models:templates.blogPost.fields.excerpt` | Excerpt | Perex |
| `models:templates.blogPost.fields.coverImage` | Cover image | Titulní obrázek |
| `models:templates.blogPost.fields.body` | Body | Obsah |
| `models:templates.page.name` | Page | Stránka |
| `models:templates.event.name` | Event | Událost |
| `models:validation.nameMin` | Name must be at least 2 characters | Název musí mít alespoň 2 znaky |
| `models:validation.slug` | Use lowercase letters, numbers and hyphens | Použijte malá písmena, číslice a pomlčky |
| `models:validation.noFields` | Add at least one field | Přidejte alespoň jedno pole |
| `builder:key.pattern` | Start with a letter; use only letters, numbers and underscores | Začněte písmenem a používejte jen písmena, číslice a podtržítka |
| `builder:key.taken` | Another field already uses this key | Tento klíč už používá jiné pole |

`model-draft.ts` has two label maps: one for the palette (`BOOLEAN: 'Yes / No'`) and one for the inspector (`BOOLEAN: 'Yes or no'`). Keep both English values exactly (`models:types.BOOLEAN` = "Yes or no" and `models:palette.BOOLEAN` = "Yes / No"; Czech "Ano, nebo ne" for both). Existing tests keep querying `Add Text field`. The "N fields · N entries" line in `ModelBuilderPage` (line 147) and the delete and rename confirmations with entry counts use the `count.*` plurals. Every other text in the listed files (template chooser, inspector labels and help, validation rule labels, title field marker, "Untitled field", move buttons, delete confirmation, toasts, empty states) moves to `models.json` or `builder.json`. Template descriptions and field help texts get keys too.

`templates.ts`:

```ts
import { i18n } from '@/i18n'
// …existing ModelTemplate interface…

/** Built on each call so a template picked in Czech gets Czech names and labels (keys stay English). */
export function getModelTemplates(): ModelTemplate[] {
  const t = (key: string) => i18n.t(`models:templates.${key}`)
  return [
    {
      id: 'blog-post',
      name: t('blogPost.name'),
      description: t('blogPost.description'),
      // …same structure as today, with every label/description replaced by t('blogPost.fields.<key>') …
    },
    // page, event: same pattern
  ]
}
```

Keep every non-text property (ids, keys, types, required, validation, titleField) exactly as in today's `MODEL_TEMPLATES`. Replace each `MODEL_TEMPLATES` use with `getModelTemplates()`.

Add the `.tsx` files to the scope and `model-draft.ts`, `templates.ts`, `api-key.ts` to the `.ts` list.

- [ ] **Step 5: Run tests, lint, build, commit**

Run: `cd packages/admin-dashboard && pnpm test && pnpm lint && pnpm build`
Expected: PASS.

```bash
git add -A packages/admin-dashboard
git commit -m "feat(admin): translate content models, templates and the field builder"
```

---

## Task 4: Forms

**Files:**
- Modify: `src/features/forms/pages/{FormsListPage,FormBuilderPage}.tsx`, `src/features/forms/components/{FormFieldInspector,FormPreview,EmbedPanel}.tsx`, `src/features/forms/form-draft.ts`, `src/i18n/resources.ts`, `forms.json` (both), `i18n-scope.json`
- Test: `src/features/forms/pages/FormBuilderPage.test.tsx`, `src/features/forms/form-draft.test.ts`

**Interfaces:**
- Consumes: Task 3 builder keys (`builder:*`).
- Produces: `formFieldTypeLabel(type)`; the new-form default fields and all validation messages built with `i18n.t` when the draft is created or validated.

- [ ] **Step 1: Register the namespace** `forms`.

- [ ] **Step 2: Write the failing tests**

`FormBuilderPage.test.tsx` (append; reuses `routes`, `form`, `apiClient` and `sitesService` mocks):

```tsx
describe('in Czech', () => {
  it('starts a new form with Czech default labels and English keys', async () => {
    await setTestLanguage('cs')
    vi.mocked(apiClient.post).mockResolvedValue({ data: { success: true, data: { ...form, id: 'f9' } } })
    renderRoutes(routes, { route: '/forms/new' })
    await userEvent.type(await screen.findByLabelText('Název'), 'Kontakt')
    await userEvent.type(screen.getByLabelText('Odesílat odpovědi na'), 'me@x.test')
    const preview = screen.getByRole('region', { name: 'Náhled' })
    expect(within(preview).getByLabelText(/Jméno/)).toBeInTheDocument()
    expect(within(preview).getByLabelText(/E-mail/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Uložit formulář' }))
    await waitFor(() => expect(apiClient.post).toHaveBeenCalled())
    const body = vi.mocked(apiClient.post).mock.calls[0][1] as { fields: { name: string; label: string }[] }
    expect(body.fields.map((f) => f.name)).toEqual(['name', 'email', 'message'])
    expect(body.fields.map((f) => f.label)).toEqual(['Jméno', 'E-mail', 'Zpráva'])
  })

  it('shows the embed panel in Czech', async () => {
    await setTestLanguage('cs')
    renderRoutes(routes, { route: '/forms/f1' })
    expect(await screen.findByRole('heading', { name: 'Vložení na web' })).toBeInTheDocument()
    expect(screen.getByLabelText('Ukázka odeslání')).toHaveTextContent('/forms/contact-us/submit')
  })
})
```

`form-draft.test.ts` (append; import `i18n`):

```ts
it('explains form errors in Czech', async () => {
  await i18n.changeLanguage('cs')
  const errors = validateFormDraft({ ...newFormDraft(), name: '', recipientEmail: 'x' })
  expect(errors.name).toBe('Název je povinný')
  expect(errors.recipientEmail).toBe('Zadejte platnou e-mailovou adresu')
})
```

(Use the file's real factory and validator names.)

- [ ] **Step 3: Run to verify they fail**

Run: `cd packages/admin-dashboard && pnpm test -- src/features/forms`
Expected: FAIL.

- [ ] **Step 4: Implement**

Required values in `forms.json`:

| Key | en | cs |
|---|---|---|
| `list.title` | Forms | Formuláře |
| `builder.name` | Name | Název |
| `builder.sendTo` | Send submissions to | Odesílat odpovědi na |
| `builder.save` | Save form | Uložit formulář |
| `preview.title` | Preview | Náhled |
| `defaults.name` | Name | Jméno |
| `defaults.email` | Email | E-mail |
| `defaults.message` | Message | Zpráva |
| `embed.title` | Embed | Vložení na web |
| `embed.exampleLabel` | Submit example | Ukázka odeslání |
| `embed.noKey` | Connect a site to get an API key. | Připojte web a získáte API klíč. |
| `validation.nameRequired` | Name is required | Název je povinný |
| `validation.email` | Enter a valid email address | Zadejte platnou e-mailovou adresu |
| `count.submissions_one` / `_few` / `_other` | {{count}} submission / (not in en) / {{count}} submissions | {{count}} odpověď / {{count}} odpovědi / {{count}} odpovědí |

The embed panel's sentence around the URL becomes a `<Trans>` with the URL in a `<code>` component. Every other text in the listed files (field type labels, inspector, options editor, list status "Accepting submissions"/"Paused", delete confirmation with the submissions plural, toasts, templates) moves to `forms.json`.

Add the `.tsx` files to the scope and `form-draft.ts` to the `.ts` list.

- [ ] **Step 5: Run tests, lint, build, commit**

Run: `cd packages/admin-dashboard && pnpm test && pnpm lint && pnpm build`
Expected: PASS.

```bash
git add -A packages/admin-dashboard
git commit -m "feat(admin): translate forms, the form builder and the embed panel"
```

---

## Task 5: Sites and API keys

**Files:**
- Modify: `src/features/sites/pages/{SitesListPage,SiteFormPage}.tsx`, `src/features/sites/components/ConnectSnippets.tsx`, `src/features/sites/sites-utils.ts`, `src/i18n/resources.ts`, `sites.json` (both), `i18n-scope.json`
- Test: `src/features/sites/pages/SitesPages.test.tsx`, `src/features/sites/sites-utils.test.ts`

**Interfaces:**
- Produces: `originError` and `validateSite` messages via `i18n.t('sites:validation.*')` at call time (the `ORIGIN_HINT` constant goes away).

- [ ] **Step 1: Register the namespace** `sites`.

- [ ] **Step 2: Write the failing tests**

`sites-utils.test.ts` (append; import `i18n`):

```ts
it('explains origin and site errors in Czech', async () => {
  await i18n.changeLanguage('cs')
  expect(originError('example.com', [])).toBe('Zadejte celou adresu URL, například https://example.com')
  expect(originError('https://a.test', ['https://a.test'])).toBe('Tento původ už je v seznamu')
  expect(validateSite({ name: '', domain: '', allowedOrigins: [] })).toEqual({ name: 'Název je povinný', domain: 'Doména je povinná' })
})
```

`SitesPages.test.tsx` (append; reuses `routes`, `site` and the `sitesService` mock):

```tsx
describe('in Czech', () => {
  it('shows the card with Czech counts and guards rotation in Czech', async () => {
    await setTestLanguage('cs')
    renderRoutes(routes, { route: '/sites' })
    const card = await screen.findByRole('article', { name: 'Blog' })
    expect(within(card).getByText(/42 požadavků/)).toBeInTheDocument()
    await userEvent.click(within(card).getByRole('button', { name: 'Vyměnit klíč' }))
    const dialog = await screen.findByRole('alertdialog')
    expect(dialog).toHaveTextContent('přestane okamžitě fungovat')
  })

  it('keeps a server validation message as sent', async () => {
    await setTestLanguage('cs')
    vi.mocked(sitesService.update).mockRejectedValue(Object.assign(new Error('x'), { isAxiosError: true, response: { status: 400, data: { error: 'Validation failed', details: [{ message: 'Invalid url' }] } } }))
    renderRoutes(routes, { route: '/sites/s1' })
    await userEvent.type(await screen.findByLabelText('Přidat povolený původ'), 'https://x.test{Enter}')
    await userEvent.click(screen.getByRole('button', { name: 'Uložit web' }))
    expect(await screen.findByText('Validation failed: Invalid url')).toBeInTheDocument()
  })
})
```

(If `isAxiosError` in `apiErrorMessage` does not accept this shape, build the error with `new AxiosError('x', '400', undefined, undefined, { status: 400, data: {...} } as never)` as the existing api-error tests do.)

- [ ] **Step 3: Run to verify they fail**

Run: `cd packages/admin-dashboard && pnpm test -- src/features/sites`
Expected: FAIL.

- [ ] **Step 4: Implement**

Required values in `sites.json`:

| Key | en | cs |
|---|---|---|
| `list.title` | Sites & API keys | Weby a API klíče |
| `card.requests_one` / `_few` / `_other` | {{count}} request / (not in en) / {{count}} requests | {{count}} požadavek / {{count}} požadavky / {{count}} požadavků |
| `card.rotate` | Rotate key | Vyměnit klíč |
| `rotate.description` | The current key stops working immediately. Update your site with the new key right away. | Současný klíč přestane okamžitě fungovat. Hned na webu nastavte nový klíč. |
| `form.addOrigin` | Add allowed origin | Přidat povolený původ |
| `form.save` | Save site | Uložit web |
| `validation.origin` | Enter a full URL, for example https://example.com | Zadejte celou adresu URL, například https://example.com |
| `validation.originDuplicate` | This origin is already in the list | Tento původ už je v seznamu |
| `validation.nameRequired` | Name is required | Název je povinný |
| `validation.domainRequired` | Domain is required | Doména je povinná |

English `card.requests_one` becomes "1 request" (today "1 requests"): ledger it. Every other text (reveal/hide/copy key labels, active/disabled badge, "last …"/"no requests yet", connect snippets heading and help, delete confirmation, toasts, form labels and help) moves to `sites.json`.

Add the `.tsx` files to the scope and `sites-utils.ts` to the `.ts` list.

- [ ] **Step 5: Run tests, lint, build, commit**

Run: `cd packages/admin-dashboard && pnpm test && pnpm lint && pnpm build`
Expected: PASS.

```bash
git add -A packages/admin-dashboard
git commit -m "feat(admin): translate sites and API keys"
```

---

## Task 6: Webhooks

**Files:**
- Modify: `src/features/webhooks/pages/{WebhooksListPage,WebhookFormPage}.tsx`, `src/features/webhooks/components/{SecretDialog,DeliveryLog}.tsx`, `src/features/webhooks/webhook-events.ts`, `src/i18n/resources.ts`, `webhooks.json` (both), `i18n-scope.json`
- Test: `src/features/webhooks/pages/WebhookPages.test.tsx`, `src/features/webhooks/webhook-events.test.ts`

**Interfaces:**
- Produces: `getEventGroups()` replacing the `EVENT_GROUPS` constant (same shape, labels built on each call); `eventLabel(value)` and `validateWebhook` via `i18n.t` at call time; `DeliveryLog` status labels via keys.

- [ ] **Step 1: Register the namespace** `webhooks`.

- [ ] **Step 2: Write the failing tests**

`webhook-events.test.ts` (append; import `i18n`):

```ts
it('labels groups, events and errors in Czech', async () => {
  await i18n.changeLanguage('cs')
  expect(getEventGroups().map((g) => g.label)).toEqual(['Položky', 'Modely obsahu', 'Média'])
  expect(eventLabel('entry.published')).toBe('Položka publikována')
  expect(eventLabel('custom.thing')).toBe('custom.thing')
  expect(validateWebhook({ name: '', url: 'ftp://x', events: [] })).toEqual({
    name: 'Název je povinný',
    url: 'Zadejte adresu začínající http nebo https',
    events: 'Vyberte alespoň jednu událost',
  })
})
```

Update the existing test's `EVENT_GROUPS` references to `getEventGroups()`.

`WebhookPages.test.tsx` (append; reuses `routes`, `hook`, `logs` and the `apiClient` mock):

```tsx
describe('in Czech', () => {
  it('lists webhooks with Czech counts and shows the delivery log in Czech', async () => {
    await setTestLanguage('cs')
    renderRoutes(routes, { route: '/webhooks' })
    expect(await screen.findByText(/2 události/)).toBeInTheDocument()
    expect(screen.getByText('Poslední doručení selhalo')).toBeInTheDocument()
  })

  it('reports a test delivery in Czech', async () => {
    await setTestLanguage('cs')
    vi.mocked(apiClient.post).mockResolvedValue({ data: { success: true, data: { success: true, statusCode: 200, responseTime: 85 } } })
    renderRoutes(routes, { route: '/webhooks/w1' })
    await userEvent.click(await screen.findByRole('button', { name: 'Odeslat test' }))
    expect(await screen.findByText('Test doručen: 200 za 85 ms')).toBeInTheDocument()
    const log = screen.getByRole('table', { name: 'Záznam doručení' })
    expect(within(log).getByText('Selhalo')).toBeInTheDocument()
    expect(within(log).getByText('Položka publikována')).toBeInTheDocument()
  })

  it('shows event checkboxes in Czech after switching language', async () => {
    renderRoutes(routes, { route: '/webhooks/new' })
    await screen.findByRole('checkbox', { name: 'Entry published' })
    await setTestLanguage('cs')
    expect(screen.getByRole('checkbox', { name: 'Položka publikována' })).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Run to verify they fail**

Run: `cd packages/admin-dashboard && pnpm test -- src/features/webhooks`
Expected: FAIL.

- [ ] **Step 4: Implement**

Required values in `webhooks.json`:

| Key | en | cs |
|---|---|---|
| `groups.entries` / `models` / `media` | Entries / Content models / Media | Položky / Modely obsahu / Média |
| `events.entry.created` … `events.media.deleted` | today's labels (Entry created, …, Media deleted) | Položka vytvořena, Položka upravena, Položka smazána, Položka publikována, Publikování položky zrušeno, Položka archivována, Model vytvořen, Model upraven, Model smazán, Médium nahráno, Médium smazáno |
| `list.eventCount_one` / `_few` / `_other` | {{count}} event / (not in en) / {{count}} events | {{count}} událost / {{count}} události / {{count}} událostí |
| `list.lastFailed` | Last delivery failed | Poslední doručení selhalo |
| `form.sendTest` | Send test | Odeslat test |
| `test.delivered` | Test delivered: {{code}} in {{ms}} ms | Test doručen: {{code}} za {{ms}} ms |
| `log.label` | Delivery log | Záznam doručení |
| `log.status.SUCCESS` / `FAILED` / `RETRYING` / `PENDING` | Delivered / Failed / Retrying / Pending | Doručeno / Selhalo / Opakuje se / Čeká |
| `validation.nameRequired` | Name is required | Název je povinný |
| `validation.url` | Enter an http or https URL | Zadejte adresu začínající http nebo https |
| `validation.events` | Choose at least one event | Vyberte alespoň jednu událost |

Event values contain dots (`entry.published`), which i18next reads as nesting, so store the labels flat with `_` in place of `.` (`events.entry_published`). `eventLabel(value)` looks up `webhooks:events.${value.replace('.', '_')}` and returns the raw value when the key is missing. Every other text (secret dialog, rotate confirmation, counts line "N total · N delivered · N failed", payload summary, active/paused, site select "All sites", empty states, toasts) moves to `webhooks.json`.

Add the `.tsx` files to the scope and `webhook-events.ts` to the `.ts` list.

- [ ] **Step 5: Run tests, lint, build, commit**

Run: `cd packages/admin-dashboard && pnpm test && pnpm lint && pnpm build`
Expected: PASS.

```bash
git add -A packages/admin-dashboard
git commit -m "feat(admin): translate webhooks"
```

---

## Task 7: App-wide guard and Plan 1 leftovers

**Files:**
- Modify: `eslint.config.js`, `i18n-scope.json`, `src/i18n/source-scan.test.ts`, `src/features/content/editor/fields/DateField.tsx`, `src/features/content/editor/fields/MediaField.tsx`, `src/components/rich-text/EditorToolbar.tsx`, any component the widened rule flags
- Test: `src/i18n/source-scan.test.ts`, `src/features/content/pages/EntryEditorPage.test.tsx`, `src/components/RichTextEditor.test.tsx`

**Interfaces:**
- Produces: `i18n-scope.json` becomes `{ "copyModules": string[] }` (the `.ts` files checked in `mode: 'all'`); `.tsx` coverage is a glob in `eslint.config.js`.

- [ ] **Step 1: Write the failing tests**

`src/i18n/source-scan.test.ts`: replace the `scope.files` iteration with a walk of every `.ts`/`.tsx` file under `src` except `*.test.*`, `src/components/ui/**` and `src/test/**`:

```ts
import { readdirSync } from 'node:fs'

const SRC = resolve(process.cwd(), 'src')
const sourceFiles = (readdirSync(SRC, { recursive: true }) as string[])
  .filter((f) => /\.(ts|tsx)$/.test(f) && !/\.test\.(ts|tsx)$/.test(f) && !f.startsWith('components/ui/') && !f.startsWith('test/'))
  .map((f) => `src/${f}`)

it.each(sourceFiles)('%s passes no literal text to toast', (file) => {
  expect(findRawToasts(readFileSync(resolve(process.cwd(), file), 'utf8'))).toEqual([])
})
```

Keep the `findRawToasts` unit test. Add to `EntryEditorPage.test.tsx`:

```tsx
it('labels the date picker navigation in Czech', async () => {
  await setTestLanguage('cs')
  const dated = { ...tripType, fields: [...tripType.fields, { name: 'day', label: 'Day', type: 'DATE' as const, required: false }] }
  vi.mocked(api.getContentType).mockResolvedValue(dated)
  renderRoutes(routes, { route: `/content/new?type=${tripType.id}` })
  await userEvent.click(await screen.findByRole('button', { name: /Vyberte datum/ }))
  expect(await screen.findByRole('button', { name: /Přejít na další měsíc/ })).toBeInTheDocument()
})
```

Add to `RichTextEditor.test.tsx`:

```tsx
it('re-translates a link error that is already shown', async () => {
  renderWithProviders(<RichTextEditor value="<p>Hi</p>" onChange={() => {}} />)
  await userEvent.click(await screen.findByRole('button', { name: 'Link' }))
  await userEvent.type(await screen.findByLabelText('Link URL'), 'javascript:alert(1)')
  await userEvent.click(screen.getByRole('button', { name: 'Apply link' }))
  expect(screen.getByText(/Use a web address/)).toBeInTheDocument()
  await setTestLanguage('cs')
  expect(screen.getByText(/Zadejte webovou adresu/)).toBeInTheDocument()
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd packages/admin-dashboard && pnpm test -- source-scan EntryEditorPage RichTextEditor`
Expected: FAIL: calendar labels English; link error stays English; the scan may fail on files outside the old scope.

- [ ] **Step 3: Implement**

- `eslint.config.js`: the JSX block's `files` becomes `['src/**/*.tsx']` with `ignores: ['src/**/*.test.tsx', 'src/components/ui/**', 'src/test/**']`; the `.ts` block reads `copyModules` from `i18n-scope.json`. Keep all existing option excludes.
- `i18n-scope.json`: `{ "copyModules": [ every .ts file previously listed plus the ones added in Tasks 1 to 6 ] }`.
- `DateField.tsx`: import `{ cs as dayPickerCs } from 'react-day-picker/locale'` and pass it as `locale` in Czech (replaces the date-fns locale there).
- `MediaField.tsx`: store the rejected file names in state (`string[] | null`) and build the message with `t` at render.
- `EditorToolbar.tsx`: store `linkError` as a boolean and render `t('toolbar.linkHint')` when true.
- Run `pnpm lint`; convert every remaining literal it reports in newly covered files (for example `Logo.tsx` alt/aria text, `AuthContext` messages shown to users). Ledger each file touched.

- [ ] **Step 4: Run tests, lint, build, commit**

Run: `cd packages/admin-dashboard && pnpm test && pnpm lint && pnpm build`
Expected: PASS, lint 0 errors 0 warnings.

```bash
git add -A packages/admin-dashboard
git commit -m "feat(admin): app-wide i18n guard; calendar and inline errors follow the language"
```

---

## Task 8: Czech review in the running app

**Files:** none unless a defect is found (fix with a test when jsdom can express it; CSS-only fixes are verified in the browser and ledgered).

- [ ] **Step 1: Accessibility in Czech**

Extend the Czech `describe` in `src/app/a11y.test.tsx` with the remaining cases from the English `cases` table (media, inbox, models, forms builder, sites list and form, webhooks list and form), each awaiting its Czech `h1` (`Média`, `Zprávy`, `Modely obsahu`, the form name, `Weby a API klíče`, the site name, `Webhooky`, the webhook name) and scanning after loading finishes.

Run: `cd packages/admin-dashboard && pnpm test -- a11y`
Expected: PASS.

- [ ] **Step 2: Browser check in Czech** (backend and admin dev servers from the worktree)

1. Every screen: no English left except server messages and user content.
2. Media: upload a file (toast and tray plurals), detail sheet, picker from the editor.
3. Inbox: message view, reply link, archive and delete confirmations.
4. Models: create from "Článek blogu" in Czech, confirm keys in the saved model are English; builder palette labels fit.
5. Forms: new form defaults in Czech, embed panel.
6. Sites: rotate confirmation typed name, origin validation message.
7. Webhooks: event checkboxes, send test result, delivery log statuses.
8. 360px (iframe) for all six areas: no horizontal scroll, no clipped labels (filter chips, badges, palette buttons, dialog buttons).
9. Switch back to English: every screen returns to today's English.

- [ ] **Step 3: Record and commit**

Append a "Localization Plan 2 verification" table to `TEST_RESULTS.md` and commit:

```bash
git add TEST_RESULTS.md
git commit -m "docs: record localization Plan 2 verification"
```

---

## Self-Review Notes

- **Spec coverage:** section 3 (Media, Inbox, Models with templates, Forms with the embed snippet, Sites, Webhooks; screen-reader text) → Tasks 1 to 6 and 7; 4.3 conventions (lists outside components as keys or functions, validation helpers) → Tasks 3 to 6; 7 quality (lint guard over the whole app, axe in Czech, layout at 360px) → Tasks 7 and 8; 9 delivery item 2 → this plan.
- **Type consistency:** `getModelTemplates`, `fieldTypeLabel`, `formFieldTypeLabel`, `getEventGroups`, `eventLabel`, `validateWebhook`, `originError`, `validateSite`, `formatBytes` keep their existing call sites or are renamed in the same task that changes every caller.
