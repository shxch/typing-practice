// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createState, typeChar } from '../../src/engine/typing'
import { dayKey } from '../../src/lessons/stats'
import { Practice } from '../../src/pages/Practice'
import { useApp } from '../../src/store/app'
import type { InProgress } from '../../src/store/types'
import { installDomStubs, press, shownText } from '../helpers/dom'
import { makeSession } from '../helpers/session'
import { resetStore } from '../helpers/store'

vi.mock('../../src/sync/runner', () => ({ syncNow: vi.fn(async () => {}), describeError: () => '' }))

beforeEach(() => {
  installDomStubs()
  resetStore()
  useApp.getState().updateSettings({ lang: 'en' })
  useApp.getState().setConfig({ device: 'mac' })
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const ip = () => useApp.getState().shared.inProgress
const lesson = (text: string, patch: Partial<InProgress> = {}): InProgress => ({
  id: 'L1',
  startedAt: Date.now(),
  device: 'mac',
  units: 1,
  earnedUnits: 1,
  state: createState(text, 'stop'),
  ...patch,
})
const typeAll = (text: string) => {
  for (const ch of text) act(() => void press(ch))
}

describe('typing a lesson', () => {
  it('shows a lesson and moves it into the shared store on the first key', () => {
    render(<Practice />)
    const text = shownText()
    expect(text.length).toBeGreaterThan(10)
    expect(ip()).toBeNull()
    const before = Date.now()
    act(() => void press(text[0]))
    expect(ip()!.state.pos).toBe(1)
    expect(ip()!.startedAt).toBeGreaterThanOrEqual(before)
    expect(ip()!.state.text).toBe(text)
  })

  it('a wrong key in stop mode does not advance', () => {
    render(<Practice />)
    const text = shownText()
    const wrong = text[0] === 'q' ? 'w' : 'q'
    act(() => void press(wrong))
    expect(ip()!.state.pos).toBe(0)
    expect(ip()!.state.presses).toBe(1)
  })

  it('ignores shortcuts, auto-repeat, modifier keys and typing in form fields', () => {
    render(
      <>
        <input data-testid="field" />
        <Practice />
      </>,
    )
    const text = shownText()
    act(() => void press(text[0], { ctrlKey: true }))
    act(() => void press(text[0], { metaKey: true }))
    act(() => void press(text[0], { altKey: true }))
    act(() => void press(text[0], { repeat: true }))
    act(() => void press('Shift'))
    act(() => void screen.getByTestId('field').dispatchEvent(new KeyboardEvent('keydown', { key: text[0], bubbles: true })))
    expect(ip()).toBeNull()
  })

  it('warns about an active IME and about Caps Lock', () => {
    render(<Practice />)
    act(() => void press('Process'))
    expect(screen.getByText(/input method|IME|English/i)).toBeTruthy()
    const e = new KeyboardEvent('keydown', { key: 'A', bubbles: true })
    Object.defineProperty(e, 'getModifierState', { value: (k: string) => k === 'CapsLock' })
    act(() => void window.dispatchEvent(e))
    expect(screen.getByText(/Caps Lock is on/)).toBeTruthy()
  })

  it('two keys handled before React re-renders are both counted', () => {
    useApp.getState().setInProgress(lesson('fjfj'))
    render(<Practice />)
    act(() => {
      press('f')
      press('j')
    })
    expect(ip()!.state.pos).toBe(2)
  })

  it('finishing records a session and shows the result; Enter starts the next round', () => {
    useApp.getState().setInProgress(lesson('fj'))
    render(<Practice />)
    typeAll('fj')
    const sessions = Object.values(useApp.getState().sessions)
    expect(sessions).toHaveLength(1)
    expect(sessions[0]).toMatchObject({ id: 'L1', device: 'mac', units: 1, earnedUnits: 1, chars: 2, accuracy: 1 })
    expect(ip()).toBeNull()
    expect(screen.getByText(/Next round/)).toBeTruthy()
    act(() => void press('Enter'))
    expect(screen.queryByText(/Next round/)).toBeNull()
    expect(shownText().length).toBeGreaterThan(0)
  })

  it('"New text" discards the unfinished lesson', () => {
    useApp.getState().setInProgress(lesson('fjfj'))
    render(<Practice />)
    typeAll('f')
    act(() => screen.getByText('New text').click())
    expect(ip()).toBeNull()
    expect(Object.keys(useApp.getState().sessions)).toHaveLength(0)
  })
})

describe('resuming', () => {
  it('shows where the lesson came from and does not time the first key across devices', () => {
    let st = typeChar(createState('fjfj', 'stop'), 'f', Date.now() - 1000)
    st = typeChar(st, 'j', Date.now() - 800)
    useApp.getState().setInProgress(lesson('fjfj', { device: 'tv', state: st }))
    render(<Practice />)
    expect(screen.getByText(/tv/)).toBeTruthy()
    const elapsed = ip()!.state.elapsedMs
    act(() => void press('f'))
    expect(ip()!.state.elapsedMs).toBe(elapsed)
    expect(ip()!.state.pos).toBe(3)
  })

  it('a lesson started yesterday and finished today counts for today', () => {
    const yesterday = Date.now() - 26 * 3600_000
    const st = typeChar(createState('fj', 'stop'), 'f', yesterday)
    useApp.getState().setInProgress(lesson('fj', { startedAt: yesterday, state: st }))
    render(<Practice />)
    typeAll('j')
    const s = Object.values(useApp.getState().sessions)[0]
    expect(dayKey(s.startedAt)).toBe(dayKey(Date.now()))
  })

  it('a round that completes the daily goal celebrates it', () => {
    useApp.getState().updateSettings({ dailyGoalMinutes: 1 })
    const st = { ...typeChar(createState('fj', 'stop'), 'f', Date.now() - 100), elapsedMs: 70_000 }
    useApp.getState().setInProgress(lesson('fj', { state: st }))
    render(<Practice />)
    typeAll('j')
    expect(screen.getByText(/today's goal is done/)).toBeTruthy()
  })
})

describe('manual jump', () => {
  it('rounds played after a jump record the practice-earned units separately', () => {
    useApp.getState().updateSettings({ manualUnits: 10 })
    render(<Practice />)
    const text = shownText()
    typeAll(text)
    const s = Object.values(useApp.getState().sessions)[0]
    expect(s.units).toBe(10)
    expect(s.earnedUnits).toBe(1)
  })

  it('the jump is cleared once practice has caught up with it', () => {
    useApp.setState((st) => ({ sessions: { old: makeSession({ id: 'old', units: 3, startedAt: 1 }) }, shared: { ...st.shared } }))
    useApp.getState().updateSettings({ manualUnits: 2 })
    useApp.getState().setInProgress(lesson('fj', { units: 3, earnedUnits: 3 }))
    render(<Practice />)
    typeAll('fj')
    expect(useApp.getState().shared.settings.manualUnits).toBeNull()
  })
})
