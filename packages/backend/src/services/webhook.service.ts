import axios, { AxiosError } from 'axios';
import { WebhookModel, IWebhook, WebhookEvent, WebhookDeliveryStatus } from '../models/webhook.model';
import { generateWebhookSignature } from '../utils/webhookSignature';

/**
 * Webhook payload structure
 */
export interface WebhookPayload {
  event: WebhookEvent;
  timestamp: string;
  data: any;
  metadata?: {
    webhookId: string;
    deliveryId: string;
  };
}

/**
 * Webhook delivery service
 * Handles sending webhooks, retries, and logging
 */
export class WebhookService {
  /**
   * Trigger webhooks for a specific event
   */
  static async triggerEvent(event: WebhookEvent, data: any, siteId?: string): Promise<void> {
    try {
      // Find all active webhooks subscribed to this event
      const query: any = {
        isActive: true,
        events: event,
      };

      if (siteId) {
        query.siteId = siteId;
      }

      const webhooks = await WebhookModel.find(query).lean();

      if (webhooks.length === 0) {
        console.log(`No active webhooks found for event: ${event}`);
        return;
      }

      console.log(`Triggering ${webhooks.length} webhooks for event: ${event}`);

      // Deliver to all webhooks (in parallel for better performance)
      const deliveryPromises = webhooks.map((webhook) =>
        this.deliverWebhook(webhook, event, data).catch((error) => {
          console.error(`Failed to deliver webhook ${webhook._id}:`, error);
        })
      );

      await Promise.allSettled(deliveryPromises);
    } catch (error) {
      console.error('Error triggering webhooks:', error);
    }
  }

  /**
   * Deliver a webhook to a single endpoint
   * Uses atomic DB operations instead of multiple save() calls to reduce RU cost
   */
  private static async deliverWebhook(
    webhook: Pick<IWebhook, '_id' | 'secret' | 'url' | 'maxRetries' | 'retryDelay'>,
    event: WebhookEvent,
    data: any,
    attemptNumber = 1
  ): Promise<void> {
    const webhookId = webhook._id;
    const deliveryId = `${webhookId}_${Date.now()}_${attemptNumber}`;
    const startTime = Date.now();

    // Build payload
    const payload: WebhookPayload = {
      event,
      timestamp: new Date().toISOString(),
      data,
      metadata: {
        webhookId: webhookId.toString(),
        deliveryId,
      },
    };

    const payloadString = JSON.stringify(payload);
    const signature = generateWebhookSignature(payloadString, webhook.secret);

    try {
      // Send webhook
      const response = await axios.post(webhook.url, payload, {
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-Event': event,
          'X-Webhook-Delivery-Id': deliveryId,
          'User-Agent': 'TheCMS-Webhook/1.0',
        },
        timeout: 10000, // 10 second timeout
        validateStatus: (status: number) => status >= 200 && status < 300,
      });

      const responseTime = Date.now() - startTime;

      // Single atomic update: log delivery + update stats
      await WebhookModel.findByIdAndUpdate(webhookId, {
        $push: {
          deliveryLogs: {
            $each: [{
              timestamp: new Date(),
              event,
              status: WebhookDeliveryStatus.SUCCESS,
              statusCode: response.status,
              responseTime,
              attemptNumber,
              payload: payloadString.length > 1000 ? '[Payload too large]' : payload,
            }],
            $slice: -50,
          },
        },
        $inc: { totalDeliveries: 1, successfulDeliveries: 1 },
        $set: {
          lastDeliveryAt: new Date(),
          lastDeliveryStatus: WebhookDeliveryStatus.SUCCESS,
        },
      });

      console.log(`Webhook delivered successfully to ${webhook.url} (${responseTime}ms)`);
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const axiosError = error as AxiosError;

      const errorMessage =
        axiosError.response?.statusText ||
        axiosError.message ||
        'Unknown error';

      const statusCode = axiosError.response?.status;

      // Determine if we should retry
      const shouldRetry = attemptNumber < webhook.maxRetries &&
        (!statusCode || statusCode >= 500 || statusCode === 408 || statusCode === 429);

      const deliveryStatus = shouldRetry
        ? WebhookDeliveryStatus.RETRYING
        : WebhookDeliveryStatus.FAILED;

      // Single atomic update: log delivery + update stats
      const incFields: Record<string, number> = { totalDeliveries: 1 };
      if (!shouldRetry) {
        incFields.failedDeliveries = 1;
      }

      await WebhookModel.findByIdAndUpdate(webhookId, {
        $push: {
          deliveryLogs: {
            $each: [{
              timestamp: new Date(),
              event,
              status: deliveryStatus,
              statusCode,
              responseTime,
              errorMessage,
              attemptNumber,
              payload: payloadString.length > 1000 ? '[Payload too large]' : payload,
            }],
            $slice: -50,
          },
        },
        $inc: incFields,
        $set: {
          lastDeliveryAt: new Date(),
          lastDeliveryStatus: deliveryStatus,
        },
      });

      if (!shouldRetry) {
        console.error(
          `Webhook delivery failed to ${webhook.url} after ${attemptNumber} attempts`
        );
        return;
      }

      // Schedule retry with exponential backoff
      const retryDelay = webhook.retryDelay * Math.pow(2, attemptNumber - 1);
      console.log(
        `Retrying webhook ${webhookId} in ${retryDelay}ms (attempt ${attemptNumber + 1}/${webhook.maxRetries})`
      );

      setTimeout(() => {
        this.deliverWebhook(webhook, event, data, attemptNumber + 1);
      }, retryDelay);
    }
  }

  /**
   * Test a webhook by sending a test event
   */
  static async testWebhook(webhookId: string): Promise<{
    success: boolean;
    statusCode?: number;
    responseTime?: number;
    error?: string;
  }> {
    const webhook = await WebhookModel.findById(webhookId);

    if (!webhook) {
      throw new Error('Webhook not found');
    }

    const startTime = Date.now();

    const testPayload: WebhookPayload = {
      event: WebhookEvent.ENTRY_CREATED,
      timestamp: new Date().toISOString(),
      data: {
        test: true,
        message: 'This is a test webhook delivery',
      },
      metadata: {
        webhookId: webhook._id.toString(),
        deliveryId: `test_${Date.now()}`,
      },
    };

    const payloadString = JSON.stringify(testPayload);
    const signature = generateWebhookSignature(payloadString, webhook.secret);

    try {
      const response = await axios.post(webhook.url, testPayload, {
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-Event': 'test',
          'X-Webhook-Delivery-Id': testPayload.metadata!.deliveryId,
          'User-Agent': 'TheCMS-Webhook/1.0',
        },
        timeout: 10000,
        validateStatus: (status: number) => status >= 200 && status < 300,
      });

      const responseTime = Date.now() - startTime;

      return {
        success: true,
        statusCode: response.status,
        responseTime,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const axiosError = error as AxiosError;

      return {
        success: false,
        statusCode: axiosError.response?.status,
        responseTime,
        error: axiosError.message,
      };
    }
  }
}
