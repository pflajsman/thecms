# TheCMS - Headless CMS on Azure

A cost-effective headless CMS built with Node.js, TypeScript, and hosted on Azure using free tiers.

## Architecture

- **Backend API**: Node.js + Express + TypeScript
- **Database**: Azure Cosmos DB (MongoDB API) - Free tier
- **Authentication**: Azure AD B2C
- **Media Storage**: Azure Blob Storage + CDN
- **Admin Dashboard**: React + Vite + TypeScript, Tailwind CSS and shadcn/ui (Radix), TanStack Query, TipTap
- **Hosting**: Azure Container Apps + Static Web Apps

## Cost Estimate

**$0-5/month permanently** using Azure free tiers:
- Cosmos DB: Free (1000 RU/s + 25GB)
- Container Apps: Free (180k vCPU-sec/mo)
- Static Web Apps: Free (100GB bandwidth)
- Blob Storage: Free (5GB)
- Azure AD B2C: Free (50k MAU)

## Project Structure

```
TheCMS/
├── packages/
│   ├── backend/          # Node.js API server
│   └── admin-dashboard/  # React admin UI
├── infrastructure/       # Pulumi IaC (TypeScript)
├── IMPLEMENTATION_PLAN.md
└── PROJECT_PROGRESS.md
```

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 8+
- Azure account (free tier eligible)
- Docker (for local development)

### Installation

```bash
# Install dependencies
pnpm install

# Start local development
pnpm dev
```

## Development Phases

- ✅ Phase 0: Planning Complete
- 🚧 Phase 1: Foundation & Authentication (65% - Azure setup pending)
- ✅ Phase 2: Content Types API
- ✅ Phase 3: Content Entries API
- ✅ Phase 4: Media Management
- ✅ Phase 5: Admin Dashboard - Foundation
- ✅ Phase 6: Admin Dashboard - Content & Media
- ✅ Phase 7: Consumer API & Multi-Site
- ✅ Phase 8: Webhooks & Events
- ⏳ Phase 9: Production Readiness (Testing + Deployment)

See [PROJECT_PROGRESS.md](./PROJECT_PROGRESS.md) for detailed task checklist.

## Documentation

- [Implementation Plan](./IMPLEMENTATION_PLAN.md) - Complete architectural plan
- [Project Progress](./PROJECT_PROGRESS.md) - Detailed task checklist

## License

MIT
