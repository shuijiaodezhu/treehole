'use client'

import { useMemo, useState } from 'react'
import { Icon, type IconName } from './icons'
import {
  KIND_HINT,
  KIND_LABEL,
  KIND_ORDER,
  describeDue,
  usePlans,
  type PlanItem,
  type PlanKind,
} from './plans'
import { SkeletonText } from './skeleton'
import { EmptyState } from './empty-state'

/**
 * 计划书：计划 / 目标 / 待办任务
 *
 * 视觉走「纸质手账」：暖色渐变纸面 + 淡横格线 + 左侧装订线，
 * 中文用衬线字体（.font-serif-cn）以贴合手写感。
 */

const KIND_ICON: Record<PlanKind, IconName> = {
  plan: 'pen',
  goal: 'target',
  task: 'check',
}

const ACCENT: Record<PlanKind, { bar: string; chip: string; text: string }> = {
  plan: { bar: 'bg-[var(--accent)]', chip: 'bg-[var(--accent-soft)]', text: 'text-[var(--accent-deep)]' },
  goal: { bar: 'bg-[#a88ab8]', chip: 'bg-[#f3edf9]', text: 'text-[#7a5a9a]' },
  task: { bar: 'bg-[#7ea86a]', chip: 'bg-[#eef6e8]', text: 'text-[#5a8a4a]' },
}

export function PlansView({ userId }: { userId: string | null }) {
  const plans = usePlans(userId)
  const [kind, setKind] = useState<PlanKind>('task')
  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')
  const [due, setDue] = useState('')
  const [showExtra, setShowExtra] = useState(false)
  const [message, setMessage] = useState('')
  const [showDone, setShowDone] = useState(false)
  const [confirmId, setConfirmId] = useState<string | null>(null)

  const current = plans.grouped[kind]
  const accent = ACCENT[kind]

  const todayText = useMemo(
    () =>
      new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' }).format(new Date()),
    [],
  )

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setMessage('')
    const result = await plans.create({ kind, title, note, dueDate: due || null })
    if (!result.ok) {
      setMessage(result.message ?? '保存失败')
      return
    }
    setTitle('')
    setNote('')
    setDue('')
    setShowExtra(false)
  }

  async function handleToggle(item: PlanItem) {
    const result = await plans.update(item.id, { done: !item.done })
    if (!result.ok) setMessage('没能更新：' + (result.message ?? '未知错误'))
  }

  async function handleDelete(id: string) {
    const result = await plans.remove(id)
    setConfirmId(null)
    if (!result.ok) setMessage('删除失败：' + (result.message ?? '未知错误'))
  }

  return (
    <div className="mx-auto max-w-3xl">
      {/* 纸面 */}
      <div
        className="relative overflow-hidden rounded-3xl border border-[#f0e0d0] shadow-[0_4px_24px_rgba(217,119,87,0.07)]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(to bottom, rgba(255,255,255,0) 0 33px, rgba(217,119,87,0.07) 33px 34px)',
          backgroundColor: '#fffaf4',
        }}
      >
        {/* 左侧装订线 */}
        <div className="pointer-events-none absolute inset-y-0 left-10 w-px bg-[#f0c8b0]/70" />

        <div className="relative pl-14 pr-6 py-7">
          {/* 抬头 */}
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <h2 className="font-serif-cn text-2xl font-semibold tracking-wide text-[#2b2620]">计划书</h2>
              <p className="mt-1 font-serif-cn text-xs text-[var(--accent-muted)]">
                写下来，梦想就有了形状 · {todayText}
              </p>
            </div>
            <div className="hidden text-right sm:block">
              <p className="font-serif-cn text-[11px] text-[#c0a890]">今天要做的</p>
              <p className="text-2xl font-bold text-[var(--accent)]">{plans.stats.openTasks}</p>
            </div>
          </div>

          {/* 概览 */}
          <div className="mb-6 grid grid-cols-3 gap-3">
            <div className="rounded-2xl border border-[#f2e4d6] bg-white/70 px-3 py-2.5">
              <p className="text-[10px] text-[var(--accent-muted)]">待完成</p>
              <p className="mt-0.5 text-lg font-semibold text-[var(--accent-deep)]">{plans.stats.openTasks}</p>
            </div>
            <div className="rounded-2xl border border-[#f2e4d6] bg-white/70 px-3 py-2.5">
              <p className="text-[10px] text-[var(--accent-muted)]">已完成</p>
              <p className="mt-0.5 text-lg font-semibold text-[#5a8a4a]">{plans.stats.doneTasks}</p>
            </div>
            <div className="rounded-2xl border border-[#f2e4d6] bg-white/70 px-3 py-2.5">
              <p className="text-[10px] text-[var(--accent-muted)]">目标进度</p>
              <p className="mt-0.5 text-lg font-semibold text-[#7a5a9a]">{plans.stats.goalProgress}%</p>
            </div>
          </div>

          {/* 类别 */}
          <div className="mb-4 flex flex-wrap gap-2">
            {KIND_ORDER.map((k) => {
              const active = kind === k
              const count = plans.grouped[k].open.length
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKind(k)}
                  className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs transition ${
                    active
                      ? `${ACCENT[k].chip} ${ACCENT[k].text} font-medium ring-1 ring-inset ring-current/20`
                      : 'text-[var(--accent-muted)] hover:bg-[#faf3ec]'
                  }`}
                >
                  <Icon name={KIND_ICON[k]} className="h-3.5 w-3.5" />
                  {KIND_LABEL[k]}
                  {count > 0 && <span className="text-[10px] opacity-70">{count}</span>}
                </button>
              )
            })}
          </div>

          <p className="mb-3 font-serif-cn text-[11px] text-[#b8a89a]">{KIND_HINT[kind]}</p>

          {/* 添加 */}
          <form onSubmit={handleAdd} className="mb-5">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={
                  kind === 'task' ? '要做什么…' : kind === 'goal' ? '想达成什么…' : '在计划什么…'
                }
                maxLength={80}
                className="min-w-0 flex-1 border-b border-dashed border-[#e0c8b4] bg-transparent px-1 py-2 font-serif-cn text-sm text-[#2b2620] placeholder:text-[#c8b8a8] focus:border-[var(--accent)] focus:outline-none transition"
              />
              <button
                type="button"
                onClick={() => setShowExtra((v) => !v)}
                title="添加备注与日期"
                className="rounded-full border border-[#e8d8c8] px-2.5 py-1.5 text-[11px] text-[var(--accent-muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent-deep)]"
              >
                {showExtra ? '收起' : '备注/日期'}
              </button>
              <button
                type="submit"
                disabled={plans.busy || !title.trim()}
                className="flex items-center gap-1 rounded-full bg-gradient-to-r from-[var(--accent-light)] to-[var(--accent)] px-4 py-1.5 text-xs font-medium text-white transition hover:shadow-[0_4px_14px_rgba(217,119,87,0.3)] disabled:opacity-50"
              >
                <Icon name="plus" className="h-3.5 w-3.5" />
                记下来
              </button>
            </div>

            {showExtra && (
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="补充一句（可留空）"
                  maxLength={200}
                  className="min-w-0 flex-1 rounded-xl border border-[#eee0d2] bg-white/70 px-3 py-1.5 text-xs text-[#4a423c] focus:border-[var(--accent)] focus:outline-none transition"
                />
                <input
                  type="date"
                  value={due}
                  onChange={(e) => setDue(e.target.value)}
                  className="rounded-xl border border-[#eee0d2] bg-white/70 px-3 py-1.5 text-xs text-[#4a423c] focus:border-[var(--accent)] focus:outline-none transition"
                />
              </div>
            )}
          </form>

          {message && <p className="mb-3 text-[11px] text-[var(--accent-deep)]">{message}</p>}
          {plans.error && <p className="mb-3 text-[11px] text-red-500">{plans.error}</p>}

          {plans.loading && plans.items.length === 0 ? (
            <SkeletonText lines={4} className="py-6" />
          ) : current.open.length === 0 ? (
            <EmptyState
              art="list"
              compact
              title={kind === 'task' ? '暂时没有待办，享受一下空闲' : `还没有${KIND_LABEL[kind]}`}
              hint={KIND_HINT[kind]}
            />
          ) : (
            <div className="space-y-2.5">
              {current.open.map((item) => (
                <PlanRow
                  key={item.id}
                  item={item}
                  accent={accent}
                  busy={plans.busyId === item.id}
                  confirming={confirmId === item.id}
                  onToggle={() => void handleToggle(item)}
                  onAskDelete={() => {
                    setConfirmId(item.id)
                    window.setTimeout(() => setConfirmId((cur) => (cur === item.id ? null : cur)), 4000)
                  }}
                  onConfirmDelete={() => void handleDelete(item.id)}
                  onProgress={(value) => void plans.update(item.id, { progress: value })}
                />
              ))}
            </div>
          )}

          {/* 已完成 */}
          {current.done.length > 0 && (
            <div className="mt-6">
              <button
                type="button"
                onClick={() => setShowDone((v) => !v)}
                className="flex items-center gap-1.5 text-[11px] text-[var(--accent-muted)] transition hover:text-[#8a7a6a]"
              >
                <Icon name={showDone ? 'check' : 'arrow'} className="h-3 w-3" />
                已完成 {current.done.length} 条
              </button>

              {showDone && (
                <div className="mt-2 space-y-2">
                  {current.done.map((item) => (
                    <PlanRow
                      key={item.id}
                      item={item}
                      accent={accent}
                      busy={plans.busyId === item.id}
                      confirming={confirmId === item.id}
                      onToggle={() => void handleToggle(item)}
                      onAskDelete={() => {
                        setConfirmId(item.id)
                        window.setTimeout(() => setConfirmId((cur) => (cur === item.id ? null : cur)), 4000)
                      }}
                      onConfirmDelete={() => void handleDelete(item.id)}
                      onProgress={(value) => void plans.update(item.id, { progress: value })}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <p className="mt-4 text-center font-serif-cn text-[11px] text-[#c0b0a0]">
        只有你自己看得到这本计划书。
      </p>
    </div>
  )
}

/* ==================== 单条 ==================== */

function PlanRow({
  item,
  accent,
  busy,
  confirming,
  onToggle,
  onAskDelete,
  onConfirmDelete,
  onProgress,
}: {
  item: PlanItem
  accent: { bar: string; chip: string; text: string }
  busy: boolean
  confirming: boolean
  onToggle: () => void
  onAskDelete: () => void
  onConfirmDelete: () => void
  onProgress: (value: number) => void
}) {
  const due = describeDue(item.due_date)

  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border bg-white/80 pl-4 pr-3 py-2.5 transition ${
        item.done ? 'border-[#f2ece4] opacity-70' : 'border-[#f2e4d6] hover:shadow-[0_2px_10px_rgba(217,119,87,0.06)]'
      }`}
    >
      {/* 左侧色条 */}
      <span className={`absolute inset-y-0 left-0 w-[3px] ${accent.bar} ${item.done ? 'opacity-40' : ''}`} />

      <div className="flex items-start gap-2.5">
        {/* 勾选 / 目标图标 */}
        {item.kind === 'goal' ? (
          <span className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full ${accent.chip} ${accent.text}`}>
            <Icon name="target" className="h-3 w-3" />
          </span>
        ) : (
          <button
            type="button"
            onClick={onToggle}
            disabled={busy}
            aria-label={item.done ? '标记为未完成' : '标记为完成'}
            className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border transition disabled:opacity-50 ${
              item.done
                ? 'border-[#7ea86a] bg-[#7ea86a] text-white'
                : 'border-[#ddd0c2] text-transparent hover:border-[#7ea86a] hover:text-[#7ea86a]/40'
            }`}
          >
            <Icon name="check" className="h-3 w-3" />
          </button>
        )}

        <div className="min-w-0 flex-1">
          <p
            className={`font-serif-cn text-sm leading-relaxed ${
              item.done ? 'text-[#a89888] line-through' : 'text-[#2b2620]'
            }`}
          >
            {item.title}
          </p>

          {item.note && (
            <p className="mt-0.5 font-serif-cn text-[11px] leading-relaxed text-[#a89888]">{item.note}</p>
          )}

          <div className="mt-1 flex flex-wrap items-center gap-2">
            {due && (
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] ${
                  due.tone === 'overdue'
                    ? 'bg-red-50 text-red-500'
                    : due.tone === 'soon'
                      ? 'bg-[var(--accent-soft)] text-[var(--accent-deep)]'
                      : 'bg-[#f6f2ec] text-[#a89888]'
                }`}
              >
                {due.text}
              </span>
            )}

            {/* 目标进度 */}
            {item.kind === 'goal' && (
              <span className="flex items-center gap-2">
                <span className="h-1.5 w-24 overflow-hidden rounded-full bg-[#f0e8f6]">
                  <span
                    className="block h-full rounded-full bg-gradient-to-r from-[#c8b0dc] to-[#a88ab8] transition-all"
                    style={{ width: `${item.progress}%` }}
                  />
                </span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={item.progress}
                  disabled={busy}
                  onChange={(e) => onProgress(Number(e.target.value))}
                  className="h-1 w-20 cursor-pointer accent-[#a88ab8]"
                  aria-label="目标进度"
                />
                <span className="text-[10px] text-[#a88ab8]">{item.progress}%</span>
              </span>
            )}
          </div>
        </div>

        {/* 操作 */}
        <div className="flex flex-shrink-0 items-center gap-1.5">
          {item.kind === 'goal' && (
            <button
              type="button"
              onClick={onToggle}
              disabled={busy}
              className={`rounded-full px-2 py-0.5 text-[10px] transition disabled:opacity-50 ${
                item.done ? 'bg-[#eef6e8] text-[#5a8a4a]' : 'text-[var(--accent-muted)] hover:text-[#7a5a9a]'
              }`}
            >
              {item.done ? '已达成' : '达成'}
            </button>
          )}

          {confirming ? (
            <button
              type="button"
              onClick={onConfirmDelete}
              disabled={busy}
              className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] text-white transition hover:bg-red-600 disabled:opacity-50"
            >
              {busy ? '…' : '确认删'}
            </button>
          ) : (
            <button
              type="button"
              onClick={onAskDelete}
              aria-label="删除"
              className="rounded-full p-1 text-[#c8b8a8] opacity-0 transition group-hover:opacity-100 hover:text-red-500 focus:opacity-100"
            >
              <Icon name="trash" className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
