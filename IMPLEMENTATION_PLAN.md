# Headless CMS on Azure - Implementation Plan

## Overview
Build a cost-effective headless CMS hosted on Azure, maximizing free tier usage. Target: 1-5 sites, <10k requests/month, staying within $0-5/month cost.

## Architecture Summary

### Azure Services (Free Tier Focus)

| Service | Tier | Purpose | Cost |
|---------|------|---------|------|
| **Azure Container Apps** | Free (180k vCPU-sec/mo) | Backend API hosting | $0 |
| **Cosmos DB (MongoDB API)** | Free tier permanent | Database (1000 RU/s + 25GB) | $0 forever |
| **Azure Static Web Apps** | Free (100GB bandwidth) | Admin UI + Consumer sites | $0 |
| **Azure Blob Storage** | General Purpose v2 | Media files (5GB free) | $0-2 |
| **Azure AD B2C** | Free (50k MAU) | User management & auth | $0 |
| **SendGrid (Azure)** | Free (100 emails/day) | Email service | $0 |
| **Azure CDN** | Standard Microsoft | Media delivery | $0 (100GB free) |
| **Application Insights** | Free (5GB data/mo) | Monitoring | $0 |

**Total: $0-5/month permanently** (no cost increase after 12 months!)

### Technology Stack

**Backend:**
- Node.js 20 LTS + TypeScript 5.x
- Express.js (REST API)
- MongoDB driver or Mongoose (ORM)
- Cosmos DB with MongoDB API
- @azure/msal-node (Azure AD B2C)
- @azure/storage-blob (media)
- @sendgrid/mail (email)

**Admin Dashboard:**
- React 18 + Vite + TypeScript
- Material UI or shadcn/ui
- React Query (data fetching)
- TipTap (rich text editor)
- @azure/msal-browser (auth)

**Infrastructure:**
- Docker (containerization)
- Terraform (IaC)
- GitHub Actions (CI/CD)

## Project Structure

```
TheCMS/
├── packages/
│   ├── backend/                    # Node.js/TypeScript API
│   │   ├── src/
│   │   │   ├── main.ts            # Entry point
│   │   │   ├── app.ts             # Express setup
│   │   │   ├── config/
│   │   │   │   ├── database.ts
│   │   │   │   ├── auth.ts        # Azure AD B2C config
│   │   │   │   └── azure.ts
│   │   │   ├── modules/
│   │   │   │   ├── content-types/
│   │   │   │   │   ├── content-types.controller.ts
│   │   │   │   │   ├── content-types.service.ts
│   │   │   │   │   ├── content-types.routes.ts
│   │   │   │   │   └── content-types.schema.ts
│   │   │   │   ├── content-entries/
│   │   │   │   ├── media/
│   │   │   │   ├── auth/
│   │   │   │   └── users/
│   │   │   └── middleware/
│   │   │       ├── auth.middleware.ts     # JWT validation
│   │   │       ├── error.middleware.ts
│   │   │       └── validation.middleware.ts
│   │   ├── prisma/
│   │   │   ├── schema.prisma      # Database schema
│   │   │   ├── migrations/
│   │   │   └── seed.ts
│   │   ├── tests/
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── admin-dashboard/           # React admin UI
│       ├── src/
│       │   ├── main.tsx
│       │   ├── App.tsx
│       │   ├── config/
│       │   │   └── msal.config.ts # Azure AD B2C config
│       │   ├── features/
│       │   │   ├── content-types/
│       │   │   ├── content-entries/
│       │   │   ├── media/
│       │   │   └── auth/
│       │   ├── components/
│       │   └── api/
│       │       └── client.ts      # API client with auth
│       ├── package.json
│       ├── vite.config.ts
│       └── staticwebapp.config.json
│
├── infrastructure/                # Terraform IaC
│   ├── terraform/
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   └── modules/
│   │       ├── container-apps/
│   │       ├── database/
│   │       ├── storage/
│   │       └── static-web-app/
│
├── .github/
│   └── workflows/
│       ├── backend-ci-cd.yml
│       └── admin-dashboard-ci-cd.yml
│
├── docker-compose.yml            # Local dev (PostgreSQL + Azurite)
├── package.json                  # Root workspace
├── pnpm-workspace.yaml
└── README.md
```

## Database Schema (MongoDB/Cosmos DB)

Core collections:
- **users**: Synced with Azure AD B2C, role-based access
- **contentTypes**: Defines content structures (fields as nested documents)
- **contentEntries**: Actual content (data as flexible documents, partitioned by contentTypeId)
- **media**: File metadata (points to Blob Storage)
- **sites**: Multi-site support with API keys

Key design: MongoDB's flexible schema perfect for dynamic content types. Use indexes for efficient querying.

**Why Cosmos DB over PostgreSQL:**
- Permanent free tier (PostgreSQL only free 12 months)
- 1000 RU/s + 25GB storage forever
- Perfect for your 10k requests/month scale
- Native JSON/document model fits CMS better
- Room to grow within free tier

## Implementation Phases

### Phase 1: Foundation & Authentication (2 weeks)
**Goal:** Working API with Azure AD B2C authentication

**Tasks:**
1. Initialize monorepo structure (pnpm workspaces)
2. Set up backend with Express + TypeScript
3. Set up Cosmos DB (MongoDB API)
   - Create Cosmos DB account in Azure Portal
   - Note connection string
   - Define MongoDB schemas with Mongoose
4. Configure Azure AD B2C tenant
   - Create user flows (sign-up, sign-in)
   - Register backend API application
5. Implement JWT validation middleware
6. Create health check and user profile endpoints
7. Set up Docker for local dev (docker-compose.yml with MongoDB)
8. Manual deployment to Azure Container Apps

**Critical Files:**
- `packages/backend/src/middleware/auth.middleware.ts`
- `packages/backend/src/config/auth.ts`
- `packages/backend/src/config/database.ts` (Cosmos DB connection)
- `packages/backend/src/models/user.model.ts` (Mongoose schemas)
- `docker-compose.yml`

**Deliverable:** API endpoint returning authenticated user profile

---

### Phase 2: Content Types API (2 weeks)
**Goal:** Core CMS functionality - define content models

**Tasks:**
1. Implement Content Types CRUD API
   - POST /api/v1/content-types
   - GET /api/v1/content-types
   - GET /api/v1/content-types/:id
   - PUT /api/v1/content-types/:id
   - DELETE /api/v1/content-types/:id
2. Define field types (Text, Rich Text, Number, Date, Boolean, Media, Relation)
3. Implement field validation with Zod schemas
4. Add Swagger/OpenAPI documentation
5. Write integration tests

**Critical Files:**
- `packages/backend/src/modules/content-types/content-types.service.ts`
- `packages/backend/src/modules/content-types/content-types.controller.ts`
- `packages/backend/src/modules/content-types/content-types.schema.ts`

**Deliverable:** Working Content Types API with validation

---

### Phase 3: Content Entries API (2 weeks)
**Goal:** Create and manage actual content

**Tasks:**
1. Implement Content Entries CRUD API
   - POST /api/v1/content-types/:typeId/entries
   - GET /api/v1/content-types/:typeId/entries (with filtering/pagination)
   - GET /api/v1/entries/:id
   - PUT /api/v1/entries/:id
   - DELETE /api/v1/entries/:id
   - PUT /api/v1/entries/:id/publish (status management)
2. Implement dynamic validation based on content type fields
3. Add filtering, sorting, pagination
4. Implement draft/publish workflow
5. Add full-text search (PostgreSQL tsvector)

**Critical Files:**
- `packages/backend/src/modules/content-entries/content-entries.service.ts`
- `packages/backend/src/modules/content-entries/content-entries.controller.ts`

**Deliverable:** Full CRUD for content with dynamic validation

---

### Phase 4: Media Management (2 weeks)
**Goal:** Handle file uploads and media library

**Tasks:**
1. Set up Azure Blob Storage
   - Create storage account
   - Configure containers (private upload, public serving)
   - Set up Azure CDN
2. Implement media upload API
   - POST /api/v1/media/upload (multipart)
   - Save metadata to PostgreSQL
3. Implement media library API
   - GET /api/v1/media (list with filters)
   - DELETE /api/v1/media/:id
4. Add image processing (Sharp)
   - Generate thumbnails
   - Create multiple sizes

**Critical Files:**
- `packages/backend/src/modules/media/media.service.ts`
- `packages/backend/src/config/azure.ts`

**Deliverable:** Full media management system

---

### Phase 5: Admin Dashboard - Foundation (2 weeks)
**Goal:** Basic admin UI with authentication

**Tasks:**
1. Initialize React + Vite + TypeScript project
2. Configure Azure AD B2C in React (MSAL)
3. Create layout, navigation, routing
4. Implement Content Types UI
   - List content types
   - Create/edit form with field builder
5. Set up React Query for API calls
6. Deploy to Azure Static Web Apps

**Critical Files:**
- `packages/admin-dashboard/src/config/msal.config.ts`
- `packages/admin-dashboard/src/api/client.ts`
- `packages/admin-dashboard/src/features/content-types/ContentTypeForm.tsx`
- `packages/admin-dashboard/staticwebapp.config.json`

**Deliverable:** Working admin UI for content types

---

### Phase 6: Admin Dashboard - Content & Media (2 weeks)
**Goal:** Complete admin UI

**Tasks:**
1. Implement Content Entries UI
   - List with filters/search
   - Dynamic form builder based on content type
   - Integrate rich text editor (TipTap)
   - Draft/publish controls
2. Implement Media Library UI
   - Grid view
   - Drag-drop upload
   - Media picker component
3. Make responsive

**Critical Files:**
- `packages/admin-dashboard/src/features/content-entries/ContentEntryForm.tsx`
- `packages/admin-dashboard/src/features/media/MediaLibrary.tsx`
- `packages/admin-dashboard/src/components/RichTextEditor.tsx`

**Deliverable:** Complete admin dashboard

---

### Phase 7: Consumer API & Multi-Site (1 week)
**Goal:** Allow consumer sites to fetch content

**Tasks:**
1. Implement Site management API
   - CRUD for sites
   - Generate API keys per site
2. Create public API endpoints
   - GET /api/v1/public/:siteId/content/:contentType
   - GET /api/v1/public/:siteId/content/:contentType/:id
   - API key authentication
3. Add rate limiting (express-rate-limit)
4. Add caching headers

**Critical Files:**
- `packages/backend/src/modules/sites/sites.service.ts`
- `packages/backend/src/middleware/api-key.middleware.ts`

**Deliverable:** Public API for consumer sites

---

### Phase 8: Production Readiness (2 weeks)
**Goal:** CI/CD, monitoring, optimization

**Tasks:**
1. Create Terraform modules for all Azure resources
2. Set up GitHub Actions workflows
   - Backend: Build → Test → Docker → Deploy
   - Admin: Build → Deploy to Static Web Apps
3. Configure Application Insights
4. Security hardening
   - CORS configuration
   - Rate limiting
   - Security headers (helmet.js)
5. Performance optimization
   - Database query optimization
   - Response compression
   - HTTP caching
6. Documentation

**Critical Files:**
- `infrastructure/terraform/main.tf`
- `.github/workflows/backend-ci-cd.yml`
- `.github/workflows/admin-dashboard-ci-cd.yml`

**Deliverable:** Production-ready system with automated deployments

---

## REST API Structure

**Base URL:** `https://<your-app>.azurecontainerapps.io/api/v1`

**Admin API** (requires JWT from Azure AD B2C):
```
POST   /api/v1/content-types
GET    /api/v1/content-types
GET    /api/v1/content-types/:id
PUT    /api/v1/content-types/:id
DELETE /api/v1/content-types/:id

POST   /api/v1/content-types/:typeId/entries
GET    /api/v1/content-types/:typeId/entries
GET    /api/v1/entries/:id
PUT    /api/v1/entries/:id
DELETE /api/v1/entries/:id
PUT    /api/v1/entries/:id/publish

POST   /api/v1/media/upload
GET    /api/v1/media
DELETE /api/v1/media/:id

POST   /api/v1/sites
GET    /api/v1/sites

GET    /api/v1/users/me
```

**Consumer API** (requires API key):
```
GET    /api/v1/public/:siteId/content-types
GET    /api/v1/public/:siteId/content/:contentType
GET    /api/v1/public/:siteId/content/:contentType/:id
```

## Initial Setup Steps

### 1. Azure Prerequisites
- Azure subscription (free tier eligible)
- Azure CLI installed
- Create Azure AD B2C tenant
- Note: Keep all resources in same region for performance

### 2. Local Development Setup
```bash
# Install pnpm
npm install -g pnpm

# Create monorepo structure
mkdir -p packages/backend packages/admin-dashboard infrastructure

# Initialize workspace
pnpm init

# Create pnpm-workspace.yaml
echo "packages:\n  - 'packages/*'" > pnpm-workspace.yaml

# Set up local PostgreSQL and Azure Storage emulator
# (docker-compose.yml provided in project structure)
```

### 3. Azure AD B2C Configuration
1. Create B2C tenant: portal.azure.com → Azure AD B2C
2. Create user flows:
   - Sign up and sign in
   - Password reset
3. Register applications:
   - Backend API (with scopes)
   - Admin Dashboard (SPA, redirect URIs)
4. Note down:
   - Tenant name
   - Client IDs
   - Policy names

### 4. Backend Initialization
```bash
cd packages/backend
pnpm init
pnpm add express mongoose
pnpm add -D typescript @types/node @types/express tsx
pnpm add @azure/msal-node @azure/storage-blob @sendgrid/mail
pnpm add zod helmet express-rate-limit

# Create tsconfig.json, Dockerfile
```

### 5. Database Setup
```bash
# Option A: Local development with MongoDB in Docker
docker-compose up -d mongodb

# Option B: Connect directly to Cosmos DB (recommended)
# Set MONGODB_URI in .env to Cosmos DB connection string

# Create indexes
node scripts/create-indexes.js
```

## Security Considerations

1. **Authentication:**
   - Azure AD B2C handles user management (MFA support)
   - JWT validation on all admin endpoints
   - API keys for consumer API (per-site)

2. **Authorization:**
   - Role-based access: Admin, Editor, Viewer
   - Content ownership tracking

3. **Input Validation:**
   - Zod schemas on all inputs
   - Sanitize HTML in rich text (DOMPurify)
   - File upload validation (type, size, magic bytes)

4. **API Protection:**
   - Rate limiting (100 req/min admin, 1000 req/hr consumer)
   - CORS configuration
   - Security headers (helmet.js)

5. **Data Protection:**
   - TLS 1.2+ enforced
   - Secrets in Azure Key Vault
   - Managed identities for Azure services

## Cost Management

### Free Tier Limits (All Permanent)
- Container Apps: 180k vCPU-sec/mo (≈ 50 hours)
- Cosmos DB: 1000 RU/s + 25GB storage (forever!)
- Static Web Apps: 100GB bandwidth/mo
- Blob Storage: 5GB free
- Azure AD B2C: 50k MAU

### Monitoring Costs
Set up Azure Cost Management alerts:
- Daily budget: $0.50
- Monthly budget: $5.00

### Optimization Tips
1. Enable compression (gzip)
2. Use Azure CDN for media
3. Implement HTTP caching
4. Container Apps: min instances = 0 (scale to zero)
5. Optimize images on upload (Sharp)

## Verification & Testing

### End-to-End Test Flow

**Phase 1-4 Verification (Backend):**
```bash
# 1. Authentication
curl -X GET https://<api-url>/api/v1/users/me \
  -H "Authorization: Bearer <jwt-token>"

# 2. Create content type
curl -X POST https://<api-url>/api/v1/content-types \
  -H "Authorization: Bearer <jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Blog Post",
    "slug": "blog-post",
    "fields": [
      {"name": "title", "type": "TEXT", "required": true},
      {"name": "body", "type": "RICH_TEXT", "required": true}
    ]
  }'

# 3. Create content entry
curl -X POST https://<api-url>/api/v1/content-types/<type-id>/entries \
  -H "Authorization: Bearer <jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "title": "My First Post",
      "body": "<p>Hello World</p>"
    },
    "status": "DRAFT"
  }'

# 4. Upload media
curl -X POST https://<api-url>/api/v1/media/upload \
  -H "Authorization: Bearer <jwt-token>" \
  -F "file=@test-image.jpg"
```

**Phase 5-6 Verification (Admin UI):**
1. Navigate to admin dashboard URL
2. Log in with Azure AD B2C
3. Create a content type with 3 fields
4. Create 2 content entries (1 draft, 1 published)
5. Upload 2 images to media library
6. Edit content entry, add media, publish

**Phase 7 Verification (Consumer API):**
```bash
# Create site and get API key
curl -X POST https://<api-url>/api/v1/sites \
  -H "Authorization: Bearer <jwt-token>" \
  -d '{"name": "My Site", "domain": "example.com"}'

# Fetch content with API key
curl -X GET https://<api-url>/api/v1/public/<site-id>/content/blog-post \
  -H "X-API-Key: <api-key>"
```

**Phase 8 Verification (CI/CD):**
1. Push code to main branch
2. Verify GitHub Actions workflow runs successfully
3. Check deployment in Azure Portal
4. Verify Application Insights telemetry
5. Test auto-scaling (load test with k6 or Artillery)

### Automated Tests
```bash
# Unit tests
pnpm --filter backend test

# Integration tests
pnpm --filter backend test:integration

# E2E tests (admin UI)
pnpm --filter admin-dashboard test:e2e
```

## Success Criteria

- ✅ Admin can create content types with custom fields
- ✅ Admin can create, edit, publish content entries
- ✅ Media uploads work, files served via CDN
- ✅ Consumer sites can fetch content via API
- ✅ API response time p95 < 500ms
- ✅ Authentication works (Azure AD B2C)
- ✅ Cost stays under $5/month (year 1)
- ✅ CI/CD deploys automatically
- ✅ Application monitoring active

## Next Steps After MVP

1. **GraphQL API** (for flexible querying)
2. **Content versioning** (track changes, revert)
3. **Webhooks** (notify on publish)
4. **Multi-language support** (i18n)
5. **Advanced permissions** (granular RBAC)
6. **Scheduled publishing** (Azure Functions timer)
7. **Full-text search** (Azure Cognitive Search)

## Critical Files Summary

Must implement in order:

1. **prisma/schema.prisma** - Data model foundation
2. **src/middleware/auth.middleware.ts** - Security layer
3. **src/modules/content-types/content-types.service.ts** - Core logic
4. **admin-dashboard/src/config/msal.config.ts** - Frontend auth
5. **infrastructure/terraform/main.tf** - Infrastructure deployment

## Resources & Documentation

- [Azure Container Apps Docs](https://learn.microsoft.com/en-us/azure/container-apps/)
- [Azure AD B2C Setup Guide](https://learn.microsoft.com/en-us/azure/active-directory-b2c/)
- [Prisma Documentation](https://www.prisma.io/docs)
- [MSAL.js Documentation](https://github.com/AzureAD/microsoft-authentication-library-for-js)
- [Azure Static Web Apps Docs](https://learn.microsoft.com/en-us/azure/static-web-apps/)

---

**Estimated Timeline:** 14-16 weeks for full MVP
**Estimated Cost (Ongoing):** $0-5/month permanently

## Database Choice Comparison

| Option | Cost After 1 Year | Pros | Cons |
|--------|------------------|------|------|
| **Cosmos DB (MongoDB API)** ⭐ | $0 forever | Permanent free tier, 25GB storage, full MongoDB features, 1000 RU/s | Need to monitor RU consumption |
| **PostgreSQL Flexible** | $12-15/month | Familiar SQL, Prisma ORM | Costs money after 12 months |
| **MongoDB Atlas M0** | $0 forever | Full MongoDB, good tooling | Only 512MB storage |
| **Azure Table Storage** | ~$0.50/month | Extremely cheap | Very limited querying, no joins, no full-text search |

**Recommendation: Cosmos DB (MongoDB API)** - Best balance of features and permanent free tier.
