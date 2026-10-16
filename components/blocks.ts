'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '../app/lib/supabase'

/**
 * 拉黑 / 屏蔽（完整拉黑）
 *
 * 表：public.blocks(blocker_id, blocked_id)
 *   —— 只有 blocker 能读自己的行（被拉黑者是静默的，收不到任何提示）
 *
 * 双向过滤靠数据库函数 get_blocked_ids()：它用 security definer
 * 返回「我拉黑的 + 拉黑我的」合并后的 uuid 数组，客户端据此隐藏内容，
 * 但拿不到"是谁拉黑了谁"这种原始信息。
 *
 * 效果：互相看不到帖子 / 评论 / 朋友圈 / 活动；被拉黑者不能加你好友、
 *       不能给你发私信。已有好友关系保留（不自动解除）。
 */

const supabase = createClient()

export type BlockedUser = {
  /** blocks 表里那一行的 id（解除拉黑时用） */
  id: string
  /** 被我拉黑的人 */
  user_id: string
  username: string | null
  nickname: string | null
  avatar_url: string | null
  created_at: string
}

export type BlocksState = {
  /** 双向黑名单 id 集合：用来过滤内容 */
  hiddenIds: Set<string>
  /** 我拉黑的人（用于设置页展示与解除） */
  blockedUsers: BlockedUser[]
  loading: boolean
  error: string
  busyId: string | null
  /** 我是否拉黑了某人（只反映"我 → 对方"这个方向） */
  isBlockedByMe: (userId: string) => boolean
  block: (userId: string) => Promise<{ ok: boolean; message?: string }>
  unblock: (userId: string) => Promise<{ ok: boolean; message?: string }>
  refresh: () => void
}

function errText(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err) {
    const m = (err as { message?: unknown }).message
    if (typeof m === 'string') return m
  }
  return String(err)
}

export function useBlocks(userId: string | null): BlocksState {
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set())
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    if (!userId) return

    let cancelled = false

    const run = async () => {
      setLoading(true)
      try {
        // 1) 双向黑名单（函数返回 uuid[]）
        const { data: hidden, error: hiddenError } = await supabase.rpc('get_blocked_ids')
        if (hiddenError) throw hiddenError
        if (cancelled) return
        setHiddenIds(new Set((hidden ?? []) as string[]))

        // 2) 我拉黑的人 + 他们的资料（用于设置页列表）
        const { data: rows, error: rowsError } = await supabase
          .from('blocks')
          .select('id, blocked_id, created_at')
          .eq('blocker_id', userId)
          .order('created_at', { ascending: false })
        if (rowsError) throw rowsError
        if (cancelled) return

        const ids = (rows ?? []).map((r) => r.blocked_id)
        let profileMap = new Map<string, { username: string | null; nickname: string | null; avatar_url: string | null }>()
        if (ids.length > 0) {
          const { data: profiles, error: profileError } = await supabase
            .from('profiles')
            .select('id, username, nickname, avatar_url')
            .in('id', ids)
          if (profileError) throw profileError
          profileMap = new Map(
            (profiles ?? []).map((p) => [
              p.id,
              { username: p.username, nickname: p.nickname, avatar_url: p.avatar_url },
            ]),
          )
        }

        if (cancelled) return
        setBlockedUsers(
          (rows ?? []).map((r) => {
            const p = profileMap.get(r.blocked_id)
            return {
              id: r.id,
              user_id: r.blocked_id,
              username: p?.username ?? null,
              nickname: p?.nickname ?? null,
              avatar_url: p?.avatar_url ?? null,
              created_at: r.created_at,
            }
          }),
        )
        setError('')
      } catch (err) {
        console.error('加载拉黑列表失败:', err)
        if (!cancelled) setError('拉黑列表加载失败（可能还没建 blocks 表）')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [userId, refreshKey])

  const isBlockedByMe = useCallback(
    (targetId: string) => blockedUsers.some((b) => b.user_id === targetId),
    [blockedUsers],
  )

  const block = useCallback(
    async (targetId: string) => {
      if (!userId) return { ok: false, message: '请先登录' }
      if (targetId === userId) return { ok: false, message: '不能拉黑自己' }
      setBusyId(targetId)
      try {
        const { error: insertError } = await supabase
          .from('blocks')
          .insert({ blocker_id: userId, blocked_id: targetId })
        if (insertError) throw insertError
        setRefreshKey((k) => k + 1)
        return { ok: true }
      } catch (err) {
        console.error('拉黑失败:', err)
        return { ok: false, message: errText(err) }
      } finally {
        setBusyId(null)
      }
    },
    [userId],
  )

  const unblock = useCallback(
    async (targetId: string) => {
      if (!userId) return { ok: false, message: '请先登录' }
      setBusyId(targetId)
      try {
        const { error: deleteError } = await supabase
          .from('blocks')
          .delete()
          .eq('blocker_id', userId)
          .eq('blocked_id', targetId)
        if (deleteError) throw deleteError
        setBlockedUsers((prev) => prev.filter((b) => b.user_id !== targetId))
        setRefreshKey((k) => k + 1)
        return { ok: true }
      } catch (err) {
        console.error('解除拉黑失败:', err)
        return { ok: false, message: errText(err) }
      } finally {
        setBusyId(null)
      }
    },
    [userId],
  )

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), [])

  return useMemo(
    () => ({
      hiddenIds,
      blockedUsers,
      loading,
      error,
      busyId,
      isBlockedByMe,
      block,
      unblock,
      refresh,
    }),
    [hiddenIds, blockedUsers, loading, error, busyId, isBlockedByMe, block, unblock, refresh],
  )
}

