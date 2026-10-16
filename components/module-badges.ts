'use client'

import { useCallback, useEffect, useState } from 'react'
import { newest } from './time-compare'
import { peek } from './local-store'
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
 * 页面进入时调用 markModuleSeen(key) 记时间戳，并广播事件让主页角标立刻消失。
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

/** 页面标记已看时广播，主页角标立刻跟着更新（不用整页刷新） */
/* 导出：别处（比如读完通知）也能触发一次「角标立即刷新」 */
export const MODULE_SEEN_EVENT = 'treehole:module-seen'

/**
 * 页面进入时调用：把这个模块标记为已看。
 * 通知主页那边的角标立即刷新——否则要等整页重载才会消失。
 */
export function markModuleSeen(key: keyof typeof SEEN_KEY): void {
  writeSeenAt(key, new Date().toISOString())
  try {
    window.dispatchEvent(new CustomEvent<string>(MODULE_SEEN_EVENT, { detail: key }))
  } catch {
    /* 忽略 */
  }
}

export function readSeenAt(key: keyof typeof SEEN_KEY): string | null {
  let local: string | null = null
  try {
    local = window.localStorage.getItem(SEEN_KEY[key])
  } catch {
    local = null
  }

  /*
   * 多端同步：数据库里也记了一份「我读到哪一刻」
   *   · 由开屏同步拉下来存在本机（module-reads）→ 0 额外请求
   *   · 取本机与服务端里**较新**的那个 →
   *     手机上读过，电脑上就不算未读（用户报的"多端不同步"）
   *   · 表还没建时 server 为空 → 行为与以前完全一致（只看本机）
   */
  let server: string | null = null
  try {
    const map = peek<Record<string, string>>('module-reads', 7 * 24 * 60 * 60 * 1000)
    server = map ? (map[key as string] ?? null) : null
  } catch {
    server = null
  }

  // 按时间戳取较新（原来比字符串 ✗ 格式不同会判错 → 角标又冒出来）
  return newest(local, server)
}

export function writeSeenAt(key: keyof typeof SEEN_KEY, iso: string): void {
  /*
   * 顺手往数据库写一份（多端同步用）
   *   fire-and-forget：不 await ✓ 不影响任何手感
   *   表不存在 / 没网 → 静默失败 ✓ 本机那份已经生效了 ✓
   *   用户 id 从开屏同步存的 me-uid 取（省得改一堆调用点）
   */
  try {
    const uid = peek<string>('me-uid', 30 * 24 * 60 * 60 * 1000)
    if (uid) {
      void (async () => {
        try {
          const supabase = createClient()
          await supabase.from('module_reads').upsert(
            { user_id: uid, module: key as string, read_at: iso, updated_at: new Date().toISOString() },
            { onConflict: 'user_id,module' },
          )
        } catch {
          /* 忽略：表还没建，或此刻没网 */
        }
      })()
    }
  } catch {
    /* 忽略 */
  }

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

/**
 * 院子里「离开后有没有新帖」
 *
 * 这里修掉两个"点一直亮"的原因：
 *  ① 本地**没有**"上次看到"的记录时（新浏览器 / 清过数据 / 换设备 / 无痕窗口），
 *     isNewer() 一律返回 true → 点必然亮，且永远不会自己消失。
 *     现在改成：第一次就以当前最新一条为准**记为已看**，从此刻开始算。
 *  ② 查询没排除自己的帖子 → 自己刚发的帖也会点亮"有新帖"。
 *     现在按 author_id 排除自己：只有「离开后**别人**发了新帖」才算新消息。
 */
async function hasNewWorldPosts(userId: string | null): Promise<boolean> {
  const seen = readSeenAt('world')
  const base = createClient()
    .from('world_posts')
    .select('created_at')
    .eq('status', 'published')
    .eq('is_hidden', false)
  const filtered = userId ? base.neq('author_id', userId) : base
  const { data, error } = await filtered.order('created_at', { ascending: false }).limit(1)

  if (error) throw error
  const latest = data?.[0]?.created_at
  if (!latest) return false
  if (!seen) {
    // 本地还没有记录：以当前最新为准记下，不点亮
    writeSeenAt('world', latest)
    return false
  }
  return isNewer(latest, seen)
}

/**
 * 派对同理：既做"首次记账"（本地没记录时先记下当前最新，不点亮），
 * 也排除自己发的活动 —— 只有「离开后**别人**发了新活动」才算新消息。
 * （作者列名 author_id 是从读写这张表的四处代码里确认的：
 *   app/play/page.tsx 的 select 与 insert、admin 与 search 的 select。）
 */
async function hasNewActivities(userId: string | null): Promise<boolean> {
  const seen = readSeenAt('play')
  const base = createClient()
    .from('play_activities')
    .select('created_at')
    .eq('status', 'published')
  const filtered = userId ? base.neq('author_id', userId) : base
  const { data, error } = await filtered.order('created_at', { ascending: false }).limit(1)

  if (error) throw error
  const latest = data?.[0]?.created_at
  if (!latest) return false
  if (!seen) {
    writeSeenAt('play', latest)
    return false
  }
  return isNewer(latest, seen)
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
        const [world, play] = await Promise.all([
          hasNewWorldPosts(userId),
          hasNewActivities(userId),
        ])
        setWorldNew(world)
        setPlayNew(play)
      } catch (err) {
        console.error('模块提示刷新失败:', err)
      }
    })()
  }, [userId])

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

        // 同样：只数个数（head: true 不带数据体），未读交给服务端过滤
        let replyQuery = supabase
          .from('world_comments')
          .select('id', { count: 'exact', head: true })
          .or(orFilter)
          .neq('author_id', userId)
        if (seenAt) replyQuery = replyQuery.gt('created_at', seenAt)

        const { count: replyCount, error } = await replyQuery
        if (error) throw error
        setWorldReplies(replyCount ?? 0)
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
    /*
     * 切回标签页时的重算要节流：
     * 这个 hook 一次要发 5-6 个查询，用户来回切窗口会让它反复打 Supabase ——
     * 那是纯粹浪费的流量。60 秒内只算一次（挂载时那一次不受影响）。
     */
    const MIN_REFRESH_MS = 60_000
    let lastRefreshAt = 0
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      const now = Date.now()
      if (now - lastRefreshAt < MIN_REFRESH_MS) return
      lastRefreshAt = now
      refreshSeenBadges()
      refreshWorldReplies()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [refreshSeenBadges, refreshWorldReplies])

  /* ---------- 小屋：待处理好友申请 + 未读私信 ---------- */
  const loadFriendsBadge = useCallback(async (uid: string) => {
    try {
      const friendSeen = readSeenAt('friends')

      // 一次取回和「我」有关的所有好友关系，再在本地拆成待处理/已通过：
      // 少一个网络来回，角标到得更快
      const [shipRes, convRes] = await Promise.all([
        supabase
          .from('friendships')
          .select('requester_id, addressee_id, status')
          .or(`requester_id.eq.${uid},addressee_id.eq.${uid}`),
        supabase
          .from('conversations')
          .select('id, user1_id, user2_id')
          .or(`user1_id.eq.${uid},user2_id.eq.${uid}`),
      ])

      if (shipRes.error) throw shipRes.error
      const ships = (shipRes.data ?? []) as {
        requester_id: string
        addressee_id: string
        status: string
      }[]
      setPendingFriends(ships.filter((s) => s.status === 'pending' && s.addressee_id === uid).length)

      // 只算「对方是我好友」的会话
      const friendIds = new Set(
        ships
          .filter((s) => s.status === 'accepted')
          .map((s) => (s.requester_id === uid ? s.addressee_id : s.requester_id)),
      )
      const convIds = ((convRes.data ?? []) as { id: string; user1_id: string; user2_id: string }[])
        .filter((c) => friendIds.has(c.user1_id === uid ? c.user2_id : c.user1_id))
        .map((c) => c.id)
      if (convIds.length === 0) {
        setUnreadMessages(0)
        return
      }

      /*
       * 只数个数、不取行。
       * head: true → 响应里只有计数头（没有数据体）；未读交给服务端过滤。
       * 原来这里把**每个会话的所有消息**拉回来再在本地筛，是出站流量最大的一个漏斗。
       */
      let unreadQuery = supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .in('conversation_id', convIds)
        .neq('sender_id', uid)
      if (friendSeen) unreadQuery = unreadQuery.gt('created_at', friendSeen)

      const { count: unreadCount, error: msgError } = await unreadQuery
      if (msgError) throw msgError
      setUnreadMessages(unreadCount ?? 0)
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
      // 只关心别人发来的：自己发的不可能是未读，不必触发重算
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `sender_id=neq.${userId}` },
        () => {
          void loadFriendsBadge(userId)
        },
      )
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

    // 页面里标记「已看」时立刻重算角标：
    // 否则从小屋返回主页，角标要等整页重载才消失（用户会以为清不掉）
    const onModuleSeen = (event: Event) => {
      const key = (event as CustomEvent<string>).detail
      refreshSeenBadges()
      if (key === 'friends') void loadFriendsBadge(userId)
      void refreshWorldReplies()
    }
    window.addEventListener(MODULE_SEEN_EVENT, onModuleSeen)

    return () => {
      window.removeEventListener(MODULE_SEEN_EVENT, onModuleSeen)
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
