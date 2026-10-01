import type { Address, CartItem, OrderRequest, PaymentMethod, Quote, QuoteRequest } from './types';

export interface CheckoutForm {
  email: string;
  name: string;
  phone: string;
  country: string;
  street: string;
  city: string;
  postalCode: string;
  isCompany: boolean;
  company: string;
  vatId: string;
  shipElsewhere: boolean;
  shipName: string;
  shipStreet: string;
  shipCity: string;
  shipPostalCode: string;
  shippingMethodId: string;
  paymentMethod: PaymentMethod | '';
  note: string;
  acceptTerms: boolean;
}

export const emptyForm: CheckoutForm = {
  email: '',
  name: '',
  phone: '',
  country: 'CZ',
  street: '',
  city: '',
  postalCode: '',
  isCompany: false,
  company: '',
  vatId: '',
  shipElsewhere: false,
  shipName: '',
  shipStreet: '',
  shipCity: '',
  shipPostalCode: '',
  shippingMethodId: '',
  paymentMethod: '',
  note: '',
  acceptTerms: false,
};

export const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  BANK_TRANSFER: 'Bankovní převod',
  CASH_ON_DELIVERY: 'Dobírka',
};

export type FieldKey =
  | 'email'
  | 'name'
  | 'phone'
  | 'street'
  | 'city'
  | 'postalCode'
  | 'company'
  | 'vatId'
  | 'shipName'
  | 'shipStreet'
  | 'shipCity'
  | 'shipPostalCode'
  | 'shipping'
  | 'payment'
  | 'note'
  | 'terms';
export type FieldErrors = Partial<Record<FieldKey, string>>;

/** Order of the fields on the page, for focusing the first error. */
export const FIELD_ORDER: FieldKey[] = ['email', 'name', 'phone', 'street', 'city', 'postalCode', 'company', 'vatId', 'shipName', 'shipStreet', 'shipCity', 'shipPostalCode', 'shipping', 'payment', 'note', 'terms'];

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CZ_SK_POSTAL = /^\d{3}\s?\d{2}$/;

function required(value: string, max: number, missing: string, tooLong: string): string | undefined {
  const v = value.trim();
  if (!v) return missing;
  return v.length > max ? tooLong : undefined;
}

function postal(value: string, country: string): string | undefined {
  const v = value.trim();
  if (!v) return 'Vyplňte PSČ.';
  if ((country === 'CZ' || country === 'SK') && !CZ_SK_POSTAL.test(v)) return 'Zadejte PSČ ve tvaru 110 00.';
  return v.length > 20 ? 'PSČ může mít nejvýše 20 znaků.' : undefined;
}

/** Field errors in Czech, checked before anything is sent; the limits match the API. */
export function validateCheckout(form: CheckoutForm, opts: { hasPhysical: boolean }): FieldErrors {
  const e: FieldErrors = {};
  const email = form.email.trim();
  if (!EMAIL.test(email) || email.length > 200) e.email = 'Zadejte platný e-mail.';
  e.name = required(form.name, 100, 'Vyplňte jméno a příjmení.', 'Jméno může mít nejvýše 100 znaků.');
  if (form.phone.trim().length > 30) e.phone = 'Telefon může mít nejvýše 30 znaků.';
  e.street = required(form.street, 200, 'Vyplňte ulici a číslo popisné.', 'Ulice může mít nejvýše 200 znaků.');
  e.city = required(form.city, 100, 'Vyplňte město.', 'Město může mít nejvýše 100 znaků.');
  e.postalCode = postal(form.postalCode, form.country);
  if (form.isCompany) {
    e.company = required(form.company, 100, 'Vyplňte název firmy.', 'Název firmy může mít nejvýše 100 znaků.');
    if (form.vatId.trim().length > 30) e.vatId = 'DIČ může mít nejvýše 30 znaků.';
  }
  if (opts.hasPhysical && form.shipElsewhere) {
    e.shipName = required(form.shipName, 100, 'Vyplňte jméno příjemce.', 'Jméno může mít nejvýše 100 znaků.');
    e.shipStreet = required(form.shipStreet, 200, 'Vyplňte ulici a číslo popisné.', 'Ulice může mít nejvýše 200 znaků.');
    e.shipCity = required(form.shipCity, 100, 'Vyplňte město.', 'Město může mít nejvýše 100 znaků.');
    e.shipPostalCode = postal(form.shipPostalCode, form.country);
  }
  if (opts.hasPhysical && !form.shippingMethodId) e.shipping = 'Vyberte dopravu.';
  if (!form.paymentMethod) e.payment = 'Vyberte způsob platby.';
  if (form.note.trim().length > 1000) e.note = 'Poznámka může mít nejvýše 1000 znaků.';
  if (!form.acceptTerms) e.terms = 'Pro odeslání objednávky je potřeba souhlasit s obchodními podmínkami.';
  return Object.fromEntries(Object.entries(e).filter(([, v]) => v)) as FieldErrors;
}

const optional = (v: string) => (v.trim() ? v.trim() : undefined);

/** The quote request for the cart and the current choices. */
export function quoteRequest(choices: Pick<CheckoutForm, 'country' | 'shippingMethodId' | 'paymentMethod'>, items: CartItem[]): QuoteRequest {
  return {
    items: items.map(({ variantId, quantity }) => ({ variantId, quantity })),
    country: choices.country,
    shippingMethodId: choices.shippingMethodId || undefined,
    paymentMethod: choices.paymentMethod || undefined,
  };
}

/** The order body: delivery goes to the billing address unless "Doručit na jinou adresu" is ticked. */
export function orderRequest(form: CheckoutForm, items: CartItem[], quote: Quote): OrderRequest {
  const billing: Address = {
    name: form.name.trim(),
    company: form.isCompany ? optional(form.company) : undefined,
    vatId: form.isCompany ? optional(form.vatId) : undefined,
    street: form.street.trim(),
    city: form.city.trim(),
    postalCode: form.postalCode.trim(),
    country: form.country,
  };
  let shipping: Address | undefined;
  if (quote.hasPhysical) {
    shipping = form.shipElsewhere
      ? { name: form.shipName.trim(), street: form.shipStreet.trim(), city: form.shipCity.trim(), postalCode: form.shipPostalCode.trim(), country: form.country }
      : { ...billing };
  }
  return {
    ...quoteRequest(form, items),
    customer: { email: form.email.trim(), name: form.name.trim(), phone: optional(form.phone) },
    billingAddress: billing,
    shippingAddress: shipping,
    note: optional(form.note),
    acceptTerms: form.acceptTerms,
    expectedTotal: quote.totals.total,
  };
}

/** Payment choices: those of the chosen shipping method; a digital-only cart pays by bank transfer. */
export function paymentOptions(quote: Quote | undefined, shippingMethodId: string): { method: PaymentMethod; fee: number }[] {
  if (!quote) return [];
  if (!quote.hasPhysical) return [{ method: 'BANK_TRANSFER', fee: 0 }];
  return quote.shippingOptions.find((o) => o.id === shippingMethodId)?.paymentMethods ?? [];
}

const KEY = 'flajsman.checkout.key';
let memoryKey: string | null = null;

/** One key per checkout attempt, so a double click or a retry returns the same order. */
export function checkoutKey(): string {
  try {
    const stored = sessionStorage.getItem(KEY);
    if (stored) return stored;
    const key = crypto.randomUUID();
    sessionStorage.setItem(KEY, key);
    return key;
  } catch {
    // Storage blocked: keep the key for this page.
    memoryKey ??= crypto.randomUUID();
    return memoryKey;
  }
}

export function forgetCheckoutKey(): void {
  memoryKey = null;
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // Nothing stored.
  }
}
