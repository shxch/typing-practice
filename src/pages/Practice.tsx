import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { KeyboardMap } from '../components/KeyboardMap'
import { ResultCard, type RoundResult } from '../components/ResultCard'
import { TypingArea } from '../components/TypingArea'
import { accuracy, backspace, createState, slowestKeys, typeChar, wpm } from '../engine/typing'
import { STAGE_NAMES, UNITS, computeProgress, type Progress } from '../lessons/curriculum'
import { generateLesson } from '../lessons/generate'
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
  const setInProgress = useApp((s) => s.setInProgress)
  const addSession = useApp((s) => s.addSession)

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
      setResult({
        wpm: session.wpm,
        accuracy: session.accuracy,
        slowest: slowestKeys(state.keyStats),
        newKeys: [...after.unlocked].filter((c) => !before.has(c)),
      })
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

      // The clock for a new lesson starts at its first key, not when it was generated.
      const lesson = inProgress ? current : { ...current, startedAt: Date.now() }
      if (next.done) finish(lesson, next)
      else setInProgress({ ...lesson, device, state: next })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [current, inProgress, result, device, finish, newRound, setInProgress])

  const st = current.state
  const resumedFromElsewhere = inProgress && inProgress.device !== device && st.pos > 0
  const stageName = STAGE_NAMES[progress.stage]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between text-slate-600">
        <div>
          <span className="font-semibold text-violet-700">{stageName}</span>
          <span className="mx-2">·</span>
          已解锁 {progress.unlockedUnits} / {UNITS.length} 组按键
          {progress.focus && (
            <>
              <span className="mx-2">·</span>
              重点练习 <span className="font-mono font-bold text-violet-700 px-1.5 rounded bg-violet-100">{progress.focus}</span>
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
          <span>继续在「{inProgress.device}」上没打完的练习，直接接着打就行～</span>
          <button onClick={newRound} className="text-sm underline">
            换一篇
          </button>
        </div>
      )}

      {imeWarning && (
        <div className="rounded-xl bg-amber-50 border border-amber-300 px-4 py-3 text-amber-800">
          好像开着中文输入法，请切换到英文输入法再打字（Mac：按 Caps Lock 或 Ctrl+空格；Windows：按 Shift）。
        </div>
      )}

      {result ? (
        <ResultCard result={result} onNext={newRound} />
      ) : (
        <div className="rounded-2xl bg-white shadow-lg px-10 py-8 min-h-48">
          <TypingArea state={st} />
        </div>
      )}

      <div className="flex justify-center pt-2">
        <KeyboardMap progress={progress} />
      </div>

      {!result && (
        <div className="text-center text-sm text-slate-400">
          {settings.errorMode === 'stop' ? '打错了要打对才能继续' : '可以用退格键改错'}
          {st.pos === 0 && ' · 直接开始打字即可'}
          {st.pos > 0 && (
            <button onClick={newRound} className="ml-3 underline">
              换一篇
            </button>
          )}
        </div>
      )}
    </div>
  )
}
