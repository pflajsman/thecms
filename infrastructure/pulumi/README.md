# TheCMS Infrastructure - Pulumi

This directory contains the Infrastructure as Code (IaC) for TheCMS using Pulumi with TypeScript.

## Overview

The infrastructure includes:
- **Resource Group**: Container for all Azure resources
- **Cosmos DB**: MongoDB API with permanent free tier (1000 RU/s + 25GB)
- **Storage Account**: Blob storage for media files (5GB free)
- **Container Apps**: Backend API hosting (180k vCPU-sec/month free)
- **Static Web App**: Admin dashboard hosting (100GB bandwidth free)
- **Application Insights**: Monitoring and logging (5GB/month free)

**Estimated Cost**: $0-5/month permanently

## Prerequisites

1. **Azure CLI**: Install from https://docs.microsoft.com/en-us/cli/azure/install-azure-cli
   ```bash
   az login
   ```

2. **Pulumi CLI**: Install from https://www.pulumi.com/docs/get-started/install/
   ```bash
   # Windows (using Chocolatey)
   choco install pulumi

   # macOS
   brew install pulumi

   # Linux
   curl -fsSL https://get.pulumi.com | sh
   ```

3. **Node.js 18+** and **pnpm**

## Setup

1. **Install dependencies**:
   ```bash
   cd infrastructure/pulumi
   pnpm install
   ```

2. **Login to Pulumi** (using local state):
   ```bash
   pulumi login --local
   ```

   Or login to Pulumi Cloud (free for individuals):
   ```bash
   pulumi login
   ```

3. **Initialize stack**:
   ```bash
   # For local backend with passphrase
   echo "your-passphrase-here" > .pulumi.passphrase
   export PULUMI_CONFIG_PASSPHRASE_FILE=.pulumi.passphrase
   pulumi stack init dev

   # Or without passphrase (Pulumi Cloud)
   pulumi stack init dev
   ```

4. **Configure Azure location** (optional):
   ```bash
   pulumi config set azure-native:location eastus
   pulumi config set thecms-infrastructure:location eastus
   ```

## Deployment

### Preview changes
```bash
pulumi preview
```

### Deploy infrastructure
```bash
pulumi up
```

This will create:
- Resource Group: `thecms-dev-rg`
- Cosmos DB: `thecms-dev-cosmos`
- Storage Account: `thecmsdevsa`
- Container App: `thecms-dev-api`
- Static Web App: `thecms-dev-admin`
- Application Insights: `thecms-dev-appinsights`

### View outputs
```bash
pulumi stack output
```

Key outputs:
- `containerAppUrl`: Backend API endpoint
- `staticWebAppUrl`: Admin dashboard URL
- `cosmosDbConnectionString`: Database connection string (secret)
- `storageConnectionString`: Storage connection string (secret)

## Stacks (Environments)

Create different stacks for different environments:

```bash
# Development
pulumi stack init dev
pulumi config set azure-native:location eastus
pulumi up

# Staging
pulumi stack init staging
pulumi config set azure-native:location westus
pulumi up

# Production
pulumi stack init prod
pulumi config set azure-native:location eastus2
pulumi up
```

Switch between stacks:
```bash
pulumi stack select dev
```

## Updating Infrastructure

1. Modify TypeScript files in `resources/`
2. Preview changes: `pulumi preview`
3. Apply changes: `pulumi up`

## Destroying Infrastructure

**⚠️ Warning**: This will delete all resources and data!

```bash
pulumi destroy
```

## Project Structure

```
infrastructure/pulumi/
├── index.ts                      # Main entry point
├── Pulumi.yaml                   # Project configuration
├── Pulumi.dev.yaml              # Dev stack configuration
├── package.json                  # Node.js dependencies
├── tsconfig.json                 # TypeScript configuration
├── .pulumi.passphrase           # Passphrase file (gitignored)
└── resources/
    ├── resourceGroup.ts         # Azure Resource Group
    ├── database.ts              # Cosmos DB (MongoDB API)
    ├── storage.ts               # Storage Account + Blob Container
    ├── containerApps.ts         # Container App + Environment
    ├── staticWebApp.ts          # Static Web App
    └── monitoring.ts            # Application Insights + Log Analytics
```

## Configuration Secrets

Sensitive configuration (connection strings, keys) are automatically encrypted by Pulumi.

View secrets:
```bash
pulumi stack output cosmosDbConnectionString --show-secrets
pulumi stack output storageConnectionString --show-secrets
```

## CI/CD Integration

For GitHub Actions, you'll need:
1. Pulumi access token: `pulumi login && pulumi org get-token`
2. Azure service principal credentials

See `.github/workflows/` for CI/CD pipeline examples.

## Cost Optimization

All services are configured to use free tiers:
- Cosmos DB: Permanent free tier enabled
- Storage: Standard LRS (cheapest)
- Container Apps: Scale to zero when idle
- Static Web App: Free tier
- Application Insights: 5GB/month free

**Expected cost**: $0/month for low traffic (<10k requests/month)

## Troubleshooting

### "passphrase must be set" error
Set passphrase environment variable:
```bash
export PULUMI_CONFIG_PASSPHRASE_FILE=.pulumi.passphrase
```

### Azure authentication issues
```bash
az login
az account show
```

### Resource naming conflicts
Resource names must be globally unique. Modify `projectName` in `index.ts`.

## Resources

- [Pulumi Azure Native Provider](https://www.pulumi.com/registry/packages/azure-native/)
- [Azure Free Tier](https://azure.microsoft.com/en-us/pricing/free-services/)
- [Cosmos DB Free Tier](https://docs.microsoft.com/en-us/azure/cosmos-db/free-tier)
