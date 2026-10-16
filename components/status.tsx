'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '../app/lib/supabase'

/**
 * 状态（挂在头像旁边的三个字）
 *
 * 和小屋的「正在输入…」不同，这个是**用户自己设的**：
 * 在「我的」里选一个现成的，或者自己写三个字。
 *
 * 刻意的限制：
 *   · **默认空** —— 不设就什么都不显示，不会出现"未设置"占位
 *   · **最多三个字** —— 小地方放不下更多；数据库层也有 check 兜底
 *   · 只在小屋聊天抬头、头像旁边出现，不在别处到处挂
 *
 * 需要先跑 supabase-status.sql（没跑也不会坏，只是设不了、不显示）。
 */

const supabase = createClient()

/** 最多三个字，按"字"算（'学习中' = 3 个字） */
export const STATUS_MAX = 3

/** 现成的几个；想加就加，都是三个字以内 */
export const STATUS_PRESETS = [
  '在线',
  '学习中',
  '摸鱼中',
  '睡觉中',
  '忙碌',
  '干饭中',
  '听歌',
  '散步中',
  '发呆',
  'emo',
] as const

export function cleanStatus(raw: string): string {
  // 去空格、去换行，再按"字"截断（Array.from 才能正确切中文与 emoji）
  const trimmed = raw.replace(/\s+/g, '').trim()
  return Array.from(trimmed).slice(0, STATUS_MAX).join('')
}

/** 读某个人的状态（null = 没设 / 还没开通） */
export function useStatusText(userId: string | null): string | null {
  const [text, setText] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    void (async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('status_text')
        .eq('id', userId)
        .maybeSingle()
      if (cancelled) return
      if (error) {
        // 字段还没加：安静地不显示
        if (!/status_text|column/i.test(error.message)) console.error('读状态失败:', error)
        return
      }
      const value = (data as { status_text?: string | null } | null)?.status_text
      setText(value ? cleanStatus(value) : null)
    })()
    return () => {
      cancelled = true
    }
  }, [userId])

  return text
}

/** 保存 / 清除自己的状态 */
export function useStatusEditor(userId: string | null) {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [hint, setHint] = useState('')
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    void (async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('status_text')
        .eq('id', userId)
        .maybeSingle()
      if (cancelled) return
      if (error) {
        if (/status_text|column/i.test(error.message)) setMissing(true)
        else console.error('读状态失败:', error)
      } else {
        const value = (data as { status_text?: string | null } | null)?.status_text
        setText(value ? cleanStatus(value) : '')
      }
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [userId])

  const save = useCallback(
    async (next: string) => {
      if (!userId) return
      const value = cleanStatus(next)
      setSaving(true)
      setHint('')
      const { data, error } = await supabase
        .from('profiles')
        .update({ status_text: value || null })
        .eq('id', userId)
        .select('id')
      setSaving(false)

      if (error || !data || data.length === 0) {
        setHint(
          /status_text|column/i.test(error?.message ?? '')
            ? '状态还没开通：先在 Supabase 里执行 supabase-status.sql'
            : '没能保存：' + (error?.message ?? '没有权限'),
        )
        return false
      }

      setText(value)
      setHint(value ? `已设为「${value}」` : '已清除，聊天里不再显示')
      return true
    },
    [userId],
  )

  return { text, setText, loading, saving, hint, missing, save }
}

/**
 * 一次取回一批人的状态（好友列表要用）
 *
 * 为什么要批量：列表里可能有几十个好友，一人一次请求就太浪费了。
 * 用 join 出来的 id 串当依赖，避免数组每次渲染都是新对象导致重复请求。
 */
export function useStatusMap(userIds: string[]): Record<string, string> {
  const [map, setMap] = useState<Record<string, string>>({})
  const key = userIds.filter(Boolean).join(',')

  useEffect(() => {
    if (!key) return
    let cancelled = false
    void (async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, status_text')
        .in('id', key.split(','))
      if (cancelled) return
      if (error) {
        if (!/status_text|column/i.test(error.message)) console.error('批量读状态失败:', error)
        return
      }
      const next: Record<string, string> = {}
      for (const row of (data ?? []) as { id: string; status_text: string | null }[]) {
        if (row.status_text) next[row.id] = cleanStatus(row.status_text)
      }
      setMap(next)
    })()
    return () => {
      cancelled = true
    }
  }, [key])

  return map
}

/** 聊天抬头里那一小截：只有字，没有底、没有框 */
export function StatusLabel({ text }: { text: string | null }) {
  if (!text) return null
  return (
    <span className="flex-shrink-0 font-serif-cn text-[11px] leading-none text-primary">
      {text}
    </span>
  )
}

/** 「我的」里的设置块：点现成的，或者自己写 */
export function StatusPicker({ userId }: { userId: string | null }) {
  const { text, setText, loading, saving, hint, missing, save } = useStatusEditor(userId)

  if (missing) {
    return (
      <section className="rounded-box border border-base-300 bg-base-100/80 p-4">
        <p className="text-xs font-medium text-base-content">状态</p>
        <p className="mt-1 text-[11.5px] leading-relaxed text-base-content/60">
          还没开通：先在 Supabase 里执行 <code>supabase-status.sql</code>。
        </p>
      </section>
    )
  }

  return (
    <section className="rounded-box border border-base-300 bg-base-100/80 p-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-xs font-medium text-base-content">状态</p>
        <p className="text-[11px] text-accent">
          {text ? `当前：${text}` : '默认不显示'}
        </p>
      </div>
      <p className="mt-1 text-[11.5px] leading-relaxed text-base-content/60">
        选一个，或者自己写（最多三个字）。设好之后只在小屋的聊天抬头、头像旁边出现。
      </p>

      {/* 现成的 */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {STATUS_PRESETS.map((preset) => {
          const active = text === preset
          return (
            <button
              key={preset}
              type="button"
              disabled={loading || saving}
              onClick={() => void save(active ? '' : preset)}
              className={`rounded-full border px-2.5 py-1 font-serif-cn text-[11px] transition disabled:opacity-50 ${
                active
                  ? 'border-primary bg-primary/5 text-primary'
                  : 'border-base-300 text-base-content/60 hover:border-accent hover:text-primary'
              }`}
            >
              {preset}
            </button>
          )
        })}
      </div>

      {/* 自己写 */}
      <div className="mt-3 flex items-center gap-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(cleanStatus(e.target.value))}
          maxLength={STATUS_MAX}
          placeholder="自己写，最多三个字"
          className="min-w-0 flex-1 rounded-box border border-base-300 bg-primary/5 px-3 py-2 text-xs text-base-content placeholder:text-accent focus:border-primary focus:outline-none"
        />
        <button
          type="button"
          disabled={loading || saving}
          onClick={() => void save(text)}
          className="rounded-box bg-primary px-3 py-2 text-xs text-primary-content transition hover:opacity-90 disabled:opacity-50"
        >
          保存
        </button>
        {text && (
          <button
            type="button"
            disabled={loading || saving}
            onClick={() => void save('')}
            className="rounded-box border border-base-300 px-3 py-2 text-xs text-base-content/60 transition hover:text-primary disabled:opacity-50"
          >
            清除
          </button>
        )}
      </div>

      {hint && <p className="mt-2 text-[11.5px] text-base-content/60">{hint}</p>}
    </section>
  )
}
