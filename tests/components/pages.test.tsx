// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../src/App'
import { BadgeIcon } from '../../src/components/BadgeIcon'
import { ResultCard } from '../../src/components/ResultCard'
import { SyncBadge } from '../../src/components/SyncBadge'
import { UNITS, unitChars } from '../../src/lessons/curriculum'
import { BADGES } from '../../src/rewards/badges'
import { useApp } from '../../src/store/app'
import type { Session } from '../../src/store/types'
import { installDomStubs } from '../helpers/dom'
import { makeSession, statsFor } from '../helpers/session'
import { resetStore } from '../helpers/store'

vi.mock('../../src/sync/runner', () => ({ syncNow: vi.fn(async () => {}), describeError: () => '' }))

beforeEach(() => {
  installDomStubs()
  resetStore()
})
afterEach(cleanup)

/** ~200 rounds over 90 days, including an odd 0 ms sample and a manual jump. */
function bigLog(): Record<string, Session> {
  const out: Record<string, Session> = {}
  const start = Date.now() - 90 * 86400_000
  for (let i = 0; i < 200; i++) {
    const units = Math.min(UNITS.length, 1 + Math.floor(i / 8))
    const s = makeSession({
      id: `s${i}`,
      startedAt: start + i * 10 * 3600_000,
      units,
      earnedUnits: units,
      wpm: 5 + (i % 40),
      accuracy: 0.8 + (i % 20) / 100,
      durationMs: 90_000 + (i % 7) * 30_000,
      device: i % 3 ? 'mac' : 'tv',
      keyStats: statsFor(unitChars(units), 300 + (i % 9) * 60, 12, i % 3),
    })
    out[s.id] = s
  }
  out.s0.keyStats.f = { n: 1, miss: 0, t: 1, ms: 0 }
  return out
}

const noBadText = () => {
  const text = document.body.textContent ?? ''
  expect(text).not.toMatch(/NaN|Infinity|undefined|\[object/)
}

describe.each([
  ['empty', () => ({})],
  ['large', bigLog],
])('every page with %s data', (_, data) => {
  it('renders without broken values', () => {
    useApp.setState({ sessions: data() })
    render(<App />)
    noBadText()
    for (const tab of ['Stats', 'Badges', 'Settings', 'Practice']) {
      act(() => fireEvent.click(screen.getAllByRole('button', { name: tab })[0]))
      noBadText()
    }
  })
})

describe('ResultCard', () => {
  it('shows stars, badges, level-up and new keys, and the next-round button works', () => {
    const onNext = vi.fn()
    render(
      <ResultCard
        result={{
          wpm: 23.6,
          accuracy: 0.974,
          score: 812.7,
          topScore: 812.7,
          newTopScore: true,
          slowest: [{ ch: ' ', ms: 500 }, { ch: 'q', ms: 900 }],
          newKeys: ['r'],
          stars: 2,
          goalJustDone: true,
          streak: 3,
          levelUp: 'Key Rookie',
          badges: [BADGES[0]],
        }}
        onNext={onNext}
      />,
    )
    // Shown numbers round down: 23.6 WPM is not 24 yet.
    expect(screen.getByText('23')).toBeTruthy()
    expect(screen.getByText('97%')).toBeTruthy()
    expect(screen.getByText('812')).toBeTruthy()
    expect(screen.getByText('🏆 New top score!')).toBeTruthy()
    expect(screen.getByText(BADGES[0].name)).toBeTruthy()
    noBadText()
    fireEvent.click(screen.getByRole('button'))
    expect(onNext).toHaveBeenCalled()
  })
})

describe('BadgeIcon', () => {
  it('shows the emoji until its picture has arrived', () => {
    const badge = BADGES.find((b) => b.id === 'rounds-1')!
    const { container } = render(<BadgeIcon badge={badge} />)
    expect(screen.getByText(badge.icon)).toBeTruthy()
    for (const img of container.querySelectorAll('img')) fireEvent.load(img)
    expect(screen.queryByText(badge.icon)).toBeNull()
    expect(container.querySelector('.opacity-0')).toBeNull()
  })
})

describe('SyncBadge', () => {
  it('spins while syncing and stops at the end of a turn once the sync is done', () => {
    const { container } = render(<SyncBadge />)
    const svg = () => container.querySelector('svg')!
    const button = screen.getByRole('button')
    expect(svg().getAttribute('class')).not.toContain('animate-spin')
    act(() => useApp.setState({ status: 'syncing' }))
    expect(svg().getAttribute('class')).toContain('animate-spin')
    const width = button.className
    act(() => useApp.setState({ status: 'ok' }))
    expect(svg().getAttribute('class')).toContain('animate-spin') // finishes the current turn
    expect(button.className).toContain('w-9')
    expect(button.className.replace(/text-\S+/g, '')).toBe(width.replace(/text-\S+/g, ''))
    // jsdom has no AnimationEvent, so React listens for the prefixed name there.
    act(() => {
      for (const type of ['animationiteration', 'webkitAnimationIteration']) svg().dispatchEvent(new Event(type, { bubbles: true }))
    })
    expect(svg().getAttribute('class')).not.toContain('animate-spin')
  })
})

describe('LineChart', () => {
  it('labels rounds with whole numbers only', async () => {
    const { LineChart } = await import('../../src/components/charts/LineChart')
    const { container } = render(
      <LineChart points={[{ lesson: 1, value: 20 }]} format={String} tooltip={() => ''} empty="-" ariaLabel="x" />,
    )
    const labels = [...container.querySelectorAll('text')].map((t) => t.textContent)
    expect(labels).not.toContain('1.5')
    expect(labels).toContain('1')
  })

  it('starts the x-axis at the first round with data', async () => {
    const { LineChart } = await import('../../src/components/charts/LineChart')
    const points = [300, 302, 310].map((lesson) => ({ lesson, value: 20 }))
    const { container } = render(<LineChart points={points} format={String} tooltip={() => ''} empty="-" ariaLabel="x" />)
    const xs = [...container.querySelectorAll('circle')].map((c) => Number(c.getAttribute('cx')))
    // The first point sits on the left edge of the plot, not most of the way across.
    expect(xs[0]).toBe(34)
    const labels = [...container.querySelectorAll('text')].map((t) => t.textContent)
    expect(labels).toEqual(expect.arrayContaining(['300', '310']))
    expect(labels).not.toContain('100')
  })
})
