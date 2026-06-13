import * as pulumi from "@pulumi/pulumi";
import * as storage from "@pulumi/azure-native/storage";

export interface StorageArgs {
  resourceGroupName: pulumi.Input<string>;
  location: string;
  accountName: string;
  /**
   * Origins allowed to fetch blobs from the browser (CORS). Needed because the
   * blog reads .gpx files via fetch(), which is subject to CORS. Defaults to
   * "*" if not provided (read-only GET, so low risk for public media).
   */
  corsAllowedOrigins?: string[];
}

export function createStorage(args: StorageArgs) {
  // Create Storage Account
  const storageAccount = new storage.StorageAccount(args.accountName, {
    accountName: args.accountName,
    resourceGroupName: args.resourceGroupName,
    location: args.location,

    // Standard LRS for free tier (5GB free)
    sku: {
      name: storage.SkuName.Standard_LRS,
    },

    kind: storage.Kind.StorageV2,

    // Enable blob public access for media
    allowBlobPublicAccess: true,

    // Enable HTTPS only
    enableHttpsTrafficOnly: true,

    // Minimum TLS version
    minimumTlsVersion: storage.MinimumTlsVersion.TLS1_2,

    tags: {
      Project: "TheCMS",
      Environment: pulumi.getStack(),
    },
  });

  // Configure CORS on the Blob service so browsers can fetch() media files
  // (e.g. the blog reads .gpx tracks via fetch, which requires CORS headers).
  // Public media is read-only, so we only allow GET/HEAD.
  const corsOrigins = args.corsAllowedOrigins && args.corsAllowedOrigins.length > 0
    ? args.corsAllowedOrigins
    : ["*"];

  new storage.BlobServiceProperties("blobCors", {
    accountName: storageAccount.name,
    resourceGroupName: args.resourceGroupName,
    blobServicesName: "default",
    cors: {
      corsRules: [
        {
          allowedOrigins: corsOrigins,
          allowedMethods: ["GET", "HEAD", "OPTIONS"],
          allowedHeaders: ["*"],
          exposedHeaders: ["*"],
          maxAgeInSeconds: 3600,
        },
      ],
    },
  });

  // Create blob container for media files
  const mediaContainer = new storage.BlobContainer("media", {
    containerName: "media",
    accountName: storageAccount.name,
    resourceGroupName: args.resourceGroupName,
    publicAccess: storage.PublicAccess.Blob, // Public read access for blobs
  });

  // Get storage account keys
  const storageAccountKeys = pulumi
    .all([args.resourceGroupName, storageAccount.name])
    .apply(([rgName, accountName]) =>
      storage.listStorageAccountKeys({
        resourceGroupName: rgName,
        accountName: accountName,
      })
    );

  const primaryKey = storageAccountKeys.apply((keys) => keys.keys[0].value);

  // Build connection string
  const connectionString = pulumi.interpolate`DefaultEndpointsProtocol=https;AccountName=${storageAccount.name};AccountKey=${primaryKey};EndpointSuffix=core.windows.net`;

  return {
    account: storageAccount,
    accountName: storageAccount.name,
    blobEndpoint: storageAccount.primaryEndpoints.apply((e) => e?.blob || ""),
    connectionString: connectionString,
    mediaContainer: mediaContainer,
  };
}
