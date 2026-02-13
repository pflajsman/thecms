import * as pulumi from "@pulumi/pulumi";
import * as app from "@pulumi/azure-native/app";
import { types } from "@pulumi/azure-native";

export interface ContainerAppArgs {
  resourceGroupName: pulumi.Input<string>;
  location: string;
  environmentName: string;
  appName: string;
  cosmosConnectionString: pulumi.Output<string>;
  storageConnectionString: pulumi.Output<string>;
  appInsightsConnectionString: pulumi.Output<string>;
  workspaceId: pulumi.Output<string>;
  workspaceSharedKey: pulumi.Output<string>;
  staticWebAppUrl?: pulumi.Output<string>;
  exampleWebAppUrl?: pulumi.Output<string>;

  // Container Registry (ghcr.io)
  registryServer?: string;
  registryUsername?: string;
  registryPassword?: pulumi.Input<string>;
  containerImage?: string;
}

export function createContainerApp(args: ContainerAppArgs) {
  const config = new pulumi.Config();

  // Determine the container image
  const containerImage = args.containerImage
    || config.get("containerImage")
    || "mcr.microsoft.com/azuredocs/containerapps-helloworld:latest";

  // Entra External ID config (set via Pulumi config or defaults)
  const entraConfig = new pulumi.Config("entra");
  const entraTenantName = entraConfig.get("tenantName") || "";
  const entraTenantId = entraConfig.get("tenantId") || "";
  const entraClientId = entraConfig.get("clientId") || "";

  // Create Container Apps Environment (Managed Environment)
  const environment = new app.ManagedEnvironment(args.environmentName, {
    environmentName: args.environmentName,
    resourceGroupName: args.resourceGroupName,
    location: args.location,

    // App Logs Configuration
    appLogsConfiguration: {
      destination: "log-analytics",
      logAnalyticsConfiguration: {
        customerId: args.workspaceId,
        sharedKey: args.workspaceSharedKey,
      },
    },

    tags: {
      Project: "TheCMS",
      Environment: pulumi.getStack(),
    },
  });

  // Build secrets array
  const secrets: types.input.app.SecretArgs[] = [
    {
      name: "mongodb-uri",
      value: args.cosmosConnectionString,
    },
    {
      name: "storage-connection-string",
      value: args.storageConnectionString,
    },
    {
      name: "appinsights-connection-string",
      value: args.appInsightsConnectionString,
    },
  ];

  // Add registry password as secret if configured
  if (args.registryPassword) {
    secrets.push({
      name: "registry-password",
      value: args.registryPassword,
    });
  }

  // Build registries config for ghcr.io
  const registries = args.registryServer
    ? [
        {
          server: args.registryServer,
          username: args.registryUsername,
          passwordSecretRef: "registry-password",
        },
      ]
    : undefined;

  // Create Container App for Backend API
  const containerApp = new app.ContainerApp(args.appName, {
    containerAppName: args.appName,
    resourceGroupName: args.resourceGroupName,
    location: args.location,
    managedEnvironmentId: environment.id,

    configuration: {
      // Ingress configuration
      ingress: {
        external: true,
        targetPort: 3000,
        transport: "auto",
        allowInsecure: false,
        traffic: [
          {
            latestRevision: true,
            weight: 100,
          },
        ],
      },

      // Container registry
      registries,

      // Secrets
      secrets,
    },

    template: {
      // Container configuration
      containers: [
        {
          name: "thecms-api",
          image: containerImage,
          resources: {
            cpu: 0.25,
            memory: "0.5Gi",
          },
          env: [
            {
              name: "NODE_ENV",
              value: "production",
            },
            {
              name: "PORT",
              value: "3000",
            },
            {
              name: "MONGODB_URI",
              secretRef: "mongodb-uri",
            },
            {
              name: "AZURE_STORAGE_CONNECTION_STRING",
              secretRef: "storage-connection-string",
            },
            {
              name: "AZURE_STORAGE_CONTAINER_NAME",
              value: "media",
            },
            {
              name: "APPLICATIONINSIGHTS_CONNECTION_STRING",
              secretRef: "appinsights-connection-string",
            },
            // Microsoft Entra External ID
            {
              name: "AZURE_ENTRA_TENANT_NAME",
              value: entraTenantName,
            },
            {
              name: "AZURE_ENTRA_TENANT_ID",
              value: entraTenantId,
            },
            {
              name: "AZURE_ENTRA_CLIENT_ID",
              value: entraClientId,
            },
            {
              name: "CORS_ORIGINS",
              value:
                args.staticWebAppUrl || args.exampleWebAppUrl
                  ? pulumi
                      .all([
                        args.staticWebAppUrl ?? pulumi.output(""),
                        args.exampleWebAppUrl ?? pulumi.output(""),
                      ])
                      .apply(([adminUrl, exampleUrl]) =>
                        [adminUrl, exampleUrl].filter(Boolean).join(",")
                      )
                  : "https://localhost:5174",
            },
          ],
        },
      ],

      // Scale configuration (free tier)
      scale: {
        minReplicas: 0,
        maxReplicas: 1,
        rules: [
          {
            name: "http-rule",
            http: {
              metadata: {
                concurrentRequests: "10",
              },
            },
          },
        ],
      },
    },

    tags: {
      Project: "TheCMS",
      Environment: pulumi.getStack(),
    },
  });

  // Get the Container App URL
  const appUrl = containerApp.configuration.apply(
    (config) => `https://${config?.ingress?.fqdn || ""}`
  );

  return {
    environment,
    app: containerApp,
    url: appUrl,
  };
}
