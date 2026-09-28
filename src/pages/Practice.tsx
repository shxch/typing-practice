import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DailyBar } from '../components/DailyBar'
import { KeyboardMap } from '../components/KeyboardMap'
import { KeyPanel } from '../components/KeyPanel'
import { ResultCard, type RoundResult } from '../components/ResultCard'
import { TypingArea } from '../components/TypingArea'
import { accuracy, backspace, createState, resume, slowestKeys, typeChar, wpm } from '../engine/typing'
import { useT } from '../i18n'
import { UNITS, computeProgress, type Progress } from '../lessons/curriculum'
import { generateLesson } from '../lessons/generate'
import { dayKey } from '../lessons/stats'
import { computeBadges, newBadges } from '../rewards/badges'
import { levelOf, minutesOn, starsByRound, streak, totalStars } from '../rewards/rewards'
import { playCorrect, playDelete, playError, playFinish, playUnlock } from '../sound/sound'
import { useApp } from '../store/app'
import type { InProgress, Session } from '../store/types'
import { syncNow } from '../sync/runner'

const newId = () => crypto.randomUUID()

function freshLesson(progress: Progress, words: number, mode: InProgress['state']['mode'], device: string): InProgress {
  return {
    id: newId(),
    startedAt: Date.now(),
    device,
    units: progress.unlockedUnits,
    earnedUnits: progress.earnedUnits,
    state: createState(generateLesson(progress, words), mode),
  }
}

const panel = 'rounded-2xl bg-white/80 backdrop-blur shadow-lg'

export function Practice() {
  const sessions = useApp((s) => s.sessions)
  const settings = useApp((s) => s.shared.settings)
  const inProgress = useApp((s) => s.shared.inProgress)
  const device = useApp((s) => s.config.device)
  const soundStyle = useApp((s) => s.config.soundStyle)
  const showKeyboard = useApp((s) => s.config.showKeyboard)
  const showKeyStats = useApp((s) => s.config.showKeyStats)
  const setConfig = useApp((s) => s.setConfig)
  const setInProgress = useApp((s) => s.setInProgress)
  const addSession = useApp((s) => s.addSession)
  const t = useT()

  const sessionList = useMemo(() => Object.values(sessions), [sessions])
  const progress = useMemo(() => computeProgress(sessionList, settings), [sessionList, settings])
  const [selectedKey, setSelectedKey] = useState<string | null>(null)

  // A lesson that hasn't been typed into yet lives only here; once typing starts it moves
  // into the store (shared.inProgress) so it can be resumed on another device.
  const [fresh, setFresh] = useState<InProgress>(() => freshLesson(progress, settings.lessonWords, settings.errorMode, device))
  const [result, setResult] = useState<RoundResult | null>(null)
  const [imeWarning, setImeWarning] = useState(false)
  const [capsLock, setCapsLock] = useState(false)
  const current = inProgress ?? fresh

  // The key handler reads these instead of render-time values, so two keys handled before
  // React re-renders (fast rollover, a slow TV) both land on the latest state.
  const freshRef = useRef(fresh)
  freshRef.current = fresh
  const resultRef = useRef(result)
  resultRef.current = result
  /** Lessons already continued on this screen; any other stored lesson gets `resume()` first. */
  const resumed = useRef(new Set<string>())
  const finished = useRef(new Set<string>())

  // Regenerate the untouched lesson when unlocks or settings change.
  const lessonKey = `${progress.unlockedUnits}|${settings.lessonWords}|${settings.errorMode}`
  const lastKey = useRef(lessonKey)
  useEffect(() => {
    if (lastKey.current === lessonKey) return
    lastKey.current = lessonKey
    if (!inProgress) setFresh(freshLesson(progress, settings.lessonWords, settings.errorMode, device))
  }, [lessonKey, inProgress, progress, settings, device])

  const newRound = useCallback(() => {
    resultRef.current = null
    setResult(null)
    setImeWarning(false)
    setInProgress(null)
    const next = freshLesson(progress, settings.lessonWords, settings.errorMode, device)
    freshRef.current = next
    setFresh(next)
  }, [progress, settings, device, setInProgress])

  const finish = useCallback(
    (lesson: InProgress, state: InProgress['state']) => {
      const now = Date.now()
      const session: Session = {
        id: lesson.id,
        // A round continued on a later day (or another device) counts for the day it was finished.
        startedAt: dayKey(lesson.startedAt) === dayKey(now) ? lesson.startedAt : Math.max(lesson.startedAt, now - state.elapsedMs),
        endedAt: now,
        device,
        stage: UNITS[lesson.units - 1]?.stage ?? 'A',
        units: lesson.units,
        ...(lesson.earnedUnits !== undefined ? { earnedUnits: lesson.earnedUnits } : {}),
        chars: state.text.length,
        wpm: wpm(state),
        accuracy: accuracy(state),
        durationMs: state.elapsedMs,
        keyStats: state.keyStats,
      }
      const after = [...sessionList, session]
      const today = dayKey(now)
      const goal = settings.dailyGoalMinutes
      const levelBefore = levelOf(totalStars(sessionList, settings)).level
      const levelAfter = levelOf(totalStars(after, settings)).level
      const goalJustDone = minutesOn(sessionList, today) < goal && minutesOn(after, today) >= goal
      const afterProgress = computeProgress(after, settings)
      const newKeys = [...afterProgress.unlocked].filter((c) => !progress.unlocked.has(c))
      const badges = newBadges(
        computeBadges(sessionList, settings, progress.earnedUnits),
        computeBadges(after, settings, afterProgress.earnedUnits),
      )

      finished.current.add(lesson.id)
      addSession(session)
      setInProgress(null)
      // Practice has caught up with a manual jump: it has nothing left to do.
      if (settings.manualUnits !== null && afterProgress.earnedUnits >= settings.manualUnits) {
        useApp.getState().updateSettings({ manualUnits: null })
      }
      const roundResult: RoundResult = {
        wpm: session.wpm,
        accuracy: session.accuracy,
        slowest: slowestKeys(state.keyStats),
        newKeys,
        stars: starsByRound(after, settings).get(session.id) ?? 1,
        goalJustDone,
        streak: streak(after, goal),
        levelUp: levelAfter > levelBefore ? t.levels[Math.min(levelAfter, t.levels.length - 1)] : null,
        badges,
      }
      resultRef.current = roundResult
      setResult(roundResult)
      playFinish()
      if (newKeys.length > 0 || goalJustDone || levelAfter > levelBefore || badges.length > 0) playUnlock()
      void syncNow()
    },
    [progress, device, addSession, setInProgress, sessionList, settings, t],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (e.getModifierState) setCapsLock(e.getModifierState('CapsLock'))
      // Holding a key down auto-repeats it; that's never intended typing.
      if (e.repeat) {
        e.preventDefault()
        return
      }

      if (e.isComposing || e.key === 'Process') {
        setImeWarning(true)
        return
      }

      if (resultRef.current) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          newRound()
        }
        return
      }

      const stored = useApp.getState().shared.inProgress
      let lesson: InProgress
      if (stored && !finished.current.has(stored.id)) {
        // Continuing a lesson from another device or from before a reload: the gap since its
        // last key isn't typing time (and the other device's clock may differ).
        lesson =
          resumed.current.has(stored.id) && stored.device === device ? stored : { ...stored, state: resume(stored.state) }
      } else {
        // The clock for a new lesson starts at its first key, not when it was generated.
        lesson = { ...freshRef.current, startedAt: Date.now() }
      }
      if (finished.current.has(lesson.id)) return
      const prev = lesson.state
      let next = prev
      if (e.key === 'Backspace') {
        next = backspace(next)
      } else if (e.key.length === 1) {
        next = typeChar(next, e.key, performance.timeOrigin + performance.now())
      } else {
        return
      }
      e.preventDefault()
      setImeWarning(false)
      if (next === prev) return
      if (e.key === 'Backspace') playDelete(soundStyle)
      if (next.presses > prev.presses) {
        if (next.correctPresses > prev.correctPresses) playCorrect(soundStyle, e.key === ' ')
        else playError()
      }

      resumed.current.add(lesson.id)
      if (next.done) finish(lesson, next)
      else setInProgress({ ...lesson, device, state: next })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [device, soundStyle, finish, newRound, setInProgress])

  const st = current.state
  const resumedFromElsewhere = inProgress && inProgress.device !== device && st.pos > 0
  const stageName = { A: t.stageA, B: t.stageB, C: t.stageC }[progress.stage]

  const toggle = (label: string, onClick: () => void) => (
    <button
      onClick={(e) => {
        onClick()
        e.currentTarget.blur()
      }}
      className="underline decoration-dotted underline-offset-2 hover:text-theme-700"
    >
      {label}
    </button>
  )

  return (
    <div className="space-y-4">
      <div className={`${panel} px-5 py-4`}>
        <DailyBar sessions={sessionList} settings={settings} liveMs={inProgress ? st.elapsedMs : 0} />
      </div>

      {showKeyStats && (
        <div className={`${panel} px-5 py-3`}>
          <KeyPanel
            progress={progress}
            sessions={sessions}
            settings={settings}
            selected={selectedKey}
            onSelect={setSelectedKey}
            header={
              <div className="text-sm text-slate-600 pb-0.5">
                <span className="font-semibold text-theme-700">{stageName}</span>
                <span className="mx-2">·</span>
                {t.unlockedUnits(progress.unlockedUnits, UNITS.length)}
              </div>
            }
          />
        </div>
      )}

      {resumedFromElsewhere && !result && (
        <div className="rounded-xl bg-sky-50/95 border border-sky-200 px-4 py-3 text-sky-800 flex justify-between items-center">
          <span>{t.resumeBanner(inProgress.device)}</span>
          <button onClick={newRound} className="text-sm underline">
            {t.newText}
          </button>
        </div>
      )}

      {capsLock && !result && (
        <div className="rounded-xl bg-amber-50/95 border border-amber-300 px-4 py-3 text-amber-800">{t.capsLockWarning}</div>
      )}

      {imeWarning && (
        <div className="rounded-xl bg-amber-50/95 border border-amber-300 px-4 py-3 text-amber-800">{t.imeWarning}</div>
      )}

      {result ? (
        <ResultCard result={result} onNext={newRound} />
      ) : (
        <div className={`${panel} ${showKeyboard ? 'px-10 py-7' : 'px-12 py-10'}`}>
          <div className="flex justify-end gap-5 font-mono text-sm text-slate-500 -mt-2 mb-2">
            <span>{Math.round(wpm(st))} WPM</span>
            <span>{Math.round(accuracy(st) * 100)}%</span>
            <span>
              {st.pos}/{st.text.length}
            </span>
          </div>
          <TypingArea state={st} large={!showKeyboard} />
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm text-slate-500 mt-5">
            <span>
              {settings.errorMode === 'stop' ? t.hintStop : t.hintBackspace}
              {st.pos === 0 && t.hintStart}
            </span>
            {st.pos > 0 && toggle(t.newText, newRound)}
            {toggle(showKeyboard ? t.hideKeyboard : t.showKeyboard, () => setConfig({ showKeyboard: !showKeyboard }))}
            {toggle(showKeyStats ? t.hideKeys : t.showKeys, () => setConfig({ showKeyStats: !showKeyStats }))}
          </div>
        </div>
      )}

      {showKeyboard && (
        <div className={`${panel} flex justify-center px-5 py-5`}>
          <KeyboardMap progress={progress} />
        </div>
      )}
    </div>
  )
}
