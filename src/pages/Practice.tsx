import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { KeyboardMap } from '../components/KeyboardMap'
import { ResultCard, type RoundResult } from '../components/ResultCard'
import { TypingArea } from '../components/TypingArea'
import { accuracy, backspace, createState, slowestKeys, typeChar, wpm } from '../engine/typing'
import { UNITS, computeProgress, type Progress } from '../lessons/curriculum'
import { generateLesson } from '../lessons/generate'
import { useT } from '../i18n'
import { playCorrect, playError, playFinish, playUnlock } from '../sound/sound'
import { useApp } from '../store/app'
import type { InProgress } from '../store/types'
import { syncNow } from '../sync/runner'

const newId = () => crypto.randomUUID()

function freshLesson(progress: Progress, words: number, mode: InProgress['state']['mode'], device: string): InProgress {
  return {
    id: newId(),
    startedAt: Date.now(),
    device,
    units: progress.unlockedUnits,
    state: createState(generateLesson(progress, words), mode),
  }
}

export function Practice() {
  const sessions = useApp((s) => s.sessions)
  const settings = useApp((s) => s.shared.settings)
  const inProgress = useApp((s) => s.shared.inProgress)
  const device = useApp((s) => s.config.device)
  const soundStyle = useApp((s) => s.config.soundStyle)
  const setInProgress = useApp((s) => s.setInProgress)
  const addSession = useApp((s) => s.addSession)
  const t = useT()

  const progress = useMemo(() => computeProgress(Object.values(sessions), settings), [sessions, settings])

  // A lesson that hasn't been typed into yet lives only here; once typing starts it moves
  // into the store (shared.inProgress) so it can be resumed on another device.
  const [fresh, setFresh] = useState<InProgress>(() => freshLesson(progress, settings.lessonWords, settings.errorMode, device))
  const [result, setResult] = useState<RoundResult | null>(null)
  const [imeWarning, setImeWarning] = useState(false)
  const current = inProgress ?? fresh

  // Regenerate the untouched lesson when unlocks or settings change.
  const lessonKey = `${progress.unlockedUnits}|${settings.lessonWords}|${settings.errorMode}`
  const lastKey = useRef(lessonKey)
  useEffect(() => {
    if (lastKey.current === lessonKey) return
    lastKey.current = lessonKey
    if (!inProgress) setFresh(freshLesson(progress, settings.lessonWords, settings.errorMode, device))
  }, [lessonKey, inProgress, progress, settings, device])

  const newRound = useCallback(() => {
    setResult(null)
    setInProgress(null)
    setFresh(freshLesson(progress, settings.lessonWords, settings.errorMode, device))
  }, [progress, settings, device, setInProgress])

  const finish = useCallback(
    (lesson: InProgress, state: InProgress['state']) => {
      const before = progress.unlocked
      const session = {
        id: lesson.id,
        startedAt: lesson.startedAt,
        endedAt: Date.now(),
        device,
        stage: UNITS[lesson.units - 1]?.stage ?? 'A',
        units: lesson.units,
        chars: state.text.length,
        wpm: wpm(state),
        accuracy: accuracy(state),
        durationMs: state.elapsedMs,
        keyStats: state.keyStats,
      }
      addSession(session)
      setInProgress(null)
      const after = computeProgress([...Object.values(sessions), session], settings)
      const newKeys = [...after.unlocked].filter((c) => !before.has(c))
      setResult({
        wpm: session.wpm,
        accuracy: session.accuracy,
        slowest: slowestKeys(state.keyStats),
        newKeys,
      })
      playFinish()
      if (newKeys.length > 0) playUnlock()
      void syncNow()
    },
    [progress, device, addSession, setInProgress, sessions, settings],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
      if (e.ctrlKey || e.metaKey || e.altKey) return

      if (e.isComposing || e.key === 'Process') {
        setImeWarning(true)
        return
      }

      if (result) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          newRound()
        }
        return
      }

      let next = current.state
      if (e.key === 'Backspace') {
        next = backspace(next)
      } else if (e.key.length === 1) {
        next = typeChar(next, e.key, performance.timeOrigin + performance.now())
      } else {
        return
      }
      e.preventDefault()
      setImeWarning(false)
      if (next === current.state) return
      if (next.presses > current.state.presses) {
        if (next.correctPresses > current.state.correctPresses) playCorrect(soundStyle, e.key === ' ')
        else playError()
      }

      // The clock for a new lesson starts at its first key, not when it was generated.
      const lesson = inProgress ? current : { ...current, startedAt: Date.now() }
      if (next.done) finish(lesson, next)
      else setInProgress({ ...lesson, device, state: next })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [current, inProgress, result, device, soundStyle, finish, newRound, setInProgress])

  const st = current.state
  const resumedFromElsewhere = inProgress && inProgress.device !== device && st.pos > 0
  const stageName = { A: t.stageA, B: t.stageB, C: t.stageC }[progress.stage]
  const panel = 'rounded-2xl bg-white/80 backdrop-blur shadow-lg'

  return (
    <div className="space-y-6">
      <div className={`${panel} flex flex-wrap gap-2 items-center justify-between text-slate-600 px-5 py-3`}>
        <div>
          <span className="font-semibold text-violet-700">{stageName}</span>
          <span className="mx-2">·</span>
          {t.unlockedUnits(progress.unlockedUnits, UNITS.length)}
          {progress.focus && (
            <>
              <span className="mx-2">·</span>
              {t.focusKey} <span className="font-mono font-bold text-violet-700 px-1.5 rounded bg-violet-100">{progress.focus}</span>
            </>
          )}
        </div>
        {!result && (
          <div className="flex gap-6 font-mono">
            <span>{Math.round(wpm(st))} WPM</span>
            <span>{Math.round(accuracy(st) * 100)}%</span>
            <span>
              {st.pos}/{st.text.length}
            </span>
          </div>
        )}
      </div>

      {resumedFromElsewhere && !result && (
        <div className="rounded-xl bg-sky-50 border border-sky-200 px-4 py-3 text-sky-800 flex justify-between items-center">
          <span>{t.resumeBanner(inProgress.device)}</span>
          <button onClick={newRound} className="text-sm underline">
            {t.newText}
          </button>
        </div>
      )}

      {imeWarning && (
        <div className="rounded-xl bg-amber-50 border border-amber-300 px-4 py-3 text-amber-800">
          {t.imeWarning}
        </div>
      )}

      {result ? (
        <ResultCard result={result} onNext={newRound} />
      ) : (
        <div className={`${panel} px-10 py-8 min-h-48`}>
          <TypingArea state={st} />
        </div>
      )}

      <div className={`${panel} flex flex-col items-center gap-4 px-5 py-5`}>
        <KeyboardMap progress={progress} />
        {!result && (
          <div className="text-center text-sm text-slate-500">
            {settings.errorMode === 'stop' ? t.hintStop : t.hintBackspace}
            {st.pos === 0 && t.hintStart}
            {st.pos > 0 && (
              <button onClick={newRound} className="ml-3 underline">
                {t.newText}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
