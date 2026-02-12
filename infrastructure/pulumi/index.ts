import * as pulumi from "@pulumi/pulumi";
import { createResourceGroup } from "./resources/resourceGroup";
import { createCosmosDb } from "./resources/database";
import { createStorage } from "./resources/storage";
import { createContainerApp } from "./resources/containerApps";
import { createStaticWebApp } from "./resources/staticWebApp";
import { createApplicationInsights } from "./resources/monitoring";

// Get configuration
const config = new pulumi.Config();
const environment = pulumi.getStack(); // dev, staging, prod
const location = config.get("location") || "westeurope";
const projectName = "thecms";

// Resource naming convention: {projectName}-{resourceType}-{environment}
const resourcePrefix = `${projectName}-${environment}`;

// GitHub Container Registry config (set via: pulumi config set ghcr:token <PAT> --secret)
const ghcrConfig = new pulumi.Config("ghcr");
const ghcrUsername = ghcrConfig.get("username") || "";
const ghcrToken = ghcrConfig.get("token") || "";
const ghcrImage = ghcrConfig.get("image") || "";

// 1. Create Resource Group
const resourceGroup = createResourceGroup({
  name: `${resourcePrefix}-rg`,
  location,
});

// 2. Create Cosmos DB (MongoDB API) - Permanent Free Tier
const cosmosDb = createCosmosDb({
  resourceGroupName: resourceGroup.name,
  location,
  accountName: `${resourcePrefix}-cosmos`,
});

// 3. Create Storage Account for Media
const storage = createStorage({
  resourceGroupName: resourceGroup.name,
  location,
  accountName: `${resourcePrefix.replace(/-/g, "")}sa`, // Storage accounts can't have dashes
});

// 4. Create Application Insights for Monitoring
const appInsights = createApplicationInsights({
  resourceGroupName: resourceGroup.name,
  location,
  name: `${resourcePrefix}-appinsights`,
});

// 5. Create Static Web App for Admin Dashboard
const staticWebApp = createStaticWebApp({
  resourceGroupName: resourceGroup.name,
  location,
  name: `${resourcePrefix}-admin`,
  apiUrl: pulumi.output(""), // Will be updated after container app is created
});

// 6. Create Container App Environment and Backend API
const containerApp = createContainerApp({
  resourceGroupName: resourceGroup.name,
  location,
  environmentName: `${resourcePrefix}-env`,
  appName: `${resourcePrefix}-api`,
  cosmosConnectionString: cosmosDb.connectionString,
  storageConnectionString: storage.connectionString,
  appInsightsConnectionString: appInsights.connectionString,
  workspaceId: appInsights.workspaceId,
  workspaceSharedKey: appInsights.workspaceSharedKey,
  staticWebAppUrl: staticWebApp.url,
  // GitHub Container Registry (ghcr.io) - free
  ...(ghcrToken
    ? {
        registryServer: "ghcr.io",
        registryUsername: ghcrUsername,
        registryPassword: ghcrToken,
        containerImage: ghcrImage,
      }
    : {}),
});


// Export outputs
export const resourceGroupName = resourceGroup.name;
export const cosmosDbEndpoint = cosmosDb.endpoint;
export const cosmosDbConnectionString = cosmosDb.connectionString;
export const storageAccountName = storage.accountName;
export const storageBlobEndpoint = storage.blobEndpoint;
export const storageConnectionString = storage.connectionString;
export const containerAppUrl = containerApp.url;
export const staticWebAppUrl = staticWebApp.url;
export const staticWebAppDeploymentToken = staticWebApp.deploymentToken;
export const appInsightsInstrumentationKey = appInsights.instrumentationKey;
export const appInsightsConnectionString = appInsights.connectionString;
