import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import { i18n } from '@/i18n'

afterEach(() => {
  cleanup()
  document.documentElement.classList.remove('dark')
  // Every test starts in English; tests that check Czech switch explicitly.
  void i18n.changeLanguage('en')
  document.documentElement.lang = 'en'
})

if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList
}

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver
Element.prototype.scrollIntoView ??= function scrollIntoView() {}
Element.prototype.hasPointerCapture ??= () => false
Element.prototype.setPointerCapture ??= () => {}
Element.prototype.releasePointerCapture ??= () => {}
// ProseMirror measures ranges when it scrolls the selection into view; jsdom has no layout.
const emptyRects = () => ({ length: 0, item: () => null, [Symbol.iterator]: [][Symbol.iterator] }) as unknown as DOMRectList
Range.prototype.getClientRects ??= emptyRects
Range.prototype.getBoundingClientRect ??= () => new DOMRect()
