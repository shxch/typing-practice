import { useState, type ReactNode } from 'react'
import { WallpaperPicker } from '../components/WallpaperPicker'
import { useT } from '../i18n'
import { UNITS, computeProgress, unitLabel } from '../lessons/curriculum'
import { playCorrect, playError, playFinish, type SoundStyle } from '../sound/sound'
import { useApp } from '../store/app'
import { GitHubClient, GitHubError } from '../sync/github'
import { syncNow } from '../sync/runner'

const TOKEN_URL = 'https://github.com/settings/personal-access-tokens/new'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl bg-white/85 backdrop-blur shadow p-6 space-y-4">
      <h2 className="text-lg font-bold text-slate-800">{title}</h2>
      {children}
    </section>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="grid grid-cols-[10rem_1fr] items-center gap-3">
      <span className="text-slate-600">{label}</span>
      <div>
        {children}
        {hint && <div className="text-xs text-slate-400 mt-1">{hint}</div>}
      </div>
    </label>
  )
}

const input = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-300'

const clamp = (v: string, lo: number, hi: number) => Math.min(hi, Math.max(lo, Number(v) || lo))

export function Settings() {
  const config = useApp((s) => s.config)
  const settings = useApp((s) => s.shared.settings)
  const sessions = useApp((s) => s.sessions)
  const status = useApp((s) => s.status)
  const statusMessage = useApp((s) => s.statusMessage)
  const lastSyncedAt = useApp((s) => s.lastSyncedAt)
  const setConfig = useApp((s) => s.setConfig)
  const updateSettings = useApp((s) => s.updateSettings)
  const t = useT()
  const [check, setCheck] = useState<string>('')

  const earned = computeProgress(Object.values(sessions), { ...settings, manualUnits: null }).earnedUnits
  const units = settings.manualUnits ?? earned
  const stageName = { A: t.stageA, B: t.stageB, C: t.stageC }

  async function testConnection() {
    setCheck(t.checking)
    try {
      await new GitHubClient(config).check()
      setCheck(t.checkOk)
      void syncNow()
    } catch (e) {
      setCheck(e instanceof GitHubError ? `✗ ${e.message}` : t.checkNetwork)
    }
  }

  /** A few keystrokes, a mistake, then the end-of-round chime. */
  function trySound(style: SoundStyle = config.soundStyle) {
    ;[0, 150, 300, 450].forEach((ms, i) => setTimeout(() => playCorrect(style, i === 2), ms))
    setTimeout(() => playError(), 700)
    setTimeout(() => playFinish(), 1100)
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <Section title={t.secLook}>
        <Field label={t.language}>
          <div className="flex gap-2">
            {(
              [
                ['zh', '中文'],
                ['en', 'English'],
              ] as const
            ).map(([v, text]) => (
              <button
                key={v}
                onClick={() => updateSettings({ lang: v })}
                className={`px-4 py-1.5 rounded-lg border ${
                  settings.lang === v ? 'bg-violet-600 border-violet-600 text-white' : 'bg-white border-slate-300 text-slate-600'
                }`}
              >
                {text}
              </button>
            ))}
          </div>
        </Field>

        <div className="space-y-2">
          <div className="text-slate-600">{t.wallpaper}</div>
          <WallpaperPicker value={settings.wallpaper} onChange={(id) => updateSettings({ wallpaper: id })} />
        </div>

        <Field label={t.soundOn} hint={t.soundHint}>
          <div className="flex items-center gap-4">
            <input type="checkbox" checked={config.sound} onChange={(e) => setConfig({ sound: e.target.checked })} />
            <span className="text-slate-500 text-sm">{t.volume}</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={config.volume}
              disabled={!config.sound}
              onChange={(e) => setConfig({ volume: Number(e.target.value) })}
              className="flex-1 accent-violet-600"
            />
            <button onClick={() => trySound()} disabled={!config.sound} className="text-sm text-violet-600 underline disabled:opacity-40">
              {t.soundTest}
            </button>
          </div>
        </Field>
        <Field label={t.soundStyle}>
          <div className="flex gap-2">
            {(['phone', 'keyboard', 'kalimba', 'wood'] as const).map((v) => (
              <button
                key={v}
                disabled={!config.sound}
                onClick={() => {
                  setConfig({ soundStyle: v })
                  ;[0, 150, 300, 450].forEach((ms, i) => setTimeout(() => playCorrect(v, i === 2), ms))
                }}
                className={`px-4 py-1.5 rounded-lg border disabled:opacity-40 ${
                  config.soundStyle === v ? 'bg-violet-600 border-violet-600 text-white' : 'bg-white border-slate-300 text-slate-600'
                }`}
              >
                {t.styles[v]}
              </button>
            ))}
          </div>
        </Field>
      </Section>

      <Section title={t.secSync}>
        <p className="text-sm text-slate-500">{t.syncIntro}</p>
        <Field label={t.ghUser}>
          <input className={input} value={config.owner} onChange={(e) => setConfig({ owner: e.target.value.trim() })} />
        </Field>
        <Field label={t.dataRepo}>
          <input className={input} value={config.repo} onChange={(e) => setConfig({ repo: e.target.value.trim() })} />
        </Field>
        <Field label={t.token} hint={t.tokenHint}>
          <input
            className={input}
            type="password"
            autoComplete="off"
            value={config.token}
            onChange={(e) => setConfig({ token: e.target.value.trim() })}
          />
          <a className="text-xs text-violet-600 underline" href={TOKEN_URL} target="_blank" rel="noreferrer">
            {t.createToken}
          </a>
        </Field>
        <Field label={t.deviceName} hint={t.deviceHint}>
          <input className={input} value={config.device} onChange={(e) => setConfig({ device: e.target.value })} />
        </Field>
        <div className="flex items-center gap-3">
          <button onClick={testConnection} className="px-4 py-2 rounded-lg bg-violet-600 text-white hover:bg-violet-700">
            {t.testSync}
          </button>
          <span className="text-sm text-slate-600">{check}</span>
        </div>
        <div className="text-sm text-slate-500">
          {t.status}
          {t.statusText[status]}
          {statusMessage && ` (${statusMessage})`}
          {lastSyncedAt && ` · ${t.lastSync} ${new Date(lastSyncedAt).toLocaleTimeString()}`}
        </div>
      </Section>

      <Section title={t.secPractice}>
        <Field label={t.dailyGoal} hint={t.dailyGoalHint}>
          <input
            className={input}
            type="number"
            min={1}
            max={120}
            value={settings.dailyGoalMinutes}
            onChange={(e) => updateSettings({ dailyGoalMinutes: clamp(e.target.value, 1, 120) })}
          />
        </Field>
        <Field label={t.targetWpm} hint={t.targetWpmHint}>
          <input
            className={input}
            type="number"
            min={5}
            max={100}
            value={settings.targetWpm}
            onChange={(e) => updateSettings({ targetWpm: clamp(e.target.value, 5, 100) })}
          />
        </Field>
        <Field label={t.targetAcc}>
          <input
            className={input}
            type="number"
            min={50}
            max={100}
            value={Math.round(settings.targetAccuracy * 100)}
            onChange={(e) => updateSettings({ targetAccuracy: clamp(e.target.value, 50, 100) / 100 })}
          />
        </Field>
        <Field label={t.lessonWords}>
          <input
            className={input}
            type="number"
            min={5}
            max={80}
            value={settings.lessonWords}
            onChange={(e) => updateSettings({ lessonWords: clamp(e.target.value, 5, 80) })}
          />
        </Field>
        <Field label={t.minSamples} hint={t.minSamplesHint}>
          <input
            className={input}
            type="number"
            min={5}
            max={100}
            value={settings.minSamples}
            onChange={(e) => updateSettings({ minSamples: clamp(e.target.value, 5, 100) })}
          />
        </Field>
        <Field label={t.onError}>
          <div className="flex gap-4">
            {(
              [
                ['stop', t.modeStop],
                ['backspace', t.modeBackspace],
              ] as const
            ).map(([v, text]) => (
              <label key={v} className="flex items-center gap-1.5">
                <input type="radio" checked={settings.errorMode === v} onChange={() => updateSettings({ errorMode: v })} />
                {text}
              </label>
            ))}
          </div>
        </Field>
      </Section>

      <Section title={t.secCurriculum}>
        <p className="text-sm text-slate-500">
          {t.curriculumIntro(earned)}
          {settings.manualUnits !== null && <span className="text-amber-600"> {t.manualNote}</span>}
        </p>
        <input
          type="range"
          min={1}
          max={UNITS.length}
          value={units}
          onChange={(e) => updateSettings({ manualUnits: Number(e.target.value) })}
          className="w-full accent-violet-600"
        />
        <div className="flex flex-wrap gap-1.5">
          {UNITS.map((u, i) => (
            <span
              key={i}
              title={stageName[u.stage]}
              className={`px-2 py-0.5 rounded font-mono text-sm ${
                i < units
                  ? u.stage === 'A'
                    ? 'bg-violet-100 text-violet-800'
                    : u.stage === 'B'
                      ? 'bg-sky-100 text-sky-800'
                      : 'bg-emerald-100 text-emerald-800'
                  : 'bg-slate-100 text-slate-400'
              }`}
            >
              {unitLabel(u)}
            </span>
          ))}
        </div>
        {settings.manualUnits !== null && (
          <button onClick={() => updateSettings({ manualUnits: null })} className="text-sm text-violet-600 underline">
            {t.restoreAuto}
          </button>
        )}
      </Section>
    </div>
  )
}
