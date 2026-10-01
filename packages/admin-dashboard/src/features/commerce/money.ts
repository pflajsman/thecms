/** Decimal and group separators of a language, from Intl (for example "," and " " in Czech). */
function separators(language: string): { decimal: string; group: string } {
  const parts = new Intl.NumberFormat(language).formatToParts(12345.6)
  return {
    decimal: parts.find((p) => p.type === 'decimal')?.value ?? '.',
    group: parts.find((p) => p.type === 'group')?.value ?? ',',
  }
}

/** Text typed in the admin language to integer minor units; null when it is not a valid price. */
export function toMinor(text: string, decimals: number, language: string): number | null {
  const { decimal, group } = separators(language)
  const cleaned = text.trim().replace(/\s/g, '').split(group.trim() || ' ').join('')
  const normalized = decimal === '.' ? cleaned : cleaned.replace(decimal, '.')
  const pattern = decimals > 0 ? new RegExp(`^\\d+(\\.\\d{1,${decimals}})?$`) : /^\d+$/
  if (!pattern.test(normalized)) return null
  const [whole, fraction = ''] = normalized.split('.')
  return Number(whole) * 10 ** decimals + Number(fraction.padEnd(decimals, '0') || 0)
}

export function fromMinor(minor: number, decimals: number, language: string): string {
  return new Intl.NumberFormat(language, { minimumFractionDigits: decimals, maximumFractionDigits: decimals, useGrouping: false }).format(minor / 10 ** decimals)
}

export function formatMoney(minor: number, currency: { code: string; decimals: number }, language: string): string {
  return new Intl.NumberFormat(language, {
    style: 'currency',
    currency: currency.code,
    minimumFractionDigits: currency.decimals,
    maximumFractionDigits: currency.decimals,
  }).format(minor / 10 ** currency.decimals)
}
