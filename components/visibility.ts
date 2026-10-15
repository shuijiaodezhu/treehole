'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '../app/lib/supabase'

/**
 * 朋友圈可见范围（四档）
 *
 *   public   所有好友可见（默认）
 *   friends  指定好友可见     → 名单存 friend_post_audience(post_id, friend_id)
 *   groups   指定分组可见     → 发布时把组内成员展开写进 friend_post_audience
 *                              （快照：以后改组名单不会改变已发动态的可见性，界面上有说明）
 *   private  仅自己可见
 *
 * 表：friend_posts.visibility / friend_post_audience / friend_groups / friend_group_members
 */

const supabase = createClient()

export type Visibility = 'public' | 'groups' | 'friends' | 'private'

export const VISIBILITY_ORDER: Visibility[] = ['public', 'groups', 'friends', 'private']

/** 选择器里的完整说法 */
export const VISIBILITY_LABEL: Record<Visibility, string> = {
  public: '所有好友可见',
  groups: '指定分组可见',
  friends: '指定好友可见',
  private: '仅自己可见',
}

/** 卡片上的短标签 */
export const VISIBILITY_SHORT: Record<Visibility, string> = {
  public: '公开',
  groups: '分组',
  friends: '部分好友',
  private: '仅自己',
}

export const VISIBILITY_HINT: Record<Visibility, string> = {
  public: '好友都能看到',
  groups: '只有你选的那些分组里的好友能看到（按发布时的名单）',
  friends: '只有你勾选的那几位好友能看到',
  private: '只有你自己能看到',
}

export type FriendLite = {
  id: string
  name: string
  avatar_url: string | null
}

export type FriendGroup = {
  id: string
  name: string
  memberIds: string[]
}

function errText(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err) {
    const m = (err as { message?: unknown }).message
    if (typeof m === 'string') return m
  }
  return String(err)
}

/* ==================== 好友列表 ==================== */

export function useFriendList(userId: string | null) {
  const [friends, setFriends] = useState<FriendLite[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!userId) {
      const frame = window.requestAnimationFrame(() => setFriends([]))
      return () => window.cancelAnimationFrame(frame)
    }

    let cancelled = false
    void (async () => {
      setLoading(true)
      try {
        const { data: rows, error } = await supabase
          .from('friendships')
          .select('requester_id, addressee_id')
          .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
          .eq('status', 'accepted')
        if (error) throw error

        const ids = [
          ...new Set(
            (rows ?? []).map((f) => (f.requester_id === userId ? f.addressee_id : f.requester_id)),
          ),
        ]
        if (ids.length === 0) {
          if (!cancelled) setFriends([])
          return
        }

        const { data: profiles, error: profileError } = await supabase
          .from('profiles')
          .select('id, username, nickname, avatar_url')
          .in('id', ids)
        if (profileError) throw profileError
        if (cancelled) return

        setFriends(
          (profiles ?? [])
            .map((p) => ({
              id: p.id,
              name: p.nickname?.trim() || p.username?.trim() || '某人',
              avatar_url: p.avatar_url ?? null,
            }))
            .sort((a, b) => a.name.localeCompare(b.name, 'zh')),
        )
      } catch (err) {
        console.error('加载好友列表失败:', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [userId])

  return { friends, loading }
}

/* ==================== 好友分组 ==================== */

export function useFriendGroups(userId: string | null) {
  const [groups, setGroups] = useState<FriendGroup[]>([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (!userId) {
      const frame = window.requestAnimationFrame(() => setGroups([]))
      return () => window.cancelAnimationFrame(frame)
    }

    let cancelled = false
    void (async () => {
      setLoading(true)
      try {
        const { data: groupRows, error: groupError } = await supabase
          .from('friend_groups')
          .select('id, name')
          .eq('owner_id', userId)
          .order('name', { ascending: true })
        if (groupError) throw groupError
        if (cancelled) return

        const ids = (groupRows ?? []).map((g) => g.id)
        let memberRows: { group_id: string; member_id: string }[] = []
        if (ids.length > 0) {
          const { data: members, error: memberError } = await supabase
            .from('friend_group_members')
            .select('group_id, member_id')
            .in('group_id', ids)
          if (memberError) throw memberError
          memberRows = members ?? []
        }
        if (cancelled) return

        setGroups(
          (groupRows ?? []).map((g) => ({
            id: g.id,
            name: g.name,
            memberIds: memberRows.filter((m) => m.group_id === g.id).map((m) => m.member_id),
          })),
        )
        setError('')
      } catch (err) {
        console.error('加载好友分组失败:', err)
        if (!cancelled) setError('分组加载失败（可能还没建 friend_groups 表）')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [userId, reloadKey])

  const refresh = useCallback(() => setReloadKey((k) => k + 1), [])

  const createGroup = useCallback(
    async (name: string) => {
      if (!userId) return { ok: false, message: '请先登录' }
      const trimmed = name.trim()
      if (!trimmed) return { ok: false, message: '分组名不能为空' }
      setBusy(true)
      try {
        const { error: insertError } = await supabase
          .from('friend_groups')
          .insert({ owner_id: userId, name: trimmed })
        if (insertError) throw insertError
        setReloadKey((k) => k + 1)
        return { ok: true }
      } catch (err) {
        console.error('创建分组失败:', err)
        return { ok: false, message: errText(err) }
      } finally {
        setBusy(false)
      }
    },
    [userId],
  )

  const deleteGroup = useCallback(async (groupId: string) => {
    setBusy(true)
    try {
      const { error: deleteError } = await supabase.from('friend_groups').delete().eq('id', groupId)
      if (deleteError) throw deleteError
      setGroups((prev) => prev.filter((g) => g.id !== groupId))
      return { ok: true }
    } catch (err) {
      console.error('删除分组失败:', err)
      return { ok: false, message: errText(err) }
    } finally {
      setBusy(false)
    }
  }, [])

  /** 直接覆盖某个分组的成员名单 */
  const setMembers = useCallback(async (groupId: string, memberIds: string[]) => {
    setBusy(true)
    try {
      const { error: deleteError } = await supabase
        .from('friend_group_members')
        .delete()
        .eq('group_id', groupId)
      if (deleteError) throw deleteError

      if (memberIds.length > 0) {
        const { error: insertError } = await supabase
          .from('friend_group_members')
          .insert(memberIds.map((member_id) => ({ group_id: groupId, member_id })))
        if (insertError) throw insertError
      }

      setGroups((prev) => prev.map((g) => (g.id === groupId ? { ...g, memberIds } : g)))
      return { ok: true }
    } catch (err) {
      console.error('更新分组成员失败:', err)
      return { ok: false, message: errText(err) }
    } finally {
      setBusy(false)
    }
  }, [])

  return { groups, loading, busy, error, createGroup, deleteGroup, setMembers, refresh }
}

/* ==================== 可见名单与判定 ==================== */

/** 批量取若干动态的可见名单：post_id → Set(好友 id) */
export async function fetchAudienceMap(postIds: string[]): Promise<Map<string, Set<string>>> {
  const map = new Map<string, Set<string>>()
  if (postIds.length === 0) return map

  const { data, error } = await supabase
    .from('friend_post_audience')
    .select('post_id, friend_id')
    .in('post_id', postIds)

  if (error) {
    console.error('加载可见名单失败:', error)
    return map
  }

  for (const row of data ?? []) {
    const set = map.get(row.post_id) ?? new Set<string>()
    set.add(row.friend_id)
    map.set(row.post_id, set)
  }
  return map
}

/** 当前用户能否看到这条动态（作者本人永远能看） */
export function canViewPost(
  post: { id: string; author_id: string; visibility: string | null },
  viewerId: string | null,
  audience: Map<string, Set<string>>,
): boolean {
  if (!viewerId) return false
  if (post.author_id === viewerId) return true

  const visibility = (post.visibility ?? 'public') as Visibility
  if (visibility === 'private') return false
  if (visibility === 'public') return true

  // friends / groups：都落在 friend_post_audience 名单里
  return audience.get(post.id)?.has(viewerId) ?? false
}

/** 把"选中的分组"展开成具体好友 id（发布时用） */
export function expandGroupMembers(groups: FriendGroup[], selectedGroupIds: string[]): string[] {
  const ids = new Set<string>()
  for (const group of groups) {
    if (selectedGroupIds.includes(group.id)) {
      for (const memberId of group.memberIds) ids.add(memberId)
    }
  }
  return [...ids]
}
