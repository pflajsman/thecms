/** Format an ISO date string in Czech locale. */
export function formatDate(iso: string): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('cs-CZ', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

/** Two-digit zero-padded index, for the post list numbering. */
export function num(n: number): string {
  return String(n).padStart(2, '0');
}

/** Czech plural: 1 položka, 2 to 4 položky, 0 or 5 and more položek. */
export function plural(n: number, one: string, few: string, many: string): string {
  if (n === 1) return one;
  if (n >= 2 && n <= 4) return few;
  return many;
}
