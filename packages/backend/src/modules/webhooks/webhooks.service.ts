import mongoose from 'mongoose';
import { WebhookModel, IWebhook } from '../../models/webhook.model';
import { generateWebhookSecret } from '../../utils/webhookSignature';
import { CreateWebhookInput, UpdateWebhookInput } from './webhooks.schema';

/**
 * Webhooks Service
 * Business logic for webhook management
 */
export class WebhooksService {
  /**
   * Create a new webhook
   */
  static async createWebhook(data: CreateWebhookInput & { createdBy?: string }): Promise<IWebhook> {
    // Generate webhook secret
    const secret = generateWebhookSecret();

    const webhook = new WebhookModel({
      ...data,
      secret,
      isActive: true,
      totalDeliveries: 0,
      successfulDeliveries: 0,
      failedDeliveries: 0,
    });

    await webhook.save();
    return webhook;
  }

  /**
   * List webhooks with pagination
   */
  static async listWebhooks(options: {
    page?: number;
    limit?: number;
    siteId?: string;
    isActive?: boolean;
  }): Promise<{ webhooks: IWebhook[]; pagination: any }> {
    const { page = 1, limit = 20, siteId, isActive } = options;

    const query: any = {};

    if (siteId) {
      query.siteId = siteId;
    }

    if (isActive !== undefined) {
      query.isActive = isActive;
    }

    const skip = (page - 1) * limit;

    const [webhooks, total] = await Promise.all([
      WebhookModel.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('siteId', 'name domain')
        .populate('createdBy', 'name email')
        .exec(),
      WebhookModel.countDocuments(query),
    ]);

    return {
      webhooks,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get webhook by ID
   */
  static async getWebhookById(id: string): Promise<IWebhook | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error('Invalid webhook ID');
    }

    const webhook = await WebhookModel.findById(id)
      .populate('siteId', 'name domain')
      .populate('createdBy', 'name email')
      .exec();

    return webhook;
  }

  /**
   * Update webhook
   */
  static async updateWebhook(id: string, data: UpdateWebhookInput): Promise<IWebhook | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error('Invalid webhook ID');
    }

    const webhook = await WebhookModel.findByIdAndUpdate(
      id,
      { $set: data },
      { new: true, runValidators: true }
    )
      .populate('siteId', 'name domain')
      .populate('createdBy', 'name email')
      .exec();

    return webhook;
  }

  /**
   * Delete webhook
   */
  static async deleteWebhook(id: string): Promise<boolean> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error('Invalid webhook ID');
    }

    const result = await WebhookModel.findByIdAndDelete(id);
    return result !== null;
  }

  /**
   * Rotate webhook secret
   */
  static async rotateSecret(id: string): Promise<{ newSecret: string }> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error('Invalid webhook ID');
    }

    const webhook = await WebhookModel.findById(id);

    if (!webhook) {
      throw new Error('Webhook not found');
    }

    const newSecret = generateWebhookSecret();
    webhook.secret = newSecret;
    await webhook.save();

    return { newSecret };
  }

  /**
   * Get webhook delivery logs
   */
  static async getDeliveryLogs(id: string, limit = 50): Promise<any[]> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error('Invalid webhook ID');
    }

    const webhook = await WebhookModel.findById(id).select('deliveryLogs').lean().exec();

    if (!webhook) {
      throw new Error('Webhook not found');
    }

    // Return logs in reverse order (most recent first)
    return webhook.deliveryLogs
      .slice(-limit)
      .reverse();
  }
}
