import { ApiError } from '../lib/cms';
import { checkoutProblem } from './errors';

const apiError = (status: number, reason?: string) => new ApiError('x', status, reason ? { reason } : {});

it('maps server reasons to Czech messages at the right section', () => {
  expect(checkoutProblem(apiError(409, 'PRICE_CHANGED'))).toMatchObject({ section: 'form', text: expect.stringContaining('Ceny se mezitím změnily') });
  expect(checkoutProblem(apiError(409, 'OUT_OF_STOCK')).section).toBe('cart');
  expect(checkoutProblem(apiError(400, 'NO_SHIPPING')).section).toBe('shipping');
  expect(checkoutProblem(apiError(400, 'PAYMENT_NOT_ALLOWED')).section).toBe('payment');
  expect(checkoutProblem(apiError(400, 'TERMS')).section).toBe('terms');
  expect(checkoutProblem(apiError(422, 'IDEMPOTENCY_KEY_REUSED'))).toMatchObject({ retryWithNewKey: true });
});

it('explains rate limits, unknown errors and network failures', () => {
  expect(checkoutProblem(apiError(429)).text).toContain('za minutu');
  expect(checkoutProblem(apiError(500)).text).toContain('Objednávku se nepodařilo odeslat');
  expect(checkoutProblem(new TypeError('Failed to fetch')).text).toContain('Nepodařilo se spojit se serverem');
});
