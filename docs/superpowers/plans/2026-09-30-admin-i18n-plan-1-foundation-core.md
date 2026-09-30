# Admin Localization, Plan 1: Foundation and Core Screens

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The admin can switch between English and Czech; the shell, sign-in, error page, Home, Content list and entry editor are fully translated, with localized dates, numbers and plurals.

**Architecture:** i18next with both languages bundled, a small `src/i18n` module for detection, storage and `<html lang>`, typed keys from the English catalogs, and code outside components calling `i18n.t` directly. A shared scope file lists every converted source file; the lint rule and a source scan check exactly those files, and Plan 2 widens the scope to the whole app.

**Tech Stack:** i18next 26, react-i18next 17, date-fns (existing, `cs` locale), `Intl.NumberFormat`, eslint-plugin-i18next 6, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-30-admin-i18n-en-cs-design.md`

**Series:** Plan 1 of 2. Plan 2 converts Media, Inbox, Models, Forms, Sites, Webhooks and widens the lint guard to the whole app.

## Global Constraints

- Languages: English (`en`, default) and Czech (`cs`). Storage key `thecms.language`. First visit: Czech when the browser's preferred language starts with `cs`, otherwise English.
- Server messages stay as the backend sends them. User content (entries, model, field and form names) is never translated.
- No backend or public API change.
- English catalog values equal today's English text exactly, so existing tests keep passing unchanged. A test that changes is a finding to ledger.
- Czech terms follow the spec glossary (section 6). Buttons use the infinitive (`Uložit`, `Smazat`, `Zrušit`). Czech quotes around names: `„{{title}}“`.
- Plurals: English `_one`/`_other`, Czech `_one`/`_few`/`_other`. Never build plurals with `count === 1 ? '' : 's'`.
- Never use an em dash in UI copy, code comments or docs (en dash ranges like `1–20` stay as they are).
- Every screen works at 360px in both languages without horizontal scrolling.

## Decisions (deviations from the spec, for the reviewer)

1. **Validation helpers call `i18n.t` directly** instead of returning keys. The spec's goal (translated validation messages in the current language) is met with no signature changes; messages are built when validation runs, which is after any language switch.
2. **The lint guard is switched on now, scoped to converted files** (listed in `i18n-scope.json`), instead of only after all screens are converted. Each task adds its files, so each task has an objective completion check. Plan 2 replaces the list with `src/**/*.tsx`.
3. **Module labels become keys.** `AppModule.label` and `CreateAction.label` are replaced by `labelKey` (typed against the `shell` catalog) so navigation, the command palette and the mobile tabs show the current language.
4. **Catalog contents are written during each task, not in this plan.** The plan fixes the namespaces, key conventions, the glossary and every Czech string that a test asserts; the rest of each catalog is the file's current English text with its Czech translation. Completeness is enforced by the lint guard, the source scan and the parity test; the owner reviews the Czech wording.

## Review Focus

1. **Storage blocked or holding an unsupported value** (`de`, garbage): the admin must still start in the detected language. Tested in Task 1.
2. **Czech plural boundaries 1, 2, 5** for counted messages (fields to fix, days ago, fields in a model): wrong forms read badly. Tested in Tasks 3 and 7.
3. **Switching language while the editor has unsaved changes** must keep the typed values and re-render labels in Czech. Tested in Task 7.
4. **Long Czech strings at 360px** (buttons, badges, top bar) must not overflow. Checked in Task 8.
5. **A date limit in validation** (`must be on or after …`) must show the date in the current language's format. Tested in Task 7.

---

## File Structure

All paths are relative to `packages/admin-dashboard`.

| File | Responsibility |
|---|---|
| `src/i18n/language.ts` | Supported languages, names, storage read/write, detection |
| `src/i18n/resources.ts` | Imports every catalog JSON and exports `resources` and `NAMESPACES` |
| `src/i18n/index.ts` | Creates and initializes the i18next instance, exports `i18n` |
| `src/i18n/i18next.d.ts` | Types keys from the English catalogs |
| `src/i18n/language-context.ts`, `LanguageProvider.tsx`, `useLanguage.ts` | Current language, `setLanguage`, `<html lang>` (same pattern as `app/theme`) |
| `src/i18n/LanguageSwitcher.tsx` | Compact switcher for the sign-in screen |
| `src/i18n/locales/{en,cs}/{common,shell,home,content,editor}.json` | Catalogs for this plan |
| `src/i18n/catalogs.test.ts` | Parity: same keys, Czech plural forms complete |
| `i18n-scope.json` | Converted files checked by the lint rule and the source scan |
| `src/i18n/source-scan.test.ts` | No literal strings passed to `toast.*` in converted files |
| `eslint.config.js` | `i18next/no-literal-string` in `jsx-only` mode on the scope |
| `src/lib/format.ts` | Language-aware `formatRelative`, `formatAbsolute`, `formatDate`, `formatNumber` |
| `src/test/setup.ts`, `src/test/render.tsx` | Tests start in English; render helpers include `LanguageProvider` |

---

## Task 1: i18n foundation

**Files:**
- Create: `src/i18n/language.ts`, `src/i18n/resources.ts`, `src/i18n/index.ts`, `src/i18n/i18next.d.ts`, `src/i18n/language-context.ts`, `src/i18n/LanguageProvider.tsx`, `src/i18n/useLanguage.ts`, `src/i18n/locales/en/common.json`, `src/i18n/locales/cs/common.json` (and empty `{}` files for `shell`, `home`, `content`, `editor` in both languages), `i18n-scope.json`, `src/i18n/source-scan.test.ts`
- Modify: `package.json` (deps), `tsconfig.app.json` (`resolveJsonModule`), `src/main.tsx`, `src/App.tsx`, `src/test/setup.ts`, `src/test/render.tsx`, `eslint.config.js`
- Test: `src/i18n/language.test.ts`, `src/i18n/LanguageProvider.test.tsx`, `src/i18n/catalogs.test.ts`

**Interfaces:**
- Produces:
  - `type Language = 'en' | 'cs'`, `SUPPORTED_LANGUAGES`, `LANGUAGE_NAMES: Record<Language, string>` (`English`, `Čeština`), `LANGUAGE_STORAGE_KEY = 'thecms.language'`, `isLanguage(v): v is Language`, `readLanguagePreference(): Language | null`, `writeLanguagePreference(l): void`, `detectLanguage(browserLanguages?: readonly string[]): Language`.
  - `i18n` (the initialized instance) from `@/i18n`.
  - `useLanguage(): { language: Language; setLanguage: (l: Language) => void }` inside `<LanguageProvider>`.
  - `NAMESPACES = ['common', 'shell', 'home', 'content', 'editor'] as const` (Plan 2 appends).
  - `i18n-scope.json`: `{ "files": string[] }` of paths relative to the package root.

- [ ] **Step 1: Install dependencies**

```bash
cd /Users/pavelflajsman/personalGit/thecms
pnpm --filter admin-dashboard add i18next@^26.4.2 react-i18next@^17.0.15
pnpm --filter admin-dashboard add -D eslint-plugin-i18next@^6.1.5
```

Add `"resolveJsonModule": true,` to `compilerOptions` in `packages/admin-dashboard/tsconfig.app.json`.

- [ ] **Step 2: Write the failing tests**

`src/i18n/language.test.ts`:

```ts
import { LANGUAGE_STORAGE_KEY, detectLanguage, readLanguagePreference, writeLanguagePreference } from './language'

afterEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

it('uses a saved supported language first', () => {
  localStorage.setItem(LANGUAGE_STORAGE_KEY, 'cs')
  expect(detectLanguage(['en-US'])).toBe('cs')
})

it('falls back to the browser preference when nothing valid is saved', () => {
  localStorage.setItem(LANGUAGE_STORAGE_KEY, 'de')
  expect(readLanguagePreference()).toBeNull()
  expect(detectLanguage(['cs-CZ', 'en'])).toBe('cs')
  expect(detectLanguage(['CS'])).toBe('cs')
  expect(detectLanguage(['en-GB', 'cs'])).toBe('en')
  expect(detectLanguage([])).toBe('en')
})

it('keeps working when storage is blocked', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('blocked')
  })
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('blocked')
  })
  expect(readLanguagePreference()).toBeNull()
  expect(() => writeLanguagePreference('cs')).not.toThrow()
  expect(detectLanguage(['cs'])).toBe('cs')
})
```

`src/i18n/LanguageProvider.test.tsx`:

```tsx
import { act, render, screen } from '@testing-library/react'
import { useTranslation } from 'react-i18next'
import { LanguageProvider } from './LanguageProvider'
import { useLanguage } from './useLanguage'
import { LANGUAGE_STORAGE_KEY } from './language'

function Probe() {
  const { t } = useTranslation()
  const { language, setLanguage } = useLanguage()
  return (
    <>
      <p>{t('actions.cancel')}</p>
      <p>lang:{language}</p>
      <button onClick={() => setLanguage('cs')}>to cs</button>
    </>
  )
}

it('switches language, saves the choice and sets html lang', async () => {
  render(
    <LanguageProvider>
      <Probe />
    </LanguageProvider>,
  )
  expect(screen.getByText('Cancel')).toBeInTheDocument()
  expect(document.documentElement.lang).toBe('en')
  await act(async () => screen.getByRole('button', { name: 'to cs' }).click())
  expect(screen.getByText('Zrušit')).toBeInTheDocument()
  expect(screen.getByText('lang:cs')).toBeInTheDocument()
  expect(document.documentElement.lang).toBe('cs')
  expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('cs')
})
```

`src/i18n/catalogs.test.ts`:

```ts
import { NAMESPACES, resources } from './resources'

type Tree = { [key: string]: string | Tree }

function flatten(tree: Tree, prefix = ''): string[] {
  return Object.entries(tree).flatMap(([k, v]) => (typeof v === 'string' ? [`${prefix}${k}`] : flatten(v, `${prefix}${k}.`)))
}

const PLURAL = /_(zero|one|two|few|many|other)$/

function split(keys: string[]) {
  const plain = new Set<string>()
  const plural = new Map<string, Set<string>>()
  for (const key of keys) {
    const m = key.match(PLURAL)
    if (!m) plain.add(key)
    else {
      const base = key.slice(0, -m[0].length)
      plural.set(base, (plural.get(base) ?? new Set()).add(m[1]))
    }
  }
  return { plain, plural }
}

describe.each(NAMESPACES)('%s catalog', (ns) => {
  const en = split(flatten(resources.en[ns] as Tree))
  const cs = split(flatten(resources.cs[ns] as Tree))

  it('has the same plain keys in Czech and English', () => {
    expect([...cs.plain].sort()).toEqual([...en.plain].sort())
  })

  it('has the same plural keys, with one/other in English and one/few/other in Czech', () => {
    expect([...cs.plural.keys()].sort()).toEqual([...en.plural.keys()].sort())
    for (const [base, forms] of en.plural) {
      expect({ base, forms: [...forms].sort() }).toEqual({ base, forms: ['one', 'other'] })
      const csForms = [...(cs.plural.get(base) ?? [])].filter((f) => f !== 'many').sort()
      expect({ base, forms: csForms }).toEqual({ base, forms: ['few', 'one', 'other'] })
    }
  })

  it('has no empty strings', () => {
    const values = [resources.en[ns], resources.cs[ns]].flatMap((t) => JSON.stringify(t).match(/":""/g) ?? [])
    expect(values).toEqual([])
  })
})
```

`src/i18n/source-scan.test.ts`:

```ts
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Paths are relative to the package root; Vitest runs from there.
const scope: { files: string[] } = JSON.parse(readFileSync(resolve(process.cwd(), 'i18n-scope.json'), 'utf8'))

// The lint rule covers JSX text and attributes; toasts are plain calls, so check them here.
const RAW_TOAST = /\btoast(?:\.(?:success|error|info|warning|message))?\(\s*(['"`])[^'"`]*[A-Za-z]/

it.each(scope.files.length ? scope.files : ['(none yet)'])('%s passes no literal text to toast', (file) => {
  if (file === '(none yet)') return
  const lines = readFileSync(resolve(process.cwd(), file), 'utf8').split('\n')
  const offenders = lines.map((l, i) => (RAW_TOAST.test(l) ? `${i + 1}: ${l.trim()}` : null)).filter(Boolean)
  expect(offenders).toEqual([])
})
```

- [ ] **Step 3: Run to verify they fail**

Run: `cd packages/admin-dashboard && pnpm test -- src/i18n`
Expected: FAIL, cannot resolve `./language`, `./resources`, `./LanguageProvider`, and `i18n-scope.json` not found.

- [ ] **Step 4: Implement the i18n module**

`src/i18n/language.ts`:

```ts
export const SUPPORTED_LANGUAGES = ['en', 'cs'] as const
export type Language = (typeof SUPPORTED_LANGUAGES)[number]

export const LANGUAGE_STORAGE_KEY = 'thecms.language'

/** Each language named in itself, as shown in the switcher. */
export const LANGUAGE_NAMES: Record<Language, string> = { en: 'English', cs: 'Čeština' }

export function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (SUPPORTED_LANGUAGES as readonly string[]).includes(value)
}

export function readLanguagePreference(): Language | null {
  try {
    const value = window.localStorage.getItem(LANGUAGE_STORAGE_KEY)
    return isLanguage(value) ? value : null
  } catch {
    return null
  }
}

export function writeLanguagePreference(language: Language): void {
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language)
  } catch {
    // Storage unavailable (private mode, blocked site data): keep the choice for this session only.
  }
}

function browserLanguages(): readonly string[] {
  if (typeof navigator === 'undefined') return []
  return navigator.languages?.length ? navigator.languages : [navigator.language]
}

/** Saved choice, else Czech when the browser's preferred language is Czech, else English. */
export function detectLanguage(languages: readonly string[] = browserLanguages()): Language {
  const saved = readLanguagePreference()
  if (saved) return saved
  return (languages[0] ?? '').toLowerCase().startsWith('cs') ? 'cs' : 'en'
}
```

`src/i18n/resources.ts`:

```ts
import enCommon from './locales/en/common.json'
import enShell from './locales/en/shell.json'
import enHome from './locales/en/home.json'
import enContent from './locales/en/content.json'
import enEditor from './locales/en/editor.json'
import csCommon from './locales/cs/common.json'
import csShell from './locales/cs/shell.json'
import csHome from './locales/cs/home.json'
import csContent from './locales/cs/content.json'
import csEditor from './locales/cs/editor.json'

export const NAMESPACES = ['common', 'shell', 'home', 'content', 'editor'] as const

export const resources = {
  en: { common: enCommon, shell: enShell, home: enHome, content: enContent, editor: enEditor },
  cs: { common: csCommon, shell: csShell, home: csHome, content: csContent, editor: csEditor },
} as const
```

`src/i18n/index.ts`:

```ts
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { NAMESPACES, resources } from './resources'
import { detectLanguage } from './language'

void i18n.use(initReactI18next).init({
  resources,
  lng: detectLanguage(),
  fallbackLng: 'en',
  supportedLngs: ['en', 'cs'],
  ns: [...NAMESPACES],
  defaultNS: 'common',
  interpolation: { escapeValue: false },
  // Catalogs are bundled, so initialize synchronously: no flash of untranslated text.
  initAsync: false,
})

export { i18n }
```

`src/i18n/i18next.d.ts`:

```ts
import 'i18next'
import type { resources } from './resources'

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common'
    resources: (typeof resources)['en']
  }
}
```

`src/i18n/language-context.ts`:

```ts
import { createContext } from 'react'
import type { Language } from './language'

export interface LanguageContextValue {
  language: Language
  setLanguage: (language: Language) => void
}

export const LanguageContext = createContext<LanguageContextValue | null>(null)
```

`src/i18n/useLanguage.ts`:

```ts
import { useContext } from 'react'
import { LanguageContext, type LanguageContextValue } from './language-context'

export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext)
  if (!context) throw new Error('useLanguage must be used inside LanguageProvider')
  return context
}
```

`src/i18n/LanguageProvider.tsx`:

```tsx
import { useCallback, useEffect, useMemo, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { i18n } from './index'
import { isLanguage, writeLanguagePreference, type Language } from './language'
import { LanguageContext } from './language-context'

export function LanguageProvider({ children }: { children: ReactNode }) {
  // Subscribes to languageChanged, so the whole tree re-renders on a switch.
  const { i18n: instance } = useTranslation()
  const language: Language = isLanguage(instance.resolvedLanguage) ? instance.resolvedLanguage : 'en'

  useEffect(() => {
    document.documentElement.lang = language
  }, [language])

  const setLanguage = useCallback((next: Language) => {
    writeLanguagePreference(next)
    void i18n.changeLanguage(next)
  }, [])

  const value = useMemo(() => ({ language, setLanguage }), [language, setLanguage])
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}
```

`src/i18n/locales/en/common.json` (Plan 1 starting content; later tasks add keys):

```json
{
  "actions": {
    "cancel": "Cancel",
    "confirm": "Confirm",
    "save": "Save",
    "delete": "Delete",
    "close": "Close",
    "retry": "Try again",
    "copy": "Copy",
    "undo": "Undo"
  },
  "status": {
    "PUBLISHED": "Published",
    "DRAFT": "Draft",
    "ARCHIVED": "Archived",
    "UNREAD": "New",
    "READ": "Read"
  },
  "time": {
    "justNow": "just now",
    "minutesAgo": "{{count}}m ago",
    "hoursAgo": "{{count}}h ago",
    "yesterday": "yesterday",
    "daysAgo": "{{count}} days ago"
  }
}
```

`src/i18n/locales/cs/common.json`:

```json
{
  "actions": {
    "cancel": "Zrušit",
    "confirm": "Potvrdit",
    "save": "Uložit",
    "delete": "Smazat",
    "close": "Zavřít",
    "retry": "Zkusit znovu",
    "copy": "Kopírovat",
    "undo": "Vrátit zpět"
  },
  "status": {
    "PUBLISHED": "Publikováno",
    "DRAFT": "Koncept",
    "ARCHIVED": "Archivováno",
    "UNREAD": "Nová",
    "READ": "Přečtená"
  },
  "time": {
    "justNow": "právě teď",
    "minutesAgo": "před {{count}} min",
    "hoursAgo": "před {{count}} h",
    "yesterday": "včera",
    "daysAgo": "před {{count}} dny"
  }
}
```

(`daysAgo` is only used for 2 to 6 days, where Czech always says `dny`, so it is a plain key.)

Create `{}` for `shell.json`, `home.json`, `content.json`, `editor.json` in both `en` and `cs`.

`i18n-scope.json` (package root):

```json
{
  "files": []
}
```

- [ ] **Step 5: Wire it into the app, tests and lint**

`src/main.tsx`: add `import './i18n'` as the first import after `'./styles/globals.css'`.

`src/App.tsx`: import `{ LanguageProvider } from './i18n/LanguageProvider'` and wrap it directly inside `<ThemeProvider>`, around `<AuthProvider>`.

`src/test/setup.ts`: add at the top `import { i18n } from '@/i18n'`, and inside the existing `afterEach` add:

```ts
  // Every test starts in English; tests that check Czech switch explicitly.
  void i18n.changeLanguage('en')
  document.documentElement.lang = 'en'
```

`src/test/render.tsx`: import `{ LanguageProvider } from '@/i18n/LanguageProvider'` and wrap it inside `<ThemeProvider>` in both `renderWithProviders` and `renderRoutes`. Add this helper:

```ts
import { act } from '@testing-library/react'
import { i18n } from '@/i18n'
import type { Language } from '@/i18n/language'

/** Switch the UI language inside a test (the setup file resets to English after each test). */
export async function setTestLanguage(language: Language) {
  await act(async () => {
    await i18n.changeLanguage(language)
  })
}
```

`eslint.config.js`: add the plugin and a scoped block.

```js
import i18next from 'eslint-plugin-i18next'
import { readFileSync } from 'node:fs'

const i18nScope = JSON.parse(readFileSync(new URL('./i18n-scope.json', import.meta.url), 'utf8')).files
```

and append to the array:

```js
  {
    // Converted files may not show literal text: JSX text and user-facing attributes must come from the catalogs.
    files: i18nScope.length ? i18nScope : ['__no-files-yet__'],
    plugins: { i18next },
    rules: {
      'i18next/no-literal-string': [
        'error',
        {
          mode: 'jsx-only',
          'jsx-attributes': {
            exclude: [
              'className', 'style', 'type', 'key', 'id', 'width', 'height', 'variant', 'size', 'align', 'side',
              'sideOffset', 'role', 'to', 'href', 'htmlFor', 'name', 'value', 'autoComplete', 'inputMode', 'rel',
              'target', 'accept', 'orientation', 'src', 'method', 'lang', 'dir', 'viewBox', 'fill', 'stroke', 'd',
              'xmlns', 'strokeWidth', 'tabIndex', 'pattern', 'min', 'max', 'step', 'scope', 'dateTime', 'mode',
              'data-.+', 'aria-(hidden|pressed|invalid|busy|current|expanded|live|haspopup|controls|describedby|labelledby|multiline|modal|selected|checked|disabled|level|orientation|atomic)',
            ],
          },
          words: { exclude: ['[0-9!-/:-@[-`{-~·…×–•]+', '[A-Z_-]+', 'TheCMS'] },
        },
      ],
    },
  },
```

- [ ] **Step 6: Run the tests, lint and build**

Run: `cd packages/admin-dashboard && pnpm test && pnpm lint && pnpm build`
Expected: all tests PASS (including the new ones and every existing test), lint exits 0, build succeeds.

- [ ] **Step 7: Commit**

```bash
git add -A packages/admin-dashboard pnpm-lock.yaml
git commit -m "feat(admin): i18n foundation with English and Czech"
```

---

## Task 2: Language switcher (user menu and sign-in)

**Files:**
- Create: `src/i18n/LanguageSwitcher.tsx`
- Modify: `src/app/shell/UserMenu.tsx`, `src/app/shell/SignInScreen.tsx`, `src/i18n/locales/{en,cs}/shell.json`, `i18n-scope.json`
- Test: `src/i18n/LanguageSwitcher.test.tsx`, add to `src/app/shell/shell.test.tsx`

**Interfaces:**
- Consumes: `useLanguage`, `LANGUAGE_NAMES`, `SUPPORTED_LANGUAGES` (Task 1).
- Produces: `<LanguageSwitcher />` (a labelled `<select>`); `shell.userMenu.*` and `shell.signIn.*` keys.

- [ ] **Step 1: Write the failing tests**

`src/i18n/LanguageSwitcher.test.tsx`:

```tsx
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/render'
import { SignInScreen } from '@/app/shell/SignInScreen'

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ login: vi.fn() }) }))

it('switches the sign-in screen to Czech and back', async () => {
  renderWithProviders(<SignInScreen />)
  expect(screen.getByRole('heading', { name: 'Welcome to TheCMS' })).toBeInTheDocument()
  await userEvent.selectOptions(screen.getByLabelText('Language'), 'cs')
  expect(screen.getByRole('heading', { name: 'Vítejte v TheCMS' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Přihlásit se' })).toBeInTheDocument()
  expect(screen.getByLabelText('Jazyk')).toHaveValue('cs')
  await userEvent.selectOptions(screen.getByLabelText('Jazyk'), 'en')
  expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument()
})
```

In `src/app/shell/shell.test.tsx`, inside the existing `describe` that renders the `UserMenu` (or add a new `describe('UserMenu language')` using the same auth mock the file already uses):

```tsx
  it('switches language from the account menu', async () => {
    auth.value = { ...auth.value, isAuthenticated: true, isLoading: false }
    renderWithProviders(<UserMenu variant="sidebar" />)
    await userEvent.click(screen.getByRole('button', { name: 'Account menu' }))
    await userEvent.click(await screen.findByRole('menuitemradio', { name: 'Čeština' }))
    await userEvent.click(screen.getByRole('button', { name: 'Nabídka účtu' }))
    expect(await screen.findByText('Jazyk')).toBeInTheDocument()
    expect(screen.getByRole('menuitemradio', { name: 'Čeština' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('menuitem', { name: 'Odhlásit se' })).toBeInTheDocument()
  })
```

(Import `UserMenu` from `./UserMenu` if the file does not already.)

- [ ] **Step 2: Run to verify they fail**

Run: `cd packages/admin-dashboard && pnpm test -- LanguageSwitcher shell`
Expected: FAIL, no `Language` control on the sign-in screen and no `Čeština` item in the menu.

- [ ] **Step 3: Implement**

`src/i18n/LanguageSwitcher.tsx`:

```tsx
import { useTranslation } from 'react-i18next'
import { LANGUAGE_NAMES, SUPPORTED_LANGUAGES, isLanguage } from './language'
import { useLanguage } from './useLanguage'

export function LanguageSwitcher() {
  const { t } = useTranslation('shell')
  const { language, setLanguage } = useLanguage()
  return (
    <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
      {t('userMenu.language')}
      <select
        value={language}
        onChange={(e) => isLanguage(e.target.value) && setLanguage(e.target.value)}
        className="h-8 rounded-md border bg-background px-2 text-sm text-foreground"
      >
        {SUPPORTED_LANGUAGES.map((l) => (
          <option key={l} value={l} lang={l}>
            {LANGUAGE_NAMES[l]}
          </option>
        ))}
      </select>
    </label>
  )
}
```

`src/i18n/locales/en/shell.json`:

```json
{
  "userMenu": {
    "account": "Account",
    "accountMenu": "Account menu",
    "setup": "Setup",
    "theme": "Theme",
    "themeLight": "Light",
    "themeDark": "Dark",
    "themeSystem": "System",
    "language": "Language",
    "signOut": "Sign out"
  },
  "signIn": {
    "title": "Welcome to TheCMS",
    "subtitle": "Sign in to manage your content.",
    "button": "Sign in"
  }
}
```

`src/i18n/locales/cs/shell.json`:

```json
{
  "userMenu": {
    "account": "Účet",
    "accountMenu": "Nabídka účtu",
    "setup": "Nastavení",
    "theme": "Motiv",
    "themeLight": "Světlý",
    "themeDark": "Tmavý",
    "themeSystem": "Podle systému",
    "language": "Jazyk",
    "signOut": "Odhlásit se"
  },
  "signIn": {
    "title": "Vítejte v TheCMS",
    "subtitle": "Přihlaste se a spravujte svůj obsah.",
    "button": "Přihlásit se"
  }
}
```

`src/app/shell/SignInScreen.tsx`:

```tsx
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/common/Logo'
import { LanguageSwitcher } from '@/i18n/LanguageSwitcher'

export function SignInScreen() {
  const { login } = useAuth()
  const { t } = useTranslation('shell')
  return (
    <main className="grid min-h-dvh place-items-center bg-background px-4">
      <div className="w-full max-w-sm rounded-2xl border bg-card p-8 text-center shadow-sm">
        <div className="mb-4 flex justify-center">
          <Logo size={56} />
        </div>
        <h1 className="font-serif text-3xl font-semibold">{t('signIn.title')}</h1>
        <p className="mt-2 text-muted-foreground">{t('signIn.subtitle')}</p>
        <Button className="mt-6 w-full" size="lg" onClick={login}>
          {t('signIn.button')}
        </Button>
        <div className="mt-6">
          <LanguageSwitcher />
        </div>
      </div>
    </main>
  )
}
```

`src/app/shell/UserMenu.tsx`:
- Replace the `THEMES` labels with keys: `{ value: 'light', labelKey: 'userMenu.themeLight', icon: Sun }`, same for `themeDark`, `themeSystem` (type `labelKey: 'userMenu.themeLight' | 'userMenu.themeDark' | 'userMenu.themeSystem'`).
- Add `const { t } = useTranslation('shell')` and `const { language, setLanguage } = useLanguage()`.
- `'Account'` fallback → `t('userMenu.account')`; `aria-label="Account menu"` → `aria-label={t('userMenu.accountMenu')}`; `Setup` label → `t('userMenu.setup')`; `Theme` → `t('userMenu.theme')`; `{t.label}` → `{t(item.labelKey)}` (rename the map variable from `t` to `item` so it does not shadow `t`); `Sign out` → `t('userMenu.signOut')`.
- After the theme radio group, add:

```tsx
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs text-muted-foreground">{t('userMenu.language')}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={language} onValueChange={(v) => isLanguage(v) && setLanguage(v)}>
          {SUPPORTED_LANGUAGES.map((l) => (
            <DropdownMenuRadioItem key={l} value={l} lang={l}>
              {LANGUAGE_NAMES[l]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
```

(The module labels in the setup section are converted in Task 4.)

Add `"src/app/shell/SignInScreen.tsx"` and `"src/i18n/LanguageSwitcher.tsx"` to `i18n-scope.json` (`UserMenu.tsx` joins in Task 4 once module labels are keys).

- [ ] **Step 4: Run tests, lint, commit**

Run: `cd packages/admin-dashboard && pnpm test && pnpm lint`
Expected: PASS, lint exits 0.

```bash
git add -A packages/admin-dashboard
git commit -m "feat(admin): language switcher in the account menu and on sign-in"
```

---

## Task 3: Language-aware dates and numbers

**Files:**
- Modify: `src/lib/format.ts`
- Test: `src/lib/format.test.ts`

**Interfaces:**
- Consumes: `i18n` (Task 1), `common.time.*` keys (Task 1).
- Produces: `formatRelative(date, now?)`, `formatAbsolute(date)`, `formatDate(date)` (day only), `formatNumber(n, options?)`; all use `i18n.language` at call time.

- [ ] **Step 1: Write the failing tests** (append to `src/lib/format.test.ts`; existing English tests stay unchanged)

```ts
import { i18n } from '@/i18n'
import { formatDate, formatNumber } from './format'

describe('in Czech', () => {
  const now = new Date('2026-09-29T12:00:00Z')
  beforeEach(async () => {
    await i18n.changeLanguage('cs')
  })

  it.each([
    ['2026-09-29T11:59:30Z', 'právě teď'],
    ['2026-09-29T11:15:00Z', 'před 45 min'],
    ['2026-09-29T09:00:00Z', 'před 3 h'],
    ['2026-09-28T12:00:00Z', 'včera'],
    ['2026-09-25T12:00:00Z', 'před 4 dny'],
    ['2026-08-01T12:00:00Z', '1. srpna 2026'],
  ])('%s is %s', (date, expected) => {
    expect(formatRelative(date, now)).toBe(expected)
  })

  it('formats absolute dates and days', () => {
    expect(formatAbsolute(new Date(2026, 8, 29, 14, 5))).toBe('29. 9. 2026, 14:05')
    expect(formatDate(new Date(2026, 7, 1))).toBe('1. srpna 2026')
  })

  it('formats numbers with Czech separators', () => {
    expect(formatNumber(1500.5).replace(/\s/g, ' ')).toBe('1 500,5')
  })
})

it('formats days and numbers in English', () => {
  expect(formatDate(new Date(2026, 7, 1))).toBe('1 Aug 2026')
  expect(formatNumber(1500.5)).toBe('1,500.5')
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd packages/admin-dashboard && pnpm test -- src/lib/format`
Expected: FAIL, `formatDate` and `formatNumber` are not exported; Czech cases return English.

- [ ] **Step 3: Implement** (replace `formatRelative` and `formatAbsolute` in `src/lib/format.ts`; keep `getInitials`)

```ts
import { differenceInCalendarDays, format } from 'date-fns'
import { cs } from 'date-fns/locale'
import { i18n } from '@/i18n'

function lang(): 'en' | 'cs' {
  return i18n.language === 'cs' ? 'cs' : 'en'
}

const PATTERNS = {
  en: { day: 'd MMM yyyy', dateTime: 'd MMM yyyy, HH:mm' },
  cs: { day: 'd. MMMM yyyy', dateTime: 'd. M. yyyy, HH:mm' },
} as const

function localeOptions() {
  return lang() === 'cs' ? { locale: cs } : {}
}

/** Short relative time for lists: "just now", "45m ago", "3h ago", "yesterday", "4 days ago", else the date. */
export function formatRelative(date: string | Date, now: Date = new Date()): string {
  const then = new Date(date)
  const seconds = Math.floor((now.getTime() - then.getTime()) / 1000)
  if (seconds < 60) return i18n.t('time.justNow')
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return i18n.t('time.minutesAgo', { count: minutes })
  const hours = Math.floor(minutes / 60)
  if (hours < 24 && differenceInCalendarDays(now, then) === 0) return i18n.t('time.hoursAgo', { count: hours })
  const days = differenceInCalendarDays(now, then)
  if (days <= 1) return i18n.t('time.yesterday')
  if (days < 7) return i18n.t('time.daysAgo', { count: days })
  return formatDate(then)
}

/** Day only: "1 Aug 2026" / "1. srpna 2026". */
export function formatDate(date: string | Date): string {
  return format(new Date(date), PATTERNS[lang()].day, localeOptions())
}

/** Day and time: "1 Aug 2026, 14:05" / "1. 8. 2026, 14:05". */
export function formatAbsolute(date: string | Date): string {
  return format(new Date(date), PATTERNS[lang()].dateTime, localeOptions())
}

export function formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(lang() === 'cs' ? 'cs-CZ' : 'en-US', options).format(value)
}
```

In `src/lib/entry-schema.ts`, delete the local `formatDay` and its `date-fns` import, and use `formatDate` from `@/lib/format` where `formatDay` was called.

- [ ] **Step 4: Run tests and commit**

Run: `cd packages/admin-dashboard && pnpm test`
Expected: PASS (the English `formatRelative` and `formatAbsolute` tests are unchanged).

```bash
git add -A packages/admin-dashboard/src/lib
git commit -m "feat(admin): dates and numbers follow the admin language"
```

---

## Task 4: Shell, navigation, error page and shared components

**Files:**
- Modify: `src/modules/types.ts`, `src/modules/registry.tsx`, `src/app/shell/{Sidebar,TopBar,MobileTabs,UserMenu,CommandPalette,ShellSkeleton,AppShell}.tsx`, `src/app/RouteError.tsx`, `src/components/common/{ConfirmDialog,EmptyState,ErrorState,Pager,StatusPill,DataList,PageHeader}.tsx`, catalogs `shell.json`, `common.json` (both languages), `i18n-scope.json`
- Test: `src/app/shell/shell.test.tsx`, `src/modules/nav.test.ts` and `src/modules/registry.test.tsx` fixtures, `src/components/common/common.test.tsx`

**Interfaces:**
- Consumes: Tasks 1 to 3.
- Produces: `AppModule.labelKey: NavLabelKey` and `CreateAction.labelKey: CreateLabelKey` (replacing `label`), where

```ts
import type shellEn from '@/i18n/locales/en/shell.json'
export type NavLabelKey = `nav.${keyof typeof shellEn.nav & string}`
export type CreateLabelKey = `create.${keyof typeof shellEn.create & string}`
```

- [ ] **Step 1: Write the failing tests**

Update fixtures first: in `shell.test.tsx`, `nav.test.ts` and `registry.test.tsx`, replace `label: 'Home'` with `labelKey: 'nav.home'`, `'Content'` → `'nav.content'`, `'Media'` → `'nav.media'`, `'Inbox'` → `'nav.inbox'`, `'Content models'` → `'nav.models'`, `'Forms'` → `'nav.forms'`, `'Sites & API keys'` → `'nav.sites'`, `'Webhooks'` → `'nav.webhooks'`, the `nav.test.ts` fixture `label: 'X'` → `labelKey: 'nav.home'`, and `label: 'New entry'` → `labelKey: 'create.newEntry'`. Assertions keep the English text.

Add to `shell.test.tsx`:

```tsx
describe('shell in Czech', () => {
  it('shows navigation, groups and search in Czech', async () => {
    await setTestLanguage('cs')
    renderWithProviders(<Sidebar modules={testModules} />)
    const nav = screen.getByRole('navigation')
    for (const name of ['Přehled', 'Obsah', 'Média', 'Zprávy', 'Modely obsahu']) {
      expect(within(nav).getByRole('link', { name: new RegExp(name) })).toBeInTheDocument()
    }
    expect(screen.getByText('Práce')).toBeInTheDocument()
    expect(screen.getByText('Nastavení')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Hledat nebo přejít' })).toBeInTheDocument()
  })
})
```

(Use the file's existing module fixture name in place of `testModules` and the existing `Sidebar` render call; import `setTestLanguage` from `@/test/render`.)

In `src/app/RouteError.test.tsx` add:

```tsx
it('explains the error in Czech', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  await setTestLanguage('cs')
  renderRoutes([{ path: '/', element: <p>home</p>, errorElement: <RouteError fullPage /> }], { route: '/nowhere' })
  expect(await screen.findByRole('heading', { name: 'Stránka nenalezena' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Přejít na Přehled' })).toHaveAttribute('href', '/')
})
```

In `src/components/common/common.test.tsx` add:

```tsx
it('shows statuses and dialog buttons in Czech', async () => {
  await setTestLanguage('cs')
  render(<StatusPill status="DRAFT" />)
  expect(screen.getByText('Koncept')).toBeInTheDocument()
  render(<ConfirmDialog open onOpenChange={() => {}} title="x" description="y" onConfirm={() => {}} />)
  expect(screen.getByRole('button', { name: 'Zrušit' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Potvrdit' })).toBeInTheDocument()
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd packages/admin-dashboard && pnpm test -- shell RouteError common nav registry`
Expected: FAIL: type errors for `labelKey`, English text where Czech is expected.

- [ ] **Step 3: Implement**

Add to `shell.json` (English values are today's text; Czech values below are required, others follow the glossary):

| Key | en | cs |
|---|---|---|
| `nav.home` | Home | Přehled |
| `nav.content` | Content | Obsah |
| `nav.media` | Media | Média |
| `nav.inbox` | Inbox | Zprávy |
| `nav.models` | Content models | Modely obsahu |
| `nav.forms` | Forms | Formuláře |
| `nav.sites` | Sites & API keys | Weby a API klíče |
| `nav.webhooks` | Webhooks | Webhooky |
| `groups.workspace` | Workspace | Práce |
| `groups.setup` | Setup | Nastavení |
| `create.newEntry` | New entry | Nová položka |
| `create.uploadMedia` | Upload media | Nahrát média |
| `search.open` | Search or jump to | Hledat nebo přejít |
| `search.button` | Search | Hledat |
| `commandPalette.title` | Command palette | Příkazy |
| `commandPalette.description` | Search or jump to a page or action | Hledejte stránku nebo akci |
| `commandPalette.placeholder` | Search or jump to… | Hledat nebo přejít na… |
| `commandPalette.empty` | No results. | Nic nenalezeno. |
| `commandPalette.entries` | Entries | Položky |
| `commandPalette.goTo` | Go to | Přejít na |
| `commandPalette.create` | Create | Vytvořit |
| `mobile.primary` | Primary | Hlavní navigace |
| `mobile.create` | Create | Vytvořit |
| `routeError.somethingWrong` | Something went wrong | Něco se pokazilo |
| `routeError.notFound` | Page not found | Stránka nenalezena |
| `routeError.notFoundText` | The page you asked for does not exist. | Stránka, kterou hledáte, neexistuje. |
| `routeError.errorText` | This page hit an unexpected error. Your saved content is safe. | Na stránce došlo k neočekávané chybě. Uložený obsah je v bezpečí. |
| `routeError.goHome` | Go to Home | Přejít na Přehled |
| `routeError.reload` | Reload page | Načíst znovu |
| `skipToContent` | Skip to content | Přeskočit na obsah |
| `loading` | Loading TheCMS | Načítání TheCMS |

Add to `common.json`: `pager.range` (`"{{from}}–{{to}} of {{total}}"` / `"{{from}}–{{to}} z {{total}}"`), `pager.previous`/`pager.next` (`Previous`/`Next`; `Předchozí`/`Další`) and any other text these components show (take the exact English from each file; for `ConfirmDialog` the "Type … to confirm" line becomes a `<Trans>` with the name in a `<span>`: en `"Type <name>{{name}}</name> to confirm"`, cs `"Pro potvrzení napište <name>{{name}}</name>"`).

Code changes:
- `modules/types.ts`: replace `label: string` with `labelKey: NavLabelKey` in `AppModule` and `label: string` with `labelKey: CreateLabelKey` in `CreateAction`; export `NavLabelKey` and `CreateLabelKey` as shown above.
- `modules/registry.tsx`: `label: 'Home'` → `labelKey: 'nav.home'` and so on for all eight modules; create actions → `labelKey: 'create.newEntry'`, `'create.uploadMedia'`.
- Every `m.label` / `module.label` / `a.label` / `active?.label` read in the shell becomes `t(m.labelKey)` with `const { t } = useTranslation('shell')`. In `CommandPalette`, the `CommandItem` `value` also uses the translated label so typing Czech words finds pages.
- `StatusPill`: keep the class map, take the text from `t(\`status.${status}\`)` (common namespace).
- `ConfirmDialog`: `confirmLabel` defaults to `t('actions.confirm')` when not passed; Cancel → `t('actions.cancel')`.
- `RouteError`, `ShellSkeleton` (its `aria-label`), the skip link in `AppShell`, `MobileTabs`, `TopBar` (`'TheCMS'` fallback stays literal), `Pager`, `ErrorState` (retry button), `EmptyState`, `DataList`, `PageHeader`: replace every literal with `t(...)`.

Add all files listed under **Files** (the `.tsx` ones) to `i18n-scope.json`.

- [ ] **Step 4: Run tests, lint, commit**

Run: `cd packages/admin-dashboard && pnpm test && pnpm lint && pnpm build`
Expected: PASS, lint exits 0 (the rule now covers the shell and shared components), build succeeds.

```bash
git add -A packages/admin-dashboard
git commit -m "feat(admin): translate the shell, navigation, error page and shared components"
```

---

## Task 5: Home

**Files:**
- Modify: `src/features/home/pages/HomePage.tsx`, `src/features/home/home-utils.ts`, `src/features/home/components/*.tsx`, `home.json` (both), `i18n-scope.json`
- Test: `src/features/home/pages/HomePage.test.tsx`, `src/features/home/home-utils.test.ts`

**Interfaces:**
- Consumes: Tasks 1 to 4.
- Produces: `setupSteps(stats)` returns steps with `titleKey`, `descriptionKey`, `ctaKey` instead of text; `greeting(name?, hour)` returns translated text via `i18n.t`.

- [ ] **Step 1: Write the failing tests**

Add to `HomePage.test.tsx` (uses the file's `statsState`, `base` and `routes`):

```tsx
it('shows Home in Czech', async () => {
  await setTestLanguage('cs')
  statsState.value = base
  renderRoutes(routes)
  expect(await screen.findByRole('heading', { name: 'Vítejte v TheCMS' })).toBeInTheDocument()
  const steps = screen.getByRole('list', { name: 'Kroky nastavení' })
  expect(within(steps).getByRole('link', { name: 'Vytvořit model' })).toHaveAttribute('href', '/models/new')
  expect(within(steps).getByText('Přihlásit se')).toBeInTheDocument()
})
```

Add to `home-utils.test.ts`:

```ts
it('greets in Czech', async () => {
  await i18n.changeLanguage('cs')
  expect(greeting('Pavel Flajsman', 9)).toBe('Dobré ráno, Pavel')
  expect(greeting(undefined, 15)).toBe('Dobré odpoledne')
  expect(greeting('Pavel', 20)).toBe('Dobrý večer, Pavel')
})
```

(Use the real exported name of the greeting helper in `home-utils.ts` if it differs; import `i18n` from `@/i18n`.)

- [ ] **Step 2: Run to verify they fail**

Run: `cd packages/admin-dashboard && pnpm test -- src/features/home`
Expected: FAIL, English text.

- [ ] **Step 3: Implement**

Required Czech values in `home.json`:

| Key | en | cs |
|---|---|---|
| `welcome` | Welcome to TheCMS | Vítejte v TheCMS |
| `setup.stepsLabel` | Setup steps | Kroky nastavení |
| `setup.signin.title` | Sign in | Přihlásit se |
| `setup.signin.description` | You are in. | Jste přihlášeni. |
| `setup.model.cta` | Create a model | Vytvořit model |
| `greeting.morning` | Good morning | Dobré ráno |
| `greeting.afternoon` | Good afternoon | Dobré odpoledne |
| `greeting.evening` | Good evening | Dobrý večer |
| `greeting.withName` | {{greeting}}, {{name}} | {{greeting}}, {{name}} |
| `snippetCopied` | Snippet copied | Ukázka zkopírována |

Every other text on Home (setup step titles, descriptions and buttons, cards, empty states, counts) moves to `home.json` with its current English and a Czech translation. Counts use plural keys (for example `draftCount_one` / `_other` in English, `_one` / `_few` / `_other` in Czech). `setupSteps` stores keys; `HomePage` and `SetupChecklist` render `t(step.titleKey)`. The greeting helper builds its text with `i18n.t('home:greeting…')`.

Add the Home `.tsx` files to `i18n-scope.json`.

- [ ] **Step 4: Run tests, lint, commit**

Run: `cd packages/admin-dashboard && pnpm test && pnpm lint`
Expected: PASS, lint exits 0.

```bash
git add -A packages/admin-dashboard
git commit -m "feat(admin): translate Home"
```

---

## Task 6: Content list

**Files:**
- Modify: `src/features/content/pages/ContentListPage.tsx`, `src/features/content/components/{ContentFilters,EntryRowMenu,NewEntryButton,TypeChooser}.tsx`, `src/features/content/useEntryActions.ts`, `src/features/content/LegacyRedirects.tsx` (if it shows text), `content.json` (both), `i18n-scope.json`
- Test: `src/features/content/pages/ContentListPage.test.tsx`

**Interfaces:**
- Consumes: Tasks 1 to 4 (`StatusPill`, `Pager`, `formatRelative`).
- Produces: `content:*` keys; `useEntryActions` toasts via `t`.

- [ ] **Step 1: Write the failing tests** (add to `ContentListPage.test.tsx`, reusing its mocks and `routes`)

```tsx
describe('in Czech', () => {
  it('shows the list, statuses, pager and filters in Czech', async () => {
    await setTestLanguage('cs')
    vi.mocked(api.listEntries).mockResolvedValue(page([makeListItem(), makeListItem({ id: 'e2', title: 'Jak jsem stavěl CMS', status: 'PUBLISHED' })], 23))
    renderRoutes(routes, { route: '/content' })
    expect(await screen.findByRole('heading', { level: 1, name: 'Obsah' })).toBeInTheDocument()
    const table = await screen.findByRole('table', { name: 'Položky' })
    expect(within(table).getByText('Publikováno')).toBeInTheDocument()
    expect(screen.getByText('1–20 z 23')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Nová položka/ })).toBeInTheDocument()
  })

  it('counts model fields with Czech plurals', async () => {
    await setTestLanguage('cs')
    const one = { ...postType, id: 'p1', name: 'One', description: undefined, fields: postType.fields.slice(0, 1) }
    const two = { ...postType, id: 'p2', name: 'Two', description: undefined, fields: postType.fields.slice(0, 2) }
    const five = { ...postType, id: 'p5', name: 'Five', description: undefined, fields: Array.from({ length: 5 }, (_, i) => ({ ...postType.fields[0], name: `f${i}` })) }
    vi.mocked(api.listContentTypes).mockResolvedValue([one, two, five])
    vi.mocked(api.listEntries).mockResolvedValue(page([]))
    renderRoutes(routes, { route: '/content/new' })
    expect(await screen.findByText('1 pole')).toBeInTheDocument()
    expect(screen.getByText('2 pole')).toBeInTheDocument()
    expect(screen.getByText('5 polí')).toBeInTheDocument()
  })
})
```

(If `/content/new` with several types renders the `TypeChooser` on a different route in this file, use the route the existing tests use for the chooser. If `postType.fields` has fewer than two fields, build `two` like `five`.)

- [ ] **Step 2: Run to verify they fail**

Run: `cd packages/admin-dashboard && pnpm test -- ContentListPage`
Expected: FAIL, English text.

- [ ] **Step 3: Implement**

Required Czech values in `content.json`:

| Key | en | cs |
|---|---|---|
| `list.title` | Content | Obsah |
| `list.description` | Everything you publish, across all content models. | Vše, co publikujete, napříč modely obsahu. |
| `list.tableLabel` | Entries | Položky |
| `list.newEntry` | New entry | Nová položka |
| `list.deletedModel` | Deleted model | Smazaný model |
| `list.untitled` | Untitled | Bez názvu |
| `typeChooser.fieldCount_one` | {{count}} field | {{count}} pole |
| `typeChooser.fieldCount_few` | (not in en) | {{count}} pole |
| `typeChooser.fieldCount_other` | {{count}} fields | {{count}} polí |
| `toast.published` | Published “{{title}}” | Publikováno „{{title}}“ |
| `toast.unpublished` | Unpublished “{{title}}” | Publikování „{{title}}“ zrušeno |
| `toast.archived` | Archived “{{title}}” | Archivováno „{{title}}“ |
| `toast.restored` | Restored “{{title}}” to draft | „{{title}}“ vráceno do konceptu |
| `toast.duplicated` | Duplicated “{{title}}” | Vytvořena kopie „{{title}}“ |
| `toast.deleted` | Deleted “{{title}}” | Smazáno „{{title}}“ |
| `toast.undone` | Undone | Vráceno zpět |

(English `fieldCount` has only `_one` and `_other`; Czech has all three.) Every other text in the listed files (filters, search placeholder, sort options, row menu items, empty states, delete confirmation, relative "Edited" labels) moves to `content.json` with its current English and a Czech translation. `list-params.ts` sort labels, if any, store keys.

The displayed "Untitled" uses `t('list.untitled')`; the comparison with the stored title still uses the `UNTITLED` constant (it is the value the backend writes).

Add the listed `.tsx` files to `i18n-scope.json`; `useEntryActions.ts` is covered by the source scan once added to the scope list.

- [ ] **Step 4: Run tests, lint, commit**

Run: `cd packages/admin-dashboard && pnpm test && pnpm lint`
Expected: PASS, lint exits 0.

```bash
git add -A packages/admin-dashboard
git commit -m "feat(admin): translate the Content list"
```

---

## Task 7: Entry editor, fields, validation and rich text toolbar

**Files:**
- Modify: `src/features/content/pages/EntryEditorPage.tsx`, `src/features/content/editor/{EntryEditor,EditorTopBar,EditorSidePanel,UnsavedChangesDialog}.tsx`, `src/features/content/editor/editor-actions.ts`, `src/features/content/editor/fields/*.tsx`, `src/features/content/editor/fields/field-aria.ts`, `src/lib/entry-schema.ts`, `src/components/RichTextEditor.tsx`, `src/components/rich-text/EditorToolbar.tsx`, `src/components/ResizableImage.tsx` (if it shows text), `editor.json` (both), `i18n-scope.json`
- Test: `src/features/content/pages/EntryEditorPage.test.tsx`, `src/lib/entry-schema.test.ts`, `src/features/content/editor/editor-actions.test.ts`, `src/components/RichTextEditor.test.tsx`

**Interfaces:**
- Consumes: Tasks 1 to 6, `formatDate` (Task 3).
- Produces: `editor-actions` items carry `labelKey` (for example `'actions.publish'`) instead of `label`; `validateEntry` messages built with `i18n.t('editor:validation.*')`.

- [ ] **Step 1: Write the failing tests**

`src/lib/entry-schema.test.ts` (append):

```ts
describe('messages in Czech', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('cs')
  })

  it('translates required, length plurals and date limits', () => {
    const fields: Field[] = [
      { name: 'title', label: 'Název', type: 'TEXT', required: true },
      { name: 'slug', label: 'Slug', type: 'TEXT', required: false, validation: { minLength: 3 } },
      { name: 'intro', label: 'Úvod', type: 'TEXT', required: false, validation: { minLength: 10 } },
      { name: 'code', label: 'Kód', type: 'TEXT', required: false, validation: { maxLength: 1 } },
      { name: 'day', label: 'Den', type: 'DATE', required: false, validation: { minDate: '2026-08-01' } },
    ]
    const errors = validateEntry(fields, { slug: 'ab', intro: 'short', code: 'ab', day: '2026-07-01' })
    expect(errors.title).toBe('Název je povinné pole')
    expect(errors.slug).toBe('Slug musí mít alespoň 3 znaky')
    expect(errors.intro).toBe('Úvod musí mít alespoň 10 znaků')
    expect(errors.code).toBe('Kód může mít nejvýše 1 znak')
    expect(errors.day).toBe('Den musí být 1. srpna 2026 nebo později')
  })
})
```

(Import `i18n` from `@/i18n` and `Field` from `@/types`. In `EntryEditorPage.test.tsx` also import `i18n` from `@/i18n` and `setTestLanguage` from `@/test/render`.)

`src/features/content/pages/EntryEditorPage.test.tsx` (append; reuses the file's mocks and `routes`):

```tsx
describe('in Czech', () => {
  it('shows editor actions and validation in Czech', async () => {
    await setTestLanguage('cs')
    renderRoutes(routes, { route: `/content/new?type=${tripType.id}` })
    const title = await screen.findByLabelText('Title')
    await userEvent.click(title)
    await userEvent.tab()
    expect(await screen.findByText('Title je povinné pole')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Uložit koncept' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Publikovat' })).toBeInTheDocument()
  })

  it('keeps unsaved values when the language changes', async () => {
    renderRoutes(routes, { route: `/content/new?type=${tripType.id}` })
    const title = await screen.findByLabelText('Title')
    await userEvent.type(title, 'Přes Šumavu')
    await setTestLanguage('cs')
    expect(screen.getByLabelText('Title')).toHaveValue('Přes Šumavu')
    expect(screen.getByRole('button', { name: 'Uložit koncept' })).toBeInTheDocument()
  })

  it.each([
    [1, 'Opravte 1 pole před uložením'],
    [2, 'Opravte 2 pole před uložením'],
    [5, 'Opravte 5 polí před uložením'],
  ])('asks to fix %i field(s) with the right Czech plural', async (count, message) => {
    await setTestLanguage('cs')
    expect(i18n.t('editor:fixFieldsToast', { count })).toBe(message)
  })
})
```

(The field label "Title" is user content from the fixture and stays English.)

`src/components/RichTextEditor.test.tsx` (append):

```tsx
it('labels the toolbar in Czech and refuses a javascript: link with a Czech hint', async () => {
  await setTestLanguage('cs')
  renderWithProviders(<RichTextEditor value="<p>Hi</p>" onChange={() => {}} />)
  const toolbar = await screen.findByRole('toolbar', { name: 'Formátování' })
  expect(within(toolbar).getByRole('button', { name: 'Tučně' })).toBeInTheDocument()
  await userEvent.click(within(toolbar).getByRole('button', { name: 'Odkaz' }))
  await userEvent.type(await screen.findByLabelText('Adresa odkazu'), 'javascript:alert(1)')
  await userEvent.click(screen.getByRole('button', { name: 'Použít odkaz' }))
  expect(screen.getByText('Zadejte webovou adresu (https://…), e-mail (mailto:…) nebo cestu ke stránce (/o-nas)')).toBeInTheDocument()
})
```

`src/features/content/editor/editor-actions.test.ts`: change every expected `label: 'Publish'` style value to the matching `labelKey` (`'actions.publish'`, `'actions.saveDraft'`, `'actions.publishChanges'`, `'actions.discard'`, `'actions.published'`, `'actions.restore'`, `'actions.duplicate'`, `'actions.unpublish'`, `'actions.archive'`, `'actions.delete'`). Ledger this as the expected test change for Decision 3's pattern.

- [ ] **Step 2: Run to verify they fail**

Run: `cd packages/admin-dashboard && pnpm test -- entry-schema EntryEditorPage RichTextEditor editor-actions`
Expected: FAIL, English messages and labels, missing `editor:fixFieldsToast`.

- [ ] **Step 3: Implement**

Required values in `editor.json`:

| Key | en | cs |
|---|---|---|
| `actions.publish` | Publish | Publikovat |
| `actions.saveDraft` | Save draft | Uložit koncept |
| `actions.publishChanges` | Publish changes | Publikovat změny |
| `actions.discard` | Discard changes | Zahodit změny |
| `actions.published` | Published | Publikováno |
| `actions.restore` | Restore to draft | Vrátit do konceptu |
| `actions.duplicate` | Duplicate | Duplikovat |
| `actions.unpublish` | Unpublish | Zrušit publikování |
| `actions.archive` | Archive | Archivovat |
| `actions.delete` | Delete | Smazat |
| `fixFieldsToast_one` | Fix {{count}} field before saving | Opravte {{count}} pole před uložením |
| `fixFieldsToast_few` | (not in en) | Opravte {{count}} pole před uložením |
| `fixFieldsToast_other` | Fix {{count}} fields before saving | Opravte {{count}} polí před uložením |
| `fixFieldsStatus_one` | Fix {{count}} field to save | Opravte {{count}} pole a uložte |
| `fixFieldsStatus_few` | (not in en) | Opravte {{count}} pole a uložte |
| `fixFieldsStatus_other` | Fix {{count}} fields to save | Opravte {{count}} polí a uložte |
| `fieldsLabel` | {{model}} fields | Pole modelu {{model}} |
| `copySuffix` | {{title}} (copy) | {{title}} (kopie) |
| `validation.required` | {{label}} is required | {{label}} je povinné pole |
| `validation.text` | {{label}} must be text | {{label}} musí být text |
| `validation.minLength_one` | {{label}} must be at least {{count}} character | {{label}} musí mít alespoň {{count}} znak |
| `validation.minLength_few` | (not in en) | {{label}} musí mít alespoň {{count}} znaky |
| `validation.minLength_other` | {{label}} must be at least {{count}} characters | {{label}} musí mít alespoň {{count}} znaků |
| `validation.maxLength_one` | {{label}} must be at most {{count}} character | {{label}} může mít nejvýše {{count}} znak |
| `validation.maxLength_few` | (not in en) | {{label}} může mít nejvýše {{count}} znaky |
| `validation.maxLength_other` | {{label}} must be at most {{count}} characters | {{label}} může mít nejvýše {{count}} znaků |
| `validation.pattern` | {{label}} does not match the required pattern | {{label}} nemá požadovaný formát |
| `validation.number` | {{label}} must be a number | {{label}} musí být číslo |
| `validation.integer` | {{label}} must be a whole number | {{label}} musí být celé číslo |
| `validation.min` | {{label}} must be at least {{min}} | {{label}} musí být alespoň {{min}} |
| `validation.max` | {{label}} must be at most {{max}} | {{label}} může být nejvýše {{max}} |
| `validation.date` | {{label}} must be a valid date | {{label}} musí být platné datum |
| `validation.minDate` | {{label}} must be on or after {{date}} | {{label}} musí být {{date}} nebo později |
| `validation.maxDate` | {{label}} must be on or before {{date}} | {{label}} musí být {{date}} nebo dříve |
| `validation.boolean` | {{label}} must be yes or no | {{label}} musí být ano, nebo ne |
| `validation.list` | {{label}} must be a list | {{label}} musí být seznam |
| `validation.single` | {{label}} must be a single item | {{label}} musí být jedna položka |
| `toolbar.label` | Formatting | Formátování |
| `toolbar.bold` | Bold | Tučně |
| `toolbar.link` | Link | Odkaz |
| `toolbar.linkUrl` | Link URL | Adresa odkazu |
| `toolbar.applyLink` | Apply link | Použít odkaz |
| `toolbar.linkHint` | Use a web address (https://…), an email (mailto:…) or a page path (/about) | Zadejte webovou adresu (https://…), e-mail (mailto:…) nebo cestu ke stránce (/o-nas) |

(English `validation.minLength` and `maxLength` today say "characters" even for 1; the new `_one` form says "character". This changes English text for a count of 1 only, which no existing test asserts; ledger it.)

Every other text in the listed files moves to `editor.json`: the remaining toolbar buttons and selects (italic, underline, strikethrough, text color, highlight, alignments, lists, quote, code block, insert image, from media library, by URL, image URL, insert, remove link, float buttons, text style and size options), side panel labels (status, visibility text, cover image, info, created, edited, ID, archive, delete), top bar (back link, saved/saving/unsaved states), field components (choose from library, upload, drop hint, move earlier/later, remove, relation picker texts, date picker texts, yes/no), the unsaved changes dialog, the type chooser on `/content/new` (if not already in `content.json`), and the delete confirmation.

Code changes:
- `entry-schema.ts`: every message becomes `i18n.t('editor:validation.<key>', { label, count, min, max, date })`; `required` uses `validation.required`; dates use `formatDate`. `duplicateData` uses `i18n.t('editor:copySuffix', { title })`.
- `editor-actions.ts`: `label` → `labelKey` typed as `` `actions.${keyof typeof editorEn.actions & string}` ``; renderers call `t(item.labelKey)`.
- `EntryEditor.tsx`: the two plural messages use `t('fixFieldsToast', { count })` and `t('fixFieldsStatus', { count: errorCount })`; `aria-label={\`${contentType.name} fields\`}` → `t('fieldsLabel', { model: contentType.name })`.
- `EditorToolbar.tsx`: `BLOCKS` and `SIZES` store `labelKey`; `LINK_HINT` becomes `t('toolbar.linkHint')`; every `label` passed to `Tool` becomes `t(...)`.

Add all `.tsx` files listed under **Files**, plus `src/lib/entry-schema.ts` and `src/features/content/editor/editor-actions.ts`, to `i18n-scope.json`.

- [ ] **Step 4: Run tests, lint, build, commit**

Run: `cd packages/admin-dashboard && pnpm test && pnpm lint && pnpm build`
Expected: PASS, lint exits 0, build succeeds.

```bash
git add -A packages/admin-dashboard
git commit -m "feat(admin): translate the entry editor, fields, validation and rich text toolbar"
```

---

## Task 8: Czech review in the running app

**Files:** none unless a defect is found (fix with a test when jsdom can express it).

- [ ] **Step 1: Accessibility in Czech**

Add to `src/app/a11y.test.tsx` a Czech run of the existing `/content` and sign-in cases: call `await setTestLanguage('cs')` before rendering, wait for the heading `Obsah` (Content) or `Vítejte v TheCMS` (sign-in), run `expectNoA11yViolations`, and assert `document.documentElement.lang` is `'cs'`.

Run: `cd packages/admin-dashboard && pnpm test -- a11y`
Expected: PASS, no axe violations in Czech.

- [ ] **Step 2: Browser check** (backend and admin dev servers as before)

1. First visit with a Czech browser language (use a fresh profile or clear `thecms.language`, set `navigator.language` via the browser's language setting): the admin opens in Czech; with English it opens in English.
2. Switch in the account menu: every screen from this plan changes at once; reload keeps the choice; `<html lang>` follows.
3. Sign-in screen switcher works before signing in.
4. Shell, Home, Content list, entry editor in Czech: no English left except server messages, user content and screens converted in Plan 2 (Media, Inbox, Models, Forms, Sites, Webhooks).
5. Dates: list "Upraveno" column and editor info panel show Czech dates; validation date limits use Czech format.
6. 360px (iframe method) for Home, Content list and entry editor in Czech: no horizontal scroll, no clipped buttons in the top bar or row menus.
7. Dark theme in Czech on the entry editor.

- [ ] **Step 3: Record and commit**

Append a "Localization Plan 1 verification" table to `TEST_RESULTS.md` and commit:

```bash
git add TEST_RESULTS.md
git commit -m "docs: record localization Plan 1 verification"
```

---

## Self-Review Notes

- **Spec coverage:** section 2 decisions (languages, storage, first visit, server messages, library) → Task 1; 4.1 module files → Task 1; 4.2 switcher (user menu, sign-in, re-render, html lang, saved) → Tasks 1 and 2; 4.3 conventions (keys, interpolation, plurals, `<Trans>`, lists outside components, validation helpers) → Tasks 4 to 7; 5 dates and numbers → Task 3; 6 glossary → Global Constraints and required-value tables; 7 quality (parity, lint guard, existing tests in English, axe in both languages, layout) → Tasks 1, 4 to 8; 8 error handling (missing key fallback, storage unavailable, unsupported value) → Task 1 tests; 9 delivery split → this plan covers item 1; Media, Inbox, Models (templates), Forms (embed snippet), Sites, Webhooks and the app-wide lint scope are Plan 2.
- **Type consistency:** `Language`, `LANGUAGE_NAMES`, `SUPPORTED_LANGUAGES`, `isLanguage`, `useLanguage`, `setTestLanguage`, `NavLabelKey`, `CreateLabelKey`, `labelKey`, `formatDate`, `formatNumber` are used with the same names and types in every task.
