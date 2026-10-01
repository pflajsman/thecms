import type { BankAccount, ShopSettings } from './commerce-api'

export interface AccountForm {
  currency: string
  holder: string
  accountNumber: string
  iban: string
  bic: string
}

export interface CheckoutForm {
  accounts: AccountForm[]
  unpaidCancelDays: string
  downloadDays: string
  downloadLimit: string
  shopEmail: string
  termsUrl: string
}

export interface CheckoutBody {
  bankAccounts: BankAccount[]
  unpaidCancelDays: number
  downloadDays: number
  downloadLimit: number
  shopEmail: string | null
  termsUrl: string | null
}

export type CheckoutErrorKey = 'holder' | 'account' | 'iban' | 'bic' | 'unpaidCancelDays' | 'downloadDays' | 'downloadLimit' | 'email' | 'url'

// Same rules as the backend settings schema.
const IBAN = /^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/
const BIC = /^[A-Z0-9]{8}([A-Z0-9]{3})?$/
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function checkoutToForm(settings: ShopSettings): CheckoutForm {
  return {
    // An account of a removed currency cannot be shown or edited, so it is not kept.
    accounts: (settings.bankAccounts ?? []).filter((a) => settings.currencies.some((c) => c.code === a.currency)).map((a) => ({ currency: a.currency, holder: a.holder, accountNumber: a.accountNumber ?? '', iban: a.iban ?? '', bic: a.bic ?? '' })),
    unpaidCancelDays: String(settings.unpaidCancelDays ?? 14),
    downloadDays: String(settings.downloadDays ?? 30),
    downloadLimit: String(settings.downloadLimit ?? 5),
    shopEmail: settings.shopEmail ?? '',
    termsUrl: settings.termsUrl ?? '',
  }
}

function whole(text: string, min: number, max: number): number | null {
  const trimmed = text.trim()
  return /^\d+$/.test(trimmed) && Number(trimmed) >= min && Number(trimmed) <= max ? Number(trimmed) : null
}

function isHttpUrl(text: string): boolean {
  try {
    return ['http:', 'https:'].includes(new URL(text).protocol)
  } catch {
    return false
  }
}

/** Errors are keyed by the input id they belong to. */
export function formToCheckout(form: CheckoutForm): { body?: CheckoutBody; errors: Record<string, CheckoutErrorKey> } {
  const errors: Record<string, CheckoutErrorKey> = {}
  const bankAccounts = form.accounts.map((a) => {
    const id = `account-${a.currency}`
    const holder = a.holder.trim()
    const accountNumber = a.accountNumber.trim()
    const iban = a.iban.replace(/\s/g, '').toUpperCase()
    const bic = a.bic.replace(/\s/g, '').toUpperCase()
    if (!holder || holder.length > 100) errors[`${id}-holder`] = 'holder'
    if ((!accountNumber && !iban) || accountNumber.length > 40) errors[`${id}-accountNumber`] = 'account'
    if (iban && !IBAN.test(iban)) errors[`${id}-iban`] = 'iban'
    if (bic && !BIC.test(bic)) errors[`${id}-bic`] = 'bic'
    return { currency: a.currency, holder, ...(accountNumber ? { accountNumber } : {}), ...(iban ? { iban } : {}), ...(bic ? { bic } : {}) }
  })
  const unpaidCancelDays = whole(form.unpaidCancelDays, 1, 90)
  const downloadDays = whole(form.downloadDays, 1, 365)
  const downloadLimit = whole(form.downloadLimit, 1, 100)
  if (unpaidCancelDays === null) errors['unpaid-days'] = 'unpaidCancelDays'
  if (downloadDays === null) errors['download-days'] = 'downloadDays'
  if (downloadLimit === null) errors['download-limit'] = 'downloadLimit'
  const shopEmail = form.shopEmail.trim()
  if (shopEmail && !EMAIL.test(shopEmail)) errors['shop-email'] = 'email'
  const termsUrl = form.termsUrl.trim()
  if (termsUrl && !isHttpUrl(termsUrl)) errors['terms-url'] = 'url'
  if (Object.keys(errors).length || unpaidCancelDays === null || downloadDays === null || downloadLimit === null) return { errors }
  return { errors, body: { bankAccounts, unpaidCancelDays, downloadDays, downloadLimit, shopEmail: shopEmail || null, termsUrl: termsUrl || null } }
}
