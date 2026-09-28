import { useEffect, useState } from 'react'
import { useT } from '../i18n'
import { hasLocalChanges, useApp } from '../store/app'
import { syncNow } from '../sync/runner'

/**
 * A fixed-size refresh icon: it spins while syncing and stops when the sync is done, so the
 * header never changes width. Problems only change its colour; the tooltip says what's up.
 */
export function SyncBadge() {
  const status = useApp((s) => s.status)
  const statusMessage = useApp((s) => s.statusMessage)
  const pending = useApp(hasLocalChanges)
  const t = useT()

  // Once started, the icon finishes its current turn before stopping, so it never jumps
  // mid-spin and even a very quick sync shows one full turn.
  const [spinning, setSpinning] = useState(false)
  useEffect(() => {
    if (status === 'syncing') setSpinning(true)
  }, [status])

  const view = {
    unconfigured: { text: t.syncUnconfigured, cls: 'text-slate-400' },
    idle: { text: t.syncIdle, cls: 'text-slate-500' },
    syncing: { text: t.syncing, cls: 'text-theme-600' },
    ok: pending ? { text: t.syncPending, cls: 'text-amber-500' } : { text: t.syncOk, cls: 'text-theme-600' },
    offline: { text: t.syncOffline, cls: 'text-amber-500' },
    error: { text: t.syncError, cls: 'text-rose-500' },
  }[status]
  const label = statusMessage ? `${view.text} — ${statusMessage}` : `${view.text} · ${t.syncClick}`

  return (
    <button
      onClick={(e) => {
        void syncNow()
        e.currentTarget.blur()
      }}
      title={label}
      aria-label={label}
      className={`w-9 h-9 grid place-items-center rounded-full hover:bg-theme-100 ${view.cls}`}
    >
      <svg
        viewBox="0 0 24 24"
        className={`w-5 h-5 ${spinning ? 'animate-spin' : ''}`}
        onAnimationIteration={() => {
          if (useApp.getState().status !== 'syncing') setSpinning(false)
        }}
        fill="none"
        stroke="currentColor"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M20 12a8 8 0 1 1-2.34-5.66" />
        <path d="M20 4v4.5h-4.5" />
      </svg>
    </button>
  )
}
