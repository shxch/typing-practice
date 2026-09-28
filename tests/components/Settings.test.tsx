// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Settings } from '../../src/pages/Settings'
import { useApp } from '../../src/store/app'
import { installDomStubs } from '../helpers/dom'
import { makeSession } from '../helpers/session'
import { resetStore } from '../helpers/store'

vi.mock('../../src/sync/runner', () => ({ syncNow: vi.fn(async () => {}), describeError: () => '' }))

beforeEach(() => {
  installDomStubs()
  resetStore()
  useApp.getState().updateSettings({ lang: 'en' })
})
afterEach(cleanup)

const settings = () => useApp.getState().shared.settings
const field = (label: RegExp) => screen.getByLabelText(label) as HTMLInputElement
const typeInto = (el: HTMLInputElement, value: string) => {
  for (let i = 1; i <= value.length; i++) fireEvent.change(el, { target: { value: value.slice(0, i) } })
}

describe('number fields', () => {
  it('can be cleared and retyped without jumping to the minimum', () => {
    render(<Settings />)
    const words = field(/Words per round/)
    fireEvent.change(words, { target: { value: '' } })
    expect(words.value).toBe('')
    typeInto(words, '12')
    expect(words.value).toBe('12')
    fireEvent.blur(words)
    expect(settings().lessonWords).toBe(12)
  })

  it('clamps out-of-range values when leaving the field or pressing Enter', () => {
    render(<Settings />)
    const wpm = field(/Target speed/)
    fireEvent.change(wpm, { target: { value: '500' } })
    fireEvent.keyDown(wpm, { key: 'Enter' })
    expect(settings().targetWpm).toBe(100)
    expect(wpm.value).toBe('100')
    fireEvent.change(wpm, { target: { value: '' } })
    fireEvent.blur(wpm)
    expect(settings().targetWpm).toBe(100) // empty = keep the old value
    expect(wpm.value).toBe('100')
  })

  it('does not re-stamp settings on every keystroke', () => {
    render(<Settings />)
    const goal = field(/Daily goal/)
    const stamp = useApp.getState().shared.settingsUpdatedAt
    typeInto(goal, '30')
    expect(useApp.getState().shared.settingsUpdatedAt).toBe(stamp)
    fireEvent.blur(goal)
    expect(settings().dailyGoalMinutes).toBe(30)
  })

  it('accuracy is shown in percent and stored as a fraction', () => {
    render(<Settings />)
    const acc = field(/Target accuracy/)
    expect(acc.value).toBe('95')
    fireEvent.change(acc, { target: { value: '90' } })
    fireEvent.blur(acc)
    expect(settings().targetAccuracy).toBeCloseTo(0.9)
  })

  it('shows changes made elsewhere (e.g. synced from another device)', () => {
    render(<Settings />)
    act(() => useApp.getState().updateSettings({ lessonWords: 33 }))
    expect(field(/Words per round/).value).toBe('33')
  })
})

describe('device name', () => {
  it('an empty name falls back to a default', () => {
    render(<Settings />)
    const name = field(/Device name/)
    fireEvent.change(name, { target: { value: '   ' } })
    fireEvent.blur(name)
    expect(useApp.getState().config.device.trim().length).toBeGreaterThan(0)
  })
})

describe('course slider', () => {
  it('jumping ahead sets a manual jump; undo clears it', () => {
    render(<Settings />)
    const slider = screen.getByRole('slider', { name: /Course progress/ })
    fireEvent.change(slider, { target: { value: '10' } })
    expect(settings().manualUnits).toBe(10)
    expect(screen.getByText(/Jumped ahead/)).toBeTruthy()
    fireEvent.click(screen.getByText('Undo the jump'))
    expect(settings().manualUnits).toBeNull()
  })

  it('hides the jump note once practice has caught up with it', () => {
    useApp.setState({ sessions: { a: makeSession({ id: 'a', units: 12, earnedUnits: 12 }) } })
    useApp.getState().updateSettings({ manualUnits: 10 })
    render(<Settings />)
    expect(screen.queryByText(/Jumped ahead/)).toBeNull()
    expect(screen.queryByText('Undo the jump')).toBeNull()
  })

  it('cannot go below what practice unlocked', () => {
    useApp.setState({ sessions: { a: makeSession({ id: 'a', units: 5, earnedUnits: 5 }) } })
    render(<Settings />)
    fireEvent.change(screen.getByRole('slider', { name: /Course progress/ }), { target: { value: '2' } })
    expect(settings().manualUnits).toBeNull()
  })
})
