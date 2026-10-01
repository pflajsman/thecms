# Content Language Versions, Plan 2: Admin and Example Site

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Editors manage content languages and language versions in the admin (Languages page, editor language switcher, Translate and Change language, shared-field hints, Content list language filters, a Translated switch in the model builder), and the example site can ask for a language.

**Architecture:** A new `languages` feature holds the API client, queries and the Languages page (Setup group). The content feature gains version API calls and a `useLanguages()`-driven UI: switching language in the editor is a navigation to the other version's URL, so the existing unsaved-changes guard applies. Every language UI hides itself while only one language exists. The model builder keeps and edits each field's `localized` flag.

**Tech Stack:** React 19, React Router 7, TanStack Query 5, react-i18next (typed keys, `en`/`cs` catalogs), shadcn/ui, Vitest + Testing Library + axe.

**Spec:** `docs/superpowers/specs/2026-09-30-content-language-versions-design.md` (sections 7 and 8). Backend from Plan 1 is merged (`docs/superpowers/plans/2026-09-30-content-languages-plan-1-backend.md`).

## Global Constraints

- All new UI text comes from the catalogs, in English and Czech, with plural forms `one`/`other` (en) and `one`/`few`/`other` (cs); `src/i18n/catalogs.test.ts` checks parity. The lint guard (`pnpm lint`) must report 0 errors and 0 warnings.
- Typed keys: other namespaces are addressed with `{ ns: 'x' }`, never a `x:` prefix inside `t()` from `useTranslation`; module-level text uses `i18n.t('ns:key')`.
- Language UI is hidden while the installation has one language (`languages.length < 2`), except the Languages page itself.
- Language codes match `^[a-z]{2,3}(-[a-z0-9]{2,8})?$`.
- Every screen passes axe in English and Czech and works at 360px wide with no horizontal scroll.
- Server error messages are shown as sent (`apiErrorMessage`); our own fallbacks follow the admin language.
- Run `pnpm --filter admin-dashboard test`, `pnpm --filter admin-dashboard lint` and `pnpm --filter admin-dashboard build` at the end of every task.
- Never use an em dash in code, copy or docs.

## Decisions (deviations from the spec, for the reviewer)

1. **Example site language comes from the runtime config** (`window.__CMS_CONFIG__.contentLanguage`, generated from the `EXAMPLE_CMS_CONTENT_LANGUAGE` secret), not a `VITE_CONTENT_LANGUAGE` build variable. The site already reads every setting from runtime config; a build variable would be the only exception.
2. **Translate needs a saved version.** "Translate to" copies the saved version on the server, so it is disabled while the editor has unsaved changes, with the hint "Save your changes before translating". Switching to an existing version is a normal navigation and goes through the unsaved-changes guard.
3. **New entries are created in the default language.** The New entry flow has no language choice; editors translate after the first save.
4. **Home needs no change.** `/stats` already counts items since Plan 1 (`entries.total`); Task 7 checks it in the browser.

## Review Focus

1. **Unsaved edits, then switching language:** the leave dialog appears and nothing is lost by accident. Tested in Task 3.
2. **A shared field saved in Czech, then switching to English:** English shows the new value, not a cached old one. Tested in Task 2 (cache) and Task 3 (UI).
3. **Saving a model in the builder keeps every field's Translated setting**, including fields the editor did not touch. Tested in Task 5.
4. **One language only** (fresh installs, today's production): no switcher, no badges, no filters, no Translated switch. Tested in Tasks 3, 4 and 5.
5. **Deleting a language shows how many versions go with it, and needs the code typed**; the default language has no Delete. Tested in Task 1.

---

## File Structure

All paths relative to `packages/admin-dashboard/src` unless noted.

| File | Responsibility |
|---|---|
| `features/languages/languages-api.ts` | `Language` type, list/create/rename/makeDefault/remove |
| `features/languages/languages-queries.ts` | `useLanguages()`, `useLanguageWrites()`, `languageKeys` |
| `features/languages/pages/LanguagesPage.tsx` | Setup page: list, add, rename, make default, delete |
| `features/languages/components/LanguageFormDialog.tsx` | Add and rename dialog |
| `i18n/locales/{en,cs}/languages.json`, `i18n/resources.ts` | New `languages` namespace |
| `modules/registry.tsx`, `i18n/locales/{en,cs}/shell.json` | Nav entry `/languages` |
| `types/index.ts` | `Field.localized`, `ContentEntry.language/itemId`, `EntryListItem.languages`, `EntryVersion` |
| `lib/localized.ts` | `isLocalized(field)` (same rule as the backend) |
| `features/content/content-api.ts`, `queries.ts` | Versions API, `useVersions`, cache refresh of sibling versions |
| `features/content/editor/LanguageMenu.tsx` | Top bar switcher with Translate |
| `features/content/editor/LanguagesSection.tsx`, `ChangeLanguageDialog.tsx` | Side panel section and Change language |
| `features/content/editor/EntryEditor.tsx`, `EditorTopBar.tsx`, `EditorSidePanel.tsx` | Wiring, shared-field hints, version-aware delete text |
| `features/content/list-params.ts`, `components/ContentFilters.tsx`, `pages/ContentListPage.tsx` | `lang` and `missing` filters, language badges |
| `features/models/model-draft.ts`, `components/ModelFieldInspector.tsx`, `pages/ModelBuilderPage.tsx` | Keep and edit `localized`, warn before unifying |
| `examples/src/config.ts`, `examples/src/lib/cms.ts`, `.github/workflows/example-website-ci-cd.yml` (repo root) | Example site `contentLanguage` |

---

## Task 1: Languages page

**Files:**
- Create: `features/languages/languages-api.ts`, `features/languages/languages-queries.ts`, `features/languages/components/LanguageFormDialog.tsx`, `features/languages/pages/LanguagesPage.tsx`, `i18n/locales/en/languages.json`, `i18n/locales/cs/languages.json`
- Modify: `i18n/resources.ts`, `modules/registry.tsx`, `i18n/locales/{en,cs}/shell.json` (`nav.languages`)
- Test: `features/languages/pages/LanguagesPage.test.tsx`

**Interfaces:**
- Produces:
  - `interface Language { id: string; code: string; name: string; isDefault: boolean; order: number }`
  - `LANGUAGE_CODE: RegExp`
  - `listLanguages(): Promise<Language[]>`, `createLanguage(body: { code: string; name: string }): Promise<Language>`, `renameLanguage(code: string, name: string): Promise<Language>`, `makeDefaultLanguage(code: string): Promise<Language>`, `deleteLanguage(code: string): Promise<{ deletedVersions: number }>`
  - `languageKeys.all = ['languages']`, `useLanguages()` (TanStack query, `staleTime: 60_000`), `useLanguageWrites(): { create, rename, makeDefault, remove }` (each refreshes `languageKeys.all`; `remove` also refreshes `contentKeys.all` and `statsKeys.all`)
  - Route `/languages`, nav label key `nav.languages`.

- [ ] **Step 1: Write the failing test** `features/languages/pages/LanguagesPage.test.tsx`

```tsx
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderRoutes, setTestLanguage } from '@/test/render'
import { expectNoA11yViolations } from '@/test/a11y'
import apiClient from '@/lib/api'
import { LanguagesPage } from './LanguagesPage'

vi.mock('@/lib/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }))

const en = { id: 'l1', code: 'en', name: 'English', isDefault: true, order: 0 }
const cs = { id: 'l2', code: 'cs', name: 'Čeština', isDefault: false, order: 1 }
const routes = [{ path: '/languages', element: <LanguagesPage /> }]

beforeEach(() => {
  vi.mocked(apiClient.get).mockImplementation(async (url: string, config?: { params?: Record<string, unknown> }) => {
    if (url === '/languages') return { data: { success: true, data: [en, cs] } }
    if (url === '/entries' && config?.params?.language === 'cs')
      return { data: { success: true, data: [], pagination: { page: 1, limit: 1, total: 4, totalPages: 4 } } }
    return { data: { success: true, data: [] } }
  })
})

it('lists languages with the default marked and no Delete on the default', async () => {
  const { container } = renderRoutes(routes, { route: '/languages' })
  const list = await screen.findByRole('list', { name: 'Languages' })
  const rows = within(list).getAllByRole('listitem')
  expect(rows[0]).toHaveTextContent('English')
  expect(rows[0]).toHaveTextContent('en')
  expect(rows[0]).toHaveTextContent('Default')
  await userEvent.click(within(rows[0]).getByRole('button', { name: 'Actions for English' }))
  expect(screen.queryByRole('menuitem', { name: 'Delete' })).not.toBeInTheDocument()
  expect(screen.queryByRole('menuitem', { name: 'Make default' })).not.toBeInTheDocument()
  await userEvent.keyboard('{Escape}')
  await expectNoA11yViolations(container)
})

it('adds a language and shows the server message when it already exists', async () => {
  vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { success: true, data: { id: 'l3', code: 'de', name: 'Deutsch', isDefault: false, order: 2 } } })
  renderRoutes(routes, { route: '/languages' })
  await userEvent.click(await screen.findByRole('button', { name: 'Add language' }))
  const dialog = await screen.findByRole('dialog', { name: 'Add language' })
  await userEvent.type(within(dialog).getByLabelText('Code'), 'Deutsch!')
  await userEvent.type(within(dialog).getByLabelText('Name'), 'Deutsch')
  await userEvent.click(within(dialog).getByRole('button', { name: 'Add language' }))
  expect(within(dialog).getByText('Use a code such as en, cs or de-at')).toBeInTheDocument()
  expect(apiClient.post).not.toHaveBeenCalled()
  await userEvent.clear(within(dialog).getByLabelText('Code'))
  await userEvent.type(within(dialog).getByLabelText('Code'), 'DE')
  await userEvent.click(within(dialog).getByRole('button', { name: 'Add language' }))
  await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/languages', { code: 'de', name: 'Deutsch' }))
  expect(await screen.findByText('Added Deutsch')).toBeInTheDocument()
})

it('makes a language the default after confirming', async () => {
  vi.mocked(apiClient.put).mockResolvedValue({ data: { success: true, data: { ...cs, isDefault: true } } })
  renderRoutes(routes, { route: '/languages' })
  const rows = within(await screen.findByRole('list', { name: 'Languages' })).getAllByRole('listitem')
  await userEvent.click(within(rows[1]).getByRole('button', { name: 'Actions for Čeština' }))
  await userEvent.click(await screen.findByRole('menuitem', { name: 'Make default' }))
  const confirm = await screen.findByRole('alertdialog', { name: 'Make Čeština the default language?' })
  await userEvent.click(within(confirm).getByRole('button', { name: 'Make default' }))
  await waitFor(() => expect(apiClient.put).toHaveBeenCalledWith('/languages/cs/default'))
})

it('deletes a language only after the code is typed, and says how many versions go with it', async () => {
  vi.mocked(apiClient.delete).mockResolvedValue({ data: { success: true, data: { deletedVersions: 4 } } })
  renderRoutes(routes, { route: '/languages' })
  const rows = within(await screen.findByRole('list', { name: 'Languages' })).getAllByRole('listitem')
  await userEvent.click(within(rows[1]).getByRole('button', { name: 'Actions for Čeština' }))
  await userEvent.click(await screen.findByRole('menuitem', { name: 'Delete' }))
  const confirm = await screen.findByRole('alertdialog', { name: 'Delete Čeština?' })
  expect(await within(confirm).findByText(/also deletes 4 entry versions/)).toBeInTheDocument()
  const button = within(confirm).getByRole('button', { name: 'Delete' })
  expect(button).toBeDisabled()
  await userEvent.type(within(confirm).getByRole('textbox'), 'cs')
  await userEvent.click(button)
  await waitFor(() => expect(apiClient.delete).toHaveBeenCalledWith('/languages/cs', { params: { confirm: 'cs' } }))
})

it('renders in Czech', async () => {
  await setTestLanguage('cs')
  const { container } = renderRoutes(routes, { route: '/languages' })
  expect(await screen.findByRole('heading', { name: 'Jazyky' })).toBeInTheDocument()
  expect(screen.getByText('Výchozí')).toBeInTheDocument()
  await expectNoA11yViolations(container)
})
```

(The `ConfirmDialog` typed-confirmation input is the only textbox in the alert dialog; check its accessible name in `components/common/ConfirmDialog.tsx` and query by it if it has one.)

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter admin-dashboard test -- LanguagesPage`
Expected: FAIL, cannot resolve `./LanguagesPage`.

- [ ] **Step 3: Implement**

`features/languages/languages-api.ts`:

```ts
import apiClient from '@/lib/api'
import type { ApiResponse } from '@/types'

export interface Language {
  id: string
  code: string
  name: string
  isDefault: boolean
  order: number
}

/** Same rule as the backend (models/language.model.ts). */
export const LANGUAGE_CODE = /^[a-z]{2,3}(-[a-z0-9]{2,8})?$/

export async function listLanguages(): Promise<Language[]> {
  return (await apiClient.get<ApiResponse<Language[]>>('/languages')).data.data
}

export async function createLanguage(body: { code: string; name: string }): Promise<Language> {
  return (await apiClient.post<ApiResponse<Language>>('/languages', body)).data.data
}

export async function renameLanguage(code: string, name: string): Promise<Language> {
  return (await apiClient.put<ApiResponse<Language>>(`/languages/${code}`, { name })).data.data
}

export async function makeDefaultLanguage(code: string): Promise<Language> {
  return (await apiClient.put<ApiResponse<Language>>(`/languages/${code}/default`)).data.data
}

export async function deleteLanguage(code: string): Promise<{ deletedVersions: number }> {
  return (await apiClient.delete<ApiResponse<{ deletedVersions: number }>>(`/languages/${code}`, { params: { confirm: code } })).data.data
}
```

`features/languages/languages-queries.ts`:

```ts
import { useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { statsKeys } from '@/lib/queries/stats'
import { contentKeys } from '@/features/content/queries'
import { createLanguage, deleteLanguage, listLanguages, makeDefaultLanguage, renameLanguage } from './languages-api'

export const languageKeys = { all: ['languages'] as const }

export function useLanguages() {
  return useQuery({ queryKey: languageKeys.all, queryFn: listLanguages, staleTime: 60_000 })
}

export function useLanguageWrites() {
  const queryClient = useQueryClient()
  return useMemo(() => {
    const refresh = () => void queryClient.invalidateQueries({ queryKey: languageKeys.all })
    return {
      create: async (body: { code: string; name: string }) => {
        const created = await createLanguage(body)
        refresh()
        return created
      },
      rename: async (code: string, name: string) => {
        const renamed = await renameLanguage(code, name)
        refresh()
        return renamed
      },
      makeDefault: async (code: string) => {
        const updated = await makeDefaultLanguage(code)
        refresh()
        return updated
      },
      remove: async (code: string) => {
        const result = await deleteLanguage(code)
        refresh()
        void queryClient.invalidateQueries({ queryKey: contentKeys.all })
        void queryClient.invalidateQueries({ queryKey: statsKeys.all })
        return result
      },
    }
  }, [queryClient])
}
```

`features/languages/components/LanguageFormDialog.tsx`:

```tsx
import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { LANGUAGE_CODE, type Language } from '../languages-api'

interface LanguageFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Rename this language; absent means add a new one. */
  language?: Language
  pending: boolean
  onSubmit: (values: { code: string; name: string }) => void
}

export function LanguageFormDialog({ open, onOpenChange, ...rest }: LanguageFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Content unmounts when closed, so the form resets on every open. */}
      <DialogContent>
        <LanguageForm {...rest} />
      </DialogContent>
    </Dialog>
  )
}

function LanguageForm({ language, pending, onSubmit }: Omit<LanguageFormDialogProps, 'open' | 'onOpenChange'>) {
  const { t } = useTranslation('languages')
  const [code, setCode] = useState(language?.code ?? '')
  const [name, setName] = useState(language?.name ?? '')
  const [submitted, setSubmitted] = useState(false)
  const cleanCode = code.trim().toLowerCase()
  const codeError = !language && !LANGUAGE_CODE.test(cleanCode) ? t('form.codeInvalid') : undefined
  const nameError = name.trim() === '' || name.trim().length > 50 ? t('form.nameRequired') : undefined
  const title = language ? t('form.renameTitle', { name: language.name }) : t('form.addTitle')

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        setSubmitted(true)
        if (codeError || nameError) return
        onSubmit({ code: language?.code ?? cleanCode, name: name.trim() })
      }}
      className="flex flex-col gap-4"
    >
      <DialogHeader>
        <DialogTitle className="font-serif text-xl">{title}</DialogTitle>
      </DialogHeader>
      {!language && (
        <div className="space-y-1.5">
          <Label htmlFor="language-code">{t('form.code')}</Label>
          <Input id="language-code" value={code} onChange={(e) => setCode(e.target.value)} className="font-mono" aria-invalid={submitted && codeError ? true : undefined} aria-describedby="language-code-help" />
          <p id="language-code-help" className={submitted && codeError ? 'text-sm text-destructive' : 'text-sm text-muted-foreground'}>
            {submitted && codeError ? codeError : t('form.codeHint')}
          </p>
        </div>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="language-name">{t('form.name')}</Label>
        <Input id="language-name" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={submitted && nameError ? true : undefined} />
        {submitted && nameError && <p className="text-sm text-destructive">{nameError}</p>}
      </div>
      <DialogFooter>
        <Button type="submit" disabled={pending}>{language ? t('form.save') : t('form.add')}</Button>
      </DialogFooter>
    </form>
  )
}
```

`features/languages/pages/LanguagesPage.tsx`:

```tsx
import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { MoreHorizontal, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/common/PageHeader'
import { ErrorState } from '@/components/common/ErrorState'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { apiErrorMessage } from '@/lib/api-error'
import { useEntryList } from '@/features/content/queries'
import type { Language } from '../languages-api'
import { useLanguages, useLanguageWrites } from '../languages-queries'
import { LanguageFormDialog } from '../components/LanguageFormDialog'

type Dialog = { kind: 'add' } | { kind: 'rename' | 'default' | 'delete'; language: Language } | null

export function LanguagesPage() {
  const { t } = useTranslation('languages')
  const languages = useLanguages()
  const writes = useLanguageWrites()
  const [dialog, setDialog] = useState<Dialog>(null)
  const [pending, setPending] = useState(false)
  const deleting = dialog?.kind === 'delete' ? dialog.language : undefined
  // Versions that go with the language, shown before confirming.
  const versions = useEntryList({ language: deleting?.code, limit: 1 }, { enabled: !!deleting })

  const run = async (work: () => Promise<string>) => {
    setPending(true)
    try {
      toast.success(await work())
      setDialog(null)
    } catch (error) {
      toast.error(apiErrorMessage(error))
    } finally {
      setPending(false)
    }
  }

  const addButton = (
    <Button onClick={() => setDialog({ kind: 'add' })}>
      <Plus aria-hidden />
      {t('page.add')}
    </Button>
  )

  let body: React.ReactNode
  if (languages.isPending) body = <Skeleton className="h-32 w-full" />
  else if (languages.isError) body = <ErrorState message={t('page.loadError')} onRetry={() => void languages.refetch()} />
  else
    body = (
      <ul aria-label={t('page.tableLabel')} className="flex flex-col divide-y rounded-xl border bg-card">
        {languages.data.map((l) => (
          <li key={l.id} className="flex items-center gap-3 px-4 py-3">
            <span className="w-14 shrink-0 font-mono text-sm text-muted-foreground">{l.code}</span>
            <span className="min-w-0 flex-1 truncate font-medium">{l.name}</span>
            {l.isDefault && <Badge variant="secondary">{t('default')}</Badge>}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label={t('menu.actionsFor', { name: l.name })}>
                  <MoreHorizontal aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setDialog({ kind: 'rename', language: l })}>{t('menu.rename')}</DropdownMenuItem>
                {!l.isDefault && (
                  <>
                    <DropdownMenuItem onSelect={() => setDialog({ kind: 'default', language: l })}>{t('menu.makeDefault')}</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setDialog({ kind: 'delete', language: l })}>
                      {t('menu.delete')}
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </li>
        ))}
      </ul>
    )

  const count = versions.data?.pagination.total
  return (
    <>
      <PageHeader title={t('page.title')} description={t('page.description')} actions={addButton} />
      {body}
      <LanguageFormDialog
        open={dialog?.kind === 'add' || dialog?.kind === 'rename'}
        onOpenChange={(o) => !o && setDialog(null)}
        language={dialog?.kind === 'rename' ? dialog.language : undefined}
        pending={pending}
        onSubmit={({ code, name }) =>
          void run(async () => {
            if (dialog?.kind === 'rename') {
              await writes.rename(code, name)
              return t('toast.renamed', { name })
            }
            await writes.create({ code, name })
            return t('toast.added', { name })
          })
        }
      />
      {dialog?.kind === 'default' && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setDialog(null)}
          title={t('confirm.defaultTitle', { name: dialog.language.name })}
          description={t('confirm.defaultText', { name: dialog.language.name })}
          confirmLabel={t('confirm.defaultConfirm')}
          pending={pending}
          onConfirm={() => void run(async () => {
            await writes.makeDefault(dialog.language.code)
            return t('toast.madeDefault', { name: dialog.language.name })
          })}
        />
      )}
      {deleting && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setDialog(null)}
          title={t('confirm.deleteTitle', { name: deleting.name })}
          description={count === undefined ? '' : count === 0 ? t('confirm.deleteNone', { name: deleting.name }) : t('confirm.deleteText', { count, name: deleting.name })}
          confirmLabel={t('menu.delete')}
          destructive
          confirmText={deleting.code}
          pending={pending}
          onConfirm={() => void run(async () => {
            await writes.remove(deleting.code)
            return t('toast.deleted', { name: deleting.name })
          })}
        />
      )}
    </>
  )
}
```

`EntryListParams` in `features/content/content-api.ts` gains `language?: string` and `missing?: string` in this task (Task 4 uses them too), so `useEntryList({ language, limit: 1 })` type-checks.

`i18n/locales/en/languages.json`:

```json
{
  "page": {
    "title": "Languages",
    "description": "Languages your content can be written in. Sites ask for one and get the default language when a translation is missing.",
    "add": "Add language",
    "loadError": "Could not load languages.",
    "tableLabel": "Languages"
  },
  "default": "Default",
  "form": {
    "addTitle": "Add language",
    "renameTitle": "Rename {{name}}",
    "code": "Code",
    "codeHint": "Lowercase, for example en, cs or de-at. It cannot be changed later.",
    "codeInvalid": "Use a code such as en, cs or de-at",
    "name": "Name",
    "nameRequired": "Enter a name of up to 50 characters",
    "add": "Add language",
    "save": "Save"
  },
  "menu": {
    "actionsFor": "Actions for {{name}}",
    "rename": "Rename",
    "makeDefault": "Make default",
    "delete": "Delete"
  },
  "confirm": {
    "defaultTitle": "Make {{name}} the default language?",
    "defaultText": "Sites that do not ask for a language get {{name}}, and missing translations fall back to it.",
    "defaultConfirm": "Make default",
    "deleteTitle": "Delete {{name}}?",
    "deleteText_one": "This also deletes {{count}} entry version in {{name}}. Sites stop receiving it.",
    "deleteText_other": "This also deletes {{count}} entry versions in {{name}}. Sites stop receiving them.",
    "deleteNone": "No entry has a version in {{name}}."
  },
  "toast": {
    "added": "Added {{name}}",
    "renamed": "Renamed to {{name}}",
    "madeDefault": "{{name}} is now the default language",
    "deleted": "Deleted {{name}}"
  }
}
```

`i18n/locales/cs/languages.json`:

```json
{
  "page": {
    "title": "Jazyky",
    "description": "Jazyky, ve kterých můžete psát obsah. Weby si o jeden řeknou, a když překlad chybí, dostanou výchozí jazyk.",
    "add": "Přidat jazyk",
    "loadError": "Jazyky se nepodařilo načíst.",
    "tableLabel": "Jazyky"
  },
  "default": "Výchozí",
  "form": {
    "addTitle": "Přidat jazyk",
    "renameTitle": "Přejmenovat jazyk {{name}}",
    "code": "Kód",
    "codeHint": "Malými písmeny, například en, cs nebo de-at. Později ho nejde změnit.",
    "codeInvalid": "Zadejte kód, například en, cs nebo de-at",
    "name": "Název",
    "nameRequired": "Zadejte název o délce nejvýše 50 znaků",
    "add": "Přidat jazyk",
    "save": "Uložit"
  },
  "menu": {
    "actionsFor": "Akce pro jazyk {{name}}",
    "rename": "Přejmenovat",
    "makeDefault": "Nastavit jako výchozí",
    "delete": "Smazat"
  },
  "confirm": {
    "defaultTitle": "Nastavit {{name}} jako výchozí jazyk?",
    "defaultText": "Weby, které o jazyk neřeknou, dostanou {{name}}. Chybějící překlady se nahradí tímto jazykem.",
    "defaultConfirm": "Nastavit jako výchozí",
    "deleteTitle": "Smazat jazyk {{name}}?",
    "deleteText_one": "Smaže se i {{count}} verze položky v jazyce {{name}}. Weby ji přestanou dostávat.",
    "deleteText_few": "Smažou se i {{count}} verze položek v jazyce {{name}}. Weby je přestanou dostávat.",
    "deleteText_other": "Smaže se i {{count}} verzí položek v jazyce {{name}}. Weby je přestanou dostávat.",
    "deleteNone": "Žádná položka nemá verzi v jazyce {{name}}."
  },
  "toast": {
    "added": "Jazyk {{name}} je přidaný",
    "renamed": "Přejmenováno na {{name}}",
    "madeDefault": "{{name}} je teď výchozí jazyk",
    "deleted": "Jazyk {{name}} je smazaný"
  }
}
```

(The Czech test above looks for the heading "Jazyky"; adjust the Czech "Delete" title assertions if you change the wording.)

- `i18n/resources.ts`: import both catalogs, add `'languages'` to `NAMESPACES` and to both `resources` maps.
- `shell.json`: `nav.languages`: en "Languages", cs "Jazyky".
- `modules/registry.tsx`: add after `webhooks` (Setup group):

```tsx
  {
    id: 'languages',
    labelKey: 'nav.languages',
    icon: Languages,
    group: 'setup',
    path: '/languages',
    routes: [{ path: 'languages', element: <LanguagesPage /> }],
  },
```

with `Languages` imported from `lucide-react` and `LanguagesPage` from `@/features/languages/pages/LanguagesPage`. Check `modules/registry.test.tsx` and `nav.test.ts` for module counts or snapshots and update them.

- [ ] **Step 4: Run tests, lint and build; commit**

Run: `pnpm --filter admin-dashboard test && pnpm --filter admin-dashboard lint && pnpm --filter admin-dashboard build`
Expected: all pass, 0 lint problems.

```bash
git add -A packages/admin-dashboard
git commit -m "feat(admin): Languages page"
```

---

## Task 2: Language data in the content feature

**Files:**
- Create: `lib/localized.ts`, `lib/localized.test.ts`
- Modify: `types/index.ts`, `features/content/content-api.ts`, `features/content/queries.ts`, `features/content/test-fixtures.ts`
- Test: `features/content/queries.test.tsx` (create)

**Interfaces:**
- Consumes: `Language` (Task 1).
- Produces:
  - `Field.localized?: boolean`; `ContentEntry.language?: string`, `ContentEntry.itemId?: string`; `EntryListItem.languages?: string[]`
  - `interface EntryVersion { id: string; language: string; status: EntryStatus; title: string; updatedAt: string }`
  - `isLocalized(field: Pick<Field, 'type' | 'localized'>): boolean`
  - `EntryWriteBody.language?: string`
  - `listVersions(entryId): Promise<EntryVersion[]>`, `createVersion(entryId, language): Promise<ContentEntry>`, `changeLanguage(entryId, language): Promise<ContentEntry>`
  - `contentKeys.versions(itemId)`; `useVersions(entry?: ContentEntry)`; `useEntryWrites()` gains `translate(entryId, language)` and `changeLanguage(entryId, language)`. Every write refreshes versions and marks every other cached entry stale (shared fields change sibling versions on the server).

- [ ] **Step 1: Write the failing tests**

`lib/localized.test.ts`:

```ts
import { isLocalized } from './localized'

it('translates text and rich text by default and shares the rest', () => {
  expect(isLocalized({ type: 'TEXT' })).toBe(true)
  expect(isLocalized({ type: 'RICH_TEXT' })).toBe(true)
  for (const type of ['NUMBER', 'DATE', 'BOOLEAN', 'MEDIA', 'RELATION'] as const) expect(isLocalized({ type })).toBe(false)
  expect(isLocalized({ type: 'TEXT', localized: false })).toBe(false)
  expect(isLocalized({ type: 'MEDIA', localized: true })).toBe(true)
})
```

`features/content/queries.test.tsx`:

```tsx
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import * as api from './content-api'
import { contentKeys, useEntryWrites } from './queries'
import { makeEntry } from './test-fixtures'

vi.mock('./content-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./content-api')>()),
  updateEntry: vi.fn(),
  createVersion: vi.fn(),
}))

function setup() {
  const queryClient = new QueryClient()
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  const { result } = renderHook(() => useEntryWrites(), { wrapper })
  return { queryClient, writes: result.current }
}

it('a save marks the other language versions stale, because shared fields changed on the server', async () => {
  const { queryClient, writes } = setup()
  const cs = makeEntry({ id: 'cs1', itemId: 'en1', language: 'cs' })
  const en = makeEntry({ id: 'en1', itemId: 'en1', language: 'en' })
  queryClient.setQueryData(contentKeys.entry('en1'), en)
  queryClient.setQueryData(contentKeys.versions('en1'), [])
  vi.mocked(api.updateEntry).mockResolvedValue({ ...cs, data: { ...cs.data, distanceKm: 99 } })
  await writes.update({ id: 'cs1', body: { data: { distanceKm: 99 } } })
  await waitFor(() => expect(queryClient.getQueryState(contentKeys.entry('en1'))?.isInvalidated).toBe(true))
  expect(queryClient.getQueryState(contentKeys.versions('en1'))?.isInvalidated).toBe(true)
  expect(queryClient.getQueryState(contentKeys.entry('cs1'))?.isInvalidated).toBe(false)
})

it('translate creates a version and caches it', async () => {
  const { queryClient, writes } = setup()
  const created = makeEntry({ id: 'cs1', itemId: 'en1', language: 'cs' })
  vi.mocked(api.createVersion).mockResolvedValue(created)
  expect(await writes.translate('en1', 'cs')).toEqual(created)
  expect(api.createVersion).toHaveBeenCalledWith('en1', 'cs')
  expect(queryClient.getQueryData(contentKeys.entry('cs1'))).toEqual(created)
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm --filter admin-dashboard test -- localized queries.test`
Expected: FAIL: missing module and types (`itemId`, `versions`, `translate`).

- [ ] **Step 3: Implement**

`types/index.ts`:

```ts
export interface Field {
  // ...existing fields
  /** Translated per language version; absent means TEXT and RICH_TEXT are translated, the rest shared. */
  localized?: boolean;
}

export interface ContentEntry {
  // ...existing fields
  /** Content language of this version. */
  language?: string;
  /** Shared by every language version of the same entry. */
  itemId?: string;
}

export type EntryListItem = Omit<ContentEntry, 'contentType'> & {
  title: string;
  contentType: EntryContentTypeRef | null;
  /** Language codes of every version of the item. */
  languages?: string[];
};

export interface EntryVersion {
  id: string;
  language: string;
  status: EntryStatus;
  title: string;
  updatedAt: string;
}
```

`lib/localized.ts`:

```ts
import type { Field } from '@/types'

/** Same rule as the backend (utils/localized.ts): TEXT and RICH_TEXT are translated unless set otherwise. */
export function isLocalized(field: Pick<Field, 'type' | 'localized'>): boolean {
  if (field.localized !== undefined) return field.localized
  return field.type === 'TEXT' || field.type === 'RICH_TEXT'
}
```

`content-api.ts` additions:

```ts
export interface EntryWriteBody {
  data: Record<string, unknown>
  status?: EntryStatus
  /** Create only: the content language; the default language when absent. */
  language?: string
}

export async function listVersions(entryId: string): Promise<EntryVersion[]> {
  return (await apiClient.get<ApiResponse<EntryVersion[]>>(`/entries/${entryId}/versions`)).data.data
}

export async function createVersion(entryId: string, language: string): Promise<ContentEntry> {
  return (await apiClient.post<ApiResponse<ContentEntry>>(`/entries/${entryId}/versions`, { language })).data.data
}

export async function changeLanguage(entryId: string, language: string): Promise<ContentEntry> {
  return (await apiClient.put<ApiResponse<ContentEntry>>(`/entries/${entryId}/language`, { language })).data.data
}
```

`queries.ts`:

```ts
export const contentKeys = {
  // ...existing keys
  versions: (itemId: string) => [...contentKeys.all, 'versions', itemId] as const,
}

/** Every language version of the entry's item; keyed by item so all versions share one cache entry. */
export function useVersions(entry?: ContentEntry, options: { enabled?: boolean } = {}) {
  const itemId = entry?.itemId ?? entry?.id
  return useQuery({
    queryKey: contentKeys.versions(itemId ?? ''),
    queryFn: () => listVersions(entry!.id),
    enabled: !!entry && (options.enabled ?? true),
  })
}
```

In `useEntryWrites`, replace `refresh` and `done` with:

```ts
    const refresh = (savedId?: string) => {
      void queryClient.invalidateQueries({ queryKey: contentKeys.lists() })
      void queryClient.invalidateQueries({ queryKey: statsKeys.all })
      void queryClient.invalidateQueries({ queryKey: [...contentKeys.all, 'versions'] })
      // Shared fields are copied to the other language versions on the server.
      void queryClient.invalidateQueries({
        predicate: (q) => q.queryKey[0] === contentKeys.all[0] && q.queryKey[1] === 'entry' && q.queryKey[2] !== savedId,
      })
    }
    const done = async (promise: Promise<ContentEntry>) => {
      const entry = await promise
      queryClient.setQueryData(contentKeys.entry(entry.id), entry)
      refresh(entry.id)
      return entry
    }
```

and add `translate: (entryId: string, language: string) => done(createVersion(entryId, language))`, `changeLanguage: (entryId: string, language: string) => done(changeLanguage(entryId, language))` (import the API function under another name, for example `changeEntryLanguage`, to avoid the clash). `remove` calls `refresh()`.

`test-fixtures.ts`: `makeEntry` defaults gain `language: 'en'` and `itemId: 'e1'`.

- [ ] **Step 4: Run tests, lint and build; commit**

Run: `pnpm --filter admin-dashboard test && pnpm --filter admin-dashboard lint && pnpm --filter admin-dashboard build`
Expected: all pass.

```bash
git add -A packages/admin-dashboard
git commit -m "feat(admin): language versions in the content data layer"
```

---

## Task 3: Editor language switcher, Translate, Change language and shared-field hints

**Files:**
- Create: `features/content/editor/LanguageMenu.tsx`, `features/content/editor/LanguagesSection.tsx`, `features/content/editor/ChangeLanguageDialog.tsx`
- Modify: `features/content/editor/EntryEditor.tsx`, `EditorTopBar.tsx`, `EditorSidePanel.tsx`, `i18n/locales/{en,cs}/editor.json`
- Test: `features/content/pages/EntryEditorLanguages.test.tsx` (create)

**Interfaces:**
- Consumes: `useLanguages()` (Task 1), `useVersions`, `useEntryWrites().translate/changeLanguage`, `isLocalized`, `EntryVersion` (Task 2).
- Produces: `LanguageMenu` props `{ languages: Language[]; versions: EntryVersion[]; current: string; canTranslate: boolean; busy: boolean; onOpen(id: string): void; onTranslate(code: string): void }`; `EditorTopBar` prop `languageMenu?: ReactNode`; `EditorSidePanel` prop `languages?: ReactNode`.

- [ ] **Step 1: Write the failing test** `features/content/pages/EntryEditorLanguages.test.tsx`

```tsx
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Link } from 'react-router-dom'
import { renderRoutes, setTestLanguage } from '@/test/render'
import { expectNoA11yViolations } from '@/test/a11y'
import * as api from '../content-api'
import * as languagesApi from '@/features/languages/languages-api'
import { EntryEditorPage } from './EntryEditorPage'
import { makeEntry, tripType } from '../test-fixtures'

vi.mock('../content-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../content-api')>()),
  getEntry: vi.fn(),
  getContentType: vi.fn(),
  listContentTypes: vi.fn(),
  updateEntry: vi.fn(),
  listVersions: vi.fn(),
  createVersion: vi.fn(),
  changeLanguage: vi.fn(),
}))
vi.mock('@/features/languages/languages-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/languages/languages-api')>()),
  listLanguages: vi.fn(),
}))
vi.mock('@/components/RichTextEditor', () => ({ RichTextEditor: () => <textarea aria-label="rich text" /> }))
vi.mock('@/features/content/editor/fields/MediaField', () => ({ MediaField: () => <div>media field</div> }))

const en = { id: 'l1', code: 'en', name: 'English', isDefault: true, order: 0 }
const cs = { id: 'l2', code: 'cs', name: 'Čeština', isDefault: false, order: 1 }
const de = { id: 'l3', code: 'de', name: 'Deutsch', isDefault: false, order: 2 }
const enEntry = makeEntry({ id: 'en1', itemId: 'en1', language: 'en', status: 'PUBLISHED', data: { title: 'Over the hills', distanceKm: 10 }, title: 'Over the hills' })
const csEntry = makeEntry({ id: 'cs1', itemId: 'en1', language: 'cs', data: { title: 'Přes kopce', distanceKm: 10 }, title: 'Přes kopce' })
const versions = [
  { id: 'en1', language: 'en', status: 'PUBLISHED' as const, title: 'Over the hills', updatedAt: '' },
  { id: 'cs1', language: 'cs', status: 'DRAFT' as const, title: 'Přes kopce', updatedAt: '' },
]
const routes = [
  { path: '/content/:id', element: <><EntryEditorPage /><Link to="/elsewhere">elsewhere</Link></> },
  { path: '/elsewhere', element: <p>elsewhere page</p> },
]

beforeEach(() => {
  vi.mocked(api.getContentType).mockResolvedValue(tripType)
  vi.mocked(api.listContentTypes).mockResolvedValue([tripType])
  vi.mocked(api.getEntry).mockImplementation(async (id) => (id === 'cs1' ? csEntry : enEntry))
  vi.mocked(api.listVersions).mockResolvedValue(versions)
  vi.mocked(languagesApi.listLanguages).mockResolvedValue([en, cs, de])
})

it('shows every language with its status or Missing, and opens another version', async () => {
  const { router, container } = renderRoutes(routes, { route: '/content/en1' })
  await userEvent.click(await screen.findByRole('button', { name: 'Language: English' }))
  expect(screen.getByRole('menuitem', { name: /Čeština.*Draft/ })).toBeInTheDocument()
  expect(screen.getByRole('menuitem', { name: 'Translate to Deutsch' })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('menuitem', { name: /Čeština/ }))
  await waitFor(() => expect(router.state.location.pathname).toBe('/content/cs1'))
  expect(await screen.findByDisplayValue('Přes kopce')).toBeInTheDocument()
  await expectNoA11yViolations(container)
})

it('translates into a missing language and opens the new draft', async () => {
  vi.mocked(api.createVersion).mockResolvedValue(makeEntry({ id: 'de1', itemId: 'en1', language: 'de', data: enEntry.data, title: enEntry.title }))
  const { router } = renderRoutes(routes, { route: '/content/en1' })
  await userEvent.click(await screen.findByRole('button', { name: 'Language: English' }))
  await userEvent.click(screen.getByRole('menuitem', { name: 'Translate to Deutsch' }))
  await waitFor(() => expect(router.state.location.pathname).toBe('/content/de1'))
  expect(api.createVersion).toHaveBeenCalledWith('en1', 'de')
})

it('does not translate while there are unsaved changes, and guards switching language', async () => {
  const { router } = renderRoutes(routes, { route: '/content/cs1' })
  const title = await screen.findByDisplayValue('Přes kopce')
  await userEvent.type(title, '!')
  await userEvent.click(screen.getByRole('button', { name: 'Language: Čeština' }))
  const translate = screen.getByRole('menuitem', { name: /Translate to Deutsch/ })
  expect(translate).toHaveAttribute('aria-disabled', 'true')
  expect(screen.getByText('Save your changes before translating')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('menuitem', { name: /English/ }))
  expect(await screen.findByRole('alertdialog')).toBeInTheDocument()
  expect(router.state.location.pathname).toBe('/content/cs1')
})

it('marks shared fields with "Same in all languages" and leaves translated ones alone', async () => {
  renderRoutes(routes, { route: '/content/en1' })
  const distance = await screen.findByLabelText('Distance (km)')
  const hint = screen.getAllByText('Same in all languages')
  // distanceKm (NUMBER) and published (BOOLEAN) are shared; the title is translated.
  expect(hint).toHaveLength(2)
  expect(distance.closest('div')?.parentElement).toHaveTextContent('Same in all languages')
})

it('changes the language of a version and warns when the default language would be left without one', async () => {
  vi.mocked(api.listVersions).mockResolvedValue([versions[0]])
  vi.mocked(api.changeLanguage).mockResolvedValue({ ...enEntry, language: 'de' })
  renderRoutes(routes, { route: '/content/en1' })
  const panel = await screen.findByRole('complementary', { name: 'Entry details' })
  await userEvent.click(await within(panel).findByRole('button', { name: 'Change language' }))
  const dialog = await screen.findByRole('alertdialog', { name: 'Change the language of this version' })
  await userEvent.click(within(dialog).getByRole('combobox', { name: 'Language' }))
  await userEvent.click(await screen.findByRole('option', { name: 'Deutsch' }))
  expect(within(dialog).getByText(/no version in English, the default language/)).toBeInTheDocument()
  await userEvent.click(within(dialog).getByRole('button', { name: 'Change language' }))
  await waitFor(() => expect(api.changeLanguage).toHaveBeenCalledWith('en1', 'de'))
})

it('says the delete removes only this language version when there are others', async () => {
  renderRoutes(routes, { route: '/content/cs1' })
  const panel = await screen.findByRole('complementary', { name: 'Entry details' })
  await userEvent.click(await within(panel).findByRole('button', { name: 'Delete' }))
  expect(await screen.findByText(/removes the Čeština version\. Other languages stay/)).toBeInTheDocument()
})

it('shows no language controls while only one language exists', async () => {
  vi.mocked(languagesApi.listLanguages).mockResolvedValue([en])
  vi.mocked(api.listVersions).mockResolvedValue([versions[0]])
  renderRoutes(routes, { route: '/content/en1' })
  await screen.findByDisplayValue('Over the hills')
  expect(screen.queryByRole('button', { name: /Language:/ })).not.toBeInTheDocument()
  expect(screen.queryByText('Same in all languages')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Change language' })).not.toBeInTheDocument()
})

it('works in Czech', async () => {
  await setTestLanguage('cs')
  const { container } = renderRoutes(routes, { route: '/content/en1' })
  await userEvent.click(await screen.findByRole('button', { name: 'Jazyk: English' }))
  expect(screen.getByRole('menuitem', { name: 'Vytvořit překlad: Deutsch' })).toBeInTheDocument()
  await userEvent.keyboard('{Escape}')
  expect(screen.getAllByText('Stejné ve všech jazycích').length).toBeGreaterThan(0)
  await expectNoA11yViolations(container)
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter admin-dashboard test -- EntryEditorLanguages`
Expected: FAIL: no "Language: English" button.

- [ ] **Step 3: Implement**

`editor/LanguageMenu.tsx`:

```tsx
import { useTranslation } from 'react-i18next'
import { ChevronDown, Languages as LanguagesIcon, Plus } from 'lucide-react'
import type { EntryVersion } from '@/types'
import type { Language } from '@/features/languages/languages-api'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

interface LanguageMenuProps {
  languages: Language[]
  versions: EntryVersion[]
  current: string
  /** False while the editor has unsaved changes: a translation copies the saved version. */
  canTranslate: boolean
  busy: boolean
  onOpen: (id: string) => void
  onTranslate: (code: string) => void
}

export function LanguageMenu({ languages, versions, current, canTranslate, busy, onOpen, onTranslate }: LanguageMenuProps) {
  const { t } = useTranslation('editor')
  const name = (code: string) => languages.find((l) => l.code === code)?.name ?? code
  const byLanguage = new Map(versions.map((v) => [v.language, v]))
  const missing = languages.filter((l) => !byLanguage.has(l.code))
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" aria-label={t('languages.switcherLabel', { language: name(current) })}>
          <LanguagesIcon aria-hidden />
          <span className="font-mono text-xs uppercase">{current}</span>
          <ChevronDown aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-56">
        {languages.filter((l) => byLanguage.has(l.code)).map((l) => {
          const version = byLanguage.get(l.code)!
          return (
            <DropdownMenuItem key={l.code} disabled={l.code === current} onSelect={() => onOpen(version.id)}>
              <span className="flex-1">{l.name}</span>
              <span className="text-xs text-muted-foreground">{t(`status.${version.status}`, { ns: 'common' })}</span>
            </DropdownMenuItem>
          )
        })}
        {missing.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
              {canTranslate ? t('languages.missing') : t('languages.saveFirst')}
            </DropdownMenuLabel>
            {missing.map((l) => (
              <DropdownMenuItem key={l.code} disabled={!canTranslate || busy} onSelect={() => onTranslate(l.code)}>
                <Plus aria-hidden />
                {t('languages.translateTo', { language: l.name })}
              </DropdownMenuItem>
            ))}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

(The current language's item is disabled so its accessible name still contains its status; the test's `/Čeština.*Draft/` relies on name and status in one item.)

`editor/ChangeLanguageDialog.tsx`:

```tsx
import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import type { Language } from '@/features/languages/languages-api'
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface ChangeLanguageDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Languages the item has no version in. */
  free: Language[]
  current: string
  /** True when the item has another version in the default language. */
  defaultCovered: boolean
  defaultLanguage?: Language
  pending: boolean
  onConfirm: (code: string) => void
}

export function ChangeLanguageDialog({ open, onOpenChange, ...rest }: ChangeLanguageDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <ChangeLanguageBody {...rest} />
      </AlertDialogContent>
    </AlertDialog>
  )
}

function ChangeLanguageBody({ free, current, defaultCovered, defaultLanguage, pending, onConfirm }: Omit<ChangeLanguageDialogProps, 'open' | 'onOpenChange'>) {
  const { t } = useTranslation('editor')
  const [code, setCode] = useState<string>()
  const leavesDefault = !!defaultLanguage && current === defaultLanguage.code && !defaultCovered && !!code
  return (
    <>
      <AlertDialogHeader>
        <AlertDialogTitle className="font-serif text-xl">{t('languages.changeTitle')}</AlertDialogTitle>
        <AlertDialogDescription>{free.length ? t('languages.changeText') : t('languages.noFreeLanguage')}</AlertDialogDescription>
      </AlertDialogHeader>
      {free.length > 0 && (
        <div className="space-y-1.5">
          <Label htmlFor="change-language">{t('languages.changeSelect')}</Label>
          <Select value={code} onValueChange={setCode}>
            <SelectTrigger id="change-language" aria-label={t('languages.changeSelect')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {free.map((l) => (
                <SelectItem key={l.code} value={l.code}>{l.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      {leavesDefault && (
        <p role="alert" className="rounded-md border border-status-draft-fg/40 bg-status-draft-bg px-3 py-2 text-sm text-status-draft-fg">
          {t('languages.noDefaultWarning', { language: defaultLanguage!.name })}
        </p>
      )}
      <AlertDialogFooter>
        <AlertDialogCancel>{t('actions.cancel', { ns: 'common' })}</AlertDialogCancel>
        <Button disabled={!code || pending} onClick={() => code && onConfirm(code)}>{t('languages.changeConfirm')}</Button>
      </AlertDialogFooter>
    </>
  )
}
```

(Use the status token class names that exist in the theme; `StatusPill` shows which ones.)

`editor/LanguagesSection.tsx`:

```tsx
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import type { EntryVersion } from '@/types'
import type { Language } from '@/features/languages/languages-api'
import { StatusPill } from '@/components/common/StatusPill'
import { Button } from '@/components/ui/button'

export function LanguagesSection({ languages, versions, current, onChange }: { languages: Language[]; versions: EntryVersion[]; current: string; onChange: () => void }) {
  const { t } = useTranslation('editor')
  const name = (code: string) => languages.find((l) => l.code === code)?.name ?? code
  return (
    <section className="rounded-lg border bg-card p-3">
      <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('languages.panelTitle')}</h2>
      <ul className="mb-3 flex flex-col gap-1.5 text-sm">
        {versions.map((v) => (
          <li key={v.id} className="flex items-center justify-between gap-2">
            {v.language === current ? (
              <span className="font-medium">{name(v.language)}</span>
            ) : (
              <Link to={`/content/${v.id}`} className="hover:underline">{name(v.language)}</Link>
            )}
            <StatusPill status={v.status} />
          </li>
        ))}
      </ul>
      <Button variant="outline" size="sm" onClick={onChange}>{t('languages.changeLanguage')}</Button>
    </section>
  )
}
```

`EditorTopBar.tsx`: add `languageMenu?: ReactNode` to the props and render it right after the type name span: `{languageMenu}`.

`EditorSidePanel.tsx`: add `languages?: ReactNode` and render it after the status section. Add `deleteText?: string` is not needed here: the delete confirm lives in `EntryEditor`.

`EntryEditor.tsx` changes:

```tsx
import { useLanguages } from '@/features/languages/languages-queries'
import { isLocalized } from '@/lib/localized'
import { useVersions } from '../queries'
import { LanguageMenu } from './LanguageMenu'
import { LanguagesSection } from './LanguagesSection'
import { ChangeLanguageDialog } from './ChangeLanguageDialog'

  // inside the component
  const languagesQuery = useLanguages()
  const languages = languagesQuery.data ?? []
  const multilingual = languages.length > 1
  const versionsQuery = useVersions(entry, { enabled: multilingual })
  const versions = versionsQuery.data ?? []
  const language = entry?.language ?? languages.find((l) => l.isDefault)?.code ?? 'en'
  const languageName = (code: string) => languages.find((l) => l.code === code)?.name ?? code
  const [changeOpen, setChangeOpen] = useState(false)
  const showLanguages = multilingual && !!entry && versions.length > 0

  const translate = async (code: string) => {
    setBusy(true)
    try {
      const created = await writes.translate(entryIdRef.current!, code)
      toast.success(t('languages.translated', { language: languageName(code) }))
      navigate(`/content/${created.id}`)
    } catch (error) {
      toast.error(apiErrorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  const changeLanguage = async (code: string) => {
    setBusy(true)
    try {
      const moved = await writes.changeLanguage(entryIdRef.current!, code)
      setEntry(moved)
      setChangeOpen(false)
      toast.success(t('languages.changed', { language: languageName(code) }))
    } catch (error) {
      toast.error(apiErrorMessage(error))
    } finally {
      setBusy(false)
    }
  }
```

- `renderField`: after `<FieldControl .../>`, add `{multilingual && !isLocalized(field) && <p className="mt-1 text-xs text-muted-foreground">{t('languages.sharedHint')}</p>}`. Do the same under the title input when the title field is shared.
- `EditorTopBar` gets `languageMenu={showLanguages ? <LanguageMenu languages={languages} versions={versions} current={language} canTranslate={!form.isDirty} busy={busy} onOpen={(id) => navigate(`/content/${id}`)} onTranslate={(code) => void translate(code)} /> : undefined}`.
- `EditorSidePanel` gets `languages={showLanguages ? <LanguagesSection languages={languages} versions={versions} current={language} onChange={() => setChangeOpen(true)} /> : undefined}`.
- Render `ChangeLanguageDialog` with `free={languages.filter((l) => !versions.some((v) => v.language === l.code))}`, `current={language}`, `defaultLanguage={languages.find((l) => l.isDefault)}`, `defaultCovered={versions.some((v) => v.language === languages.find((l) => l.isDefault)?.code && v.id !== entry?.id)}`.
- Delete confirm description: `versions.length > 1 ? t('confirm.deleteVersionText', { language: languageName(language) }) : t('confirm.deleteText')`.
- Duplicate keeps the language: add `language: entry?.language` to the duplicate's create body.

`editor.json` additions (en):

```json
  "languages": {
    "switcherLabel": "Language: {{language}}",
    "missing": "Missing",
    "translateTo": "Translate to {{language}}",
    "saveFirst": "Save your changes before translating",
    "panelTitle": "Languages",
    "changeLanguage": "Change language",
    "changeTitle": "Change the language of this version",
    "changeText": "Choose the language this version is written in. The content stays as it is.",
    "changeSelect": "Language",
    "changeConfirm": "Change language",
    "noFreeLanguage": "Every language already has a version of this entry.",
    "noDefaultWarning": "After this change the entry has no version in {{language}}, the default language. Sites that do not ask for a language will not show it.",
    "sharedHint": "Same in all languages",
    "translated": "Created the {{language}} version",
    "changed": "Moved to {{language}}"
  }
```

and `confirm.deleteVersionText`: "This permanently removes the {{language}} version. Other languages stay."

(cs):

```json
  "languages": {
    "switcherLabel": "Jazyk: {{language}}",
    "missing": "Chybí",
    "translateTo": "Vytvořit překlad: {{language}}",
    "saveFirst": "Před překladem uložte změny",
    "panelTitle": "Jazyky",
    "changeLanguage": "Změnit jazyk",
    "changeTitle": "Změnit jazyk této verze",
    "changeText": "Vyberte jazyk, ve kterém je tato verze napsaná. Obsah zůstane beze změny.",
    "changeSelect": "Jazyk",
    "changeConfirm": "Změnit jazyk",
    "noFreeLanguage": "Tato položka už má verzi ve všech jazycích.",
    "noDefaultWarning": "Po této změně položka nebude mít verzi ve výchozím jazyce ({{language}}). Weby, které o jazyk neřeknou, ji nezobrazí.",
    "sharedHint": "Stejné ve všech jazycích",
    "translated": "Verze {{language}} je vytvořená",
    "changed": "Přesunuto do jazyka {{language}}"
  }
```

and `confirm.deleteVersionText`: "Trvale odstraní verzi {{language}}. Ostatní jazyky zůstanou."

- [ ] **Step 4: Run tests, lint and build; commit**

Run: `pnpm --filter admin-dashboard test && pnpm --filter admin-dashboard lint && pnpm --filter admin-dashboard build`
Expected: all pass (existing `EntryEditorPage` tests too: with `listLanguages` unmocked there they fail to load languages, so add the same `languages-api` mock to `EntryEditorPage.test.tsx` and `EntryEditorPage.review.test.tsx` returning `[en]`).

```bash
git add -A packages/admin-dashboard
git commit -m "feat(admin): editor language switcher, translate and change language"
```

---

## Task 4: Content list language filters and badges

**Files:**
- Modify: `features/content/list-params.ts`, `features/content/components/ContentFilters.tsx`, `features/content/pages/ContentListPage.tsx`, `i18n/locales/{en,cs}/content.json`
- Test: `features/content/list-params.test.ts` (add cases; create if missing), `features/content/pages/ContentListPage.test.tsx` (add cases)

**Interfaces:**
- Consumes: `useLanguages()` (Task 1), `EntryListParams.language/missing` (Task 1), `EntryListItem.languages` (Task 2).
- Produces: `ContentListParams.lang?: string`, `ContentListParams.missing?: string` (URL `?lang=cs&missing=de`).

- [ ] **Step 1: Write the failing tests**

`list-params.test.ts`:

```ts
import { parseListParams, serializeListParams, toEntryQuery } from './list-params'

it('reads and writes the language filters', () => {
  const p = parseListParams(new URLSearchParams('lang=cs&missing=de'))
  expect(p).toMatchObject({ lang: 'cs', missing: 'de' })
  expect(serializeListParams(p).toString()).toBe('lang=cs&missing=de')
  expect(toEntryQuery(p)).toMatchObject({ language: 'cs', missing: 'de' })
})

it('ignores malformed language codes', () => {
  expect(parseListParams(new URLSearchParams('lang=Czech!&missing=x'))).not.toHaveProperty('lang')
})
```

Add to `ContentListPage.test.tsx` (follow its existing mocks; add a `languages-api` mock that returns `[en, cs]` by default):

```tsx
it('filters by language and shows each row’s language and the others it has', async () => {
  vi.mocked(api.listEntries).mockResolvedValue(page([makeListItem({ id: 'cs1', language: 'cs', languages: ['cs', 'en'], title: 'Přes kopce' })]))
  renderWithProviders(<ContentListPage />, { route: '/content?lang=cs' })
  expect(await screen.findByText('Přes kopce')).toBeInTheDocument()
  expect(api.listEntries).toHaveBeenLastCalledWith(expect.objectContaining({ language: 'cs' }))
  const row = screen.getByText('Přes kopce').closest('tr')!
  expect(within(row).getByText('CS')).toBeInTheDocument()
  expect(within(row).getByText('Also in EN')).toBeInTheDocument()
})

it('finds entries missing a language', async () => {
  renderWithProviders(<ContentListPage />, { route: '/content' })
  await userEvent.click(await screen.findByRole('combobox', { name: 'Missing translation' }))
  await userEvent.click(await screen.findByRole('option', { name: 'Missing in Čeština' }))
  await waitFor(() => expect(api.listEntries).toHaveBeenLastCalledWith(expect.objectContaining({ missing: 'cs' })))
})

it('hides language filters and badges with one language', async () => {
  vi.mocked(languagesApi.listLanguages).mockResolvedValue([en])
  vi.mocked(api.listEntries).mockResolvedValue(page([makeListItem({ language: 'en', languages: ['en'] })]))
  renderWithProviders(<ContentListPage />, { route: '/content' })
  await screen.findByText('Přes Šumavu')
  expect(screen.queryByRole('combobox', { name: 'Language' })).not.toBeInTheDocument()
  expect(screen.queryByText('EN')).not.toBeInTheDocument()
})
```

(Use the file's existing helpers for a paginated response and its render helper; the names above (`page`, `renderWithProviders`) match the shared test utilities, adjust if the file uses others.)

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm --filter admin-dashboard test -- list-params ContentListPage`
Expected: FAIL on the new cases.

- [ ] **Step 3: Implement**

`list-params.ts`:

```ts
const LANGUAGE_CODE = /^[a-z]{2,3}(-[a-z0-9]{2,8})?$/

export interface ContentListParams {
  // ...existing
  lang?: string
  missing?: string
}

// parseListParams
  const lang = sp.get('lang')
  if (lang && LANGUAGE_CODE.test(lang)) params.lang = lang
  const missing = sp.get('missing')
  if (missing && LANGUAGE_CODE.test(missing)) params.missing = missing

// serializeListParams (after page is fine; keep this order for the test: lang, missing come first when nothing else is set)
  if (p.lang) sp.set('lang', p.lang)
  if (p.missing) sp.set('missing', p.missing)

// toEntryQuery
    language: p.lang,
    missing: p.missing,
```

Import `LANGUAGE_CODE` from `@/features/languages/languages-api` instead of redefining it.

`ContentFilters.tsx`: new optional prop `languages?: Language[]`. When `languages && languages.length > 1`, render two more selects next to Status:

```tsx
          <Select value={params.lang ?? ANY} onValueChange={(v) => update({ lang: v === ANY ? undefined : v })}>
            <SelectTrigger aria-label={t('filters.language')} className="w-auto min-w-36 rounded-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>{t('filters.allLanguages')}</SelectItem>
              {languages.map((l) => (
                <SelectItem key={l.code} value={l.code}>{l.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={params.missing ?? ANY} onValueChange={(v) => update({ missing: v === ANY ? undefined : v })}>
            <SelectTrigger aria-label={t('filters.missing')} className="w-auto min-w-40 rounded-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>{t('filters.missingAny')}</SelectItem>
              {languages.map((l) => (
                <SelectItem key={l.code} value={l.code}>{t('filters.missingIn', { language: l.name })}</SelectItem>
              ))}
            </SelectContent>
          </Select>
```

`ContentListPage.tsx`:
- `const languages = useLanguages().data ?? []`, `const multilingual = languages.length > 1`; pass `languages` to `ContentFilters`.
- `filtersActive` includes `params.lang || params.missing`; Clear filters resets them too.
- In the title cell and the mobile row, after `TitleLink`, when `multilingual && e.language`:

```tsx
function LanguageBadges({ entry }: { entry: EntryListItem }) {
  const { t } = useTranslation('content')
  const others = (entry.languages ?? []).filter((l) => l !== entry.language)
  return (
    <span className="ml-2 inline-flex items-center gap-1.5 align-middle text-xs text-muted-foreground">
      <span className="rounded border px-1 font-mono uppercase">{entry.language}</span>
      {others.length > 0 && <span>{t('list.alsoIn', { languages: others.map((l) => l.toUpperCase()).join(', ') })}</span>}
    </span>
  )
}
```

(`entry.language` is shown uppercase through CSS, so the DOM text is `cs`; make the test match whichever you choose: either render `entry.language.toUpperCase()` and keep the test's `'CS'`, or keep CSS and query `'cs'`. Prefer rendering the uppercase text so screen readers and the test agree.)

`content.json` additions. en: `filters.language` "Language", `filters.allLanguages` "All languages", `filters.missing` "Missing translation", `filters.missingAny` "Any translation", `filters.missingIn` "Missing in {{language}}", `list.alsoIn` "Also in {{languages}}". cs: "Jazyk", "Všechny jazyky", "Chybějící překlad", "Bez ohledu na překlad", "Chybí: {{language}}", "Také: {{languages}}". (The test uses the English option "Missing in Čeština".)

- [ ] **Step 4: Run tests, lint and build; check 360px; commit**

Run: `pnpm --filter admin-dashboard test && pnpm --filter admin-dashboard lint && pnpm --filter admin-dashboard build`
Expected: all pass. The filter row already wraps (`flex-wrap`); confirm in Task 7 at 360px.

```bash
git add -A packages/admin-dashboard
git commit -m "feat(admin): language filters and badges in the content list"
```

---

## Task 5: Translated switch in the model builder

**Files:**
- Modify: `features/models/model-draft.ts`, `features/models/components/ModelFieldInspector.tsx`, `features/models/pages/ModelBuilderPage.tsx`, `i18n/locales/{en,cs}/models.json`
- Test: `features/models/model-draft.test.ts` (add), `features/models/pages/ModelBuilderPage.test.tsx` (add)

**Interfaces:**
- Consumes: `isLocalized` (Task 2), `useLanguages()` (Task 1).
- Produces: `DraftField.originalLocalized?: boolean` (the saved effective value), `toModelPayload` keeps `localized` when set, `diffKeys(d)` returns `{ renamed, removed, unified: string[] }` (keys of saved fields that were translated and are now shared), `ModelFieldInspector` prop `multilingual: boolean`.

- [ ] **Step 1: Write the failing tests**

`model-draft.test.ts`:

```ts
it('keeps each field’s Translated setting when saving, including untouched fields', () => {
  const draft = draftFromType({
    ...type,
    fields: [
      { name: 'title', label: 'Title', type: 'TEXT', required: true, localized: false },
      { name: 'km', label: 'Distance', type: 'NUMBER', required: false, localized: true },
      { name: 'body', label: 'Body', type: 'RICH_TEXT', required: false },
    ],
  })
  expect(toModelPayload(draft).fields.map((f) => [f.name, f.localized])).toEqual([
    ['title', false],
    ['km', true],
    ['body', undefined],
  ])
})

it('lists saved fields that turn from translated to shared', () => {
  const draft = draftFromType({ ...type, fields: [{ name: 'body', label: 'Body', type: 'RICH_TEXT', required: false }] })
  const changed = updateField(draft, draft.fields[0].cid, { localized: false })
  expect(diffKeys(changed).unified).toEqual(['body'])
  expect(diffKeys(updateField(changed, draft.fields[0].cid, { localized: true })).unified).toEqual([])
})
```

(Use the file's existing `type` fixture name; add one if it has none.)

`ModelBuilderPage.test.tsx` (add, using the file's existing mocks; add a `languages-api` mock returning `[en, cs]`, and `[en]` for the last case):

```tsx
it('switches a field to shared and warns before saving when the model has entries', async () => {
  // existing model with a RICH_TEXT "body" field and an entry count of 3, per the file's helpers
  renderBuilder()
  await userEvent.click(await screen.findByRole('button', { name: /Body/ }))
  const translated = screen.getByRole('switch', { name: 'Translated' })
  expect(translated).toBeChecked()
  await userEvent.click(translated)
  expect(screen.getByText('The same value in every language.')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
  const dialog = await screen.findByRole('alertdialog', { name: 'Make fields the same in every language?' })
  expect(within(dialog).getByText(/body/)).toBeInTheDocument()
  await userEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }))
  await waitFor(() => expect(apiClient.put).toHaveBeenCalledWith(expect.stringMatching(/^\/content-types\//), expect.objectContaining({
    fields: expect.arrayContaining([expect.objectContaining({ name: 'body', localized: false })]),
  })))
})

it('hides the Translated switch with one language', async () => {
  vi.mocked(languagesApi.listLanguages).mockResolvedValue([en])
  renderBuilder()
  await userEvent.click(await screen.findByRole('button', { name: /Body/ }))
  expect(screen.queryByRole('switch', { name: 'Translated' })).not.toBeInTheDocument()
})
```

(Adapt `renderBuilder`, the field-selection button name and the save button label to the file's existing helpers and copy; the assertions that matter are the switch state, the dialog title and the `localized: false` payload.)

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm --filter admin-dashboard test -- model-draft ModelBuilderPage`
Expected: FAIL: `localized` dropped from the payload; no switch.

- [ ] **Step 3: Implement**

`model-draft.ts`:

```ts
import { isLocalized } from '@/lib/localized'

export type DraftField = Field & { cid: string; originalName?: string; keyTouched: boolean; originalLocalized?: boolean }

// draftFromType
  const fields = ct.fields.map((f) => ({ ...f, cid: nextCid(), originalName: f.name, keyTouched: true, originalLocalized: isLocalized(f) }))

// toModelPayload, inside the field map
      if (f.localized !== undefined) field.localized = f.localized

export function diffKeys(d: ModelDraft): { renamed: { from: string; to: string }[]; removed: string[]; unified: string[] } {
  // ...existing renamed/removed
  const unified = d.fields.filter((f) => f.originalLocalized === true && !isLocalized(f)).map((f) => f.name)
  return { renamed, removed, unified }
}
```

`ModelFieldInspector.tsx`: new prop `multilingual: boolean`; after the Required switch:

```tsx
      {multilingual && (
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="fi-localized">{t('inspector.translated')}</Label>
            <Switch id="fi-localized" checked={isLocalized(field)} onCheckedChange={(checked) => onChange({ localized: checked })} />
          </div>
          <p className="text-sm text-muted-foreground">{isLocalized(field) ? t('inspector.translatedHint') : t('inspector.sharedHint')}</p>
        </div>
      )}
```

`ModelBuilderPage.tsx`:
- `const multilingual = (useLanguages().data?.length ?? 0) > 1` and pass it to the inspector.
- `requestSave`: open the confirm when `model && (!countKnown || count > 0) && (diff.renamed.length || diff.removed.length || diff.unified.length)`.
- Confirm title: `diff.renamed.length || diff.removed.length ? tr('builder.renameTitle') : tr('builder.unifyTitle')`. Description: keep the existing rename block when there are renames or removals; when `diff.unified.length`, add `<span className="block">{tr('builder.unifyText')}</span><span className="block font-mono text-xs">{diff.unified.join(', ')}</span>`.

`models.json` additions. en: `inspector.translated` "Translated", `inspector.translatedHint` "Each language has its own value.", `inspector.sharedHint` "The same value in every language.", `builder.unifyTitle` "Make fields the same in every language?", `builder.unifyText` "Each entry keeps the value from its default-language version in these fields:". cs: "Překládá se", "Každý jazyk má vlastní hodnotu.", "Ve všech jazycích stejná hodnota.", "Sjednotit pole ve všech jazycích?", "Každá položka si v těchto polích ponechá hodnotu z verze ve výchozím jazyce:".

- [ ] **Step 4: Run tests, lint and build; commit**

Run: `pnpm --filter admin-dashboard test && pnpm --filter admin-dashboard lint && pnpm --filter admin-dashboard build`
Expected: all pass (`model-draft.ts` is in `i18n-scope.json`, so no literal strings there).

```bash
git add -A packages/admin-dashboard
git commit -m "feat(admin): Translated switch in the model builder"
```

---

## Task 6: Example site content language

**Files (repo root):**
- Modify: `examples/src/config.ts`, `examples/src/lib/cms.ts`, `examples/public/config.js` is git-ignored (document the key in `examples/README.md`), `.github/workflows/example-website-ci-cd.yml`

**Interfaces:**
- Produces: `CmsConfig.contentLanguage: string` (empty means the CMS default language).

The example site has no test runner; this task is verified by `pnpm --filter blog-flajsman build` and the browser check in Task 7.

- [ ] **Step 1: Implement**

`examples/src/config.ts`: add to `CmsConfig`

```ts
  /** Content language code sent as ?language= (for example "cs"). Empty = the CMS default language. */
  contentLanguage: string;
```

and to `config`: `contentLanguage: raw.contentLanguage || '',`.

`examples/src/lib/cms.ts`: in `request`, add the language to every content request:

```ts
async function request<T>(endpoint: string, params: Record<string, unknown> = {}): Promise<T> {
  const url = new URL(`${config.apiUrl}${endpoint}`);
  const all = endpoint.startsWith('/content/') ? { language: config.contentLanguage, ...params } : params;
  for (const [k, v] of Object.entries(all)) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  }
  // ...unchanged
}
```

(Empty `contentLanguage` is skipped by the existing empty-value check, so sites without the setting send no parameter.)

`.github/workflows/example-website-ci-cd.yml`: in the generated `config.js`, add `contentLanguage: "${{ secrets.EXAMPLE_CMS_CONTENT_LANGUAGE }}",` after `mapTilerKey`. A missing secret renders as an empty string, which means the default language.

`examples/README.md`: document `contentLanguage` in the config section, with the example `contentLanguage: "cs"`.

- [ ] **Step 2: Build and commit**

Run: `pnpm --filter blog-flajsman build`
Expected: build succeeds.

```bash
git add examples .github/workflows/example-website-ci-cd.yml
git commit -m "feat(example): content language setting"
```

---

## Task 7: Browser verification

**Files:** none unless a defect is found (fix with a test).

- [ ] **Step 1: Local run**

Start mongod, Azurite, the backend (port 3000) and the admin dev server from the worktree, plus the example site. Use a throwaway copy of the local database (as in Plan 1 Task 7) so the real local data stays as it is; point the backend at it with `MONGODB_URI`.

Check, in English and then Czech:

1. Setup, Languages: English is default; add Čeština; rename it and back; the default row has no Delete.
2. Content list: language filter and "Missing in Čeština" appear; rows show `EN`; at 360px the filter row wraps with no horizontal scroll.
3. Editor on an English entry: the language button shows `EN`; Translate to Čeština opens the new draft; edit its title and a shared field (a number or media field), save, switch back to English: the shared value changed, the title did not.
4. Unsaved edit, then choose English in the language menu: the leave dialog appears; Translate items are disabled with the hint.
5. Change language on the Czech version to a new language, see the toast; change it back.
6. Model builder: the Translated switch shows on fields; turn a rich text field to shared on a model with entries: the warning lists the field; cancel.
7. Delete Čeština: the dialog states how many versions go with it; type `cs`, delete; the content list loses the Czech rows.
8. Home: Entries tile counts items (a translated entry counts once).
9. Example site with `contentLanguage: "cs"` in `public/config.js`: posts show Czech versions where they exist and the default language otherwise.
10. Axe has no violations on the Languages page (unit tests); dark theme looks right on Languages and the editor.

- [ ] **Step 2: Record and commit**

Append a "Content languages Plan 2 verification" table to `TEST_RESULTS.md`, drop the throwaway database, and commit:

```bash
git add TEST_RESULTS.md
git commit -m "docs: record content languages Plan 2 verification"
```

---

## Self-Review Notes

- **Spec coverage (section 7):** Languages page → Task 1; editor switcher, Translate, Change language with warning, shared hint, unsaved guard → Task 3 (Decision 2); content list filter, Missing, badges → Task 4; model builder switch and warning → Task 5; Home counts → backend (Decision 4), checked in Task 7; translations under the lint guard → every task. Section 8 example site → Task 6 (Decision 1). Section 10 admin testing → Tasks 1 to 5; browser → Task 7.
- **Type consistency:** `Language`, `LANGUAGE_CODE`, `useLanguages`, `useLanguageWrites`, `EntryVersion`, `isLocalized`, `listVersions`, `createVersion`, `changeLanguage`, `useVersions`, `contentKeys.versions`, `writes.translate`, `writes.changeLanguage`, `ContentListParams.lang/missing`, `EntryListParams.language/missing`, `diffKeys().unified`, `DraftField.originalLocalized` are used with the same names in every task.
