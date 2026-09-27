import { useState, type ReactNode } from 'react'
import { STAGE_NAMES, UNITS, computeProgress, unitLabel } from '../lessons/curriculum'
import { useApp, type SyncStatus } from '../store/app'
import { GitHubClient, GitHubError } from '../sync/github'
import { syncNow } from '../sync/runner'

const TOKEN_URL = 'https://github.com/settings/personal-access-tokens/new'

const STATUS_TEXT: Record<SyncStatus, string> = {
  unconfigured: '未设置',
  idle: '等待同步',
  syncing: '同步中',
  ok: '正常',
  offline: '离线',
  error: '出错',
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl bg-white shadow p-6 space-y-4">
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

const input = 'w-full rounded-lg border border-slate-300 px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-300'

export function Settings() {
  const config = useApp((s) => s.config)
  const settings = useApp((s) => s.shared.settings)
  const sessions = useApp((s) => s.sessions)
  const status = useApp((s) => s.status)
  const statusMessage = useApp((s) => s.statusMessage)
  const lastSyncedAt = useApp((s) => s.lastSyncedAt)
  const setConfig = useApp((s) => s.setConfig)
  const updateSettings = useApp((s) => s.updateSettings)
  const [check, setCheck] = useState<string>('')

  const earned = computeProgress(Object.values(sessions), { ...settings, manualUnits: null }).earnedUnits
  const units = settings.manualUnits ?? earned

  async function testConnection() {
    setCheck('检查中…')
    try {
      await new GitHubClient(config).check()
      setCheck('✓ 连接成功')
      void syncNow()
    } catch (e) {
      setCheck(e instanceof GitHubError ? `✗ ${e.message}` : '✗ 网络错误')
    }
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <Section title="进度同步（每台设备设置一次）">
        <p className="text-sm text-slate-500">
          练习记录保存在你的私有仓库里，MacBook 和家里电脑填同样的信息就能共享进度。Token 只保存在这台设备的浏览器里。
        </p>
        <Field label="GitHub 用户名">
          <input className={input} value={config.owner} onChange={(e) => setConfig({ owner: e.target.value.trim() })} />
        </Field>
        <Field label="数据仓库">
          <input className={input} value={config.repo} onChange={(e) => setConfig({ repo: e.target.value.trim() })} />
        </Field>
        <Field
          label="Token"
          hint="在 GitHub 创建 fine-grained token：Repository access 只选数据仓库，Permissions → Contents 选 Read and write。"
        >
          <input
            className={input}
            type="password"
            autoComplete="off"
            value={config.token}
            onChange={(e) => setConfig({ token: e.target.value.trim() })}
          />
          <a className="text-xs text-violet-600 underline" href={TOKEN_URL} target="_blank" rel="noreferrer">
            去创建 token →
          </a>
        </Field>
        <Field label="这台设备的名字" hint="换设备继续练习时会显示">
          <input className={input} value={config.device} onChange={(e) => setConfig({ device: e.target.value })} />
        </Field>
        <div className="flex items-center gap-3">
          <button onClick={testConnection} className="px-4 py-2 rounded-lg bg-violet-600 text-white hover:bg-violet-700">
            测试连接并同步
          </button>
          <span className="text-sm text-slate-600">{check}</span>
        </div>
        <div className="text-sm text-slate-500">
          状态：{STATUS_TEXT[status]}
          {statusMessage && `（${statusMessage}）`}
          {lastSyncedAt && ` · 上次同步 ${new Date(lastSyncedAt).toLocaleTimeString()}`}
        </div>
      </Section>

      <Section title="练习设置（所有设备共用）">
        <Field label="目标速度 (WPM)" hint="每个键都达到这个速度才会解锁下一个键">
          <input
            className={input}
            type="number"
            min={5}
            max={100}
            value={settings.targetWpm}
            onChange={(e) => updateSettings({ targetWpm: Math.max(5, Number(e.target.value) || 5) })}
          />
        </Field>
        <Field label="目标准确率 (%)">
          <input
            className={input}
            type="number"
            min={50}
            max={100}
            value={Math.round(settings.targetAccuracy * 100)}
            onChange={(e) => updateSettings({ targetAccuracy: Math.min(100, Math.max(50, Number(e.target.value) || 50)) / 100 })}
          />
        </Field>
        <Field label="每轮单词数">
          <input
            className={input}
            type="number"
            min={5}
            max={80}
            value={settings.lessonWords}
            onChange={(e) => updateSettings({ lessonWords: Math.min(80, Math.max(5, Number(e.target.value) || 5)) })}
          />
        </Field>
        <Field label="达标所需练习次数" hint="一个键至少打对这么多次，速度才算数">
          <input
            className={input}
            type="number"
            min={5}
            max={100}
            value={settings.minSamples}
            onChange={(e) => updateSettings({ minSamples: Math.min(100, Math.max(5, Number(e.target.value) || 5)) })}
          />
        </Field>
        <Field label="打错时">
          <div className="flex gap-4">
            {(
              [
                ['stop', '停住，打对才继续'],
                ['backspace', '继续，可用退格改'],
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

      <Section title="课程进度">
        <p className="text-sm text-slate-500">
          按练习成绩自动解锁了 {earned} 组。需要时可以手动调整（比如直接跳到大写或标点）。
          {settings.manualUnits !== null && <span className="text-amber-600">当前为手动设置。</span>}
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
              title={STAGE_NAMES[u.stage]}
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
            恢复自动解锁
          </button>
        )}
      </Section>
    </div>
  )
}
