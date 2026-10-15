'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '../app/lib/supabase'

/**
 * 计划书：计划 / 目标 / 待办任务
 *
 * 表 public.user_plans（见 supabase-plans.sql），每人只能读写自己的。
 * 三类共用一张表，用 kind 区分：
 *   plan 计划   —— 有标题、备注、可选日期，可标记完成
 *   goal 目标   —— 额外有 0-100 的进度
 *   task 待办   —— 勾选式，按截止日期排
 */

const supabase = createClient()

export type PlanKind = 'plan' | 'goal' | 'task'

export const KIND_LABEL: Record<PlanKind, string> = {
  plan: '计划',
  goal: '目标',
  task: '待办',
}

export const KIND_HINT: Record<PlanKind, string> = {
  plan: '想做的事，先写下来',
  goal: '想成为的样子，一点点靠近',
  task: '今天要完成的小事',
}

export const KIND_ORDER: PlanKind[] = ['plan', 'goal', 'task']

export type PlanItem = {
  id: string
  kind: PlanKind
  title: string
  note: string | null
  due_date: string | null
  done: boolean
  progress: number
  created_at: string
  updated_at: string
}

export type PlanInput = {
  kind: PlanKind
  title: string
  note?: string | null
  dueDate?: string | null
}

function errText(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err) {
    const m = (err as { message?: unknown }).message
    if (typeof m === 'string') return m
  }
  return String(err)
}

export function usePlans(userId: string | null) {
  const [items, setItems] = useState<PlanItem[]>([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (!userId) {
      const frame = window.requestAnimationFrame(() => setItems([]))
      return () => window.cancelAnimationFrame(frame)
    }

    let cancelled = false
    void (async () => {
      setLoading(true)
      try {
        const { data, error: queryError } = await supabase
          .from('user_plans')
          .select('id, kind, title, note, due_date, done, progress, created_at, updated_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })

        if (queryError) throw queryError
        if (!cancelled) {
          setItems((data ?? []) as unknown as PlanItem[])
          setError('')
        }
      } catch (err) {
        console.error('加载计划书失败:', err)
        if (!cancelled) setError('计划书加载失败（可能还没跑 supabase-plans.sql）')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [userId, reloadKey])

  const create = useCallback(
    async (input: PlanInput): Promise<{ ok: boolean; message?: string }> => {
      if (!userId) return { ok: false, message: '请先登录' }
      const title = input.title.trim()
      if (!title) return { ok: false, message: '写点什么再保存' }

      setBusy(true)
      try {
        const { data, error: insertError } = await supabase
          .from('user_plans')
          .insert({
            user_id: userId,
            kind: input.kind,
            title,
            note: input.note?.trim() || null,
            due_date: input.dueDate || null,
          })
          .select('id, kind, title, note, due_date, done, progress, created_at, updated_at')
          .single()
        if (insertError) throw insertError

        setItems((prev) => [data as unknown as PlanItem, ...prev])
        return { ok: true }
      } catch (err) {
        console.error('新建失败:', err)
        return { ok: false, message: errText(err) }
      } finally {
        setBusy(false)
      }
    },
    [userId],
  )

  /** 局部更新（勾选完成 / 改进度 / 改标题备注） */
  const update = useCallback(
    async (id: string, patch: Partial<Pick<PlanItem, 'title' | 'note' | 'done' | 'progress' | 'due_date'>>) => {
      if (!userId) return { ok: false, message: '请先登录' }
      setBusyId(id)
      try {
        const { data, error: updateError } = await supabase
          .from('user_plans')
          .update({ ...patch, updated_at: new Date().toISOString() })
          .eq('id', id)
          .eq('user_id', userId)
          .select('id, kind, title, note, due_date, done, progress, created_at, updated_at')
          .single()
        if (updateError) throw updateError
        if (!data) return { ok: false, message: '数据库没有更新任何一行' }

        setItems((prev) => prev.map((it) => (it.id === id ? (data as unknown as PlanItem) : it)))
        return { ok: true }
      } catch (err) {
        console.error('更新失败:', err)
        return { ok: false, message: errText(err) }
      } finally {
        setBusyId(null)
      }
    },
    [userId],
  )

  const remove = useCallback(
    async (id: string) => {
      if (!userId) return { ok: false, message: '请先登录' }
      setBusyId(id)
      try {
        const { data, error: deleteError } = await supabase
          .from('user_plans')
          .delete()
          .eq('id', id)
          .eq('user_id', userId)
          .select('id')
        if (deleteError) throw deleteError
        if (!data || data.length === 0) return { ok: false, message: '数据库没有删除任何一行' }

        setItems((prev) => prev.filter((it) => it.id !== id))
        return { ok: true }
      } catch (err) {
        console.error('删除失败:', err)
        return { ok: false, message: errText(err) }
      } finally {
        setBusyId(null)
      }
    },
    [userId],
  )

  /** 按类别分组，未完成在前、完成在后；有截止日期的按日期靠前 */
  const grouped = useMemo(() => {
    const make = () => ({ open: [] as PlanItem[], done: [] as PlanItem[] })
    const result: Record<PlanKind, { open: PlanItem[]; done: PlanItem[] }> = {
      plan: make(),
      goal: make(),
      task: make(),
    }

    for (const item of items) {
      if (item.done) result[item.kind].done.push(item)
      else result[item.kind].open.push(item)
    }

    const byDue = (a: PlanItem, b: PlanItem) => {
      if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date)
      if (a.due_date) return -1
      if (b.due_date) return 1
      return b.created_at.localeCompare(a.created_at)
    }
    for (const kind of KIND_ORDER) {
      result[kind].open.sort(byDue)
      result[kind].done.sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    }
    return result
  }, [items])

  const stats = useMemo(() => {
    const openTasks = items.filter((i) => i.kind === 'task' && !i.done).length
    const doneTasks = items.filter((i) => i.kind === 'task' && i.done).length
    const goals = items.filter((i) => i.kind === 'goal')
    const goalProgress = goals.length
      ? Math.round(goals.reduce((s, g) => s + g.progress, 0) / goals.length)
      : 0
    return { openTasks, doneTasks, goals: goals.length, goalProgress }
  }, [items])

  return {
    items,
    grouped,
    stats,
    loading,
    busy,
    busyId,
    error,
    create,
    update,
    remove,
    refresh: () => setReloadKey((k) => k + 1),
  }
}

/** 日期显示：今天/明天/已逾期/N 天后 */
export function describeDue(due: string | null): { text: string; tone: 'normal' | 'soon' | 'overdue' } | null {
  if (!due) return null
  const target = new Date(`${due}T00:00:00`)
  if (Number.isNaN(target.getTime())) return null

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86400000)

  if (diffDays === 0) return { text: '今天', tone: 'soon' }
  if (diffDays === 1) return { text: '明天', tone: 'soon' }
  if (diffDays < 0) return { text: `逾期 ${Math.abs(diffDays)} 天`, tone: 'overdue' }
  if (diffDays <= 7) return { text: `${diffDays} 天后`, tone: 'soon' }
  return { text: due.slice(5).replace('-', '/'), tone: 'normal' }
}
