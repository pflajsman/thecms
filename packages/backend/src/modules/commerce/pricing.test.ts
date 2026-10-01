import { priceCart, type PricingContext } from './pricing'

const v = (id: string, over: Partial<PricingContext['variants'] extends Map<string, infer V> ? V : never> = {}) => ({
  id, productId: 'p-' + id, itemId: 'i-' + id, sku: id.toUpperCase(), type: 'PHYSICAL' as const, name: 'Tee', optionLabels: [],
  price: 49000, vatRate: 2100, weightGrams: 500, tracked: true, quantity: 10, forSale: true, ...over,
})

function ctx(over: Partial<PricingContext> = {}): PricingContext {
  return {
    currency: { code: 'CZK', decimals: 2 },
    language: 'en',
    defaultLanguage: 'en',
    variants: new Map([['tee', v('tee')], ['book', v('book', { type: 'DIGITAL', weightGrams: 0, tracked: false, price: 29900, vatRate: 1200 })]]),
    zones: [{ id: 'cz', countries: ['CZ'], rest: false }, { id: 'rest', countries: [], rest: true }],
    methods: [
      { id: 'courier', name: 'Courier', paymentMethods: ['BANK_TRANSFER', 'CASH_ON_DELIVERY'], codFees: { CZK: 3900 }, freeOver: { CZK: 200000 },
        rates: [{ zoneId: 'cz', bands: [{ upToGrams: 2000, prices: { CZK: 12900 } }, { upToGrams: null, prices: { CZK: 19900 } }] }] },
      { id: 'abroad', name: 'Abroad', paymentMethods: ['BANK_TRANSFER'], codFees: {}, freeOver: {},
        rates: [{ zoneId: 'rest', bands: [{ upToGrams: null, prices: { CZK: 49900 } }] }] },
    ],
    ...over,
  }
}

it('prices lines, picks the weight band and adds the cash on delivery fee', () => {
  const q = priceCart({ currency: 'CZK', language: 'en', items: [{ variantId: 'tee', quantity: 5 }], country: 'CZ', shippingMethodId: 'courier', paymentMethod: 'CASH_ON_DELIVERY' }, ctx())
  expect(q.lines[0]).toMatchObject({ unitPrice: 49000, quantity: 5, lineTotal: 245000 })
  expect(q.weightGrams).toBe(2500)
  // 245000 is over the free threshold of 200000.
  expect(q.shipping).toEqual({ methodId: 'courier', name: 'Courier', price: 0 })
  expect(q.payment).toEqual({ method: 'CASH_ON_DELIVERY', fee: 3900 })
  expect(q.totals).toMatchObject({ items: 245000, shipping: 0, paymentFee: 3900, total: 248900 })
  expect(q.problems).toEqual([])
})

it('uses the band for the weight and offers only methods for the country', () => {
  const light = priceCart({ currency: 'CZK', language: 'en', items: [{ variantId: 'tee', quantity: 1 }], country: 'CZ' }, ctx())
  expect(light.shippingOptions.map((o) => [o.id, o.price])).toEqual([['courier', 12900]])
  const de = priceCart({ currency: 'CZK', language: 'en', items: [{ variantId: 'tee', quantity: 1 }], country: 'DE' }, ctx())
  expect(de.shippingOptions.map((o) => o.id)).toEqual(['abroad'])
  const noZone = priceCart({ currency: 'CZK', language: 'en', items: [{ variantId: 'tee', quantity: 1 }], country: 'CZ' }, ctx({ zones: [{ id: 'sk', countries: ['SK'], rest: false }] }))
  expect(noZone.shippingOptions).toEqual([])
  expect(noZone.problems).toContain('NO_SHIPPING')
})

it('never offers cash on delivery with a digital line, and digital-only carts skip shipping', () => {
  const mixed = priceCart({ currency: 'CZK', language: 'en', items: [{ variantId: 'tee', quantity: 1 }, { variantId: 'book', quantity: 1 }], country: 'CZ', shippingMethodId: 'courier', paymentMethod: 'CASH_ON_DELIVERY' }, ctx())
  expect(mixed.shippingOptions[0].paymentMethods.map((p) => p.method)).toEqual(['BANK_TRANSFER'])
  expect(mixed.problems).toContain('PAYMENT_NOT_ALLOWED')
  const digital = priceCart({ currency: 'CZK', language: 'en', items: [{ variantId: 'book', quantity: 2 }], paymentMethod: 'BANK_TRANSFER' }, ctx())
  expect(digital).toMatchObject({ shipping: null, shippingOptions: [], hasPhysical: false, payment: { method: 'BANK_TRANSFER', fee: 0 } })
  expect(digital.problems).toEqual([])
})

it('reports line problems', () => {
  const c = ctx({ variants: new Map([['tee', v('tee', { quantity: 2 })], ['gone', v('gone', { forSale: false })], ['eur', v('eur', { price: undefined })]]) })
  const q = priceCart({ currency: 'CZK', language: 'en', items: [{ variantId: 'tee', quantity: 3 }, { variantId: 'gone', quantity: 1 }, { variantId: 'eur', quantity: 1 }, { variantId: 'missing', quantity: 1 }], country: 'CZ' }, c)
  expect(q.lines.map((l) => [l.variantId, l.problem, l.availableQuantity])).toEqual([
    ['tee', 'NOT_ENOUGH_STOCK', 2],
    ['gone', 'NOT_FOR_SALE', undefined],
    ['eur', 'NO_PRICE', undefined],
    ['missing', 'NOT_FOR_SALE', undefined],
  ])
  expect(q.problems).toContain('LINES')
})

it('splits VAT per rate and taxes shipping and fees at the highest line rate', () => {
  const q = priceCart({ currency: 'CZK', language: 'en', items: [{ variantId: 'tee', quantity: 1 }, { variantId: 'book', quantity: 1 }], country: 'CZ', shippingMethodId: 'courier', paymentMethod: 'BANK_TRANSFER' }, ctx())
  // tee 49000 @21 %, book 29900 @12 %, shipping 12900 @21 % (highest line rate)
  expect(q.totals.vat).toEqual([
    { rate: 2100, base: 51157, amount: 10743 },
    { rate: 1200, base: 26696, amount: 3204 },
  ])
  expect(q.totals.total).toBe(91800)
})

it('merges repeated lines of the same variant', () => {
  const q = priceCart({ currency: 'CZK', language: 'en', items: [{ variantId: 'tee', quantity: 1 }, { variantId: 'tee', quantity: 2 }], country: 'CZ' }, ctx())
  expect(q.lines).toHaveLength(1)
  expect(q.lines[0].quantity).toBe(3)
})
