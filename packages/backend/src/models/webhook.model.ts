import mongoose, { Document, Schema } from 'mongoose';

/**
 * Webhook event types
 */
export enum WebhookEvent {
  // Content Entry Events
  ENTRY_CREATED = 'entry.created',
  ENTRY_UPDATED = 'entry.updated',
  ENTRY_DELETED = 'entry.deleted',
  ENTRY_PUBLISHED = 'entry.published',
  ENTRY_UNPUBLISHED = 'entry.unpublished',
  ENTRY_ARCHIVED = 'entry.archived',

  // Content Type Events
  CONTENT_TYPE_CREATED = 'content_type.created',
  CONTENT_TYPE_UPDATED = 'content_type.updated',
  CONTENT_TYPE_DELETED = 'content_type.deleted',

  // Media Events
  MEDIA_UPLOADED = 'media.uploaded',
  MEDIA_DELETED = 'media.deleted',
}

/**
 * Webhook delivery status
 */
export enum WebhookDeliveryStatus {
  PENDING = 'PENDING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  RETRYING = 'RETRYING',
}

/**
 * Webhook delivery log entry
 */
export interface IWebhookDeliveryLog {
  timestamp: Date;
  event: WebhookEvent;
  status: WebhookDeliveryStatus;
  statusCode?: number;
  responseTime?: number; // in milliseconds
  errorMessage?: string;
  attemptNumber: number;
  payload?: any;
}

/**
 * Webhook document interface
 */
export interface IWebhook extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  url: string;
  description?: string;
  events: WebhookEvent[];
  secret: string; // Used for HMAC signature
  isActive: boolean;
  siteId?: mongoose.Types.ObjectId; // Optional: Associate webhook with a specific site
  createdBy?: mongoose.Types.ObjectId;

  // Retry configuration
  maxRetries: number;
  retryDelay: number; // in milliseconds

  // Statistics
  totalDeliveries: number;
  successfulDeliveries: number;
  failedDeliveries: number;
  lastDeliveryAt?: Date;
  lastDeliveryStatus?: WebhookDeliveryStatus;

  // Recent delivery logs (keep last 50)
  deliveryLogs: IWebhookDeliveryLog[];

  createdAt: Date;
  updatedAt: Date;
}

/**
 * Webhook schema
 */
const WebhookSchema = new Schema<IWebhook>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    url: {
      type: String,
      required: true,
      trim: true,
      validate: {
        validator: (url: string) => {
          try {
            const parsed = new URL(url);
            return parsed.protocol === 'http:' || parsed.protocol === 'https:';
          } catch {
            return false;
          }
        },
        message: 'Invalid webhook URL. Must be a valid HTTP/HTTPS URL.',
      },
    },
    description: {
      type: String,
      trim: true,
    },
    events: {
      type: [String],
      required: true,
      validate: {
        validator: (events: string[]) => {
          return events.length > 0 && events.every((e) => Object.values(WebhookEvent).includes(e as WebhookEvent));
        },
        message: 'Must specify at least one valid event',
      },
    },
    secret: {
      type: String,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    siteId: {
      type: Schema.Types.ObjectId,
      ref: 'Site',
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    maxRetries: {
      type: Number,
      default: 3,
      min: 0,
      max: 10,
    },
    retryDelay: {
      type: Number,
      default: 5000, // 5 seconds
      min: 1000,
      max: 300000, // 5 minutes
    },
    totalDeliveries: {
      type: Number,
      default: 0,
    },
    successfulDeliveries: {
      type: Number,
      default: 0,
    },
    failedDeliveries: {
      type: Number,
      default: 0,
    },
    lastDeliveryAt: {
      type: Date,
    },
    lastDeliveryStatus: {
      type: String,
      enum: Object.values(WebhookDeliveryStatus),
    },
    deliveryLogs: {
      type: [
        {
          timestamp: { type: Date, required: true },
          event: { type: String, required: true },
          status: { type: String, required: true },
          statusCode: { type: Number },
          responseTime: { type: Number },
          errorMessage: { type: String },
          attemptNumber: { type: Number, required: true },
          payload: { type: Schema.Types.Mixed },
        },
      ],
      default: [],
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        const { _id, __v, secret, ...rest } = ret;
        return {
          id: _id.toString(),
          ...rest,
          // Mask secret in responses (show only first 8 chars)
          secretPreview: secret ? `${secret.substring(0, 8)}...` : undefined,
        };
      },
    },
  }
);

// Indexes for efficient queries
WebhookSchema.index({ events: 1, isActive: 1 });
WebhookSchema.index({ siteId: 1, isActive: 1 });
WebhookSchema.index({ createdAt: -1 });

// Limit delivery logs to last 50 entries
WebhookSchema.pre('save', function (next) {
  if (this.deliveryLogs && this.deliveryLogs.length > 50) {
    this.deliveryLogs = this.deliveryLogs.slice(-50);
  }
  next();
});

export const WebhookModel = mongoose.model<IWebhook>('Webhook', WebhookSchema);
