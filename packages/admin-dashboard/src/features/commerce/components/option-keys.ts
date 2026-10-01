import { toApiKey } from '@/features/builder/api-key'

/** A key for a new option or value from its label: lowercase letters, digits and hyphens, unique. */
export function optionKey(label: string, taken: string[]): string {
  const base = toApiKey(label).replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/^[^a-z]+/, '').slice(0, 40) || 'option'
  let key = base
  for (let n = 2; taken.includes(key); n++) {
    const suffix = `-${n}`
    // Shorten the base, not the suffix, so long labels still get distinct keys.
    key = `${base.slice(0, 40 - suffix.length).replace(/-+$/, '')}${suffix}`
  }
  return key
}

/** Drop empty labels so saved data only holds what the editor typed. */
export function cleanLabels(labels: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(labels).map(([k, v]) => [k, v.trim()]).filter(([, v]) => v !== ''))
}
