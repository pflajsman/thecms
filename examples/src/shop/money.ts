/** Minor units to Czech money text: "1 290 Kč", or "129,50 Kč" when there are hundredths. */
export function formatPrice(minor: number, currency: string, decimals = 2): string {
  const value = minor / 10 ** decimals;
  const fraction = Number.isInteger(value) ? 0 : decimals;
  return new Intl.NumberFormat('cs-CZ', {
    style: 'currency',
    currency,
    minimumFractionDigits: fraction,
    maximumFractionDigits: fraction,
  }).format(value);
}
