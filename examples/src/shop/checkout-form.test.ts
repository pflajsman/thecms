import { quoteFor } from '../test/shop-fixtures';
import { checkoutKey, emptyForm, forgetCheckoutKey, orderRequest, paymentOptions, validateCheckout } from './checkout-form';

const filled = { ...emptyForm, email: 'jana@example.test', name: 'Jana', street: 'Hlavní 1', city: 'Praha', postalCode: '110 00', shippingMethodId: 'x', paymentMethod: 'BANK_TRANSFER' as const, acceptTerms: true };
const items = [{ variantId: 'v-tee-s', productId: 'p-tee', quantity: 1 }];

it('names every missing or invalid field in Czech', () => {
  expect(validateCheckout(emptyForm, { hasPhysical: true })).toEqual({
    email: 'Zadejte platný e-mail.',
    name: 'Vyplňte jméno a příjmení.',
    street: 'Vyplňte ulici a číslo popisné.',
    city: 'Vyplňte město.',
    postalCode: 'Vyplňte PSČ.',
    shipping: 'Vyberte dopravu.',
    payment: 'Vyberte způsob platby.',
    terms: 'Pro odeslání objednávky je potřeba souhlasit s obchodními podmínkami.',
  });
  expect(validateCheckout({ ...filled, postalCode: '1100' }, { hasPhysical: true })).toEqual({ postalCode: 'Zadejte PSČ ve tvaru 110 00.' });
  expect(validateCheckout({ ...filled, country: 'DE', postalCode: '10115' }, { hasPhysical: true })).toEqual({});
  expect(validateCheckout({ ...filled, isCompany: true }, { hasPhysical: true })).toEqual({ company: 'Vyplňte název firmy.' });
  expect(validateCheckout({ ...filled, shipElsewhere: true }, { hasPhysical: true })).toMatchObject({ shipName: 'Vyplňte jméno příjemce.' });
  expect(validateCheckout({ ...filled, shippingMethodId: '' }, { hasPhysical: false })).toEqual({});
});

it('builds the order with a separate delivery address and company details', () => {
  const quote = quoteFor({ items: [{ variantId: 'v-tee-s', quantity: 1 }], country: 'CZ' });
  const body = orderRequest(
    { ...filled, isCompany: true, company: 'Kola s.r.o.', vatId: 'CZ123', shipElsewhere: true, shipName: 'Petr', shipStreet: 'Dlouhá 2', shipCity: 'Brno', shipPostalCode: '602 00', note: '  ' },
    items,
    quote,
  );
  expect(body.billingAddress).toEqual({ name: 'Jana', company: 'Kola s.r.o.', vatId: 'CZ123', street: 'Hlavní 1', city: 'Praha', postalCode: '110 00', country: 'CZ' });
  expect(body.shippingAddress).toEqual({ name: 'Petr', street: 'Dlouhá 2', city: 'Brno', postalCode: '602 00', country: 'CZ' });
  expect(body.note).toBeUndefined();
  expect(body.expectedTotal).toBe(quote.totals.total);
});

it('sends no delivery address for a digital-only cart and offers bank transfer only', () => {
  const quote = quoteFor({ items: [{ variantId: 'v-guide', quantity: 1 }], country: 'CZ' });
  expect(orderRequest(filled, [{ variantId: 'v-guide', productId: 'p-guide', quantity: 1 }], quote).shippingAddress).toBeUndefined();
  expect(paymentOptions(quote, '')).toEqual([{ method: 'BANK_TRANSFER', fee: 0 }]);
});

it('keeps one idempotency key until it is dropped', () => {
  const first = checkoutKey();
  expect(checkoutKey()).toBe(first);
  forgetCheckoutKey();
  expect(checkoutKey()).not.toBe(first);
});
