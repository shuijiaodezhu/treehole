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
import { useRouter } from 'next/navigation'
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

        /*
         * 先用一次 RPC 拿回全部（9 次往返 → 1 次 ✓）
         *   app_boot() 是 security invoker 函数 ✓ RLS 照常生效 ✓
         *   没建这个函数 / 报错 / 超时 → boot 为 null → 下面的 pick 自动退回原查询 ✓
         *   **最坏情况只是"没变快"，绝不会"打不开"** ✓
         */
        const bootRes = await withTimeout(
          // rpc 的返回类型和 withTimeout 的泛型对不上 ✓ 这里显式转一层（运行期没有区别）
          supabase.rpc('app_boot') as unknown as PromiseLike<{ data: unknown }>,
          Q_TIMEOUT_MS,
          { data: null },
        )
        const boot = (bootRes?.data ?? null) as Record<string, unknown> | null
        const hasBoot = !!(boot && Array.isArray(boot.categories))

        /** 有合并结果就用它，没有就真的去查（查询函数只在需要时才执行 ✓） */
        const pick = <T,>(
          key: string,
          fallback: T,
          run: () => PromiseLike<{ data: T | null }>,
        ): Promise<T> => {
          if (hasBoot && boot && boot[key] !== undefined && boot[key] !== null) {
            return Promise.resolve(boot[key] as T)
          }
          return q(run(), fallback)
        }

        // ── 并行拉（每条各自兜底 ✓）──
        const [cats, me, friends, conversations, messages, unread, convReads, moduleReads, posts] = await Promise.all([
          pick('categories', [], () => supabase.from('categories').select('id, name, icon, parent_id, sort_order').eq('status', 'approved').order('sort_order', { ascending: true })),

          pick('me', null, () => supabase.from('profiles').select('id, username, nickname, avatar_url, signature, location').eq('id', uid).maybeSingle()),

          pick('friendships', [], () => supabase.from('friendships').select('id, requester_id, addressee_id').or(`requester_id.eq.${uid},addressee_id.eq.${uid}`).eq('status', 'accepted')),

          pick('conversations', [], () => supabase.from('conversations').select('*').order('last_message_at', { ascending: false }).limit(50)),

          pick('messages', [], () => supabase.from('messages').select('id, conversation_id, sender_id, content, created_at').order('created_at', { ascending: false }).limit(60)),

          q(supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', uid).is('read_at', null), null),

          // 服务端记的"我在每个会话读到哪一刻"（多端同步用）
          // 表还没建 → 这里会返回空数组 ✓ 前端自动退回本机方式 ✓ 不影响任何功能
          pick('conv_reads', [], () => supabase.from('conversation_reads').select('conversation_id, read_at').eq('user_id', uid)),

          // 各模块（院子/小屋/朋友圈…）的已读位置（多端同步 · 第二部分）
          // 表还没建 → 返回空数组 → 前端自动退回本机方式 ✓
          pick('module_reads', [], () => supabase.from('module_reads').select('module, read_at').eq('user_id', uid)),

          pick('posts', [], () => supabase.from('world_posts').select('id, author_id, is_anonymous, content, category_id, created_at, image_urls').eq('status', 'published').eq('is_hidden', false).is('category_id', null).order('created_at', { ascending: false }).limit(20)),
        ])

        if (cancelled) return

        // ── 写进本地库（写不进去也不报错 ✓）──
        save('categories', cats)
        if (me) save('me-profile', me)
        save('friendships', friends)
        save('conversations', conversations)
        save('recent-messages', messages)
        save('world-posts-hall', posts)
        // 顺手把自己的 uid 存下来（别处写"已读"时要用，省得改一堆调用点）
        save('me-uid', uid)
        try {
          const m: Record<string, string> = {}
          for (const r of (moduleReads ?? []) as { module: string; read_at: string }[]) {
            if (r && r.module && r.read_at) m[r.module] = r.read_at
          }
          save('module-reads', m)
        } catch {
          /* 忽略 */
        }
        try {
          const map: Record<string, string> = {}
          for (const r of (convReads ?? []) as { conversation_id: string; read_at: string }[]) {
            if (r && r.conversation_id && r.read_at) map[r.conversation_id] = r.read_at
          }
          save('conversation-reads', map)
        } catch {
          /* 忽略 */
        }
        if (typeof unread === 'number') save('notifications-unread', unread)

        // 记一笔"什么时候同步过"✓（最后写 ✓ 失败了下次还会重试 ✓）
        save(SYNC_KEY, 1)

        /*
         * 通知各个角标 hook：本地标记刚刚写好了，重算一次 ✓
         *   之前的问题：开屏同步还在写 conversation-reads / module-reads 时，
         *   角标 hook 已经算完了 ✗ → 重装后角标一直是旧的 ✗
         *   而且之后也不会重算（依赖数组里没有"同步完成"这个信号）✗
         */
        try {
          window.dispatchEvent(new Event('treehole:synced'))
        } catch {
          /* 忽略 */
        }
      } catch {
        /* 开屏同步是"锦上添花" ✗ 任何问题都不该影响用户 ✓ */
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  /*
   * 预热主要页面的代码（微信/抖音那种"点进去秒开"的手感）
   *
   * 原理：每个页面是一份独立的 JS 包，第一次进要**现下载**（跨境很慢）
   * 现在：进来之后空闲时就把这几个常用页面的包**悄悄下好**
   *   → 你点过去时是**从本机读** ✓ 不是等网络 ✓（这就是"秒切"✓）
   * 只在空闲时做 ✓ 不抢首屏的带宽 ✓ 失败也不影响任何功能 ✓
   */
  const router = useRouter()
  useEffect(() => {
    const routes = ['/world', '/friends', '/me', '/play', '/search']
    const warm = () => {
      for (const r of routes) {
        try {
          router.prefetch(r)
        } catch {
          /* 忽略 */
        }
      }
    }
    try {
      const ric = (window as unknown as { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback
      if (typeof ric === 'function') {
        ric(warm)
        return
      }
    } catch {
      /* 忽略 */
    }
    const t = window.setTimeout(warm, 1200)
    return () => window.clearTimeout(t)
  }, [router])

  /*
   * 注册 Service Worker（离线可用 + 图片/字体一次下载就留着）
   *
   * 三道保险（免得出现"卡在旧版本"那种经典事故）：
   *   · updateViaCache: 'none' → 每次都去问最新版，不吃 HTTP 缓存
   *   · 每次打开都顺手 reg.update() 问一次有没有新版
   *   · sw.js 里用 skipWaiting + clients.claim → 新版**立刻接管** ✓
   * 注册失败/不支持（比如某些 WebView 设置）→ 什么都不影响 ✓
   */
  useEffect(() => {
    void (async () => {
      try {
        if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
        const reg = await navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' })
        void reg.update()
      } catch {
        /* 注册不上就算了 ✓ 网站照常用 ✓ */
      }
    })()
  }, [])

  // 它不渲染任何东西 ✓ 所以不可能影响页面结构 ✓
  return null
}
