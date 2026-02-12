import * as pulumi from "@pulumi/pulumi";
import * as azure from "@pulumi/azure-native";
import * as operationalinsights from "@pulumi/azure-native/operationalinsights";

export interface ApplicationInsightsArgs {
  resourceGroupName: pulumi.Input<string>;
  location: string;
  name: string;
}

export function createApplicationInsights(args: ApplicationInsightsArgs) {
  // Create Log Analytics Workspace (required for Application Insights)
  const workspace = new operationalinsights.Workspace(`${args.name}-workspace`, {
    workspaceName: `${args.name}-workspace`,
    resourceGroupName: args.resourceGroupName,
    location: args.location,

    // Free tier (5GB/month)
    sku: {
      name: "PerGB2018", // Pay-as-you-go, but includes 5GB free
    },

    retentionInDays: 30, // Free tier supports up to 30 days

    tags: {
      Project: "TheCMS",
      Environment: pulumi.getStack(),
    },
  });

  // Create Application Insights
  const appInsights = new azure.applicationinsights.Component(args.name, {
    resourceName: args.name,
    resourceGroupName: args.resourceGroupName,
    location: args.location,

    kind: "web",
    applicationType: "web",

    // Link to Log Analytics Workspace
    workspaceResourceId: workspace.id,

    // Sampling percentage (100 = no sampling, useful for low traffic)
    samplingPercentage: 100,

    tags: {
      Project: "TheCMS",
      Environment: pulumi.getStack(),
    },
  });

  // Get workspace shared keys for Container Apps log analytics integration
  const workspaceSharedKeys = pulumi
    .all([args.resourceGroupName, workspace.name])
    .apply(([rgName, wsName]) =>
      operationalinsights.getSharedKeys({
        resourceGroupName: rgName,
        workspaceName: wsName,
      })
    );

  return {
    workspace,
    appInsights,
    instrumentationKey: appInsights.instrumentationKey,
    connectionString: appInsights.connectionString,
    workspaceId: workspace.customerId,
    workspaceSharedKey: workspaceSharedKeys.apply((keys) => keys.primarySharedKey!),
  };
}
