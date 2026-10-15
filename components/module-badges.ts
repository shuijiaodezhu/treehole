'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '../app/lib/supabase'

/**
 * 主页模块上的未读提示
 *
 *   小屋(friends) → 数字角标 = 待处理好友申请 + 未读私信
 *   院子(world)   → 半明显的点 = 离开后有没有新帖子
 *   派对(play)    → 半明显的点 = 离开后有没有新活动
 *   我的(me)      → 不提示
 *
 * 未读一律用「上次离开时的时间戳」比较，存在 localStorage，不改数据库结构。
 * 院子/派对在离开时由各自页面记录时间戳（见 notes 里的 markModuleSeen）。
 */

const supabase = createClient()

const SEEN_KEY = {
  world: 'treehole:seen:world',
  play: 'treehole:seen:play',
  friends: 'treehole:seen:friends',
} as const

export type ModuleKey = 'friends' | 'world' | 'play' | 'me'

export type ModuleBadge = {
  /** 有数字就显示数字角标 */
  count?: number
  /** 只有点 */
  dot?: boolean
}

export type ModuleBadges = Record<ModuleKey, ModuleBadge>

/* ==================== 本地时间戳读写（页面与主页共用） ==================== */

export function readSeenAt(key: keyof typeof SEEN_KEY): string | null {
  try {
    return window.localStorage.getItem(SEEN_KEY[key])
  } catch {
    return null
  }
}

export function writeSeenAt(key: keyof typeof SEEN_KEY, iso: string): void {
  try {
    window.localStorage.setItem(SEEN_KEY[key], iso)
  } catch {
    /* 隐私模式忽略 */
  }
}

/** 内容时间是否晚于上次查看 */
function isNewer(iso: string, seenAt: string | null): boolean {
  if (!seenAt) return true
  const seen = new Date(seenAt).getTime()
  if (Number.isNaN(seen)) return true
  return new Date(iso).getTime() > seen
}

/* ==================== 院子 / 派对：最新内容时间与可见时间戳的对比 ==================== */

const WORLD_REPLIES_SEEN_PREFIX = 'treehole:seen:worldReplies:'

/** 院子里「离开后有没有新帖」 */
async function hasNewWorldPosts(): Promise<boolean> {
  const seen = readSeenAt('world')
  const { data, error } = await createClient()
    .from('world_posts')
    .select('created_at')
    .eq('status', 'published')
    .eq('is_hidden', false)
    .order('created_at', { ascending: false })
    .limit(1)

  if (error) throw error
  const latest = data?.[0]?.created_at
  return Boolean(latest && isNewer(latest, seen))
}

/** 派对同理 */
async function hasNewActivities(): Promise<boolean> {
  const seen = readSeenAt('play')
  const { data, error } = await createClient()
    .from('play_activities')
    .select('created_at')
    .eq('status', 'published')
    .order('created_at', { ascending: false })
    .limit(1)

  if (error) throw error
  const latest = data?.[0]?.created_at
  return Boolean(latest && isNewer(latest, seen))
}

/* ==================== Hook ==================== */

export function useModuleBadges(userId: string | null): ModuleBadges {
  const [pendingFriends, setPendingFriends] = useState(0)
  const [unreadMessages, setUnreadMessages] = useState(0)
  const [worldNew, setWorldNew] = useState(false)
  const [playNew, setPlayNew] = useState(false)
  const [worldReplies, setWorldReplies] = useState(0)

  /** 时间戳类提示：每次回到页面重算（离开时各页面会写入新的时间戳） */
  const refreshSeenBadges = useCallback(() => {
    void (async () => {
      try {
        const [world, play] = await Promise.all([hasNewWorldPosts(), hasNewActivities()])
        setWorldNew(world)
        setPlayNew(play)
      } catch (err) {
        console.error('模块提示刷新失败:', err)
      }
    })()
  }, [])

  /** 院子里"有人回我"的未读数（兼顾：新帖用点，回复用数字） */
  const refreshWorldReplies = useCallback(() => {
    if (!userId) {
      setWorldReplies(0)
      return
    }

    void (async () => {
      try {
        const seenAt = window.localStorage.getItem(`${WORLD_REPLIES_SEEN_PREFIX}${userId}`)

        const [postsRes, commentsRes] = await Promise.all([
          supabase.from('world_posts').select('id').eq('author_id', userId).limit(500),
          supabase.from('world_comments').select('id').eq('author_id', userId).limit(500),
        ])
        if (postsRes.error) throw postsRes.error
        if (commentsRes.error) throw commentsRes.error

        const postIds = (postsRes.data ?? []).map((p) => p.id)
        const commentIds = (commentsRes.data ?? []).map((c) => c.id)
        if (postIds.length === 0 && commentIds.length === 0) {
          setWorldReplies(0)
          return
        }

        const orFilter = [
          postIds.length > 0 ? `post_id.in.(${postIds.join(',')})` : null,
          commentIds.length > 0 ? `parent_id.in.(${commentIds.join(',')})` : null,
        ]
          .filter(Boolean)
          .join(',')

        const { data, error } = await supabase
          .from('world_comments')
          .select('id, created_at')
          .or(orFilter)
          .neq('author_id', userId)
          .limit(200)

        if (error) throw error
        setWorldReplies((data ?? []).filter((c) => isNewer(c.created_at, seenAt)).length)
      } catch (err) {
        console.error('院子回复统计失败:', err)
      }
    })()
  }, [userId])

  /* ---------- 回到标签页时重算 ---------- */
  useEffect(() => {
    refreshSeenBadges()
    // refreshWorldReplies 内部是 async，setState 都在 await 之后；规则无法识别
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshWorldReplies()
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        refreshSeenBadges()
        refreshWorldReplies()
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [refreshSeenBadges, refreshWorldReplies])

  /* ---------- 小屋：待处理好友申请 + 未读私信 ---------- */
  const loadFriendsBadge = useCallback(async (uid: string) => {
    try {
      const friendSeen = readSeenAt('friends')

      const [pendingRes, convRes] = await Promise.all([
        supabase
          .from('friendships')
          .select('id')
          .eq('addressee_id', uid)
          .eq('status', 'pending'),
        supabase.from('conversations').select('id').or(`user1_id.eq.${uid},user2_id.eq.${uid}`),
      ])

      if (pendingRes.error) throw pendingRes.error
      setPendingFriends(pendingRes.data?.length ?? 0)

      const convIds = (convRes.data ?? []).map((c) => c.id)
      if (convIds.length === 0) {
        setUnreadMessages(0)
        return
      }

      const { data: msgs, error: msgError } = await supabase
        .from('messages')
        .select('id, sender_id, created_at')
        .in('conversation_id', convIds)
        .neq('sender_id', uid)

      if (msgError) throw msgError

      setUnreadMessages(
        (msgs ?? []).filter((m) => isNewer(m.created_at, friendSeen)).length,
      )
    } catch (err) {
      console.error('好友未读统计失败:', err)
    }
  }, [])

  /* ---------- 初次加载 + Realtime（新申请 / 新私信 / 新帖 / 新活动） ---------- */
  useEffect(() => {
    if (!userId) {
      // rAF 推迟，避开「effect 内同步 setState」
      const frame = window.requestAnimationFrame(() => {
        setPendingFriends(0)
        setUnreadMessages(0)
      })
      return () => window.cancelAnimationFrame(frame)
    }

    // loadFriendsBadge 是 async 函数，setState 都在 await 之后；规则无法识别
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadFriendsBadge(userId)
    void refreshWorldReplies()

    const channel = supabase
      .channel(`module-badges:${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'friendships', filter: `addressee_id=eq.${userId}` },
        () => { void loadFriendsBadge(userId) },
      )
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => {
        void loadFriendsBadge(userId)
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'world_posts' }, () => {
        refreshSeenBadges()
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'play_activities' }, () => {
        refreshSeenBadges()
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'world_comments' }, () => {
        refreshWorldReplies()
      })
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [userId, loadFriendsBadge, refreshSeenBadges, refreshWorldReplies])

  const friendsCount = pendingFriends + unreadMessages

  return {
    friends: friendsCount > 0 ? { count: friendsCount } : {},
    // 院子兼顾：有人回我用数字，只是有新帖就用点
    world: worldReplies > 0 ? { count: worldReplies, dot: worldNew } : worldNew ? { dot: true } : {},
    play: playNew ? { dot: true } : {},
    me: {},
  }
}
