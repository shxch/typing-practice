import { describe, expect, it } from 'vitest'
import { UNITS } from '../../src/lessons/curriculum'
import { BADGES, computeBadges, newBadges } from '../../src/rewards/badges'
import { dayAt, makeSession } from '../helpers/session'

const R = { targetWpm: 25, targetAccuracy: 0.95, dailyGoalMinutes: 15 }
const earned = (list: ReturnType<typeof computeBadges>) => list.filter((b) => b.earnedAt !== null).map((b) => b.badge.id)
const get = (list: ReturnType<typeof computeBadges>, id: string) => list.find((b) => b.badge.id === id)!

describe('badge list', () => {
  it('ids are unique and every badge has both languages and an icon', () => {
    expect(new Set(BADGES.map((b) => b.id)).size).toBe(BADGES.length)
    for (const b of BADGES) {
      expect(b.name.zh && b.name.en && b.desc.zh && b.desc.en && b.icon).toBeTruthy()
    }
  })

  it('nothing is earned with no practice and progress is 0..1', () => {
    const list = computeBadges([], R)
    expect(earned(list)).toEqual([])
    for (const b of list) {
      expect(b.progress).toBeGreaterThanOrEqual(0)
      expect(b.progress).toBeLessThanOrEqual(1)
    }
  })
})

describe('earning', () => {
  it('first round badge is dated at the end of that round', () => {
    const s = makeSession({ startedAt: 1000, endedAt: 5000 })
    expect(get(computeBadges([s], R), 'rounds-1').earnedAt).toBe(5000)
  })

  it('10 rounds exactly', () => {
    const list = Array.from({ length: 10 }, (_, i) => makeSession({ startedAt: i * 1e6, endedAt: i * 1e6 + 1 }))
    expect(get(computeBadges(list.slice(0, 9), R), 'rounds-10').earnedAt).toBeNull()
    expect(get(computeBadges(list, R), 'rounds-10').earnedAt).toBe(9e6 + 1)
    expect(get(computeBadges(list.slice(0, 5), R), 'rounds-10').progress).toBeCloseTo(0.5)
  })

  it('speed tiers use the best single round', () => {
    const ids = earned(computeBadges([makeSession({ wpm: 61 }), makeSession({ wpm: 32 })], R))
    expect(ids).toEqual(expect.arrayContaining(['speed-30', 'speed-40', 'speed-50', 'speed-60']))
    expect(ids).not.toContain('speed-70')
  })

  it('an accurate run resets after a sloppy round', () => {
    const acc = [1, 0.96, 0.99, 0.97, 0.5, 0.98, 0.98, 0.98, 0.98]
    const list = acc.map((accuracy, i) => makeSession({ accuracy, startedAt: i }))
    expect(get(computeBadges(list, R), 'accuracy-5').earnedAt).toBeNull()
    const more = [...list, makeSession({ accuracy: 0.95, startedAt: 99 })]
    expect(get(computeBadges(more, R), 'accuracy-5').earnedAt).not.toBeNull()
    expect(get(computeBadges(list, R), 'accuracy-1').earnedAt).not.toBeNull() // one 100% round
  })

  it('day-streak badges need consecutive goal days', () => {
    const day = (d: number) => makeSession({ startedAt: dayAt(2026, 9, d, 23, 50), durationMs: 16 * 60_000 })
    expect(get(computeBadges([day(1), day(2), day(3)], R), 'streak-3').earnedAt).not.toBeNull()
    expect(get(computeBadges([day(1), day(2), day(4)], R), 'streak-3').earnedAt).toBeNull()
    expect(get(computeBadges([day(1)], R), 'streak-1').earnedAt).not.toBeNull()
  })

  it('the goal can be met by several short rounds on one day', () => {
    const list = [0, 1, 2].map((i) => makeSession({ startedAt: dayAt(2026, 9, 1, 10 + i), durationMs: 5 * 60_000 }))
    expect(get(computeBadges(list, R), 'streak-1').earnedAt).toBe(list[2].endedAt)
  })

  it('two devices', () => {
    const list = [makeSession({ device: 'mac' }), makeSession({ device: 'tv' })]
    expect(get(computeBadges(list, R), 'keys-2').earnedAt).not.toBeNull()
  })

  it('the rainbow badge is hidden and needs the sixth star', () => {
    const list = (wpm: number) => [makeSession({ wpm, accuracy: 1, startedAt: 1 })]
    expect(get(computeBadges(list(30), R), 'stars-rainbow').earnedAt).toBeNull()
    expect(get(computeBadges(list(40), R), 'stars-rainbow').earnedAt).not.toBeNull()
    expect(get(computeBadges(list(40), R), 'stars-rainbow').badge.hidden).toBe(true)
  })

  it('a badge for every level reached', () => {
    // 5 stars a round; level 2 needs 15 stars
    const list = (n: number) => Array.from({ length: n }, (_, i) => makeSession({ wpm: 30, accuracy: 1, startedAt: i + 1 }))
    expect(get(computeBadges(list(2), R), 'level-2').earnedAt).toBeNull()
    expect(get(computeBadges(list(3), R), 'level-2').earnedAt).not.toBeNull()
    expect(get(computeBadges(list(3), R), 'level-3').earnedAt).toBeNull()
  })

  it('newBadges reports only the newly earned ones', () => {
    const before = computeBadges([makeSession({ wpm: 25, startedAt: 1 })], R)
    const after = computeBadges([makeSession({ wpm: 25, startedAt: 1 }), makeSession({ wpm: 42, startedAt: 2 })], R)
    expect(newBadges(before, after).map((b) => b.id).sort()).toEqual(['speed-30', 'speed-40'])
  })
})

describe('key badges come from practice only', () => {
  const lowerUnits = UNITS.filter((u) => u.stage === 'A').length

  it('are earned when practice has unlocked the keys', () => {
    const s = makeSession({ units: lowerUnits, earnedUnits: lowerUnits })
    expect(get(computeBadges([s], R), `keys-${lowerUnits}`).earnedAt).not.toBeNull()
    expect(get(computeBadges([], R, lowerUnits), `keys-${lowerUnits}`).earnedAt).not.toBeNull()
  })

  it('are not earned by rounds played after a manual jump', () => {
    const s = makeSession({ units: UNITS.length, earnedUnits: 3 })
    const list = computeBadges([s], R, 3)
    expect(get(list, `keys-${lowerUnits}`).earnedAt).toBeNull()
    expect(get(list, `keys-${UNITS.length}`).earnedAt).toBeNull()
  })
})
