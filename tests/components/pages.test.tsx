// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../src/App'
import { ResultCard } from '../../src/components/ResultCard'
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
  for (const lang of ['zh', 'en'] as const) {
    it(`renders in ${lang} without broken values`, () => {
      useApp.setState({ sessions: data() })
      useApp.getState().updateSettings({ lang })
      render(<App />)
      noBadText()
      for (const tab of lang === 'zh' ? ['统计', '徽章', '设置', '练习'] : ['Stats', 'Badges', 'Settings', 'Practice']) {
        act(() => fireEvent.click(screen.getAllByRole('button', { name: tab })[0]))
        noBadText()
      }
    })
  }
})

describe('language toggle', () => {
  it('switches the whole app', () => {
    render(<App />)
    expect(document.title).toBe('熊猫打字')
    act(() => fireEvent.click(screen.getByTitle('Switch to English')))
    expect(useApp.getState().shared.settings.lang).toBe('en')
    expect(document.documentElement.lang).toBe('en')
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
          slowest: [{ ch: ' ', ms: 500 }, { ch: 'q', ms: 900 }],
          newKeys: ['r'],
          stars: 2,
          goalJustDone: true,
          streak: 3,
          levelUp: '键盘新手',
          badges: [BADGES[0]],
        }}
        onNext={onNext}
      />,
    )
    expect(screen.getByText('24')).toBeTruthy()
    expect(screen.getByText('97%')).toBeTruthy()
    expect(screen.getByText(BADGES[0].name.zh)).toBeTruthy()
    noBadText()
    fireEvent.click(screen.getByRole('button'))
    expect(onNext).toHaveBeenCalled()
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
})
