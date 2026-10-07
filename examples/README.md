# FlajsmanLab: portfolio

A static React (Vite) single-page app that renders Pavel Flajšman's portfolio
live from the **TheCMS** public API, in Czech and English. Pastel plates, deep
violet ink and one blue for actions, set in Onest (after the Pastel Webflow template).

## Architecture

```
examples/
├─ index.html              # entry; loads /config.js then the app, pulls in fonts
├─ public/
│  └─ config.js            # runtime config (gitignored; create it for local dev)
├─ src/
│  ├─ main.tsx             # React + React Query providers
│  ├─ App.tsx              # routes and setup gate
│  ├─ config.ts            # reads window.__CMS_CONFIG__
│  ├─ i18n.ts              # languages, UI strings, localized paths
│  ├─ types/               # API + domain types
│  ├─ lib/cms.ts           # typed public-API client + Entry→Project normaliser
│  ├─ hooks/useContent.ts  # React Query hooks (projects, project, page, media)
│  ├─ components/          # Header, Footer, Layout, ProjectCard, MediaImage, LabMark, ...
│  ├─ pages/               # Projects, Project, About, NotFound
│  └─ styles/global.css    # design tokens and styles
```

**Routes:** `/` redirects to `/cs` for Czech or Slovak browsers and to `/en` otherwise.

| Czech | English | Page |
|---|---|---|
| `/cs` | `/en` | Projects, with a technology filter (`?tag=React`) |
| `/cs/projekty/:id` | `/en/projects/:id` | Project detail |
| `/cs/o-mne` | `/en/about` | About |

The header switch opens the same page in the other language. Project links use
the entry's shared item id, so they work in both languages. Every content
request sends `?language=cs|en`; an entry without a published version in that
language comes in the CMS default language.

Tests: `pnpm --filter blog-flajsman test`.

## Local development

```bash
pnpm install
cat > examples/public/config.js <<'EOF'
window.__CMS_CONFIG__ = {
  apiUrl: "https://<backend>/api/v1/public",
  apiKey: "<FlajsmanLab site API key>",
  siteTitle: "FlajsmanLab",
};
EOF
pnpm --filter blog-flajsman dev
```

Without a real `config.js` the app shows a Setup screen. The site's allowed
origins in the admin must include `http://localhost:5173`.

## CMS setup (FlajsmanLab project in the admin)

1. **Languages:** add Czech (`cs`). English (`en`) is the default.
2. **Content type `project`** (title field `title`):

   | Field | Type | Localized | Notes |
   |---|---|---|---|
   | `title` | TEXT, required | yes | |
   | `summary` | TEXT | yes | one or two sentences for the card |
   | `body` | RICH_TEXT | yes | the project story |
   | `role` | TEXT | yes | e.g. "Autor", "Frontend" |
   | `cover` | MEDIA | no | card and detail image, ideally 16:10 |
   | `gallery` | MEDIA, multiple | no | further screenshots |
   | `tags` | TEXT | no | comma-separated: `React, Node, Azure`; feeds the filter |
   | `year` | NUMBER | no | |
   | `liveUrl` | TEXT | no | "Visit site" button |
   | `repoUrl` | TEXT | no | "Source code" button |
   | `order` | NUMBER | no | lower first; projects without it follow, newest year first |
   | `tint` | TEXT | no | plate colour: `blue`, `lilac`, `blush`, `sun` or `mint`; empty takes turns |

3. **Content type `page`** for page text: `key` (TEXT, required, not localized),
   `title` (TEXT), `subtitle` (TEXT), `body` (RICH_TEXT), `image` (MEDIA, not localized).
   - `key=home`: `title` and `subtitle` are the hero on the projects page.
   - `key=about`: the About page; `image` is the portrait.

   Both fall back to built-in copy if absent.
4. Publish each entry in both languages.

## Deploy

Push to `main` with changes under `examples/**`. CI tests and builds the app
and injects `config.js` from these GitHub secrets:
`EXAMPLE_CMS_API_URL`, `EXAMPLE_CMS_API_KEY` (the FlajsmanLab site key),
`EXAMPLE_CMS_SITE_TITLE` (`FlajsmanLab`), `EXAMPLE_CMS_PROJECTS_SLUG` and
`EXAMPLE_CMS_PAGES_SLUG` (optional, default `project` and `page`), plus
`AZURE_EXAMPLE_WEB_APPS_API_TOKEN`.
