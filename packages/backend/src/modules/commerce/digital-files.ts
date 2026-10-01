import type { IProduct } from '../../models/product.model';

/** Replaced in the digital files task; products have no file yet. */
export async function deleteDigitalFile(_product: Pick<IProduct, 'digitalFile'>): Promise<void> {
  return;
}
