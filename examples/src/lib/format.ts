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
