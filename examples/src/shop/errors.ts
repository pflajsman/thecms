import { ApiError } from '../lib/cms';
import type { FieldErrors, FieldKey } from './checkout-form';

export type CheckoutSection = 'cart' | 'shipping' | 'payment' | 'terms' | 'form';

export interface CheckoutProblem {
  section: CheckoutSection;
  text: string;
  /** The idempotency key was used for a different order: start over with a new one. */
  retryWithNewKey?: boolean;
  /** Fields the server refused. */
  fields?: FieldErrors;
}

// The server's messages are English; known reasons get Czech text.
const BY_REASON: Record<string, CheckoutProblem> = {
  PRICE_CHANGED: { section: 'form', text: 'Ceny se mezitím změnily. Zkontrolujte prosím souhrn a objednejte znovu.' },
  OUT_OF_STOCK: { section: 'cart', text: 'Některé zboží už není skladem v požadovaném množství.' },
  LINES: { section: 'cart', text: 'Některé zboží už nelze objednat.' },
  NO_SHIPPING: { section: 'shipping', text: 'Do této země bohužel nedoručujeme.' },
  SHIPPING_REQUIRED: { section: 'shipping', text: 'Vyberte prosím dopravu.' },
  PAYMENT_NOT_ALLOWED: { section: 'payment', text: 'Tento způsob platby není pro vybranou dopravu dostupný.' },
  PAYMENT_REQUIRED: { section: 'payment', text: 'Vyberte prosím způsob platby.' },
  TERMS: { section: 'terms', text: 'Pro odeslání objednávky je potřeba souhlasit s obchodními podmínkami.' },
  IDEMPOTENCY_KEY_REUSED: {
    section: 'form',
    text: 'Předchozí pokus o objednávku s jinými údaji mohl projít. Zkontrolujte prosím e-mail; dalším kliknutím odešlete novou objednávku.',
    retryWithNewKey: true,
  },
};

// Paths in the server's validation errors ("body.customer.email") to checkout fields.
const FIELD_BY_PATH: Record<string, FieldKey> = {
  'customer.email': 'email',
  'customer.name': 'name',
  'customer.phone': 'phone',
  'billingAddress.name': 'name',
  'billingAddress.company': 'company',
  'billingAddress.vatId': 'vatId',
  'billingAddress.street': 'street',
  'billingAddress.city': 'city',
  'billingAddress.postalCode': 'postalCode',
  'shippingAddress.name': 'shipName',
  'shippingAddress.street': 'shipStreet',
  'shippingAddress.city': 'shipCity',
  'shippingAddress.postalCode': 'shipPostalCode',
  note: 'note',
};

function refusedFields(body: Record<string, unknown>): FieldErrors {
  const fields: FieldErrors = {};
  for (const detail of Array.isArray(body.details) ? body.details : []) {
    const key = FIELD_BY_PATH[String((detail as { path?: unknown }).path ?? '').replace(/^body\./, '')];
    if (key) fields[key] = key === 'email' ? 'Zadejte platný e-mail.' : 'Zkontrolujte prosím tento údaj.';
  }
  return fields;
}

/** What the checkout shows for a failed order request. */
export function checkoutProblem(error: unknown): CheckoutProblem {
  if (error instanceof ApiError) {
    const known = error.reason ? BY_REASON[error.reason] : undefined;
    if (known) return known;
    const fields = error.status === 400 ? refusedFields(error.body) : {};
    if (Object.keys(fields).length) return { section: 'form', text: 'Zkontrolujte prosím označené údaje.', fields };
    if (error.status === 429) return { section: 'form', text: 'Příliš mnoho pokusů, zkuste to prosím za minutu.' };
    return { section: 'form', text: 'Objednávku se nepodařilo odeslat. Zkuste to prosím znovu.' };
  }
  return { section: 'form', text: 'Nepodařilo se spojit se serverem. Zkontrolujte připojení a zkuste to znovu.' };
}
