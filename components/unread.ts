'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '../app/lib/supabase'
import { markModuleSeen, writeSeenAt } from './module-badges'

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

/* ==================== 未读缓存（进页面立刻显示的前提） ==================== */

const UNREAD_CACHE_PREFIX = 'treehole:cache:unread:'

/** 缓存多久算过期：一天。过期的就别拿来预热了，省得显示一个很旧数字 */
const UNREAD_CACHE_TTL_MS = 24 * 60 * 60 * 1000

type UnreadCache = {
  counts: Record<string, number>
  friends: Record<string, string>
  lastAt: Record<string, string>
  at: number
}

function readUnreadCache(userId: string): {
  counts: Record<string, number>
  friends: Record<string, string>
  lastAt: Record<string, string>
} {
  const empty = { counts: {}, friends: {}, lastAt: {} }
  try {
    const raw = window.localStorage.getItem(`${UNREAD_CACHE_PREFIX}${userId}`)
    if (!raw) return empty
    const parsed = JSON.parse(raw) as Partial<UnreadCache>
    if (!parsed || typeof parsed.at !== 'number') return empty
    if (Date.now() - parsed.at > UNREAD_CACHE_TTL_MS) return empty
    return { counts: parsed.counts ?? {}, friends: parsed.friends ?? {}, lastAt: parsed.lastAt ?? {} }
  } catch {
    return empty
  }
}

function writeUnreadCache(
  userId: string,
  counts: Record<string, number>,
  friends: Record<string, string>,
  lastAt: Record<string, string>,
): void {
  try {
    const payload: UnreadCache = { counts, friends, lastAt, at: Date.now() }
    window.localStorage.setItem(`${UNREAD_CACHE_PREFIX}${userId}`, JSON.stringify(payload))
  } catch {
    /* 隐私模式忽略 */
  }
}

/* ==================== 好友私信未读 ==================== */

export type UnreadMessages = {
  /** 会话 id → 未读条数 */
  byConversation: Record<string, number>
  /** 会话 id → 好友 id（用于在小屋好友列表里对应到人） */
  friendIdByConversation: Record<string, string>
  /** 会话 id → 最后一条消息的时间（好友列表靠它把刚聊过的顶上去） */
  lastAtByConversation: Record<string, string>
  total: number
  /** 打开某个好友后调用，把这个会话标记为已读 */
  markConversationRead: (conversationId: string, friendId: string) => void
  /** 新的私信到达时调用（Realtime） */
  refresh: () => void
}

export function useUnreadMessages(userId: string | null): UnreadMessages {
  const [byConversation, setByConversation] = useState<Record<string, number>>({})
  const [friendIdByConversation, setFriendIdByConversation] = useState<Record<string, string>>({})
  const [lastAtByConversation, setLastAtByConversation] = useState<Record<string, string>>({})
  const [refreshKey, setRefreshKey] = useState(0)
  /** 查询是否已经回来过一次 —— 没回来之前不许写缓存，否则会把上次的结果擦掉 */
  const [loaded, setLoaded] = useState(false)

  /*
   * 预热：先用**上次算出来的结果**把角标铺上。
   *
   * 之前的观感是「首页明明有提示，点进小屋要等几秒才出现」——
   * 因为未读要查三次才出来（会话 + 好友关系 + 消息）。
   * 现在进页面立刻用缓存显示，查询回来后再校正（快了就是对的，慢了也不闪空）。
   * 缓存只在浏览器本地，读不到就当没有，不影响正确性。
   */
  useEffect(() => {
    if (!userId) return
    const cached = readUnreadCache(userId)
    // 读 localStorage 后同步铺上：这条只在客户端跑，且必须赶在查询回来之前，
    // 才能做到「点进小屋立刻看到提示」。规则对同一 effect 只报一次，下面那条不用再豁免。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setByConversation(cached.counts)
    setFriendIdByConversation(cached.friends)
    setLastAtByConversation(cached.lastAt)
  }, [userId])

  useEffect(() => {
    if (!userId) return

    let cancelled = false

    const run = async () => {
      try {
        /*
         * 会话列表：优先读 last_message_at（数据库维护的「最后一条消息时间」，
         * 有了它排序就不受消息条数限制）。
         *
         * 但那个字段是**后加的**，所以先试着带它查一次；报「字段不存在」就退回旧写法。
         * 也就是说：没跑 supabase-conversations-last-message.sql 也能正常用，
         * 只是排序退回「最近 400 条消息」那种近似算法。
         */
        type ConvRow = {
          id: string
          user1_id: string
          user2_id: string
          last_message_at?: string | null
        }
        let convRows: ConvRow[] = []
        let convError: { message: string } | null = null
        let hasLastMessageColumn = true

        const withColumn = await supabase
          .from('conversations')
          .select('id, user1_id, user2_id, last_message_at')
          .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)

        if (withColumn.error && /last_message_at/i.test(withColumn.error.message)) {
          hasLastMessageColumn = false
          const withoutColumn = await supabase
            .from('conversations')
            .select('id, user1_id, user2_id')
            .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
          convRows = (withoutColumn.data ?? []) as ConvRow[]
          convError = withoutColumn.error
        } else {
          convRows = (withColumn.data ?? []) as ConvRow[]
          convError = withColumn.error
        }

        const friendRes = await supabase
          .from('friendships')
          .select('requester_id, addressee_id')
          .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
          .eq('status', 'accepted')

        if (convError) throw convError
        if (cancelled) return

        // 只保留「对方是我好友」的会话：
        // 不是好友的会话在小屋里打不开，计进去就变成永远清不掉的红点
        const friendIds = new Set(
          (friendRes.data ?? []).map((f) =>
            f.requester_id === userId ? f.addressee_id : f.requester_id,
          ),
        )
        const convs = convRows.filter((c) =>
          friendIds.has(c.user1_id === userId ? c.user2_id : c.user1_id),
        )

        const convIds = convs.map((c) => c.id)
        const friendMap: Record<string, string> = {}
        const dbLastAt: Record<string, string> = {}
        for (const conv of convs) {
          friendMap[conv.id] = conv.user1_id === userId ? conv.user2_id : conv.user1_id
          if (conv.last_message_at) dbLastAt[conv.id] = conv.last_message_at
        }
        setFriendIdByConversation(friendMap)

        if (convIds.length === 0) {
          setByConversation({})
          setLoaded(true)
          return
        }

        // order + limit：只看最近的，别把几年的私信全拉回来算
        // 不再排除自己发的 —— 好友列表排序要用「最后一条消息」，
        // 自己刚发完的那个人也应该待在最上面；统计未读时再跳过自己的。
        const { data: msgs, error: msgError } = await supabase
          .from('messages')
          .select('id, conversation_id, sender_id, created_at')
          .in('conversation_id', convIds)
          .order('created_at', { ascending: false })
          .limit(400)

        if (msgError) throw msgError
        if (cancelled) return

        const counts: Record<string, number> = {}
        const computedLastAt: Record<string, string> = {}
        for (const msg of (msgs ?? []) as {
          conversation_id: string
          sender_id: string
          created_at: string
        }[]) {
          // 最后一条：查询已按时间倒序，第一次见到就是最新的
          if (!computedLastAt[msg.conversation_id]) computedLastAt[msg.conversation_id] = msg.created_at

          // 未读：只算别人发来的
          if (msg.sender_id === userId) continue
          const seenAt = readKey(`${CONV_SEEN_PREFIX}${userId}:${msg.conversation_id}`)
          if (!isNewer(msg.created_at, seenAt)) continue
          counts[msg.conversation_id] = (counts[msg.conversation_id] ?? 0) + 1
        }

        /*
         * 排序时间：数据库那份（dbLastAt）为准，它不受 400 条窗口限制；
         * 没有字段时（没跑那段 SQL）退回这趟算出来的近似值。
         * 两个都有的会话取较新的那个，避免回填之后又有新消息时出现偏差。
         */
        const lastAt: Record<string, string> = { ...computedLastAt }
        if (hasLastMessageColumn) {
          for (const convId of convIds) {
            const fromDb = dbLastAt[convId]
            if (!fromDb) continue
            const fromMsgs = computedLastAt[convId]
            lastAt[convId] = !fromMsgs || fromDb > fromMsgs ? fromDb : fromMsgs
          }
        }

        setByConversation(counts)
        setLastAtByConversation(lastAt)
        setLoaded(true)
      } catch (err) {
        if (!cancelled) console.error('私信未读统计失败:', err)
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [userId, refreshKey])

  // 算完之后把结果存下来，供下次进页面预热（loaded 之前不写，免得擦掉上次的）
  useEffect(() => {
    if (!userId || !loaded) return
    writeUnreadCache(userId, byConversation, friendIdByConversation, lastAtByConversation)
  }, [userId, loaded, byConversation, friendIdByConversation, lastAtByConversation])

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

  return {
    byConversation,
    friendIdByConversation,
    lastAtByConversation,
    total,
    markConversationRead,
    refresh,
  }
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
  /** 哪些帖子被回了（按最新时间倒序）：界面拿它做悬浮列表 ✓ 点哪条跳哪条 ✓ */
  items: { postId: string; snippet: string; count: number }[]
  markRead: () => void
  refresh: () => void
} {
  const [count, setCount] = useState(0)
  const [items, setItems] = useState<{ postId: string; snippet: string; count: number }[]>([])
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    if (!userId) return
    let cancelled = false

    const run = async () => {
      try {
        const seenAt = readKey(`${WORLD_REPLIES_SEEN_PREFIX}${userId}`)

        const [postsRes, commentsRes] = await Promise.all([
          supabase.from('world_posts').select('id, content').eq('author_id', userId).limit(500),
          supabase.from('world_comments').select('id').eq('author_id', userId).limit(500),
        ])
        if (postsRes.error) throw postsRes.error
        if (commentsRes.error) throw commentsRes.error
        if (cancelled) return

        const contentById = new Map((postsRes.data ?? []).map((p) => [p.id, p.content ?? '']))
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
          .select('id, post_id, created_at')
          .or(orFilter)
          .neq('author_id', userId)
          .order('created_at', { ascending: false })
          .limit(200)

        if (error) throw error
        if (cancelled) return

        const fresh = ((incoming ?? []) as { id: string; post_id: string; created_at: string }[])
          .filter((c) => isNewer(c.created_at, seenAt))
        setCount(fresh.length)

        // 按**帖子**归并（同一帖多条回复只占一行），顺序按最新那条回复的时间 ✓
        const grouped = new Map<string, { postId: string; snippet: string; count: number }>()
        for (const c of fresh) {
          const text = (contentById.get(c.post_id) ?? '').replace(/\s+/g, ' ').trim()
          const snippet = text.length > 18 ? text.slice(0, 18) + '…' : text || '（没有正文）'
          const hit = grouped.get(c.post_id)
          if (hit) hit.count += 1
          else grouped.set(c.post_id, { postId: c.post_id, snippet, count: 1 })
        }
        setItems([...grouped.values()])
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
    setItems([])
  }, [userId])

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), [])

  return { count, items, markRead, refresh }
}

