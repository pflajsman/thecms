import type { ShopCurrency } from './commerce-api'
import type { PaymentMethod } from './orders-api'
import type { MethodInput, ShippingMethod } from './shipping-api'
import { fromMinor, toMinor } from './money'

export interface BandForm {
  upTo: string
  prices: Record<string, string>
}

export interface RateForm {
  zoneId: string
  bands: BandForm[]
}

export interface MethodForm {
  labels: Record<string, string>
  active: boolean
  paymentMethods: PaymentMethod[]
  codFees: Record<string, string>
  freeOver: Record<string, string>
  rates: RateForm[]
}

export type MethodErrorKey = 'labelRequired' | 'paymentRequired' | 'ratesRequired' | 'money' | 'upTo' | 'upToOrder' | 'bandPrice'

function moneyText(map: Record<string, number>, currencies: ShopCurrency[], language: string): Record<string, string> {
  return Object.fromEntries(currencies.map((c) => [c.code, typeof map[c.code] === 'number' ? fromMinor(map[c.code], c.decimals, language) : '']))
}

export function emptyBand(currencies: ShopCurrency[]): BandForm {
  return { upTo: '', prices: Object.fromEntries(currencies.map((c) => [c.code, ''])) }
}

export function methodToForm(method: ShippingMethod | undefined, currencies: ShopCurrency[], language: string): MethodForm {
  if (!method) {
    return { labels: {}, active: true, paymentMethods: ['BANK_TRANSFER'], codFees: moneyText({}, currencies, language), freeOver: moneyText({}, currencies, language), rates: [] }
  }
  return {
    labels: { ...method.labels },
    active: method.active,
    paymentMethods: [...method.paymentMethods],
    codFees: moneyText(method.codFees, currencies, language),
    freeOver: moneyText(method.freeOver, currencies, language),
    rates: method.rates.map((r) => ({
      zoneId: r.zoneId,
      bands: r.bands.map((b) => ({ upTo: b.upToGrams === null ? '' : String(b.upToGrams), prices: moneyText(b.prices, currencies, language) })),
    })),
  }
}

/** Form to API body. Errors are keyed by field ("cod:CZK", "rate:0:band:1:upTo") and name the message to show. */
export function formToMethod(
  form: MethodForm,
  currencies: ShopCurrency[],
  language: string,
  defaultLanguage: string,
): { body?: MethodInput; errors: Record<string, MethodErrorKey> } {
  const errors: Record<string, MethodErrorKey> = {}
  const labels = Object.fromEntries(Object.entries(form.labels).map(([k, v]) => [k, v.trim()]).filter(([, v]) => v))
  if (!labels[defaultLanguage] || labels[defaultLanguage].length > 100) errors[`label:${defaultLanguage}`] = 'labelRequired'
  if (form.paymentMethods.length === 0) errors.payment = 'paymentRequired'

  const money = (map: Record<string, string>, prefix: string) => {
    const out: Record<string, number> = {}
    for (const c of currencies) {
      const text = map[c.code]?.trim() ?? ''
      if (!text) continue
      const minor = toMinor(text, c.decimals, language)
      if (minor === null) errors[`${prefix}:${c.code}`] = 'money'
      else out[c.code] = minor
    }
    return out
  }
  const codFees = form.paymentMethods.includes('CASH_ON_DELIVERY') ? money(form.codFees, 'cod') : {}
  const freeOver = money(form.freeOver, 'free')

  if (form.rates.length === 0) errors.rates = 'ratesRequired'
  const rates = form.rates.map((rate, i) => {
    let previous = 0
    return {
      zoneId: rate.zoneId,
      bands: rate.bands.map((band, j) => {
        const id = `rate:${i}:band:${j}`
        const last = j === rate.bands.length - 1
        const text = band.upTo.trim()
        let upToGrams: number | null = null
        if (text || !last) {
          const grams = Number(text)
          if (!/^\d+$/.test(text) || grams < 1 || grams > 1_000_000) errors[`${id}:upTo`] = 'upTo'
          else if (grams <= previous) errors[`${id}:upTo`] = 'upToOrder'
          else {
            upToGrams = grams
            previous = grams
          }
        }
        const prices = money(band.prices, `${id}:price`)
        const badPrice = currencies.some((c) => errors[`${id}:price:${c.code}`])
        if (Object.keys(prices).length === 0 && !badPrice) errors[`${id}:price`] = 'bandPrice'
        return { upToGrams, prices }
      }),
    }
  })

  if (Object.keys(errors).length) return { errors }
  return { errors, body: { labels, active: form.active, paymentMethods: form.paymentMethods, codFees, freeOver, rates } }
}
