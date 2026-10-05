import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { SoundStyle } from '../sound/sound'
import { mergeSessions, monthOf } from '../sync/merge'
import { idbGet, idbPut } from '../wallpapers/idb'
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
  /** Layout preferences, per device. */
  showKeyboard: boolean
  showKeyStats: boolean
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
  /** Wallpaper image uploads/deletions waiting for the data repo. */
  wallpaperOps: { op: 'put' | 'delete'; id: string; kind?: 'wallpaper' | 'badge' }[]

  // runtime only
  status: SyncStatus
  statusMessage: string
  lastSyncedAt: number | null

  addSession: (s: Session) => void
  setInProgress: (ip: InProgress | null) => void
  updateSettings: (patch: Partial<SyncedSettings>) => void
  setConfig: (patch: Partial<LocalConfig>) => void
}

export function guessDevice(): string {
  const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent
  if (/Mac/.test(ua)) return 'MacBook'
  if (/Windows/.test(ua)) return '家里电脑'
  return '设备'
}

const SESSIONS_KEY = 'app:sessions'
/**
 * The practice log outgrows localStorage (and was rewritten there on every key press), so it is
 * kept in IndexedDB. Until `loadSessions` has moved it there — or if IndexedDB doesn't work —
 * it stays in localStorage with everything else.
 */
let sessionsInIdb = false

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
      config: { owner: 'shxch', repo: 'typing-data', token: '', device: guessDevice(), sound: true, volume: 0.6, soundStyle: 'phone', showKeyboard: true, showKeyStats: true },
      shas: {},
      dirtyMonths: [],
      remoteStamp: { settings: 0, inProgress: 0 },
      wallpaperOps: [],
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
      version: 2,
      // v2: the phone-keyboard click became the default sound.
      migrate: (persisted, version) => {
        const p = persisted as { config?: Partial<LocalConfig> }
        if (version < 2 && p.config) p.config.soundStyle = 'phone'
        return p as never
      },
      partialize: (st) => ({
        ...(sessionsInIdb ? {} : { sessions: st.sessions }),
        shared: st.shared,
        config: st.config,
        shas: st.shas,
        dirtyMonths: st.dirtyMonths,
        remoteStamp: st.remoteStamp,
        wallpaperOps: st.wallpaperOps,
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

useApp.subscribe((st, prev) => {
  if (!sessionsInIdb || st.sessions === prev.sessions) return
  // If the write fails, the next change goes back to localStorage.
  idbPut(SESSIONS_KEY, st.sessions).catch(() => (sessionsInIdb = false))
})

/** Load the practice log from IndexedDB, moving it there from localStorage the first time. Call before rendering. */
export async function loadSessions(): Promise<void> {
  try {
    const stored = await idbGet<Record<string, Session>>(SESSIONS_KEY)
    const legacy = useApp.getState().sessions
    await idbPut(SESSIONS_KEY, mergeSessions(stored ?? {}, legacy))
    sessionsInIdb = true
    // The log is gone but sync remembers the remote files as seen: forget that, so they are pulled again.
    const lost = !stored && Object.keys(legacy).length === 0
    useApp.setState((st) => ({ sessions: mergeSessions(stored ?? {}, st.sessions), ...(lost ? { shas: {} } : {}) }))
  } catch {
    /* no IndexedDB: the log stays in localStorage */
  }
}

export const isConfigured = (c: LocalConfig) => Boolean(c.owner && c.repo && c.token)

/** True when this device has changes the remote hasn't seen. */
export function hasLocalChanges(st: Pick<AppState, 'dirtyMonths' | 'shared' | 'remoteStamp' | 'wallpaperOps'>): boolean {
  return (
    st.dirtyMonths.length > 0 ||
    st.wallpaperOps.length > 0 ||
    st.shared.settingsUpdatedAt > st.remoteStamp.settings ||
    st.shared.inProgressUpdatedAt > st.remoteStamp.inProgress
  )
}
