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
  // Every kind of space (Czech groups digits with a narrow no-break space) counts as one space.
  const spaced = text.trim().replace(/[\s\u00a0\u202f]/g, ' ')
  const groupChar = /\s/.test(group) ? ' ' : group
  // A dot typed where the language uses a decimal comma is still a decimal point (Czech "490.5").
  const decimalChar = spaced.includes(decimal) ? decimal : decimal !== '.' && groupChar !== '.' && spaced.includes('.') ? '.' : decimal
  const [whole, fraction, extra] = spaced.split(decimalChar)
  if (extra !== undefined || whole === undefined) return null
  // Group separators are only allowed between groups of three digits, so "490,5" in English is not 4905.
  const escaped = groupChar.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const wholeOk = new RegExp(`^(\\d+|\\d{1,3}(${escaped}\\d{3})+)$`).test(whole)
  const fractionOk = fraction === undefined || (decimals > 0 && new RegExp(`^\\d{1,${Math.max(decimals, 1)}}$`).test(fraction))
  if (!wholeOk || !fractionOk) return null
  const digits = whole.split(groupChar).join('')
  return Number(digits) * 10 ** decimals + Number((fraction ?? '').padEnd(decimals, '0') || 0)
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
