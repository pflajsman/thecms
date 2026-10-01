/** Country name in the admin language, or the code when the browser has no name for it. */
export function countryName(code: string, language: string): string {
  try {
    return new Intl.DisplayNames([language], { type: 'region' }).of(code) ?? code
  } catch {
    return code
  }
}

/** Codes typed as "cz, sk at": uppercased, without repeats; anything that is not two letters is invalid. */
export function parseCountries(text: string): { codes: string[]; invalid: string[] } {
  const parts = text.split(/[\s,;]+/).map((p) => p.trim().toUpperCase()).filter(Boolean)
  const valid = (p: string) => /^[A-Z]{2}$/.test(p)
  return { codes: [...new Set(parts.filter(valid))], invalid: parts.filter((p) => !valid(p)) }
}
