import * as pulumi from "@pulumi/pulumi";
import * as web from "@pulumi/azure-native/web";

export interface StaticWebAppArgs {
  resourceGroupName: pulumi.Input<string>;
  location: string;
  name: string;
  apiUrl: pulumi.Output<string>;
}

export function createStaticWebApp(args: StaticWebAppArgs) {
  const config = new pulumi.Config();
  const repositoryUrl = config.get("repositoryUrl") || "";

  // Create Static Web App for Admin Dashboard
  const staticWebApp = new web.StaticSite(args.name, {
    name: args.name,
    resourceGroupName: args.resourceGroupName,

    // Free tier
    sku: {
      name: "Free",
      tier: "Free",
    },

    // Static Web Apps support westeurope
    location: args.location,

    // Build properties
    buildProperties: {
      appLocation: "/", // Root of the app
      apiLocation: "", // No built-in API (we use Container Apps)
      outputLocation: "dist", // Vite build output
    },

    // Repository configuration (optional, can be configured via GitHub Actions)
    ...(repositoryUrl ? { repositoryUrl, branch: "main" } : {}),

    tags: {
      Project: "TheCMS",
      Environment: pulumi.getStack(),
    },
  });

  // Get the Static Web App URL
  const appUrl = staticWebApp.defaultHostname.apply((hostname) => `https://${hostname}`);

  // Get the deployment token for GitHub Actions
  const apiKey = pulumi
    .all([args.resourceGroupName, staticWebApp.name])
    .apply(([rgName, siteName]) =>
      web.listStaticSiteSecrets({
        resourceGroupName: rgName,
        name: siteName,
      })
    )
    .apply((secrets) => secrets.properties?.apiKey || "");

  return {
    staticSite: staticWebApp,
    url: appUrl,
    deploymentToken: apiKey,
  };
}
