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

  // Create MongoDB database with shared throughput (1000 RU/s shared across all collections)
  // This avoids the 400 RU/s minimum per collection which would exceed free tier with 6 collections
  const mongoDatabase = new azure.cosmosdb.MongoDBResourceMongoDBDatabase("thecms-db", {
    accountName: cosmosAccount.name,
    resourceGroupName: args.resourceGroupName,
    databaseName: "thecms",
    resource: {
      id: "thecms",
    },
    options: {
      throughput: 1000, // Shared across all collections — fits in free tier
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

  // Append database name to connection string so Mongoose uses the shared-throughput database
  // Cosmos DB connection strings don't include a database name by default,
  // which would cause collections to be created in "test" db with individual 400 RU/s each
  const primaryConnectionString = connectionStrings.apply((cs) => {
    const raw = cs.connectionStrings![0].connectionString!;
    // Insert /thecms before the query string: ...azure.com:10255/?ssl=... → ...azure.com:10255/thecms?ssl=...
    return raw.replace(/\/\?/, "/thecms?");
  });

  return {
    account: cosmosAccount,
    database: mongoDatabase,
    endpoint: cosmosAccount.documentEndpoint,
    connectionString: primaryConnectionString,
  };
}
