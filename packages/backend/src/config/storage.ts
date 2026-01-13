import { BlobServiceClient, ContainerClient } from '@azure/storage-blob';

/**
 * Storage configuration
 */
export interface StorageConfig {
  connectionString: string;
  containerName: string;
  cdnUrl?: string;
}

/**
 * Get storage configuration from environment
 */
export function getStorageConfig(): StorageConfig {
  const connectionString =
    process.env.AZURE_STORAGE_CONNECTION_STRING ||
    'DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;BlobEndpoint=http://127.0.0.1:10000/devstoreaccount1;';

  const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME || 'media';
  const cdnUrl = process.env.AZURE_CDN_URL;

  return {
    connectionString,
    containerName,
    cdnUrl,
  };
}

/**
 * Azure Blob Storage client singleton
 */
class StorageService {
  private blobServiceClient: BlobServiceClient | null = null;
  private containerClient: ContainerClient | null = null;
  private config: StorageConfig;

  constructor() {
    this.config = getStorageConfig();
  }

  /**
   * Initialize blob service client
   */
  async initialize(): Promise<void> {
    try {
      // Create BlobServiceClient from connection string
      this.blobServiceClient = BlobServiceClient.fromConnectionString(
        this.config.connectionString
      );

      // Get container client
      this.containerClient = this.blobServiceClient.getContainerClient(this.config.containerName);

      // Create container if it doesn't exist
      const exists = await this.containerClient.exists();
      if (!exists) {
        await this.containerClient.create({
          access: 'blob', // Public read access for blobs
        });
        console.log(`✅ Created blob container: ${this.config.containerName}`);
      } else {
        console.log(`✅ Blob container already exists: ${this.config.containerName}`);
      }
    } catch (error) {
      console.error('❌ Failed to initialize Azure Blob Storage:', error);
      throw error;
    }
  }

  /**
   * Get container client
   */
  getContainerClient(): ContainerClient {
    if (!this.containerClient) {
      throw new Error('Storage service not initialized. Call initialize() first.');
    }
    return this.containerClient;
  }

  /**
   * Upload a file to blob storage
   */
  async uploadFile(
    filename: string,
    buffer: Buffer,
    mimeType: string
  ): Promise<{ url: string; cdnUrl?: string }> {
    const containerClient = this.getContainerClient();
    const blockBlobClient = containerClient.getBlockBlobClient(filename);

    await blockBlobClient.upload(buffer, buffer.length, {
      blobHTTPHeaders: {
        blobContentType: mimeType,
      },
    });

    const url = blockBlobClient.url;
    const cdnUrl = this.config.cdnUrl ? `${this.config.cdnUrl}/${filename}` : undefined;

    return { url, cdnUrl };
  }

  /**
   * Delete a file from blob storage
   */
  async deleteFile(filename: string): Promise<boolean> {
    try {
      const containerClient = this.getContainerClient();
      const blockBlobClient = containerClient.getBlockBlobClient(filename);

      await blockBlobClient.delete();
      return true;
    } catch (error) {
      console.error(`Failed to delete file ${filename}:`, error);
      return false;
    }
  }

  /**
   * Check if a file exists in blob storage
   */
  async fileExists(filename: string): Promise<boolean> {
    try {
      const containerClient = this.getContainerClient();
      const blockBlobClient = containerClient.getBlockBlobClient(filename);

      return await blockBlobClient.exists();
    } catch (error) {
      return false;
    }
  }

  /**
   * Get blob URL
   */
  getBlobUrl(filename: string): string {
    const containerClient = this.getContainerClient();
    const blockBlobClient = containerClient.getBlockBlobClient(filename);
    return blockBlobClient.url;
  }

  /**
   * Get CDN URL if configured
   */
  getCdnUrl(filename: string): string | undefined {
    return this.config.cdnUrl ? `${this.config.cdnUrl}/${filename}` : undefined;
  }
}

// Export singleton instance
export const storageService = new StorageService();
