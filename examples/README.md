# flajsman.cz — personal blog

A static React (Vite) single-page app that renders blog content live from
**TheCMS** public API. Black & white, lime accent, Space Grotesk typography.

## Architecture

```
examples/
├─ index.html              # entry; loads /config.js then the app, pulls in fonts
├─ public/
│  └─ config.js            # runtime config (gitignored; placeholder for local dev)
├─ src/
│  ├─ main.tsx             # React + React Query providers
│  ├─ App.tsx              # router + setup gate
│  ├─ config.ts            # reads window.__CMS_CONFIG__
│  ├─ types/               # API + domain types
│  ├─ lib/
│  │  ├─ cms.ts            # typed public-API client + Entry→Post normaliser
│  │  ├─ queryClient.ts
│  │  └─ format.ts
│  ├─ hooks/usePosts.ts    # React Query hooks (posts, post, contact form)
│  ├─ components/          # Header, Footer, Layout, PostRow, RichText, Setup, Spinner
│  ├─ pages/               # Home, Post, About, Contact, NotFound
│  └─ styles/global.css    # design system
└─ staticwebapp.config.json
```

**Data flow:** components → React Query hooks → `cms` client → TheCMS
`/api/v1/public/*` endpoints. Posts come from a content type (slug `postsSlug`);
each entry's dynamic `data` is normalised into a typed `Post` in `cms.ts`
(`toPost`), tolerant of field-name variations (`title`/`name`, `body`/`content`,
`excerpt`/`summary`, `coverImage`/`image`).

## Local development

```bash
pnpm install
cp examples/config.example.js examples/public/config.js   # fill in apiUrl + apiKey
pnpm --filter blog-flajsman dev
```

Without a real `config.js` the app shows a Setup screen.

## CMS setup (admin dashboard)

- **Content type** `blog-post` with fields: `title` (TEXT, required),
  `excerpt` (TEXT), `coverImage` (TEXT/MEDIA url), `author` (TEXT),
  `tags` (TEXT), `body` (RICH_TEXT, required). Publish entries.
- **Content type** `page` for static page text, fields: `key` (TEXT, required —
  e.g. `home` or `about`), `title` (TEXT), `subtitle` (TEXT, used for the home
  tagline), `body` (RICH_TEXT, used for the about text). Create one published
  entry with `key=home` and one with `key=about`. Pages fall back to built-in
  copy if absent.
- **Content type** `trip` for bike trips, fields: `title` (TEXT, required),
  `summary` (TEXT), `gpxUrl` (TEXT — either a media **id** of a `.gpx` uploaded
  to the Media Library, or a full public URL), `distanceKm` (NUMBER, optional —
  auto-computed from the GPX if empty), `body` (RICH_TEXT). The route is drawn
  with Leaflet from the GPX, and a "Stáhnout GPX" download button is shown.
  Media ids are resolved to file URLs via `GET /api/v1/public/media/:id`.
- **Contact form** slug `contact-us` (any fields; the form renders itself).

## Deploy

Push to `main` with changes under `examples/**`. CI builds the app and injects
`config.js` from these GitHub secrets:
`EXAMPLE_CMS_API_URL`, `EXAMPLE_CMS_API_KEY`, `EXAMPLE_CMS_SITE_TITLE`,
`EXAMPLE_CMS_POSTS_SLUG`, `EXAMPLE_CMS_CONTACT_FORM_SLUG`,
plus `AZURE_EXAMPLE_WEB_APPS_API_TOKEN`.
