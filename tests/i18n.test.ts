// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { DICTS } from '../src/i18n'
import { BADGES } from '../src/rewards/badges'
import { LEVEL_STARS } from '../src/rewards/rewards'
import type { SyncStatus } from '../src/store/app'

const STATUSES: SyncStatus[] = ['unconfigured', 'idle', 'syncing', 'ok', 'offline', 'error']

describe('translations', () => {
  it('Chinese and English have the same keys', () => {
    expect(Object.keys(DICTS.en).sort()).toEqual(Object.keys(DICTS.zh).sort())
  })

  it('every text is non-empty and every function returns text', () => {
    for (const [lang, d] of Object.entries(DICTS)) {
      for (const [k, v] of Object.entries(d)) {
        if (typeof v === 'string') expect(v.length, `${lang}.${k}`).toBeGreaterThan(0)
        if (typeof v === 'function') {
          const out = (v as (...a: unknown[]) => unknown)(3, 5, 7)
          expect(typeof out === 'string' && out.length > 0 && !out.includes('undefined'), `${lang}.${k}`).toBe(true)
        }
      }
    }
  })

  it('covers every sync status, badge group and level', () => {
    const groups = new Set(BADGES.map((b) => b.group))
    for (const d of Object.values(DICTS)) {
      for (const s of STATUSES) expect(d.statusText[s]).toBeTruthy()
      for (const g of groups) expect(d.badgeGroups[g]).toBeTruthy()
      expect(d.levels.length).toBeGreaterThanOrEqual(LEVEL_STARS.length)
      expect(d.weekdays).toHaveLength(7)
    }
  })
})
