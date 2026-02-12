import * as pulumi from "@pulumi/pulumi";
import * as resources from "@pulumi/azure-native/resources";

export interface ResourceGroupArgs {
  name: string;
  location: string;
  tags?: { [key: string]: string };
}

export function createResourceGroup(args: ResourceGroupArgs) {
  const resourceGroup = new resources.ResourceGroup(args.name, {
    resourceGroupName: args.name,
    location: args.location,
    tags: {
      Project: "TheCMS",
      Environment: pulumi.getStack(),
      ManagedBy: "Pulumi",
      ...args.tags,
    },
  });

  return resourceGroup;
}
