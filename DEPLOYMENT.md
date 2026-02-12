# TheCMS - Deployment Manual

Step-by-step guide to deploy TheCMS from local development to Azure production.

## Prerequisites

- [Azure CLI](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli) installed
- [Pulumi CLI](https://www.pulumi.com/docs/get-started/install/) installed
- [Node.js 20+](https://nodejs.org/) and [pnpm](https://pnpm.io/) installed
- [Docker](https://www.docker.com/) installed
- Azure subscription (free tier eligible)
- GitHub repository with this code pushed

---

## Phase 1: Create Entra External ID Tenant (Azure Portal)

> Azure AD B2C was deprecated May 2025. We use **Microsoft Entra External ID** instead.

### 1.1 Create the External Tenant

1. Go to [Microsoft Entra admin center](https://entra.microsoft.com)
2. Sign in with your Azure account
3. Navigate to **Microsoft Entra ID** > **Overview** > **Manage tenants**
4. Click **Create**
5. Select **External** > **Continue**
6. Fill in:
   - **Tenant name**: `TheCMS Customers`
   - **Domain name**: `thecmscustomers`
   - **Country/Region**: your region (cannot change later)
   - **Subscription**: select your Azure subscription
7. Click **Create** (takes up to 30 minutes)

### 1.2 Switch to the External Tenant

1. Click your profile icon (top right) > **Switch directory**
2. Select `TheCMS Customers`

### 1.3 Register Backend API Application

1. Go to **App registrations** > **New registration**
2. Fill in:
   - **Name**: `TheCMS Backend API`
   - **Supported account types**: Accounts in this organizational directory only
3. Click **Register**
4. Go to **Expose an API** > click **Set** next to Application ID URI
5. Add scopes:
   - Click **Add a scope**
   - Scope name: `cms.read`, Admin consent display name: `Read CMS data`, State: Enabled
   - Click **Add a scope** again
   - Scope name: `cms.write`, Admin consent display name: `Write CMS data`, State: Enabled

**Save these values:**

| Value | Where to find | Used as |
|-------|--------------|---------|
| Application (client) ID | Overview page | `AZURE_ENTRA_CLIENT_ID` (backend) |
| Directory (tenant) ID | Overview page | `AZURE_ENTRA_TENANT_ID` |
| Tenant domain | `thecmscustomers.onmicrosoft.com` | `AZURE_ENTRA_TENANT_NAME` = `thecmscustomers` |

### 1.4 Register Admin Dashboard Application (SPA)

1. Go to **App registrations** > **New registration**
2. Fill in:
   - **Name**: `TheCMS Admin Dashboard`
   - **Supported account types**: Accounts in this organizational directory only
   - **Redirect URI**: Platform = **Single-page application (SPA)**, URI = `http://localhost:5174`
3. Click **Register**
4. Go to **Authentication** > **Add URI** (you'll add the production URL after deployment)
5. Go to **API permissions** > **Add a permission** > **My APIs** > select `TheCMS Backend API`
6. Check `cms.read` and `cms.write` > **Add permissions**
7. Click **Grant admin consent for TheCMS Customers**

**Save this value:**

| Value | Where to find | Used as |
|-------|--------------|---------|
| Application (client) ID | Overview page | `VITE_AZURE_ENTRA_CLIENT_ID` (frontend) |

### 1.5 Create User Flow

1. Navigate to **External Identities** > **User flows**
2. Click **New user flow**
3. Select **Sign up and sign in** (Recommended)
4. Configure:
   - **Name**: `signupsignin1`
   - **Identity providers**: Email + password
   - **User attributes**: Email Address, Display Name
5. Click **Create**

### 1.6 Switch Back to Main Directory

1. Click your profile icon > **Switch directory**
2. Select your main Azure AD directory (where your subscription lives)

---

## Phase 2: Deploy Azure Infrastructure (Pulumi)

### 2.1 Login to Azure and Pulumi

```bash
# Login to Azure CLI
az login
az account show  # Verify correct subscription

# Login to Pulumi (local state)
cd infrastructure/pulumi
pulumi login --local
```

### 2.2 Install Dependencies

```bash
cd infrastructure/pulumi
pnpm install
```

### 2.3 Initialize Stack

```bash
# Set passphrase for local encryption
export PULUMI_CONFIG_PASSPHRASE_FILE=.pulumi.passphrase
# Or on Windows PowerShell:
# $env:PULUMI_CONFIG_PASSPHRASE_FILE = ".pulumi.passphrase"

# Initialize dev stack (if not already done)
pulumi stack init dev
```

### 2.4 Configure Stack

```bash
# Azure region
pulumi config set azure-native:location westeurope

# Microsoft Entra External ID (from Phase 1)
pulumi config set entra:tenantName thecmscustomers
pulumi config set entra:tenantId <your-tenant-id-guid>
pulumi config set entra:clientId <your-backend-api-client-id>
```

### 2.5 Preview and Deploy

```bash
# Preview what will be created
pulumi preview

# Deploy (creates all resources)
pulumi up
```

This creates:

| Resource | Name | Purpose | Cost |
|----------|------|---------|------|
| Resource Group | `thecms-dev-rg` | Container for all resources | $0 |
| Cosmos DB | `thecms-dev-cosmos` | MongoDB API database (free tier) | $0 |
| Storage Account | `thecmsdevsa` | Blob storage for media (free 5GB) | $0 |
| Container App | `thecms-dev-api` | Backend API hosting (free tier) | $0 |
| Static Web App | `thecms-dev-admin` | Admin dashboard hosting (free) | $0 |
| App Insights | `thecms-dev-appinsights` | Monitoring (free 5GB/mo) | $0 |

Docker images are stored on **GitHub Container Registry (ghcr.io)** for free - no Azure Container Registry needed.

### 2.6 Save Outputs

```bash
# View all outputs
pulumi stack output

# Key values you need:
pulumi stack output containerAppUrl
pulumi stack output staticWebAppUrl
pulumi stack output staticWebAppDeploymentToken --show-secrets
```

---

## Phase 3: Create Azure Service Principal (for GitHub Actions)

```bash
# Get your subscription ID
az account show --query id -o tsv

# Create service principal with Contributor role
az ad sp create-for-rbac \
  --name "thecms-github-deploy" \
  --role contributor \
  --scopes /subscriptions/<YOUR_SUBSCRIPTION_ID>/resourceGroups/thecms-dev-rg \
  --sdk-auth
```

Save the JSON output - you'll need it for the `AZURE_CREDENTIALS` GitHub secret.

The output looks like:
```json
{
  "clientId": "...",
  "clientSecret": "...",
  "subscriptionId": "...",
  "tenantId": "...",
  ...
}
```

---

## Phase 4: Configure GitHub Secrets

Go to your GitHub repo > **Settings** > **Secrets and variables** > **Actions** > **New repository secret**.

Add these 7 secrets:

| Secret Name | Value | Source |
|-------------|-------|--------|
| `AZURE_CREDENTIALS` | Full JSON from Phase 3 | `az ad sp create-for-rbac` output |
| `AZURE_STATIC_WEB_APPS_API_TOKEN` | SWA deployment token | `pulumi stack output staticWebAppDeploymentToken --show-secrets` |
| `VITE_API_URL` | `https://<container-app-url>/api/v1` | `pulumi stack output containerAppUrl` + `/api/v1` |
| `VITE_AZURE_ENTRA_TENANT_NAME` | `thecmscustomers` | From Phase 1 |
| `VITE_AZURE_ENTRA_TENANT_ID` | Tenant ID (GUID) | From Phase 1.3 |
| `VITE_AZURE_ENTRA_CLIENT_ID` | Admin dashboard client ID | From Phase 1.4 |
| `VITE_AZURE_ENTRA_API_CLIENT_ID` | Backend API client ID | From Phase 1.3 |

### Configure ghcr.io for Pulumi (Container App registry)

After the first GitHub Actions deploy pushes an image to ghcr.io, configure Pulumi to pull from it:

```bash
cd infrastructure/pulumi

# Your GitHub username
pulumi config set ghcr:username <your-github-username>

# A GitHub Personal Access Token with read:packages scope
pulumi config set ghcr:token <your-github-pat> --secret

# The image reference (repo owner is lowercase)
pulumi config set ghcr:image ghcr.io/<your-github-username>/thecms-api:latest

# Apply
pulumi up
```

This configures the Container App to pull images from ghcr.io on restart/scale.

---

## Phase 5: Add Production Redirect URI

Now that you have the Static Web App URL, add it to the Entra app registration:

1. Go back to [Entra admin center](https://entra.microsoft.com)
2. Switch to the **TheCMS Customers** directory
3. Go to **App registrations** > **TheCMS Admin Dashboard**
4. Go to **Authentication**
5. Under **Single-page application** redirect URIs, click **Add URI**
6. Add: `https://<your-static-web-app>.azurestaticapps.net`
7. Click **Save**

---

## Phase 6: Deploy via GitHub Actions

### First Deployment

Push your code to the `main` branch:

```bash
git add .
git commit -m "Add CI/CD and deployment configuration"
git push origin main
```

This triggers both workflows:
- **Backend CI/CD**: Builds Docker image > pushes to ghcr.io > deploys to Container Apps
- **Admin Dashboard CI/CD**: Builds Vite app > deploys to Static Web Apps

### Monitor Deployments

- Go to your GitHub repo > **Actions** tab
- Watch both workflows run
- Green checkmark = success

### Verify Deployment

```bash
# Check backend health
curl https://<container-app-url>/health

# Check API docs
# Open in browser: https://<container-app-url>/api-docs

# Check admin dashboard
# Open in browser: https://<static-web-app-url>
```

---

## Phase 7: Create First Admin User

After the first deployment, sign up through the admin dashboard:

1. Open `https://<static-web-app-url>`
2. You'll be redirected to the Entra External ID sign-up page
3. Create an account with email + password
4. After sign-up, you'll be redirected back to the dashboard
5. The backend auto-creates a user with `EDITOR` role

To promote yourself to `ADMIN`, connect to Cosmos DB and run:

```javascript
// In MongoDB shell or Cosmos DB Data Explorer
db.users.updateOne(
  { email: "your-email@example.com" },
  { $set: { role: "ADMIN" } }
)
```

---

## SendGrid Setup (Optional - Email)

1. Go to [Azure Portal](https://portal.azure.com) > **Create a resource** > search **"Twilio SendGrid"**
2. Select **Free** plan (100 emails/day)
3. Complete signup and go to SendGrid dashboard via **Manage**
4. Go to **Settings** > **API Keys** > **Create API Key**
5. Add the API key to the Container App:

```bash
az containerapp update \
  --name thecms-dev-api \
  --resource-group thecms-dev-rg \
  --set-env-vars "SENDGRID_API_KEY=<your-key>" "SENDGRID_FROM_EMAIL=noreply@yourdomain.com"
```

---

## Cost Alert Setup (Recommended)

1. Azure Portal > **Cost Management + Billing** > **Cost Management**
2. **Budgets** > **Add**
   - Budget name: `TheCMS Monthly`
   - Amount: `$5`
   - Reset period: Monthly
3. Add alert at 80% ($4) and 100% ($5) with your email

---

## Environment Variables Reference

### Container App (Backend) - All Set by Pulumi

| Variable | Value | Source |
|----------|-------|--------|
| `NODE_ENV` | `production` | Pulumi (hardcoded) |
| `PORT` | `3000` | Pulumi (hardcoded) |
| `MONGODB_URI` | Cosmos DB connection string | Pulumi (secret, from Cosmos DB) |
| `AZURE_STORAGE_CONNECTION_STRING` | Storage connection string | Pulumi (secret, from Storage) |
| `AZURE_STORAGE_CONTAINER_NAME` | `media` | Pulumi (hardcoded) |
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | App Insights connection | Pulumi (secret, from App Insights) |
| `AZURE_ENTRA_TENANT_NAME` | Your tenant name | Pulumi config `entra:tenantName` |
| `AZURE_ENTRA_TENANT_ID` | Your tenant ID | Pulumi config `entra:tenantId` |
| `AZURE_ENTRA_CLIENT_ID` | Backend API client ID | Pulumi config `entra:clientId` |
| `CORS_ORIGINS` | Static Web App URL | Pulumi (auto, from SWA URL) |

### Static Web App (Frontend) - Baked at Build Time

| Variable | Value | Set Where |
|----------|-------|-----------|
| `VITE_API_URL` | Container App URL + `/api/v1` | GitHub Secret |
| `VITE_AZURE_ENTRA_TENANT_NAME` | Your tenant name | GitHub Secret |
| `VITE_AZURE_ENTRA_TENANT_ID` | Your tenant ID | GitHub Secret |
| `VITE_AZURE_ENTRA_CLIENT_ID` | Admin dashboard client ID | GitHub Secret |
| `VITE_AZURE_ENTRA_API_CLIENT_ID` | Backend API client ID | GitHub Secret |

> **Note**: `VITE_*` variables are embedded into the JavaScript bundle during `vite build`. They are NOT runtime environment variables. That's why they're set as GitHub Actions secrets, not on the Static Web App itself.

---

## Updating After Deployment

### Update Backend Code

Just push to `main` with changes in `packages/backend/`:
```bash
git push origin main
# GitHub Actions auto-builds Docker image, pushes to ghcr.io, deploys to Container Apps
```

### Update Frontend Code

Just push to `main` with changes in `packages/admin-dashboard/`:
```bash
git push origin main
# GitHub Actions auto-builds and deploys to Static Web Apps
```

### Update Infrastructure

```bash
cd infrastructure/pulumi
pulumi up
```

### Update Entra Config

```bash
cd infrastructure/pulumi
pulumi config set entra:clientId <new-value>
pulumi up
```

---

## Troubleshooting

### Container App not starting

```bash
# Check logs
az containerapp logs show \
  --name thecms-dev-api \
  --resource-group thecms-dev-rg \
  --type console

# Check revision status
az containerapp revision list \
  --name thecms-dev-api \
  --resource-group thecms-dev-rg \
  -o table
```

### Container App can't pull image from ghcr.io

1. Verify the GitHub PAT has `read:packages` scope
2. Verify the Pulumi ghcr config is set:
   ```bash
   pulumi config get ghcr:username
   pulumi config get ghcr:image
   ```
3. Make sure the ghcr.io package is public, or the PAT token is valid

### Authentication not working

1. Verify Entra tenant config matches env vars
2. Check that redirect URIs include both `localhost:5174` AND the production SWA URL
3. Check that API permissions have admin consent granted
4. Check browser console for MSAL errors

### Static Web App returning 404

The `staticwebapp.config.json` handles SPA routing. Make sure it's included in the build output.

### GitHub Actions failing

- Check that all 7 secrets are set correctly
- Verify the service principal has Contributor role on the resource group
- Check the Actions tab for detailed error logs

### Database migration (azureB2CId to entraId)

If you had users in the database before the auth migration:

```javascript
db.users.updateMany({}, { $rename: { "azureB2CId": "entraId" } })
```

---

## Architecture Diagram

```
                    ┌─────────────────┐
                    │   GitHub Repo    │
                    │    (main)        │
                    └────────┬────────┘
                             │ push
                    ┌────────┴────────┐
                    │  GitHub Actions  │
                    └──┬───────────┬──┘
                       │           │
              ┌────────┴──┐  ┌────┴────────────┐
              │ Docker     │  │ Vite Build       │
              │ Build+Push │  │ (VITE_* baked in)│
              └────┬──────┘  └──────┬───────────┘
                   │                │
          ┌────────┴──┐    ┌───────┴──────────┐
          │ ghcr.io    │    │ Azure Static     │
          │ (free)     │    │ Web Apps         │
          └────┬──────┘    │ (admin dashboard) │
               │            └──────────────────┘
      ┌────────┴──────────┐         │
      │ Azure Container   │         │ HTTPS
      │ Apps (backend API)│◄────────┘
      └──┬─────┬─────┬───┘
         │     │     │
   ┌─────┴┐ ┌─┴───┐ ┌┴──────────┐
   │Cosmos│ │Blob  │ │Entra      │
   │DB    │ │Store │ │External ID│
   └──────┘ └─────┘ └───────────┘
```

---

## Estimated Monthly Cost

| Service | Tier | Monthly Cost |
|---------|------|-------------|
| Cosmos DB (MongoDB API) | Free (permanent) | $0 |
| Container Apps | Free (180k vCPU-sec) | $0 |
| Static Web Apps | Free | $0 |
| Blob Storage | Free (5GB) | $0 |
| Entra External ID | Free (50k MAU) | $0 |
| App Insights | Free (5GB/mo) | $0 |
| GitHub Container Registry | Free (included with GitHub) | $0 |
| **Total** | | **$0/month** |
