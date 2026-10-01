import crypto from 'crypto';
import type { IOrder } from '../../models/order.model';
import type { IShopSettings } from '../../models/shop-settings.model';
import { DownloadGrantModel, type IDownloadGrant } from '../../models/download-grant.model';
import { ProductModel } from '../../models/product.model';
import { AppError } from '../../middleware/error.middleware';
import { storageService } from '../../config/storage';

/** Fresh grants for every digital line of a paid order; earlier grants of the order expire. */
export async function issueGrants(order: IOrder, settings: Pick<IShopSettings, 'downloadDays' | 'downloadLimit'>): Promise<IDownloadGrant[]> {
  const now = new Date();
  await DownloadGrantModel.updateMany({ orderId: order._id, expiresAt: { $gt: now } }, { $set: { expiresAt: now } });
  const grants: IDownloadGrant[] = [];
  for (const [lineIndex, line] of order.lines.entries()) {
    if (line.type !== 'DIGITAL') continue;
    grants.push(
      await DownloadGrantModel.create({
        token: crypto.randomBytes(24).toString('base64url'),
        orderId: order._id,
        lineIndex,
        productId: line.productId,
        expiresAt: new Date(now.getTime() + (settings.downloadDays ?? 30) * 24 * 3600_000),
        limit: settings.downloadLimit ?? 5,
      })
    );
  }
  return grants;
}

export async function expireGrants(order: IOrder): Promise<void> {
  const now = new Date();
  await DownloadGrantModel.updateMany({ orderId: order._id, expiresAt: { $gt: now } }, { $set: { expiresAt: now } });
}

/** Count one download and return a short-lived private link; 404 unknown, 410 expired or used up. */
export async function redeem(token: string): Promise<string> {
  const grant = await DownloadGrantModel.findOneAndUpdate(
    { token, expiresAt: { $gt: new Date() }, $expr: { $lt: ['$used', '$limit'] } },
    { $inc: { used: 1 } },
    { new: true }
  );
  if (!grant) {
    if (!(await DownloadGrantModel.exists({ token }))) throw new AppError('Download not found', 404);
    throw new AppError('This download link has expired', 410);
  }
  const product = await ProductModel.findById(grant.productId).select('digitalFile').lean();
  if (!product?.digitalFile?.blobName) throw new AppError('The file is no longer available', 410);
  return storageService.privateFileSasUrl(product.digitalFile.blobName, 5);
}
