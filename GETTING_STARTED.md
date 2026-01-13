# Getting Started with TheCMS

## Prerequisites

- **Node.js 20+** - [Download](https://nodejs.org/)
- **pnpm 8+** - Install: `npm install -g pnpm`
- **Docker Desktop** - [Download](https://www.docker.com/products/docker-desktop/)
- **Azure Account** - [Sign up for free](https://azure.microsoft.com/free/)

## Phase 1: Local Development Setup

### 1. Install Dependencies

```bash
# From project root
pnpm install
```

### 2. Start Local Services (MongoDB + Azurite)

```bash
# Start Docker containers
docker-compose up -d

# Verify services are running
docker-compose ps
```

You should see:
- MongoDB running on `localhost:27017`
- Azurite (Azure Storage Emulator) on `localhost:10000`

### 3. Configure Environment Variables

The `.env` file is already created in `packages/backend/.env` with local development defaults.

**Note:** Azure AD B2C variables are placeholders. We'll configure them after creating the Azure AD B2C tenant.

### 4. Start Backend Development Server

```bash
# From project root
cd packages/backend
pnpm dev
```

You should see:
```
✅ Database connected successfully
🚀 Server running on port 3000
📝 Environment: development
🔗 API URL: http://localhost:3000
💚 Health check: http://localhost:3000/health
```

### 5. Test the API

```bash
# Health check
curl http://localhost:3000/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2026-01-09T...",
  "uptime": 1.234,
  "environment": "development"
}
```

## Next Steps: Azure Setup

### Step 1: Create Azure AD B2C Tenant

1. Go to [Azure Portal](https://portal.azure.com)
2. Search for "Azure AD B2C" and click "Create"
3. Click "Create a new Azure AD B2C Tenant"
4. Fill in details:
   - Organization name: `TheCMS` (or your choice)
   - Initial domain name: `thecms` (must be unique)
   - Country/Region: Your location
5. Click "Review + create" → "Create"
6. Wait for tenant creation (2-3 minutes)
7. Switch to your new B2C tenant (top-right menu)

### Step 2: Configure User Flows

1. In Azure AD B2C tenant, go to "User flows"
2. Click "New user flow"
3. Select "Sign up and sign in" → Recommended version
4. Name it: `signupsignin`
5. Identity providers: Enable "Email signup"
6. User attributes and claims:
   - Collect: Email Address, Display Name
   - Return: Email Addresses, Display Name, User's Object ID
7. Click "Create"

### Step 3: Register Backend API Application

1. Go to "App registrations" → "New registration"
2. Fill in:
   - Name: `TheCMS Backend API`
   - Supported account types: Accounts in this organizational directory only
   - Redirect URI: Leave blank for now
3. Click "Register"
4. Note the **Application (client) ID** - you'll need this
5. Go to "Expose an API"
6. Click "Set" next to Application ID URI (accept default)
7. Click "Add a scope":
   - Scope name: `cms.access`
   - Admin consent display name: `Access TheCMS API`
   - Admin consent description: `Allows access to TheCMS API`
   - State: Enabled
8. Click "Add scope"

### Step 4: Update Backend .env

Update `packages/backend/.env` with your B2C details:

```env
AZURE_AD_B2C_TENANT_NAME=thecms
AZURE_AD_B2C_CLIENT_ID=<your-backend-client-id>
AZURE_AD_B2C_POLICY_NAME=B2C_1_signupsignin
AZURE_AD_B2C_ISSUER=https://thecms.b2clogin.com/<tenant-id>/v2.0/
```

### Step 5: Create Cosmos DB Account

1. In Azure Portal, search for "Azure Cosmos DB"
2. Click "Create" → "Azure Cosmos DB for MongoDB"
3. Fill in:
   - Subscription: Your subscription
   - Resource Group: Create new → `thecms-rg`
   - Account Name: `thecms-db` (must be globally unique)
   - Location: Choose nearest region
   - Capacity mode: **Serverless** (for free tier)
   - Version: 4.2 or higher
4. Click "Review + create" → "Create"
5. Wait for deployment (5-10 minutes)
6. Go to resource → "Connection strings"
7. Copy the "Primary Connection String"

### Step 6: Update Backend to Use Cosmos DB

Update `packages/backend/.env`:

```env
MONGODB_URI=<your-cosmos-db-connection-string>
```

### Step 7: Restart Backend

```bash
cd packages/backend
pnpm dev
```

The backend should now connect to Azure Cosmos DB!

## Testing Authentication (After Azure Setup)

### Get a Test Token

1. Use Postman or a similar tool to get a token from Azure AD B2C
2. Or use the admin dashboard (Phase 5) once it's built

### Test Protected Endpoint

```bash
curl http://localhost:3000/api/v1/users/me \
  -H "Authorization: Bearer <your-jwt-token>"
```

## Common Issues

### MongoDB Connection Error

**Error:** `MongoServerError: Authentication failed`

**Solution:** Make sure Docker containers are running:
```bash
docker-compose ps
docker-compose logs mongodb
```

### Port Already in Use

**Error:** `EADDRINUSE: address already in use :::3000`

**Solution:** Change PORT in `.env` or stop other services:
```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <pid> /F

# Mac/Linux
lsof -i :3000
kill -9 <pid>
```

### TypeScript Build Errors

**Solution:** Make sure dependencies are installed:
```bash
cd packages/backend
pnpm install
```

## Project Structure

```
TheCMS/
├── packages/
│   └── backend/
│       ├── src/
│       │   ├── main.ts           # Entry point
│       │   ├── app.ts            # Express app
│       │   ├── config/           # Configuration
│       │   ├── middleware/       # Middleware functions
│       │   ├── models/           # Mongoose models
│       │   └── routes/           # API routes
│       ├── .env                  # Environment variables
│       ├── package.json
│       └── tsconfig.json
├── docker-compose.yml            # Local services
└── GETTING_STARTED.md            # This file
```

## What's Next?

After completing Phase 1, you can:

1. ✅ **Phase 1 Complete** - You have a working backend with auth!
2. **Phase 2** - Implement Content Types API
3. **Phase 3** - Implement Content Entries API
4. **Phase 4** - Add Media Management
5. **Phase 5** - Build Admin Dashboard

See [PROJECT_PROGRESS.md](./PROJECT_PROGRESS.md) for detailed checklist.

## Useful Commands

```bash
# Install dependencies
pnpm install

# Start local services
docker-compose up -d

# Stop local services
docker-compose down

# View logs
docker-compose logs -f

# Start backend dev server
cd packages/backend && pnpm dev

# Build backend
cd packages/backend && pnpm build

# Run tests (when added)
cd packages/backend && pnpm test
```

## Resources

- [Implementation Plan](./IMPLEMENTATION_PLAN.md)
- [Project Progress](./PROJECT_PROGRESS.md)
- [Azure AD B2C Documentation](https://learn.microsoft.com/en-us/azure/active-directory-b2c/)
- [Cosmos DB MongoDB API](https://learn.microsoft.com/en-us/azure/cosmos-db/mongodb/introduction)
