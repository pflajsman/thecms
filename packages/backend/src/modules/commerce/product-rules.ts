import { AppError } from '../../middleware/error.middleware';
import type { ProductOption } from '../../models/product.model';

/** Labels must include the default language and use only configured language codes. */
export function assertLabels(labels: Record<string, string>, codes: string[], defaultCode: string, what: string): void {
  if (!labels[defaultCode]) throw new AppError(`${what} needs a label in ${defaultCode}`, 400);
  const unknown = Object.keys(labels).filter((c) => !codes.includes(c));
  if (unknown.length) throw new AppError(`${what} has labels in unknown languages: ${unknown.join(', ')}`, 400);
}

export function assertOptions(options: ProductOption[], codes: string[], defaultCode: string): void {
  const keys = options.map((o) => o.key);
  if (new Set(keys).size !== keys.length) throw new AppError('Option keys must be unique', 400);
  for (const o of options) {
    assertLabels(o.labels, codes, defaultCode, `Option ${o.key}`);
    const valueKeys = o.values.map((v) => v.key);
    if (new Set(valueKeys).size !== valueKeys.length) throw new AppError(`Values of option ${o.key} must be unique`, 400);
    for (const v of o.values) assertLabels(v.labels, codes, defaultCode, `Value ${o.key}.${v.key}`);
  }
}

/** Every combination of option values, as { optionKey: valueKey }. */
export function combinations(options: ProductOption[]): Record<string, string>[] {
  return options.reduce<Record<string, string>[]>(
    (acc, o) => acc.flatMap((combo) => o.values.map((v) => ({ ...combo, [o.key]: v.key }))),
    [{}]
  );
}

export const sameCombo = (a: Record<string, string>, b: Record<string, string>) =>
  Object.keys(a).length === Object.keys(b).length && Object.entries(a).every(([k, v]) => b[k] === v);

export function skuFromName(name: string): string {
  const base = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return (base || 'PRODUCT').slice(0, 56);
}
