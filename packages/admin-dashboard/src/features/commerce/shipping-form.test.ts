import { formToMethod, methodToForm } from './shipping-form'

const czk = [{ code: 'CZK', decimals: 2 }]
const method = {
  id: 'm1',
  labels: { en: 'Courier' },
  active: true,
  paymentMethods: ['BANK_TRANSFER', 'CASH_ON_DELIVERY'] as ('BANK_TRANSFER' | 'CASH_ON_DELIVERY')[],
  codFees: { CZK: 3900 },
  freeOver: { CZK: 200000 },
  rates: [{ zoneId: 'z1', bands: [{ upToGrams: 2000, prices: { CZK: 12900 } }, { upToGrams: null, prices: { CZK: 19900 } }] }],
  order: 0,
}

it('round-trips a method through the form in Czech number format', () => {
  const form = methodToForm(method, czk, 'cs')
  expect(form.rates[0].bands[0]).toEqual({ upTo: '2000', prices: { CZK: '129,00' } })
  expect(form.rates[0].bands[1].upTo).toBe('')
  const { id, order, ...body } = method
  void id
  void order
  expect(formToMethod(form, czk, 'cs', 'en')).toEqual({ errors: {}, body })
})

it('reads "129,5" in Czech as 12950 and names a bad amount', () => {
  const form = methodToForm(method, czk, 'cs')
  form.rates[0].bands[0].prices.CZK = '129,5'
  expect(formToMethod(form, czk, 'cs', 'en').body?.rates[0].bands[0].prices).toEqual({ CZK: 12950 })
  form.codFees.CZK = 'abc'
  expect(formToMethod(form, czk, 'cs', 'en')).toEqual({ errors: { 'cod:CZK': 'money' } })
})

it('allows an open limit only on the last band and needs rising limits', () => {
  const form = methodToForm(method, czk, 'en')
  form.rates[0].bands = [
    { upTo: '', prices: { CZK: '100' } },
    { upTo: '2000', prices: { CZK: '120' } },
    { upTo: '1000', prices: { CZK: '150' } },
  ]
  expect(formToMethod(form, czk, 'en', 'en').errors).toEqual({ 'rate:0:band:0:upTo': 'upTo', 'rate:0:band:2:upTo': 'upToOrder' })
})

it('needs a default-language name, a payment method, a rate and a price per band', () => {
  const empty = methodToForm(undefined, czk, 'en')
  empty.paymentMethods = []
  expect(formToMethod(empty, czk, 'en', 'en').errors).toEqual({ 'label:en': 'labelRequired', payment: 'paymentRequired', rates: 'ratesRequired' })
  const noPrice = methodToForm(method, czk, 'en')
  noPrice.rates[0].bands[1].prices.CZK = ''
  expect(formToMethod(noPrice, czk, 'en', 'en').errors).toEqual({ 'rate:0:band:1:price': 'bandPrice' })
})

it('drops cash on delivery fees when cash on delivery is not offered', () => {
  const form = methodToForm(method, czk, 'en')
  form.paymentMethods = ['BANK_TRANSFER']
  expect(formToMethod(form, czk, 'en', 'en').body?.codFees).toEqual({})
})
