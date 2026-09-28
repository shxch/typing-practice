import { vi } from 'vitest'

/** Browser APIs jsdom doesn't have. */
export function installDomStubs() {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {}
}

/** The lesson text as shown by TypingArea. */
export function shownText(): string {
  return [...document.querySelectorAll('[data-i]')].map((el) => (el.textContent === '·' ? ' ' : el.textContent)).join('')
}

export const press = (key: string, init: KeyboardEventInit = {}) =>
  window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }))
