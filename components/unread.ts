'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '../app/lib/supabase'
import { markModuleSeen, readSeenAt, writeSeenAt } from './module-badges'

/**
 * 页内未读：好友私信 / 朋友圈 / 院子的"有人回我"
 *
 * 全部用 localStorage 的「上次查看时间戳」判断，不改数据库结构：
 *   私信   → treehole:seen:conv:<我>:<会话id>
 *   朋友圈 → treehole:seen:moments:<我>
 *   院子回复 → treehole:seen:worldReplies:<我>
 */

const supabase = createClient()

const CONV_SEEN_PREFIX = 'treehole:seen:conv:'
const MOMENTS_SEEN_PREFIX = 'treehole:seen:moments:'
const WORLD_REPLIES_SEEN_PREFIX = 'treehole:seen:worldReplies:'

function readKey(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeKey(key: string, iso: string): void {
  try {
    window.localStorage.setItem(key, iso)
  } catch {
    /* 隐私模式忽略 */
  }
}

function isNewer(iso: string, seenAt: string | null): boolean {
  if (!seenAt) return true
  const seen = new Date(seenAt).getTime()
  if (Number.isNaN(seen)) return true
  return new Date(iso).getTime() > seen
}

/* ==================== 好友私信未读 ==================== */

export type UnreadMessages = {
  /** 会话 id → 未读条数 */
  byConversation: Record<string, number>
  /** 会话 id → 好友 id（用于在小屋好友列表里对应到人） */
  friendIdByConversation: Record<string, string>
  total: number
  /** 打开某个好友后调用，把这个会话标记为已读 */
  markConversationRead: (conversationId: string, friendId: string) => void
  /** 新的私信到达时调用（Realtime） */
  refresh: () => void
}

export function useUnreadMessages(userId: string | null): UnreadMessages {
  const [byConversation, setByConversation] = useState<Record<string, number>>({})
  const [friendIdByConversation, setFriendIdByConversation] = useState<Record<string, string>>({})
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    if (!userId) return

    let cancelled = false

    const run = async () => {
      try {
        const [convRes, friendRes] = await Promise.all([
          supabase
            .from('conversations')
            .select('id, user1_id, user2_id')
            .or(`user1_id.eq.${userId},user2_id.eq.${userId}`),
          supabase
            .from('friendships')
            .select('requester_id, addressee_id')
            .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
            .eq('status', 'accepted'),
        ])

        if (convRes.error) throw convRes.error
        if (cancelled) return

        // 只保留「对方是我好友」的会话：
        // 不是好友的会话在小屋里打不开，计进去就变成永远清不掉的红点
        const friendIds = new Set(
          (friendRes.data ?? []).map((f) =>
            f.requester_id === userId ? f.addressee_id : f.requester_id,
          ),
        )
        const convs = ((convRes.data ?? []) as { id: string; user1_id: string; user2_id: string }[]).filter(
          (c) => friendIds.has(c.user1_id === userId ? c.user2_id : c.user1_id),
        )

        const convIds = convs.map((c) => c.id)
        const friendMap: Record<string, string> = {}
        for (const conv of convs) {
          friendMap[conv.id] = conv.user1_id === userId ? conv.user2_id : conv.user1_id
        }
        setFriendIdByConversation(friendMap)

        if (convIds.length === 0) {
          setByConversation({})
          return
        }

        const { data: msgs, error: msgError } = await supabase
          .from('messages')
          .select('id, conversation_id, sender_id, created_at')
          .in('conversation_id', convIds)
          .neq('sender_id', userId)

        if (msgError) throw msgError
        if (cancelled) return

        const counts: Record<string, number> = {}
        for (const msg of (msgs ?? []) as { conversation_id: string; created_at: string }[]) {
          const seenAt = readKey(`${CONV_SEEN_PREFIX}${userId}:${msg.conversation_id}`)
          if (!isNewer(msg.created_at, seenAt)) continue
          counts[msg.conversation_id] = (counts[msg.conversation_id] ?? 0) + 1
        }
        setByConversation(counts)
      } catch (err) {
        if (!cancelled) console.error('私信未读统计失败:', err)
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [userId, refreshKey])

  const markConversationRead = useCallback(
    (conversationId: string, friendId: string) => {
      if (!userId) return
      writeKey(`${CONV_SEEN_PREFIX}${userId}:${conversationId}`, new Date().toISOString())
      setByConversation((prev) => {
        if (!(conversationId in prev)) return prev
        const next = { ...prev }
        delete next[conversationId]
        return next
      })

      /*
       * 顺手把「小屋整体已看」的时间也推到现在。
       *
       * 主页那张「小屋」卡片用的是 treehole:seen:friends 这个时间戳（进小屋时写的），
       * 和上面按会话记的已读是**两套**。不推的话会出现：
       *   进小屋 → 聊天里读到新消息 → 回主页，那条已经读过的消息又被算成未读
       *   → 角标重新冒出来，得再进一次小屋才消。
       * markModuleSeen 会同时广播事件，主页那边（如果还挂着）也会立刻重算。
       */
      markModuleSeen('friends')
      void friendId
    },
    [userId],
  )

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), [])

  const total = Object.values(byConversation).reduce((sum, n) => sum + n, 0)

  return { byConversation, friendIdByConversation, total, markConversationRead, refresh }
}

/* ==================== 朋友圈新动态 ==================== */

export function useMomentsBadge(userId: string | null, active: boolean): boolean {
  const [hasNew, setHasNew] = useState(false)

  const check = useCallback(() => {
    if (!userId) return
    void (async () => {
      try {
        const seenAt = readKey(`${MOMENTS_SEEN_PREFIX}${userId}`)
        const { data } = await supabase
          .from('friend_posts')
          .select('created_at')
          .order('created_at', { ascending: false })
          .limit(1)
        const latest = data?.[0]?.created_at
        setHasNew(Boolean(latest && isNewer(latest, seenAt)))
      } catch (err) {
        console.error('朋友圈提示检查失败:', err)
      }
    })()
  }, [userId])

  /** 点开朋友圈时记录已看（页签上的点由 useMomentsBadge 自己消除） */
  useEffect(() => {
    if (active) check()
  }, [active, check])

  return hasNew
}

export function markMomentsSeen(userId: string): void {
  writeKey(`${MOMENTS_SEEN_PREFIX}${userId}`, new Date().toISOString())
}

/* ==================== 院子：有谁回了我的帖/评论 ==================== */

/**
 * 数量口径与模块角标一致：只算「我来往之后」的新评论
 * 同时把 module-badges 的时间戳也推进，避免主页的点与这里不同步。
 */
export function useWorldRepliesBadge(userId: string | null): {
  count: number
  markRead: () => void
  refresh: () => void
} {
  const [count, setCount] = useState(0)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    if (!userId) return
    let cancelled = false

    const run = async () => {
      try {
        const seenAt = readKey(`${WORLD_REPLIES_SEEN_PREFIX}${userId}`)

        const [postsRes, commentsRes] = await Promise.all([
          supabase.from('world_posts').select('id').eq('author_id', userId).limit(500),
          supabase.from('world_comments').select('id').eq('author_id', userId).limit(500),
        ])
        if (postsRes.error) throw postsRes.error
        if (commentsRes.error) throw commentsRes.error
        if (cancelled) return

        const postIds = (postsRes.data ?? []).map((p) => p.id)
        const commentIds = (commentsRes.data ?? []).map((c) => c.id)
        if (postIds.length === 0 && commentIds.length === 0) {
          setCount(0)
          return
        }

        const orFilter = [
          postIds.length > 0 ? `post_id.in.(${postIds.join(',')})` : null,
          commentIds.length > 0 ? `parent_id.in.(${commentIds.join(',')})` : null,
        ]
          .filter(Boolean)
          .join(',')

        const { data: incoming, error } = await supabase
          .from('world_comments')
          .select('id, created_at')
          .or(orFilter)
          .neq('author_id', userId)
          .order('created_at', { ascending: false })
          .limit(200)

        if (error) throw error
        if (cancelled) return

        setCount((incoming ?? []).filter((c) => isNewer(c.created_at, seenAt)).length)
      } catch (err) {
        if (!cancelled) console.error('院子回复统计失败:', err)
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [userId, refreshKey])

  const markRead = useCallback(() => {
    if (!userId) return
    const now = new Date().toISOString()
    writeKey(`${WORLD_REPLIES_SEEN_PREFIX}${userId}`, now)
    // 主页的院子提示也一起推进，否则返回主页还会显示"有新内容"
    writeSeenAt('world', now)
    setCount(0)
  }, [userId])

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), [])

  return { count, markRead, refresh }
}

/** 供主页计算院子徽标：新帖点 + 回复数 */
export function worldRepliesSeenAt(userId: string): string | null {
  return readSeenAt('world') ?? readKey(`${WORLD_REPLIES_SEEN_PREFIX}${userId}`)
}
