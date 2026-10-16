'use client'

/**
 * 开屏同步（像 App 一样：先把常用东西拉到本机，之后每页先读本地）
 *
 * 做的事：登录后（或打开时）**并行**拉这几样，写进本地库：
 *   分区 · 我的资料 · 好友列表 · 最近的会话与消息 · 未读通知数 · 院子首页帖子
 *
 * 三层保险（都是踩坑换来的 ✓）：
 *   ① 这个组件**只 return null** → 不渲染任何东西 ✗ 所以不可能把页面搞白 ✓
 *   ② 每条查询都套 withTimeout ✓ 单条最多等 5 秒 ✓ 不回来就放弃 ✓ 绝不拖住页面 ✗
 *   ③ 一条失败/超时**不影响**别的 ✓（Promise.all + 每条各自兜底 ✓）而且整段包在 try 里 ✓
 *
 * 它**不阻塞**首屏：effect 里 fire-and-forget ✓ 页面该画画 ✓ 它在背后慢慢来 ✓
 */

import { useEffect } from 'react'
import { createClient } from '../app/lib/supabase'
import { age, save, withTimeout } from './local-store'

/** 同步记录用的 key（只记"上次什么时候同步过"✓ 不存业务数据 ✓） */
const SYNC_KEY = 'boot-sync-at'
/** 一分钟内不重复同步 ✓（切页、来回跳都不会反复拉 ✓） */
const MIN_GAP_MS = 60_000
/** 单条查询最多等多久（超时就放弃这一条 ✓ 不拖页面 ✓） */
const Q_TIMEOUT_MS = 5000

/**
 * 把一条 Supabase 查询变成"一定会有结果"的查询 ✓
 * 超时 / 报错 → 返回 fallback ✓（调用方永远拿到数组或 null ✓ 不用处理异常 ✗）
 */
async function q<T>(
  builder: PromiseLike<{ data: T | null }>,
  fallback: T,
): Promise<T> {
  const res = await withTimeout(builder, Q_TIMEOUT_MS, { data: fallback })
  return res?.data ?? fallback
}

export function BootSync() {
  useEffect(() => {
    let cancelled = false

    void (async () => {
      try {
        // 刚同步过就不折腾 ✓
        if (age(SYNC_KEY) < MIN_GAP_MS) return

        const supabase = createClient()

        // 先确认登录（getSession 读本地 ✓ 瞬时 ✓ 不会卡）
        const sessionRes = await withTimeout(
          supabase.auth.getSession(),
          Q_TIMEOUT_MS,
          { data: { session: null }, error: null } as { data: { session: null }; error: null },
        )
        const uid = sessionRes?.data?.session?.user?.id
        if (!uid || cancelled) return

        // ── 并行拉（每条各自兜底 ✓）──
        const [cats, me, friends, conversations, messages, unread, posts] = await Promise.all([
          q(supabase.from('categories').select('id, name, icon, parent_id, sort_order').eq('status', 'approved').order('sort_order', { ascending: true }), []),

          q(supabase.from('profiles').select('id, username, nickname, avatar_url, signature').eq('id', uid).maybeSingle(), null),

          q(supabase.from('friendships').select('id, requester_id, addressee_id').or(`requester_id.eq.${uid},addressee_id.eq.${uid}`).eq('status', 'accepted'), []),

          q(supabase.from('conversations').select('*').order('last_message_at', { ascending: false }).limit(50), []),

          q(supabase.from('messages').select('id, conversation_id, sender_id, content, created_at').order('created_at', { ascending: false }).limit(60), []),

          q(supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', uid).is('read_at', null), null),

          q(supabase.from('world_posts').select('id, author_id, is_anonymous, content, category_id, created_at, image_urls').eq('status', 'published').eq('is_hidden', false).is('category_id', null).order('created_at', { ascending: false }).limit(20), []),
        ])

        if (cancelled) return

        // ── 写进本地库（写不进去也不报错 ✓）──
        save('categories', cats)
        if (me) save('me-profile', me)
        save('friendships', friends)
        save('conversations', conversations)
        save('recent-messages', messages)
        save('world-posts-hall', posts)
        if (typeof unread === 'number') save('notifications-unread', unread)

        // 记一笔"什么时候同步过"✓（最后写 ✓ 失败了下次还会重试 ✓）
        save(SYNC_KEY, 1)
      } catch {
        /* 开屏同步是"锦上添花" ✗ 任何问题都不该影响用户 ✓ */
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  // 它不渲染任何东西 ✓ 所以不可能影响页面结构 ✓
  return null
}
