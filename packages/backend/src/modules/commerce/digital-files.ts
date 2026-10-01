import { promises as fs } from 'fs';
import crypto from 'crypto';
import { storageService } from '../../config/storage';
import { ProductModel, ProductType, type DigitalFile, type IProduct } from '../../models/product.model';
import { AppError } from '../../middleware/error.middleware';
import { WebhookEvent } from '../../models/webhook.model';
import { emitProductEvent } from './commerce-events';

export async function uploadDigitalFile(productId: string, file: Express.Multer.File): Promise<DigitalFile> {
  try {
    const product = await ProductModel.findById(productId);
    if (!product) throw new AppError('Product not found', 404);
    if (product.type !== ProductType.DIGITAL) throw new AppError('Only digital products have a file', 400);
    const blobName = `products/${productId}/${crypto.randomUUID()}`;
    await storageService.uploadPrivateFile(blobName, file.path, file.mimetype);
    const previous = product.digitalFile?.blobName;
    product.digitalFile = { blobName, originalName: file.originalname, mimeType: file.mimetype, size: file.size };
    await product.save();
    if (previous) await storageService.deletePrivateFile(previous).catch((err) => console.error('Old digital file not deleted:', err));
    emitProductEvent(WebhookEvent.PRODUCT_UPDATED, product);
    return product.digitalFile;
  } finally {
    await fs.unlink(file.path).catch(() => undefined);
  }
}

export async function deleteDigitalFile(product: Pick<IProduct, 'digitalFile'>): Promise<void> {
  if (!product.digitalFile?.blobName) return;
  await storageService.deletePrivateFile(product.digitalFile.blobName).catch((err) => console.error('Digital file not deleted:', err));
}
