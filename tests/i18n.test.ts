// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { TEXT } from '../src/i18n'
import { BADGES } from '../src/rewards/badges'
import { LEVEL_STARS } from '../src/rewards/rewards'
import type { SyncStatus } from '../src/store/app'

const STATUSES: SyncStatus[] = ['unconfigured', 'idle', 'syncing', 'ok', 'offline', 'error']

describe('translations', () => {
  it('every text is non-empty and every function returns text', () => {
    for (const [k, v] of Object.entries(TEXT)) {
      if (typeof v === 'string') expect(v.length, k).toBeGreaterThan(0)
      if (typeof v === 'function') {
        const out = (v as (...a: unknown[]) => unknown)(3, 5, 7)
        expect(typeof out === 'string' && out.length > 0 && !out.includes('undefined'), k).toBe(true)
      }
    }
  })

  it('covers every sync status, badge group and level', () => {
    const groups = new Set(BADGES.map((b) => b.group))
    for (const s of STATUSES) expect(TEXT.statusText[s]).toBeTruthy()
    for (const g of groups) expect(TEXT.badgeGroups[g]).toBeTruthy()
    expect(TEXT.levels.length).toBeGreaterThanOrEqual(LEVEL_STARS.length)
    expect(TEXT.weekdays).toHaveLength(7)
  })
})
