// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TypingArea } from '../../src/components/TypingArea'
import { backspace, createState, typeChar } from '../../src/engine/typing'
import { installDomStubs } from '../helpers/dom'

beforeEach(installDomStubs)
afterEach(cleanup)

const cell = (c: HTMLElement, i: number) => c.querySelector(`[data-i="${i}"]`) as HTMLElement

describe('TypingArea', () => {
  it('renders every character once, words kept whole with their trailing space', () => {
    const { container } = render(<TypingArea state={createState('ab cd ef', 'stop')} />)
    expect(container.querySelectorAll('[data-i]')).toHaveLength(8)
    const words = [...container.querySelectorAll('.inline-block')].map((w) => w.textContent)
    expect(words).toEqual(['ab ', 'cd ', 'ef'])
  })

  it('colors typed, fixed, wrong and pending characters differently', () => {
    let s = createState('abcd', 'backspace')
    s = typeChar(s, 'a', 1)
    s = typeChar(s, 'x', 2)
    s = backspace(s)
    s = typeChar(s, 'b', 3)
    s = typeChar(s, 'z', 4)
    const { container } = render(<TypingArea state={s} />)
    expect(cell(container, 0).className).toContain('text-slate-800')
    expect(cell(container, 1).className).toContain('text-amber-500')
    expect(cell(container, 2).className).toContain('bg-rose-500')
    expect(cell(container, 3).className).toContain('text-theme-900') // the caret position
  })

  it('shows a mistyped space as a visible dot', () => {
    const s = typeChar(typeChar(createState('a b', 'backspace'), 'a', 1), 'x', 2)
    const { container } = render(<TypingArea state={s} />)
    expect(cell(container, 1).textContent).toBe('·')
  })

  it('keeps the caret in view as the text moves on', () => {
    const spy = vi.fn()
    Element.prototype.scrollIntoView = spy
    const s = createState('ab cd', 'stop')
    const { rerender } = render(<TypingArea state={s} />)
    rerender(<TypingArea state={typeChar(s, 'a', 1)} />)
    expect(spy).toHaveBeenCalled()
    expect(spy.mock.calls.at(-1)![0]).toMatchObject({ block: 'nearest' })
  })

  it('handles an empty or finished lesson without a caret', () => {
    const done = typeChar(createState('a', 'stop'), 'a', 1)
    expect(() => render(<TypingArea state={done} />)).not.toThrow()
    expect(() => render(<TypingArea state={createState('', 'stop')} />)).not.toThrow()
  })
})
