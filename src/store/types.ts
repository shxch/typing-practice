import type { ErrorMode, KeyStats, TypingState } from '../engine/typing'

/** One finished practice round. Immutable once written; the unit of sync. */
export interface Session {
  id: string
  startedAt: number
  endedAt: number
  device: string
  stage: string
  /** Units unlocked when the lesson was generated. */
  units: number
  /** Of those, units earned by practice (without a manual jump). Missing in older sessions. */
  earnedUnits?: number
  chars: number
  wpm: number
  accuracy: number
  durationMs: number
  keyStats: KeyStats
}

/** A round that was started but not finished, so it can be resumed on any device. */
export interface InProgress {
  id: string
  startedAt: number
  device: string
  units: number
  earnedUnits?: number
  state: TypingState
}

/** Settings shared by all devices. */
export interface SyncedSettings {
  targetWpm: number
  targetAccuracy: number
  minSamples: number
  manualUnits: number | null
  lessonWords: number
  errorMode: ErrorMode
  lang: Lang
  /** Wallpaper id (see content/wallpapers.ts). */
  wallpaper: string
  /** Rounds to finish in a day for it to count toward the streak. */
  dailyGoalRounds: number
  /** Wallpapers added in the app; the images themselves live in the data repo. */
  customWallpapers: CustomWallpaper[]
  /** Built-in wallpapers the user removed from the picker. */
  hiddenWallpapers: string[]
}

export interface CustomWallpaper {
  id: string
  name: string
  addedAt: number
}

export type Lang = 'zh' | 'en'

export const DEFAULT_SETTINGS: SyncedSettings = {
  targetWpm: 25,
  targetAccuracy: 0.95,
  minSamples: 10,
  manualUnits: null,
  lessonWords: 20,
  errorMode: 'stop',
  lang: 'zh',
  wallpaper: 'gradient-lavender',
  dailyGoalRounds: 15,
  customWallpapers: [],
  hiddenWallpapers: [],
}

/** The small, frequently-changing part of the synced data (state.json). */
export interface SharedState {
  settings: SyncedSettings
  settingsUpdatedAt: number
  inProgress: InProgress | null
  inProgressUpdatedAt: number
}
