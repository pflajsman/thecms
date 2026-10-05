# Projects, Members and Roles

**Date:** 2026-10-05
**Status:** Approved in conversation, awaiting written review
**Scope:** `packages/backend`, `packages/admin-dashboard`, `docs`.
**Builds on:** personal access tokens and MCP (`docs/superpowers/specs/2026-10-02-ai-mcp-agent-design.md`), the e-shop specs, content language versions.

## 1. Goal

One TheCMS install serves several clients. The superadmin creates a project for a client and invites its owner. The owner signs in with Google or email through Entra External ID and invites their own team. Every project's data is fully separate: a member of one project never sees another project's content, models, media, forms, sites, webhooks or shop.

## 2. Decisions

| Topic | Decision |
|---|---|
| Tenancy | Separate projects; every tenant document carries `projectId` |
| Who creates projects | Only a superadmin |
| Superadmin | `User.isSuperadmin`, set at sign-in when the Entra subject id or email is listed in `SUPERADMINS` (comma separated; subject ids preferred in production); acts as Owner in every project |
| Roles per project | Owner, Admin, Editor, Viewer |
| Sign-in providers | Entra External ID stays; Google is added in the Entra portal (section 9) |
| Access on first sign-in | None. A user with no membership sees "No access" |
| Invitations | Accepted by a one-time link while signed in, not by matching the email claim |
| Request scope | Admin requests send `X-Project-Id`; the public API takes the project from the site API key; a personal access token belongs to one project |
| Enforcement | A Mongoose plugin scopes every tenant query from an `AsyncLocalStorage` context and refuses queries without one |
| Existing data | Moved to a project named "Default" by an idempotent startup migration |

## 3. Data

### 3.1 New collections

**`projects`**

| Field | Rules |
|---|---|
| `name` | 1 to 100 characters |
| `status` | `active` or `archived`, default `active` |
| `createdBy` | Entra id of the superadmin |
| `createdAt`, `updatedAt` | Timestamps |

**`projectmembers`**

| Field | Rules |
|---|---|
| `projectId` | Indexed |
| `userId` | Entra id, indexed |
| `role` | `OWNER`, `ADMIN`, `EDITOR`, `VIEWER` |
| `createdAt` | Timestamp |

Unique `(projectId, userId)` (new collection, so Cosmos accepts the unique index).

**`invitations`**

| Field | Rules |
|---|---|
| `projectId` | Indexed |
| `email` | Lowercased; used to address the email and shown in lists, never to grant access |
| `role` | As above |
| `tokenHash` | SHA-256 hex of the link token, unique |
| `invitedBy` | Entra id |
| `expiresAt` | 7 days after creation or resend |
| `acceptedAt`, `acceptedBy` | Set once on acceptance |

Link token: 32 random bytes base64url, shown in the link only, never stored or logged. At most 50 open invitations per project. The link is `ADMIN_URL/invite/<token>` (new setting `ADMIN_URL`, default `http://localhost:5173`).

### 3.2 Changed collections

- `users`: add `isSuperadmin` (default false). The global `role` stays readable for the migration only and no longer grants anything. `email` is no longer unique: one person may have two Entra accounts (Google and an email code) with the same address.
- `accesstokens`: add `projectId`.
- Tenant collections gain an indexed `projectId`: content types, entries, languages, media, sites, webhooks, contact forms, submissions, products, variants, shipping zones, shipping methods, orders, download grants, shop settings, AI settings.
- Unique per project instead of global: content type `slug`, language `code`, contact form `slug`, variant `sku`. Cosmos cannot add a unique index to a non-empty collection, so the old unique index is dropped, a non-unique `(projectId, field)` index is added, and the services check uniqueness.
- Order numbers stay unique across the install (one counter per year), so links and emails never clash.
- Per user, not scoped: AI connections and AI usage.

## 4. Roles

| Capability | Owner | Admin | Editor | Viewer |
|---|---|---|---|---|
| Read content, media, forms, orders, settings | yes | yes | yes | yes |
| Create and edit entries, upload media, handle orders and submissions | yes | yes | yes | no |
| Models, languages, sites, webhooks, shop settings, shipping, AI settings | yes | yes | no | no |
| Invite and remove Editors and Viewers, invite Admins | yes | yes | no | no |
| Change or remove Admins and Owners, rename the project | yes | no | no | no |

- Nobody grants a role above their own.
- The last Owner cannot be removed or demoted.
- A member can leave a project unless they are its last Owner.
- MCP: Viewers get the read tools; Editors and above also get the write tools.

## 5. Request scope

- `projectMiddleware` runs after `authMiddleware` on admin routes. It reads `X-Project-Id`, loads the membership (a superadmin needs none) and sets `req.project = { id, role }`. Missing header: `400 PROJECT_REQUIRED`. Not a member, or the project is archived (superadmin excepted): `403`.
- `requireProjectRole(minimum)` guards writes per section 4.
- The request handler runs inside `runInProject(projectId, …)`.
- Routes without a project: `/users/me`, `/projects` (superadmin), `/invites/:token`.

### 5.1 Tenant plugin

- Adds `projectId` to the schema.
- Injects `{ projectId }` into `find`, `findOne`, `findOneAndUpdate`, `findOneAndDelete`, `countDocuments`, `updateOne`, `updateMany`, `deleteOne`, `deleteMany`, `distinct`, `replaceOne`.
- Prepends `{ $match: { projectId } }` to `aggregate`.
- Sets `projectId` on `save` and `insertMany`; a document whose `projectId` differs from the context is refused.
- Without a context it throws `NoProjectContextError`. `withoutProject(fn)` lifts the rule for superadmin listings, the migration and lookups that find the project first (for example a download token).

## 6. API

### 6.1 Me

`GET /users/me` answers `{ entraId, email, displayName, isSuperadmin, projects: [{ id, name, role }] }`. A superadmin's `projects` lists every active project with role `OWNER`.

### 6.2 Projects (superadmin)

| Endpoint | Behaviour |
|---|---|
| `GET /projects` | Every project with member count and status |
| `POST /projects` | `{ name, ownerEmail, language? }`: creates the project, seeds it (section 7), invites the owner and answers `{ project, invitation, inviteUrl, emailSent }` |
| `PATCH /projects/:id` | `{ name?, status? }` |

A project is never deleted through the API; archiving hides it from its members.

### 6.3 Members (current project)

| Endpoint | Minimum role |
|---|---|
| `GET /members`: members with email, name, role; open invitations | Admin |
| `PATCH /members/:userId` `{ role }` | Admin for Editor and Viewer, Owner otherwise |
| `DELETE /members/:userId` | As above; anyone for themselves |
| `POST /invitations` `{ email, role, language? }`: sends the email in `en` or `cs`, answers `{ invitation, inviteUrl, emailSent }`; an open invitation for the same email is reissued | Admin (Owner to invite an Owner) |
| `POST /invitations/:id/resend`: new token and expiry | Admin |
| `DELETE /invitations/:id` | Admin |
| `PATCH /project` `{ name }` | Owner |

### 6.4 Accepting

- `GET /invites/:token` (signed in): `{ projectName, role, invitedByName }`.
- `POST /invites/:token/accept`: creates the membership for the caller, or raises the role if they are already a member with a lower one. It answers `{ projectId }`.
- An expired, revoked or used token answers `410`.

### 6.5 Public API, MCP, tokens

- `Site.projectId`. `apiKeyMiddleware` runs the request in the site's project. The download route resolves the project from the grant's order.
- `POST /tokens` binds the token to the current project. `/mcp` runs in the token's project with the owner's current role there. If the owner is no longer a member, the answer is `401`.

## 7. Seeding and background work

- `seedProject(projectId)` creates the English default language and the system product model. It runs on project creation and from the migration.
- Webhook dispatch runs in the caller's project context, so only that project's webhooks fire.
- The unpaid-order job runs once per active project, each with that project's shop settings.
- Stats count the current project only.
- New media blobs are named `<projectId>/<name>`; existing blobs keep their URLs.

## 8. Migration

`migrateProjects()` runs at startup after `migrateLanguages()`. It is idempotent:

1. If no project exists, create "Default".
2. Set `projectId` to Default on every tenant document and access token that has none.
3. For every user without a membership in Default, add one: global ADMIN becomes OWNER, EDITOR stays EDITOR, VIEWER stays VIEWER.
4. Drop the old global unique indexes listed in 3.2 and add the `(projectId, field)` indexes.

Take a Cosmos backup before the first production start with this code.

## 9. Google sign-in

This is configuration in the Entra External ID tenant, documented in `docs/auth-providers.md`:

1. Create a Google OAuth client and give it the redirect URIs that Entra lists for Google federation.
2. In External ID, add Google as an identity provider with that client id and secret.
3. Enable Google in the sign-up and sign-in user flow used by the admin app registration.
4. Make sure the access token carries `email` and `name` (optional claims) so member lists show who people are.

These steps come from general knowledge of External ID and were not verified against current Microsoft documentation; check them during setup. The app code does not change, since it already uses the CIAM authority. Facebook and Apple work the same way.

## 10. Admin dashboard

- `ProjectProvider` loads `/users/me`, keeps the current project in local storage (`current_project`) and falls back to the first project. The API client sends `X-Project-Id` on every call, including the AI stream `fetch`. Switching project clears the query cache.
- **No access screen:** shown for a user with no projects. It gives their email so they can ask for an invitation, and offers sign out.
- **Project switcher:** under the logo in the sidebar and in the mobile top bar, shown when there are two or more projects or the user is a superadmin.
- **Members** (setup group, Admin and Owner): the member list with role select and remove, invite dialog (email, role), and open invitations with resend, copy link and revoke.
- **Projects** (`/admin/projects`, user menu item for superadmins): the list, the create dialog (name, owner email), rename, archive and open.
- **Invite page** (`/invite/:token`): shows the project and role, accepts, then switches to the project.
- `useProjectRole()` hides controls the role cannot use. The server still decides.
- Texts in English and Czech.

## 11. Out of scope

- Self-service project creation and billing.
- Per-project custom domains for the admin.
- Moving existing media blobs into project folders.
- Sharing content between projects.
