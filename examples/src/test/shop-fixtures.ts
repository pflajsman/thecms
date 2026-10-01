import type { Quote, QuoteLine, QuoteRequest, ShopProduct } from '../shop/types';

export const tee: ShopProduct = {
  id: 'p-tee',
  type: 'PHYSICAL',
  itemId: 'i-tee',
  currency: 'CZK',
  content: { data: { name: 'Cyklistické tričko', description: '<p>Merino vlna</p>', images: [] } },
  options: [{ key: 'size', label: 'Velikost', values: [{ key: 's', label: 'S' }, { key: 'm', label: 'M' }] }],
  variants: [
    { id: 'v-tee-s', sku: 'TEE-S', optionValues: { size: 's' }, price: 49000, vatRate: 2100, available: true, availableQuantity: 3 },
    { id: 'v-tee-m', sku: 'TEE-M', optionValues: { size: 'm' }, price: 52000, vatRate: 2100, available: false, availableQuantity: 0 },
  ],
  priceRange: { min: 49000, max: 52000 },
};

export const guide: ShopProduct = {
  id: 'p-guide',
  type: 'DIGITAL',
  itemId: 'i-guide',
  currency: 'CZK',
  content: { data: { name: 'Průvodce Šumavou', description: '', images: [] } },
  options: [],
  variants: [{ id: 'v-guide', sku: 'GUIDE', optionValues: {}, price: 29900, vatRate: 1200, available: true, availableQuantity: null }],
  priceRange: { min: 29900, max: 29900 },
};

export const COURIER = 'aaaaaaaaaaaaaaaaaaaaaaaa';

const catalog: Record<string, Omit<QuoteLine, 'quantity' | 'lineTotal'>> = {
  'v-tee-s': { variantId: 'v-tee-s', productId: 'p-tee', type: 'PHYSICAL', name: 'Cyklistické tričko', optionLabels: [{ option: 'Velikost', value: 'S' }], unitPrice: 49000 },
  'v-guide': { variantId: 'v-guide', productId: 'p-guide', type: 'DIGITAL', name: 'Průvodce Šumavou', optionLabels: [], unitPrice: 29900 },
};

/** A quote like the backend's: courier to CZ only (129 Kč), cash on delivery +39 Kč without digital items. `bump` raises every unit price. */
export function quoteFor(body: QuoteRequest, options: { stock?: Record<string, number>; bump?: number } = {}): Quote {
  const lines: QuoteLine[] = body.items.map((i) => {
    const base = catalog[i.variantId];
    const unitPrice = base.unitPrice + (options.bump ?? 0);
    const stock = options.stock?.[i.variantId];
    const short = stock !== undefined && stock < i.quantity;
    return {
      ...base,
      unitPrice,
      quantity: i.quantity,
      lineTotal: short ? 0 : unitPrice * i.quantity,
      ...(short ? { problem: stock === 0 ? ('OUT_OF_STOCK' as const) : ('NOT_ENOUGH_STOCK' as const), availableQuantity: stock } : {}),
    };
  });
  const hasPhysical = lines.some((l) => l.type === 'PHYSICAL');
  const hasDigital = lines.some((l) => l.type === 'DIGITAL');
  const items = lines.reduce((n, l) => n + l.lineTotal, 0);
  const ships = hasPhysical && body.country === 'CZ';
  const shippingOptions = ships
    ? [{ id: COURIER, name: 'Kurýr', price: 12900, paymentMethods: [{ method: 'BANK_TRANSFER' as const, fee: 0 }, ...(hasDigital ? [] : [{ method: 'CASH_ON_DELIVERY' as const, fee: 3900 }])] }]
    : [];
  const shipping = ships && body.shippingMethodId === COURIER ? { methodId: COURIER, name: 'Kurýr', price: 12900 } : null;
  const fee = body.paymentMethod === 'CASH_ON_DELIVERY' ? 3900 : 0;
  const total = items + (shipping?.price ?? 0) + fee;
  const vat = Math.round((total * 2100) / 12100);
  return {
    currency: 'CZK',
    lines,
    hasPhysical,
    hasDigital,
    shippingOptions,
    shipping,
    payment: body.paymentMethod ? { method: body.paymentMethod, fee } : null,
    totals: { items, shipping: shipping?.price ?? 0, paymentFee: fee, total, vat: [{ rate: 2100, base: total - vat, amount: vat }] },
    problems: [...(lines.some((l) => l.problem) ? ['LINES'] : []), ...(hasPhysical && body.country && !ships ? ['NO_SHIPPING'] : [])],
  };
}
