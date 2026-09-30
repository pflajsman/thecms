# Admin Dashboard Localization (English and Czech): Design

**Date:** 2026-09-30
**Status:** Approved in conversation, awaiting written review
**Scope:** `packages/admin-dashboard` only. No backend or public API change.

## 1. Goal

The admin dashboard is fully usable in English and Czech. A user picks the language in the user menu (or on the sign-in screen); the choice is remembered in the browser. Adding a third language later means adding one catalog folder.

Content language variants (translations of entries) are a separate, later project and are not part of this design.

## 2. Decisions

| Topic | Decision |
|---|---|
| Languages | English (`en`, default) and Czech (`cs`) |
| Where the choice lives | Browser storage (`thecms.language`), like the theme preference. No backend change |
| First visit | Czech when the browser's preferred language starts with `cs`, otherwise English |
| Server messages | Shown as the backend sends them (English) |
| Library | `i18next` + `react-i18next` |
| Czech texts | Drafted by the implementer, reviewed by the owner |

## 3. What is translated

Everything the admin writes itself:

- Navigation, page titles and descriptions, buttons, menus, dialogs, empty states, toasts, placeholders, help text.
- Validation messages produced by the admin (entry fields, sites, webhooks, form builder, model builder, links in rich text).
- Screen-reader text: `aria-label`, `sr-only` text, `role="status"` messages, the document `<title>`.
- Dates, relative times and numbers (see section 5).
- Model templates (Blog post, Event and others): template names and descriptions, and the field labels they create, in the current admin language.
- The form embed snippet: its button and success text use the current admin language, because that text ends up on the user's website.

Not translated:

- Server messages (validation errors, "Validation failed", conflicts) as returned by the API.
- User content: entries, model names, field labels, form names, site names that users typed.
- The public API, notification emails, the example website.
- `components/ui` primitives (they carry no user-facing copy of their own beyond what callers pass in).

## 4. Architecture

### 4.1 `src/i18n/`

| File | Responsibility |
|---|---|
| `index.ts` | Creates and initializes the i18next instance with both languages bundled (no lazy loading, no flash of English) |
| `language.ts` | `readLanguagePreference()`, `detectLanguage()`, `writeLanguagePreference()`, `SUPPORTED_LANGUAGES`; all storage access in try/catch |
| `LanguageProvider.tsx` | Applies the language on start and on change, sets `<html lang>`, exposes `useLanguage()` (`language`, `setLanguage`) |
| `locales/en/<namespace>.json`, `locales/cs/<namespace>.json` | Catalogs |
| `i18next.d.ts` | Declares resources from the English catalogs so keys are type-checked |

Namespaces: `common`, `shell`, `home`, `content`, `editor`, `media`, `inbox`, `models`, `forms`, `sites`, `webhooks`.

### 4.2 Switcher

- User menu: a "Language" group under Theme with "English" and "Čeština" (each name in its own language), as radio items.
- Sign-in screen: a compact switcher, so the language can be chosen before signing in.
- Changing the language re-renders the app, updates `<html lang>` and saves the choice.

### 4.3 Conventions

- Keys describe purpose, not wording: `content.list.empty.title`, `sites.rotate.confirm`.
- Interpolation: `"Delete {{name}}?"`.
- Plurals use i18next plural suffixes resolved by `Intl.PluralRules`. Czech needs `one`, `few` and `other` (for example `1 položka`, `3 položky`, `5 položek`).
- Sentences with links or emphasis use `<Trans>` so word order can change per language.
- Lists defined outside components (navigation in `modules/registry.tsx`, webhook `EVENT_GROUPS`, editor toolbar options, model templates, status labels) store keys and are translated at render time.
- Validation helpers (`validateSite`, `originError`, `validateWebhook`, `entry-schema`, form builder and model builder rules) return message keys with values instead of English sentences; components translate them.

## 5. Dates and numbers

`lib/format.ts` takes the current language:

- Absolute dates use the date-fns locale with a pattern per language. English keeps today's patterns (`1 Aug 2026`, `1 Aug 2026, 14:05`); Czech uses `d. MMMM yyyy` (`1. srpna 2026`) and `d. M. yyyy, HH:mm` (`1. 8. 2026, 14:05`).
- Relative times come from the catalogs: `právě teď`, `před 45 min`, `před 3 h`, `včera`, `před 4 dny`.
- Counts, file sizes and durations use `Intl.NumberFormat` (`1,5 MB` in Czech).

## 6. Czech glossary

| English | Czech |
|---|---|
| Home | Přehled |
| Workspace / Setup (sidebar groups) | Práce / Nastavení |
| Content · Entry | Obsah · Položka |
| Media | Média |
| Inbox · Unread | Zprávy · Nepřečtené |
| Content models · Field | Modely obsahu · Pole |
| Forms | Formuláře |
| Sites & API keys | Weby a API klíče |
| Webhooks | Webhooky |
| Draft · Published · Archived | Koncept · Publikováno · Archivováno |
| Publish · Unpublish · Save draft | Publikovat · Zrušit publikování · Uložit koncept |
| Sign in · Sign out | Přihlásit se · Odhlásit se |

Other terms follow the same style: buttons use the infinitive (`Uložit`, `Smazat`, `Zrušit`), and English loanwords are avoided where a common Czech term exists (API, webhook and URL stay).

## 7. Quality

- **Catalog parity test:** fails when `cs` misses a key present in `en`, has an extra key, or lacks a required Czech plural form.
- **Lint guard:** `eslint-plugin-i18next` rule `no-literal-string` in JSX-text mode on `src/**/*.tsx`, excluding tests and `components/ui`. Enabled once every screen is converted, so new untranslated text fails `pnpm lint`.
- **Existing tests:** the test setup initializes i18n in English; the existing tests keep asserting English text. Selected tests switch to Czech to prove switching, plurals and dates.
- **Accessibility:** the axe page test runs in both languages; `<html lang>` matches the chosen language.
- **Layout:** Czech strings are often longer. Every screen is checked in Czech at 360px and desktop for overflow and clipped buttons or badges.

## 8. Error handling

- Missing key at runtime: i18next falls back to English, then to the key; the parity test prevents this from shipping.
- Storage unavailable: the language is detected from the browser for the session and not saved.
- Unsupported stored value: ignored, detection runs again.

## 9. Delivery

Two plans:

1. **Foundation and core screens:** `src/i18n`, switcher (user menu and sign-in), `lib/format.ts`, the shell (sidebar, top bar, mobile tabs, command palette, error page), sign-in, Home, Content list and entry editor (including field editors and the rich text toolbar).
2. **Remaining screens and guards:** Media, Inbox, Models (including templates), Forms (including the embed snippet), Sites, Webhooks; the lint guard; browser verification of every screen in Czech.

## 10. Out of scope

- Translating server messages or adding error codes to the API.
- Language stored on the user account.
- Content language variants.
- Right-to-left languages.
