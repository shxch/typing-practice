// Badges, Wings of Fire style. Like stars and levels they are derived from the session log
// (replayed in time order), so every device agrees and nothing extra needs syncing.

import { UNITS } from '../lessons/curriculum'
import { dayKey, score } from '../lessons/stats'
import type { Session } from '../store/types'
import { inPlayOrder, levelOf, starsByRound, type StarRules } from './rewards'

export interface BadgeRules extends StarRules {
  dailyGoalRounds: number
}

/** Running totals while replaying the sessions. */
interface Ctx {
  rounds: number
  timeMs: number
  bestWpm: number
  /** Best score since SCORE_BADGES_FROM. */
  bestScore: number
  perfectRounds: number
  fiveStarRounds: number
  rainbowRounds: number
  /** Stars earned so far, and the level they add up to (1 = the first). */
  stars: number
  level: number
  /** Consecutive rounds (so far) at 95%+ accuracy. */
  accurateRun: number
  bestAccurateRun: number
  /** Longest run of consecutive days meeting the daily goal. */
  bestDayStreak: number
  goalDays: number
  maxUnits: number
}

export type BadgeGroup = 'rounds' | 'speed' | 'score' | 'accuracy' | 'streak' | 'time' | 'stars' | 'level' | 'keys'

export interface Badge {
  id: string
  group: BadgeGroup
  icon: string
  name: string
  desc: string
  /** Kept secret (not listed, not counted) until it is earned. */
  hidden?: boolean
  /** Progress toward the badge, 0..1 (1 = earned). */
  progress: (c: Ctx) => number
}

/**
 * The top-score badges arrived after plenty of rounds had been played. Only rounds started from
 * here on count toward them, so they are handed out when a score is next beaten, not all at once.
 */
export const SCORE_BADGES_FROM = Date.UTC(2026, 9, 13, 13)

const ratio = (v: number, goal: number) => Math.min(1, v / goal)

const LOWER_UNITS = UNITS.filter((u) => u.stage === 'A').length
const CAPITAL_UNITS = LOWER_UNITS + UNITS.filter((u) => u.stage === 'B').length

function tiers(
  group: BadgeGroup,
  value: (c: Ctx) => number,
  list: [goal: number, icon: string, name: string, desc: string][],
): Badge[] {
  return list.map(([goal, icon, name, desc]) => ({
    id: `${group}-${goal}`,
    group,
    icon,
    name,
    desc,
    progress: (c) => ratio(value(c), goal),
  }))
}

export const BADGES: Badge[] = [
  ...tiers('rounds', (c) => c.rounds, [
    [1, '🥚', 'Hatchling', 'Finish your first round'],
    [10, '🐣', 'Dragonet', 'Finish 10 rounds'],
    [50, '🐉', 'Jade Mountain Student', 'Finish 50 rounds'],
    [100, '📜', 'Scroll Keeper', 'Finish 100 rounds'],
    [250, '🏔️', 'Guardian of Jade Mountain', 'Finish 250 rounds'],
    [500, '👑', 'Dragon Legend', 'Finish 500 rounds'],
  ]),
  ...tiers('speed', (c) => c.bestWpm, [
    // Slowest to fastest: SeaWing, NightWing, SandWing, RainWing, then SkyWing (the fastest fliers).
    [30, '🌊', 'SeaWing Speed', 'Reach 30 WPM in a round'],
    [40, '🌙', 'NightWing Speed', 'Reach 40 WPM in a round'],
    [50, '🏜️', 'SandWing Speed', 'Reach 50 WPM in a round'],
    [60, '🦎', 'RainWing Speed', 'Reach 60 WPM in a round'],
    [70, '☁️', 'SkyWing Speed', 'Reach 70 WPM in a round'],
  ]),
  // The top score (see `score` in lessons/stats.ts). A clean round scores about 10 × WPM × the
  // number of different keys in it, so the top score climbs as keys unlock: about 3,500 with the
  // first ten keys, 8,000-10,000 with every lowercase letter, 20,000 with capitals and punctuation
  // at 50 WPM. Past the early tiers each step is roughly two or three more keys.
  ...tiers('score', (c) => c.bestScore, [
    [500, '🪙', 'First Coin', 'Reach a top score of 500'],
    [1000, '💰', 'Small Hoard', 'Reach a top score of 1,000'],
    [2000, '🧰', 'Treasure Chest', 'Reach a top score of 2,000'],
    [3000, '🏺', "Dragon's Hoard", 'Reach a top score of 3,000'],
    [4000, '🔷', 'Sapphire', 'Reach a top score of 4,000'],
    [5000, '🟢', 'Emerald', 'Reach a top score of 5,000'],
    [6500, '♦️', 'Ruby', 'Reach a top score of 6,500'],
    [8000, '💎', 'Diamond', 'Reach a top score of 8,000'],
    [10000, '👁️', 'Eye of Onyx', 'Reach a top score of 10,000'],
    [12500, '🌙', 'Dreamvisitor', 'Reach a top score of 12,500'],
    [15000, '☄️', 'Skyfire', 'Reach a top score of 15,000'],
    [20000, '🏆', "Queen's Treasure", 'Reach a top score of 20,000'],
  ]),
  ...tiers('accuracy', (c) => c.perfectRounds, [
    [1, '💎', 'Flawless', 'A round with 100% accuracy'],
    [10, '🔮', "Seer's Eye", '10 rounds at 100% accuracy'],
  ]),
  ...tiers('accuracy', (c) => c.bestAccurateRun, [
    [5, '🎯', 'Steady Talons', '5 rounds in a row at 95%+ accuracy'],
    [20, '🛡️', 'IceWing Precision', '20 rounds in a row at 95%+ accuracy'],
  ]),
  ...tiers('streak', (c) => c.goalDays, [
    [1, '✅', 'Goal Reached', "Meet the daily goal for the first time"],
  ]),
  ...tiers('streak', (c) => c.bestDayStreak, [
    [3, '🔥', 'Little Flame', 'Meet the daily goal 3 days in a row'],
    [7, '🌙', 'Week of Moons', 'Meet the daily goal 7 days in a row'],
    [14, '🌟', 'Steadfast Heart', 'Meet the daily goal 14 days in a row'],
    [30, '🌋', 'Undying Fire', 'Meet the daily goal 30 days in a row'],
    [100, '🐲', 'Hundred-Day Dragon', 'Meet the daily goal 100 days in a row'],
  ]),
  ...tiers('time', (c) => c.timeMs / 3_600_000, [
    [1, '⏳', 'First Hour', 'Practice 1 hour in total'],
    [5, '🕯️', 'Candlelight Study', 'Practice 5 hours in total'],
    [10, '📚', 'Library Regular', 'Practice 10 hours in total'],
    [24, '🌍', 'Around Pyrrhia', 'Practice 24 hours in total'],
    [50, '🗺️', 'Voyage to Pantala', 'Practice 50 hours in total'],
  ]),
  ...tiers('stars', (c) => c.fiveStarRounds, [
    [1, '⭐', 'First Five Stars', 'Get five stars in a round'],
    [10, '✨', 'Starry Night', 'Five stars in 10 rounds'],
    [50, '🌌', 'Sky Full of Stars', 'Five stars in 50 rounds'],
  ]),
  {
    id: 'stars-rainbow',
    group: 'stars',
    hidden: true,
    icon: '🌈',
    name: 'Rainbow Dragon',
    desc: 'Earn the hidden rainbow star in a round',
    progress: (c) => ratio(c.rainbowRounds, 1),
  },
  // One per level-up, named after the level (see `levels` in i18n.ts).
  ...tiers('level', (c) => c.level, [
    [2, '⌨️', 'Key Rookie', 'Reach level 2'],
    [3, '🧭', 'Letter Explorer', 'Reach level 3'],
    [4, '⚔️', 'Word Warrior', 'Reach level 4'],
    [5, '🛡️', 'Key Knight', 'Reach level 5'],
    [6, '🌟', 'Rising Star', 'Reach level 6'],
    [7, '🦸', 'Flying Fingers', 'Reach level 7'],
    [8, '🪄', 'Keyboard Wizard', 'Reach level 8'],
    [9, '⚡', 'Lightning Hands', 'Reach level 9'],
    [10, '🥋', 'Typing Hero', 'Reach level 10'],
    [11, '🎖️', 'Key Master', 'Reach level 11'],
    [12, '🏅', 'Grand Master', 'Reach level 12'],
    [13, '🏆', 'Keyboard Legend', 'Reach level 13'],
    [14, '🚀', 'Light-Speed Typist', 'Reach level 14'],
    [15, '🔱', 'Typing Titan', 'Reach level 15'],
    [16, '🪐', 'Galactic Champion', 'Reach level 16'],
  ]),
  ...tiers('keys', (c) => c.maxUnits, [
    [LOWER_UNITS, '🔤', 'All Lowercase', 'Unlock all 26 lowercase letters'],
    [CAPITAL_UNITS, '🔠', 'All Capitals', 'Unlock all capital letters'],
    [UNITS.length, '🎓', 'Jade Mountain Graduate', 'Unlock every key, punctuation too'],
  ]),
]

export interface BadgeState {
  badge: Badge
  /** When it was earned (end of the round that earned it), or null. */
  earnedAt: number | null
  progress: number
}

/**
 * Replay the sessions and record when each badge was first earned.
 * `currentUnits` (units earned by practice, not a manual jump) lets an unlock badge appear right
 * away, before another round is played.
 */
export function computeBadges(sessions: Session[], r: BadgeRules, currentUnits = 0): BadgeState[] {
  const sorted = inPlayOrder(sessions)
  const stars = starsByRound(sorted, r)
  const c: Ctx = {
    rounds: 0,
    timeMs: 0,
    bestWpm: 0,
    bestScore: 0,
    perfectRounds: 0,
    fiveStarRounds: 0,
    rainbowRounds: 0,
    stars: 0,
    level: 1,
    accurateRun: 0,
    bestAccurateRun: 0,
    bestDayStreak: 0,
    goalDays: 0,
    maxUnits: 0,
  }
  const earned = new Map<string, number>()
  const perDay = new Map<string, number>()
  const goalMet = new Set<string>()

  const check = (at: number) => {
    for (const b of BADGES) if (!earned.has(b.id) && b.progress(c) >= 1) earned.set(b.id, at)
  }

  for (const s of sorted) {
    c.rounds++
    c.timeMs += s.durationMs
    c.bestWpm = Math.max(c.bestWpm, s.wpm)
    if (s.startedAt >= SCORE_BADGES_FROM) c.bestScore = Math.max(c.bestScore, score(s))
    if (s.accuracy >= 0.9999) c.perfectRounds++
    if ((stars.get(s.id) ?? 0) >= 5) c.fiveStarRounds++
    if (stars.get(s.id) === 6) c.rainbowRounds++
    c.stars += stars.get(s.id) ?? 0
    c.level = levelOf(c.stars).level + 1
    c.accurateRun = s.accuracy >= 0.95 ? c.accurateRun + 1 : 0
    c.bestAccurateRun = Math.max(c.bestAccurateRun, c.accurateRun)
    // Only what practice unlocked counts; a manual jump on the course slider doesn't.
    c.maxUnits = Math.max(c.maxUnits, s.earnedUnits ?? s.units)

    const day = dayKey(s.startedAt)
    perDay.set(day, (perDay.get(day) ?? 0) + 1)
    if (!goalMet.has(day) && perDay.get(day)! >= r.dailyGoalRounds) {
      goalMet.add(day)
      c.goalDays = goalMet.size
      // Streak of goal days ending today.
      const d = new Date(s.startedAt)
      d.setHours(12, 0, 0, 0)
      let n = 0
      while (goalMet.has(dayKey(d.getTime()))) {
        n++
        d.setDate(d.getDate() - 1)
      }
      c.bestDayStreak = Math.max(c.bestDayStreak, n)
    }
    check(s.endedAt || s.startedAt)
  }

  if (currentUnits > c.maxUnits) {
    c.maxUnits = currentUnits
    check(sorted.length ? sorted[sorted.length - 1].endedAt : Date.now())
  }

  return BADGES.map((badge) => ({
    badge,
    earnedAt: earned.get(badge.id) ?? null,
    progress: badge.progress(c),
  }))
}

/** Badges earned by `after` that `before` didn't have. */
export function newBadges(before: BadgeState[], after: BadgeState[]): Badge[] {
  const had = new Set(before.filter((b) => b.earnedAt !== null).map((b) => b.badge.id))
  return after.filter((b) => b.earnedAt !== null && !had.has(b.badge.id)).map((b) => b.badge)
}
