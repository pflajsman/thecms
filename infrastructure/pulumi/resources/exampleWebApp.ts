import * as pulumi from "@pulumi/pulumi";
import * as web from "@pulumi/azure-native/web";

export interface ExampleWebAppArgs {
  resourceGroupName: pulumi.Input<string>;
  location: string;
  name: string;
}

export function createExampleWebApp(args: ExampleWebAppArgs) {
  const staticWebApp = new web.StaticSite(args.name, {
    name: args.name,
    resourceGroupName: args.resourceGroupName,

    sku: {
      name: "Free",
      tier: "Free",
    },

    location: args.location,

    buildProperties: {
      appLocation: "/",
      apiLocation: "",
      outputLocation: "",
    },

    tags: {
      Project: "TheCMS",
      Environment: pulumi.getStack(),
    },
  });

  const appUrl = staticWebApp.defaultHostname.apply(
    (hostname) => `https://${hostname}`
  );

  // Include staticWebApp.id to ensure the resource is created before listing secrets
  const apiKey = pulumi
    .all([args.resourceGroupName, staticWebApp.name, staticWebApp.id])
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
