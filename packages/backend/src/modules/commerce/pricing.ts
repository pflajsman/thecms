import type { PaymentMethod } from '../../models/shipping.model';

export interface CartInput {
  currency: string
  language: string
  items: { variantId: string; quantity: number }[]
  country?: string
  shippingMethodId?: string
  paymentMethod?: PaymentMethod
}

export interface PricingContext {
  currency: { code: string; decimals: number }
  language: string
  defaultLanguage: string
  variants: Map<string, { id: string; productId: string; itemId: string; sku: string; type: 'PHYSICAL' | 'DIGITAL'; name: string; optionLabels: { option: string; value: string }[]; price?: number; vatRate: number; weightGrams: number; tracked: boolean; quantity: number; forSale: boolean }>
  zones: { id: string; countries: string[]; rest: boolean }[]
  methods: { id: string; name: string; paymentMethods: PaymentMethod[]; codFees: Record<string, number>; freeOver: Record<string, number>; rates: { zoneId: string; bands: { upToGrams: number | null; prices: Record<string, number> }[] }[] }[]
}

export type LineProblem = 'NOT_FOR_SALE' | 'NO_PRICE' | 'OUT_OF_STOCK' | 'NOT_ENOUGH_STOCK'

export interface Quote {
  currency: string
  lines: { variantId: string; productId: string; itemId: string; sku: string; type: 'PHYSICAL' | 'DIGITAL'; name: string; optionLabels: { option: string; value: string }[]; unitPrice: number; quantity: number; lineTotal: number; vatRate: number; weightGrams: number; problem?: LineProblem; availableQuantity?: number | null }[]
  weightGrams: number
  hasPhysical: boolean
  hasDigital: boolean
  shippingOptions: { id: string; name: string; price: number; paymentMethods: { method: PaymentMethod; fee: number }[] }[]
  shipping: { methodId: string; name: string; price: number } | null
  payment: { method: PaymentMethod; fee: number } | null
  totals: { items: number; shipping: number; paymentFee: number; total: number; vat: { rate: number; base: number; amount: number }[] }
  problems: string[]  // 'LINES', 'NO_SHIPPING', 'SHIPPING_REQUIRED', 'PAYMENT_NOT_ALLOWED'
}

const vatOf = (gross: number, rate: number) => Math.round((gross * rate) / (10000 + rate));

export function priceCart(input: CartInput, ctx: PricingContext): Quote {
  const merged = new Map<string, number>();
  for (const item of input.items) merged.set(item.variantId, (merged.get(item.variantId) ?? 0) + item.quantity);

  const lines: Quote['lines'] = [...merged].map(([variantId, quantity]) => {
    const v = ctx.variants.get(variantId);
    if (!v || !v.forSale) {
      return { variantId, productId: v?.productId ?? '', itemId: v?.itemId ?? '', sku: v?.sku ?? '', type: v?.type ?? 'PHYSICAL', name: v?.name ?? '', optionLabels: v?.optionLabels ?? [], unitPrice: 0, quantity, lineTotal: 0, vatRate: 0, weightGrams: 0, problem: 'NOT_FOR_SALE' };
    }
    const base = { variantId, productId: v.productId, itemId: v.itemId, sku: v.sku, type: v.type, name: v.name, optionLabels: v.optionLabels, vatRate: v.vatRate, weightGrams: v.weightGrams, quantity };
    if (v.price === undefined) return { ...base, unitPrice: 0, lineTotal: 0, problem: 'NO_PRICE' };
    let problem: LineProblem | undefined;
    if (v.tracked && v.quantity <= 0) problem = 'OUT_OF_STOCK';
    else if (v.tracked && v.quantity < quantity) problem = 'NOT_ENOUGH_STOCK';
    return { ...base, unitPrice: v.price, lineTotal: v.price * quantity, ...(problem ? { problem, availableQuantity: v.quantity } : {}) };
  });

  const problems: string[] = [];
  if (lines.some((l) => l.problem)) problems.push('LINES');
  const priced = lines.filter((l) => !l.problem);
  const items = priced.reduce((sum, l) => sum + l.lineTotal, 0);
  const hasPhysical = priced.some((l) => l.type === 'PHYSICAL');
  const hasDigital = priced.some((l) => l.type === 'DIGITAL');
  const weightGrams = priced.filter((l) => l.type === 'PHYSICAL').reduce((s, l) => s + l.weightGrams * l.quantity, 0);
  const code = ctx.currency.code;

  let shippingOptions: Quote['shippingOptions'] = [];
  if (hasPhysical && input.country) {
    const country = input.country.toUpperCase();
    const zone = ctx.zones.find((z) => z.countries.includes(country)) ?? ctx.zones.find((z) => z.rest);
    shippingOptions = zone
      ? ctx.methods.flatMap((m) => {
          const band = m.rates.find((r) => r.zoneId === zone.id)?.bands.find((b) => b.upToGrams === null || weightGrams <= b.upToGrams);
          const bandPrice = band?.prices[code];
          if (bandPrice === undefined) return [];
          const free = m.freeOver[code] !== undefined && items >= m.freeOver[code];
          const payments = m.paymentMethods
            // Cash on delivery is never offered with a digital line; without a fee in the currency it costs 0.
            .filter((p) => !(p === 'CASH_ON_DELIVERY' && hasDigital))
            .map((p) => ({ method: p, fee: p === 'CASH_ON_DELIVERY' ? m.codFees[code] ?? 0 : 0 }));
          return payments.length ? [{ id: m.id, name: m.name, price: free ? 0 : bandPrice, paymentMethods: payments }] : [];
        })
      : [];
    if (shippingOptions.length === 0) problems.push('NO_SHIPPING');
  }

  let shipping: Quote['shipping'] = null;
  let payment: Quote['payment'] = null;
  if (hasPhysical) {
    const chosen = shippingOptions.find((o) => o.id === input.shippingMethodId);
    if (input.shippingMethodId && !chosen) problems.push('SHIPPING_REQUIRED');
    if (chosen) {
      shipping = { methodId: chosen.id, name: chosen.name, price: chosen.price };
      if (input.paymentMethod) {
        const allowed = chosen.paymentMethods.find((p) => p.method === input.paymentMethod);
        if (allowed) payment = { method: allowed.method, fee: allowed.fee };
        else problems.push('PAYMENT_NOT_ALLOWED');
      }
    }
  } else if (input.paymentMethod) {
    if (input.paymentMethod === 'BANK_TRANSFER') payment = { method: 'BANK_TRANSFER', fee: 0 };
    else problems.push('PAYMENT_NOT_ALLOWED');
  }

  const shippingPrice = shipping?.price ?? 0;
  const paymentFee = payment?.fee ?? 0;
  const topRate = Math.max(0, ...priced.map((l) => l.vatRate));
  const grossByRate = new Map<number, number>();
  for (const l of priced) grossByRate.set(l.vatRate, (grossByRate.get(l.vatRate) ?? 0) + l.lineTotal);
  if (shippingPrice + paymentFee > 0) grossByRate.set(topRate, (grossByRate.get(topRate) ?? 0) + shippingPrice + paymentFee);
  const vat = [...grossByRate]
    .sort((a, b) => b[0] - a[0])
    .map(([rate, gross]) => ({ rate, base: gross - vatOf(gross, rate), amount: vatOf(gross, rate) }));

  return {
    currency: code,
    lines,
    weightGrams,
    hasPhysical,
    hasDigital,
    shippingOptions,
    shipping,
    payment,
    totals: { items, shipping: shippingPrice, paymentFee, total: items + shippingPrice + paymentFee, vat },
    problems,
  };
}
