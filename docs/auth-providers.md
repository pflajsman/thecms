# Sign-in providers, superadmins and projects

TheCMS signs people in through Microsoft Entra External ID (the CIAM tenant in `AZURE_ENTRA_TENANT_*`). Signing in only proves who someone is. Access comes from project memberships, so a new person who signs in sees "No project yet" until someone invites them.

## Superadmins

A superadmin creates projects and acts as Owner in every project.

1. Sign in to the admin once.
2. Find your Entra subject id: open `GET /api/v1/users/me` in the browser's network tab and copy `entraId`.
3. Set it on the backend, comma separated for several people:
   - locally: `SUPERADMINS=<entraId>` in `packages/backend/.env`
   - Azure: `pulumi config set superadmins <entraId>` and deploy (the container app reads `SUPERADMINS`).
4. Sign in again. The user menu now shows **Projects**.

`SUPERADMINS` also accepts email addresses, which is handy locally. Prefer subject ids in production: an id belongs to one account, while an email claim comes from whichever provider the person used.

Set `ADMIN_URL` to the admin dashboard address so invitation links point to it. Pulumi sets it from the Static Web App URL.

## Adding Google sign-in

The app code does not change: the admin already uses the External ID authority, and the user flow decides which providers are offered.

1. **Google Cloud console:** create an OAuth client of type "Web application". Add the redirect URIs that Entra lists for Google federation. For External ID they are on your tenant's `ciamlogin.com` domain, for example `https://<tenant-subdomain>.ciamlogin.com/<tenant-id>/federation/oauth2` and `https://<tenant-subdomain>.ciamlogin.com/<tenant-subdomain>.onmicrosoft.com/federation/oauth2`.
2. **Entra admin center, External Identities, All identity providers:** add Google with the client id and secret from step 1.
3. **User flows:** open the sign-up and sign-in flow used by the admin app registration and turn on Google under identity providers.
4. **Token claims:** make sure the access token for the backend API carries `email` and `name` (optional claims on the API app registration, or user attributes collected by the flow). Member lists show people by these. Without them a member appears by id only.
5. Test in a private window: the sign-in page offers "Sign in with Google".

Facebook and Apple are added the same way.

**Not verified:** these steps come from general knowledge of Entra External ID, not from current Microsoft documentation. Portal labels and redirect URIs may differ. Check Microsoft's "Add Google as an identity provider" guide for External ID while setting it up.

## Rolling out projects on an existing install

1. Take a Cosmos DB backup.
2. Deploy the backend. On start, `migrateProjects()`:
   - creates a project named "Default";
   - moves every existing document and access token into it;
   - gives every existing user a membership from their old global role (Admin becomes Owner, Editor stays Editor, Viewer stays Viewer);
   - drops the old global unique indexes on content type slug, form slug, language code and variant SKU, which are now unique per project.

   It is idempotent, and two instances starting at once are safe.
3. Set `SUPERADMINS` and sign in. Rename "Default" from **Projects** if you like.
4. To add a client: **Projects, New project**, then enter the owner's email. They receive an invitation link, which works once and expires in 7 days. If email is not configured (`BREVO_API_KEY`), copy the link from the dialog and send it yourself.

Existing site API keys keep working: each site now belongs to the Default project and serves only its content.
