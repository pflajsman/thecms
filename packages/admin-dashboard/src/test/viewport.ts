/** Make `(min-width: …)` media queries match (desktop) or not (mobile) for a test. */
export function setViewport(desktop: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: desktop && query.includes('min-width'),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
}
