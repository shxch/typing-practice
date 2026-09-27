import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { SoundStyle } from '../sound/sound'
import { monthOf } from '../sync/merge'
import { DEFAULT_SETTINGS, type InProgress, type Session, type SharedState, type SyncedSettings } from './types'

export type SyncStatus = 'unconfigured' | 'idle' | 'syncing' | 'ok' | 'offline' | 'error'

/** This-device-only settings. Never synced (the token especially). */
export interface LocalConfig {
  owner: string
  repo: string
  token: string
  device: string
  /** Sound is per device: the TV and the laptop have very different speakers. */
  sound: boolean
  volume: number
  soundStyle: SoundStyle
}

interface AppState {
  sessions: Record<string, Session>
  shared: SharedState
  config: LocalConfig

  // sync bookkeeping (persisted so offline work survives a reload)
  /** Last seen sha per remote path. */
  shas: Record<string, string>
  /** Months with sessions not yet pushed. */
  dirtyMonths: string[]
  /** Timestamps of the shared state as last seen on the remote. */
  remoteStamp: { settings: number; inProgress: number }

  // runtime only
  status: SyncStatus
  statusMessage: string
  lastSyncedAt: number | null

  addSession: (s: Session) => void
  setInProgress: (ip: InProgress | null) => void
  updateSettings: (patch: Partial<SyncedSettings>) => void
  setConfig: (patch: Partial<LocalConfig>) => void
}

function guessDevice(): string {
  const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent
  if (/Mac/.test(ua)) return 'MacBook'
  if (/Windows/.test(ua)) return '家里电脑'
  return '设备'
}

export const useApp = create<AppState>()(
  persist(
    (set) => ({
      sessions: {},
      shared: {
        settings: DEFAULT_SETTINGS,
        settingsUpdatedAt: 0,
        inProgress: null,
        inProgressUpdatedAt: 0,
      },
      config: { owner: 'shxch', repo: 'typing-data', token: '', device: guessDevice(), sound: true, volume: 0.6, soundStyle: 'keyboard' },
      shas: {},
      dirtyMonths: [],
      remoteStamp: { settings: 0, inProgress: 0 },
      status: 'idle',
      statusMessage: '',
      lastSyncedAt: null,

      addSession: (s) =>
        set((st) => ({
          sessions: { ...st.sessions, [s.id]: s },
          dirtyMonths: Array.from(new Set([...st.dirtyMonths, monthOf(s.startedAt)])),
        })),

      setInProgress: (ip) =>
        set((st) => ({
          shared: { ...st.shared, inProgress: ip, inProgressUpdatedAt: Date.now() },
        })),

      updateSettings: (patch) =>
        set((st) => ({
          shared: {
            ...st.shared,
            settings: { ...st.shared.settings, ...patch },
            settingsUpdatedAt: Date.now(),
          },
        })),

      setConfig: (patch) => set((st) => ({ config: { ...st.config, ...patch } })),
    }),
    {
      name: 'typing-practice',
      version: 1,
      partialize: (st) => ({
        sessions: st.sessions,
        shared: st.shared,
        config: st.config,
        shas: st.shas,
        dirtyMonths: st.dirtyMonths,
        remoteStamp: st.remoteStamp,
      }),
      merge: (persisted, current) => {
        const p = persisted as Partial<AppState>
        return {
          ...current,
          ...p,
          config: { ...current.config, ...p.config },
          // New settings fields get defaults when loading older data.
          shared: p.shared
            ? { ...p.shared, settings: { ...DEFAULT_SETTINGS, ...p.shared.settings } }
            : current.shared,
        }
      },
    },
  ),
)

export const isConfigured = (c: LocalConfig) => Boolean(c.owner && c.repo && c.token)

/** True when this device has changes the remote hasn't seen. */
export function hasLocalChanges(st: Pick<AppState, 'dirtyMonths' | 'shared' | 'remoteStamp'>): boolean {
  return (
    st.dirtyMonths.length > 0 ||
    st.shared.settingsUpdatedAt > st.remoteStamp.settings ||
    st.shared.inProgressUpdatedAt > st.remoteStamp.inProgress
  )
}
