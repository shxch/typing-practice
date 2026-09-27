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
}

export const DEFAULT_SETTINGS: SyncedSettings = {
  targetWpm: 25,
  targetAccuracy: 0.95,
  minSamples: 15,
  manualUnits: null,
  lessonWords: 20,
  errorMode: 'stop',
}

/** The small, frequently-changing part of the synced data (state.json). */
export interface SharedState {
  settings: SyncedSettings
  settingsUpdatedAt: number
  inProgress: InProgress | null
  inProgressUpdatedAt: number
}
