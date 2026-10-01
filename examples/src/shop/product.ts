import type { ShopProduct, ShopVariant } from './types';

const text = (v: unknown) => (typeof v === 'string' ? v : '');

export function productName(p: ShopProduct): string {
  return text(p.content?.data?.name) || 'Bez názvu';
}

export function productDescription(p: ShopProduct): string {
  return text(p.content?.data?.description);
}

/** Media ids (or URLs) of the product's images, in order. */
export function productImages(p: ShopProduct): string[] {
  const value = p.content?.data?.images;
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string' && v.length > 0);
  return typeof value === 'string' && value ? [value] : [];
}

export function isSoldOut(p: ShopProduct): boolean {
  return p.variants.every((v) => !v.available);
}

/** The variant matching every chosen option value. */
export function findVariant(p: ShopProduct, chosen: Record<string, string>): ShopVariant | undefined {
  return p.variants.find((v) => p.options.every((o) => v.optionValues[o.key] === chosen[o.key]));
}

/** Opens the page on the first variant that can be bought. */
export function initialChoice(p: ShopProduct): Record<string, string> {
  const variant = p.variants.find((v) => v.available) ?? p.variants[0];
  return variant ? { ...variant.optionValues } : {};
}

/** Most pieces that can go in the cart at once: 99, or the stock when it is tracked. */
export function maxQuantity(v: ShopVariant): number {
  return Math.max(0, Math.min(99, v.availableQuantity ?? 99));
}
