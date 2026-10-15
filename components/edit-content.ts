'use client'

import { useCallback, useState } from 'react'
import { createClient } from '../app/lib/supabase'

/**
 * 编辑已发的内容（帖子 / 评论 / 朋友圈）
 *
 * 只改 content 字段；每条更新都带 author_id = 我 的条件（双保险，
 * 即使 RLS 配置宽松也不会改到别人的内容）。
 *
 * 注意：这三张表都没有 updated_at 列，所以不显示"已编辑"标记
 * （只在保存后给 2 秒「已保存」提示，避免刷新后标记消失造成误导）。
 */

const supabase = createClient()

export type EditableKind = 'world_post' | 'world_comment' | 'moment'

const TABLE: Record<EditableKind, string> = {
  world_post: 'world_posts',
  world_comment: 'world_comments',
  moment: 'friend_posts',
}

const MAX_LENGTH: Record<EditableKind, number> = {
  world_post: 500,
  world_comment: 200,
  moment: 500,
}

function errText(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err) {
    const m = (err as { message?: unknown }).message
    if (typeof m === 'string') return m
  }
  return String(err)
}

export type EditResult = { ok: boolean; message?: string }

export function useEditContent(meId: string | null) {
  /** 正在编辑哪一条：`${kind}:${id}` */
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [savedKey, setSavedKey] = useState<string | null>(null)

  const keyOf = (kind: EditableKind, id: string) => `${kind}:${id}`

  const canEdit = useCallback(
    (authorId: string | null | undefined) => Boolean(meId && authorId && authorId === meId),
    [meId],
  )

  const isEditing = useCallback(
    (kind: EditableKind, id: string) => editingKey === keyOf(kind, id),
    [editingKey],
  )

  const isBusy = useCallback((kind: EditableKind, id: string) => busyKey === keyOf(kind, id), [busyKey])

  const wasSaved = useCallback((kind: EditableKind, id: string) => savedKey === keyOf(kind, id), [savedKey])

  const start = useCallback((kind: EditableKind, id: string, initial: string) => {
    setEditingKey(keyOf(kind, id))
    setDraft(initial)
  }, [])

  const cancel = useCallback(() => {
    setEditingKey(null)
    setDraft('')
  }, [])

  const save = useCallback(
    async (kind: EditableKind, id: string, content: string): Promise<EditResult> => {
      if (!meId) return { ok: false, message: '请先登录' }
      const text = content.trim()
      if (!text) return { ok: false, message: '内容不能为空' }
      if (text.length > MAX_LENGTH[kind]) {
        return { ok: false, message: `最多 ${MAX_LENGTH[kind]} 个字` }
      }

      const key = keyOf(kind, id)
      setBusyKey(key)
      try {
        const { error } = await supabase
          .from(TABLE[kind])
          .update({ content: text })
          .eq('id', id)
          .eq('author_id', meId) // 双保险：只能改自己发的
        if (error) throw error

        setEditingKey(null)
        setDraft('')
        setSavedKey(key)
        window.setTimeout(() => setSavedKey((cur) => (cur === key ? null : cur)), 2000)
        return { ok: true }
      } catch (err) {
        console.error('编辑失败:', err)
        return { ok: false, message: errText(err) }
      } finally {
        setBusyKey(null)
      }
    },
    [meId],
  )

  return { draft, setDraft, canEdit, isEditing, isBusy, wasSaved, start, cancel, save, maxLength: MAX_LENGTH }
}
