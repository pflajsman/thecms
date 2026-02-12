import * as pulumi from "@pulumi/pulumi";
import * as azure from "@pulumi/azure-native";

export interface CosmosDbArgs {
  resourceGroupName: pulumi.Input<string>;
  location: string;
  accountName: string;
}

export function createCosmosDb(args: CosmosDbArgs) {
  // Create Cosmos DB account with MongoDB API
  const cosmosAccount = new azure.cosmosdb.DatabaseAccount(args.accountName, {
    accountName: args.accountName,
    resourceGroupName: args.resourceGroupName,
    location: args.location,
    databaseAccountOfferType: azure.cosmosdb.DatabaseAccountOfferType.Standard,
    // MongoDB API
    kind: azure.cosmosdb.DatabaseAccountKind.MongoDB,

    // Enable Free Tier (permanent 1000 RU/s + 25GB)
    enableFreeTier: true,

    // Consistency level
    consistencyPolicy: {
      defaultConsistencyLevel: azure.cosmosdb.DefaultConsistencyLevel.Session,
    },

    // Single region for free tier
    locations: [
      {
        locationName: args.location,
        failoverPriority: 0,
        isZoneRedundant: false,
      },
    ],

    // Capabilities for MongoDB API
    capabilities: [
      { name: "EnableMongo" },
      { name: "DisableRateLimitingResponses" }, // Better for free tier
    ],

    // Public network access
    publicNetworkAccess: azure.cosmosdb.PublicNetworkAccess.Enabled,

    // Backup policy
    backupPolicy: {
      type: azure.cosmosdb.BackupPolicyType.Periodic,
      periodicModeProperties: {
        backupIntervalInMinutes: 240,
        backupRetentionIntervalInHours: 8,
      },
    },

    tags: {
      Project: "TheCMS",
      Environment: pulumi.getStack(),
    },
  });

  // Get connection strings
  const connectionStrings = pulumi
    .all([args.resourceGroupName, cosmosAccount.name])
    .apply(([rgName, accountName]) =>
      azure.cosmosdb.listDatabaseAccountConnectionStrings({
        resourceGroupName: rgName,
        accountName: accountName,
      })
    );

  const primaryConnectionString = connectionStrings.apply(
    (cs) => cs.connectionStrings![0].connectionString!
  );

  return {
    account: cosmosAccount,
    endpoint: cosmosAccount.documentEndpoint,
    connectionString: primaryConnectionString,
  };
}
