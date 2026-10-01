import type { ProductOption, Variant } from './commerce-api'

export function combinations(options: ProductOption[]): Record<string, string>[] {
  return options.reduce<Record<string, string>[]>((acc, o) => acc.flatMap((c) => o.values.map((v) => ({ ...c, [o.key]: v.key }))), [{}])
}

const same = (a: Record<string, string>, b: Record<string, string>) =>
  Object.keys(a).length === Object.keys(b).length && Object.entries(a).every(([k, v]) => b[k] === v)

/** Variants the server removes when these options are applied (backend products.service regenerate). */
export function removedByOptions<V extends Pick<Variant, 'id' | 'optionValues'>>(variants: V[], options: ProductOption[]): V[] {
  const wanted = combinations(options)
  const keys = options.map((o) => o.key)
  const project = (values: Record<string, string>) => ({
    ...Object.fromEntries(options.map((o) => [o.key, o.values[0]?.key])),
    ...Object.fromEntries(Object.entries(values ?? {}).filter(([k]) => keys.includes(k))),
  })
  const kept: Record<string, string>[] = []
  return variants.filter((v) => {
    const p = project(v.optionValues)
    const match = wanted.find((w) => same(w, p))
    if (match && !kept.some((k) => same(k, match))) {
      kept.push(match)
      return false
    }
    return true
  })
}
