// Badges, Wings of Fire style. Like stars and levels they are derived from the session log
// (replayed in time order), so every device agrees and nothing extra needs syncing.

import { UNITS } from '../lessons/curriculum'
import { dayKey } from '../lessons/stats'
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
  bestAcc: number
  perfectRounds: number
  fiveStarRounds: number
  rainbowRounds: number
  /** Stars earned so far, and the level they add up to (1 = the first). */
  stars: number
  level: number
  /** Consecutive rounds (so far) at 95%+ accuracy. */
  accurateRun: number
  bestAccurateRun: number
  /** Consecutive days meeting the daily goal, ending on the latest session's day. */
  dayStreak: number
  bestDayStreak: number
  goalDays: number
  maxUnits: number
  devices: number
}

export type BadgeGroup = 'rounds' | 'speed' | 'accuracy' | 'streak' | 'time' | 'stars' | 'level' | 'keys'

export interface Badge {
  id: string
  group: BadgeGroup
  icon: string
  name: { zh: string; en: string }
  desc: { zh: string; en: string }
  /** Kept secret (not listed, not counted) until it is earned. */
  hidden?: boolean
  /** Progress toward the badge, 0..1 (1 = earned). */
  progress: (c: Ctx) => number
}

const ratio = (v: number, goal: number) => Math.min(1, v / goal)

const LOWER_UNITS = UNITS.filter((u) => u.stage === 'A').length
const CAPITAL_UNITS = LOWER_UNITS + UNITS.filter((u) => u.stage === 'B').length

function tiers(
  group: BadgeGroup,
  value: (c: Ctx) => number,
  list: [goal: number, icon: string, zh: string, en: string, descZh: string, descEn: string][],
): Badge[] {
  return list.map(([goal, icon, zh, en, descZh, descEn]) => ({
    id: `${group}-${goal}`,
    group,
    icon,
    name: { zh, en },
    desc: { zh: descZh, en: descEn },
    progress: (c) => ratio(value(c), goal),
  }))
}

export const BADGES: Badge[] = [
  ...tiers('rounds', (c) => c.rounds, [
    [1, '🥚', '破壳而出', 'Hatchling', '完成第 1 轮练习', 'Finish your first round'],
    [10, '🐣', '小小龙崽', 'Dragonet', '完成 10 轮练习', 'Finish 10 rounds'],
    [50, '🐉', '学院新生', 'Jade Mountain Student', '完成 50 轮练习', 'Finish 50 rounds'],
    [100, '📜', '勤学之翼', 'Scroll Keeper', '完成 100 轮练习', 'Finish 100 rounds'],
    [250, '🏔️', '玉山守护者', 'Guardian of Jade Mountain', '完成 250 轮练习', 'Finish 250 rounds'],
    [500, '👑', '龙族传奇', 'Dragon Legend', '完成 500 轮练习', 'Finish 500 rounds'],
  ]),
  ...tiers('speed', (c) => c.bestWpm, [
    // Slowest to fastest: SeaWing, NightWing, SandWing, RainWing, then SkyWing (the fastest fliers).
    [30, '🌊', 'SeaWing 之速', 'SeaWing Speed', '单轮速度达到 30 WPM', 'Reach 30 WPM in a round'],
    [40, '🌙', 'NightWing 之速', 'NightWing Speed', '单轮速度达到 40 WPM', 'Reach 40 WPM in a round'],
    [50, '🏜️', 'SandWing 之速', 'SandWing Speed', '单轮速度达到 50 WPM', 'Reach 50 WPM in a round'],
    [60, '🦎', 'RainWing 之速', 'RainWing Speed', '单轮速度达到 60 WPM', 'Reach 60 WPM in a round'],
    [70, '☁️', 'SkyWing 之速', 'SkyWing Speed', '单轮速度达到 70 WPM', 'Reach 70 WPM in a round'],
  ]),
  ...tiers('accuracy', (c) => c.perfectRounds, [
    [1, '💎', '零失误', 'Flawless', '有一轮 100% 全对', 'A round with 100% accuracy'],
    [10, '🔮', '预言家之眼', "Seer's Eye", '10 轮 100% 全对', '10 rounds at 100% accuracy'],
  ]),
  ...tiers('accuracy', (c) => c.bestAccurateRun, [
    [5, '🎯', '稳稳的爪子', 'Steady Talons', '连续 5 轮准确率 95% 以上', '5 rounds in a row at 95%+ accuracy'],
    [20, '🛡️', 'IceWing 般精准', 'IceWing Precision', '连续 20 轮准确率 95% 以上', '20 rounds in a row at 95%+ accuracy'],
  ]),
  ...tiers('streak', (c) => c.goalDays, [
    [1, '✅', '今日达成', 'Goal Reached', '第一次完成每日目标', "Meet the daily goal for the first time"],
  ]),
  ...tiers('streak', (c) => c.bestDayStreak, [
    [3, '🔥', '小火苗', 'Little Flame', '连续 3 天完成每日目标', 'Meet the daily goal 3 days in a row'],
    [7, '🌙', '一周月光', 'Week of Moons', '连续 7 天完成每日目标', 'Meet the daily goal 7 days in a row'],
    [14, '🌟', '坚持之星', 'Steadfast Heart', '连续 14 天完成每日目标', 'Meet the daily goal 14 days in a row'],
    [30, '🌋', '不灭之火', 'Undying Fire', '连续 30 天完成每日目标', 'Meet the daily goal 30 days in a row'],
    [100, '🐲', '百日神龙', 'Hundred-Day Dragon', '连续 100 天完成每日目标', 'Meet the daily goal 100 days in a row'],
  ]),
  ...tiers('time', (c) => c.timeMs / 3_600_000, [
    [1, '⏳', '第一个小时', 'First Hour', '累计练习 1 小时', 'Practice 1 hour in total'],
    [5, '🕯️', '烛光夜读', 'Candlelight Study', '累计练习 5 小时', 'Practice 5 hours in total'],
    [10, '📚', '图书馆常客', 'Library Regular', '累计练习 10 小时', 'Practice 10 hours in total'],
    [24, '🌍', '环游 Pyrrhia', 'Around Pyrrhia', '累计练习 24 小时', 'Practice 24 hours in total'],
    [50, '🗺️', '远航 Pantala', 'Voyage to Pantala', '累计练习 50 小时', 'Practice 50 hours in total'],
  ]),
  ...tiers('stars', (c) => c.fiveStarRounds, [
    [1, '⭐', '第一个五星', 'First Five Stars', '有一轮拿到五颗星', 'Get five stars in a round'],
    [10, '✨', '星光熠熠', 'Starry Night', '10 轮拿到五颗星', 'Five stars in 10 rounds'],
    [50, '🌌', '满天星辰', 'Sky Full of Stars', '50 轮拿到五颗星', 'Five stars in 50 rounds'],
  ]),
  {
    id: 'stars-rainbow',
    group: 'stars',
    hidden: true,
    icon: '🌈',
    name: { zh: '彩虹龙', en: 'Rainbow Dragon' },
    desc: { zh: '有一轮拿到隐藏的彩虹星', en: 'Earn the hidden rainbow star in a round' },
    progress: (c) => ratio(c.rainbowRounds, 1),
  },
  // One per level-up, named after the level (see `levels` in i18n.ts).
  ...tiers('level', (c) => c.level, [
    [2, '⌨️', '键盘新手', 'Key Rookie', '升到 Lv.2', 'Reach level 2'],
    [3, '🧭', '字母探险家', 'Letter Explorer', '升到 Lv.3', 'Reach level 3'],
    [4, '⚔️', '单词小勇士', 'Word Warrior', '升到 Lv.4', 'Reach level 4'],
    [5, '🛡️', '键盘骑士', 'Key Knight', '升到 Lv.5', 'Reach level 5'],
    [6, '🌟', '速度小明星', 'Rising Star', '升到 Lv.6', 'Reach level 6'],
    [7, '🦸', '打字飞侠', 'Flying Fingers', '升到 Lv.7', 'Reach level 7'],
    [8, '🪄', '键盘魔法师', 'Keyboard Wizard', '升到 Lv.8', 'Reach level 8'],
    [9, '⚡', '闪电手指', 'Lightning Hands', '升到 Lv.9', 'Reach level 9'],
    [10, '🥋', '打字大侠', 'Typing Hero', '升到 Lv.10', 'Reach level 10'],
    [11, '🎖️', '键盘大师', 'Key Master', '升到 Lv.11', 'Reach level 11'],
    [12, '🏅', '打字宗师', 'Grand Master', '升到 Lv.12', 'Reach level 12'],
    [13, '🏆', '键盘传奇', 'Keyboard Legend', '升到 Lv.13', 'Reach level 13'],
    [14, '🚀', '光速打字王', 'Light-Speed Typist', '升到 Lv.14', 'Reach level 14'],
    [15, '🔱', '打字之神', 'Typing Titan', '升到 Lv.15', 'Reach level 15'],
    [16, '🪐', '宇宙第一打字王', 'Galactic Champion', '升到 Lv.16', 'Reach level 16'],
  ]),
  ...tiers('keys', (c) => c.maxUnits, [
    [LOWER_UNITS, '🔤', '小写字母全掌握', 'All Lowercase', '解锁全部 26 个小写字母', 'Unlock all 26 lowercase letters'],
    [CAPITAL_UNITS, '🔠', '大写字母全掌握', 'All Capitals', '解锁全部大写字母', 'Unlock all capital letters'],
    [UNITS.length, '🎓', '玉山毕业生', 'Jade Mountain Graduate', '解锁全部按键（含标点）', 'Unlock every key, punctuation too'],
  ]),
  ...tiers('keys', (c) => c.devices, [
    [2, '🏡', '两处龙穴', 'Two Dens', '在两台设备上练习过', 'Practice on two devices'],
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
    bestAcc: 0,
    perfectRounds: 0,
    fiveStarRounds: 0,
    rainbowRounds: 0,
    stars: 0,
    level: 1,
    accurateRun: 0,
    bestAccurateRun: 0,
    dayStreak: 0,
    bestDayStreak: 0,
    goalDays: 0,
    maxUnits: 0,
    devices: 0,
  }
  const earned = new Map<string, number>()
  const perDay = new Map<string, number>()
  const goalMet = new Set<string>()
  const devices = new Set<string>()

  const check = (at: number) => {
    for (const b of BADGES) if (!earned.has(b.id) && b.progress(c) >= 1) earned.set(b.id, at)
  }

  for (const s of sorted) {
    c.rounds++
    c.timeMs += s.durationMs
    c.bestWpm = Math.max(c.bestWpm, s.wpm)
    c.bestAcc = Math.max(c.bestAcc, s.accuracy)
    if (s.accuracy >= 0.9999) c.perfectRounds++
    if ((stars.get(s.id) ?? 0) >= 5) c.fiveStarRounds++
    if (stars.get(s.id) === 6) c.rainbowRounds++
    c.stars += stars.get(s.id) ?? 0
    c.level = levelOf(c.stars).level + 1
    c.accurateRun = s.accuracy >= 0.95 ? c.accurateRun + 1 : 0
    c.bestAccurateRun = Math.max(c.bestAccurateRun, c.accurateRun)
    // Only what practice unlocked counts; a manual jump on the course slider doesn't.
    c.maxUnits = Math.max(c.maxUnits, s.earnedUnits ?? s.units)
    devices.add(s.device)
    c.devices = devices.size

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
      c.dayStreak = n
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
