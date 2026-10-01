import type { IProduct } from '../../models/product.model';
import { WebhookEvent } from '../../models/webhook.model';
import { WebhookService } from '../../services/webhook.service';

type ProductEvent = WebhookEvent.PRODUCT_UPDATED | WebhookEvent.PRODUCT_DELETED | WebhookEvent.STOCK_CHANGED;

/** Fire-and-forget commerce webhook: { product: { id, itemId, type, active }, variantIds }. */
export function emitProductEvent(event: ProductEvent, product: IProduct, variantIds: string[] = []): void {
  WebhookService.triggerEvent(event, {
    product: { id: String(product._id), itemId: String(product.itemId), type: product.type, active: product.active },
    variantIds,
  }).catch((err) => console.error('Webhook trigger error:', err));
}
