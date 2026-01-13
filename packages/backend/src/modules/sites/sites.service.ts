import { SiteModel, ISite } from '../../models/site.model';
import { generateApiKey } from '../../utils/apiKey';
import mongoose from 'mongoose';

/**
 * Create site data
 */
export interface CreateSiteData {
  name: string;
  domain: string;
  description?: string;
  allowedOrigins?: string[];
}

/**
 * Update site data
 */
export interface UpdateSiteData {
  name?: string;
  domain?: string;
  description?: string;
  allowedOrigins?: string[];
  isActive?: boolean;
}

/**
 * List sites options
 */
export interface ListSitesOptions {
  page?: number;
  limit?: number;
  isActive?: boolean;
}

/**
 * Sites Service
 */
export class SitesService {
  /**
   * Create a new site
   */
  static async createSite(data: CreateSiteData): Promise<ISite> {
    // Generate unique API key
    const apiKey = generateApiKey();

    const site = new SiteModel({
      ...data,
      apiKey,
      isActive: true,
      requestCount: 0,
    });

    await site.save();
    return site;
  }

  /**
   * List all sites with pagination
   */
  static async listSites(options: ListSitesOptions = {}): Promise<{
    sites: ISite[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const { page = 1, limit = 20, isActive } = options;

    const query: any = {};
    if (isActive !== undefined) {
      query.isActive = isActive;
    }

    const skip = (page - 1) * limit;

    const [sites, total] = await Promise.all([
      SiteModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).exec(),
      SiteModel.countDocuments(query),
    ]);

    return {
      sites,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get site by ID
   */
  static async getSiteById(siteId: string): Promise<ISite | null> {
    if (!mongoose.Types.ObjectId.isValid(siteId)) {
      throw new Error('Invalid site ID');
    }

    return SiteModel.findById(siteId).exec();
  }

  /**
   * Get site by API key
   */
  static async getSiteByApiKey(apiKey: string): Promise<ISite | null> {
    return SiteModel.findOne({ apiKey, isActive: true }).exec();
  }

  /**
   * Update site
   */
  static async updateSite(siteId: string, updates: UpdateSiteData): Promise<ISite | null> {
    if (!mongoose.Types.ObjectId.isValid(siteId)) {
      throw new Error('Invalid site ID');
    }

    return SiteModel.findByIdAndUpdate(siteId, updates, {
      new: true,
      runValidators: true,
    }).exec();
  }

  /**
   * Delete site
   */
  static async deleteSite(siteId: string): Promise<boolean> {
    if (!mongoose.Types.ObjectId.isValid(siteId)) {
      throw new Error('Invalid site ID');
    }

    const result = await SiteModel.findByIdAndDelete(siteId);
    return !!result;
  }

  /**
   * Rotate API key for a site
   */
  static async rotateApiKey(siteId: string): Promise<ISite | null> {
    if (!mongoose.Types.ObjectId.isValid(siteId)) {
      throw new Error('Invalid site ID');
    }

    const newApiKey = generateApiKey();

    return SiteModel.findByIdAndUpdate(
      siteId,
      { apiKey: newApiKey },
      { new: true, runValidators: true }
    ).exec();
  }

  /**
   * Increment request count for a site
   */
  static async incrementRequestCount(siteId: mongoose.Types.ObjectId): Promise<void> {
    await SiteModel.findByIdAndUpdate(siteId, {
      $inc: { requestCount: 1 },
      lastRequestAt: new Date(),
    }).exec();
  }
}
