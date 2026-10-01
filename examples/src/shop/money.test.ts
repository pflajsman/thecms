import { formatPrice } from './money';

const plain = (s: string) => s.replace(/\s/g, ' ');

it('shows whole crowns without decimals and hundredths when there are some', () => {
  expect(plain(formatPrice(129000, 'CZK'))).toBe('1 290 Kč');
  expect(plain(formatPrice(12950, 'CZK'))).toBe('129,50 Kč');
  expect(plain(formatPrice(0, 'CZK'))).toBe('0 Kč');
});

it('uses the currency decimals', () => {
  expect(plain(formatPrice(1290, 'CZK', 0))).toBe('1 290 Kč');
  expect(plain(formatPrice(2050, 'EUR'))).toBe('20,50 €');
});
