'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '../app/lib/supabase'
import { Icon } from './icons'

/**
 * 站内通知
 *
 * 表在 supabase-notifications.sql，由数据库触发器写入（客户端**没有** insert 权限，
 * 所以伪造不了一条"系统通知"）。这里只负责读、标记已读、删除。
 *
 * 到达方式：**Realtime 订阅**（数据库那边要把 notifications 加进
 * supabase_realtime 发布，见那份 SQL 的第八段）+ **5 分钟兜底轮询**。
 * 订阅是为了"一发就到"，轮询是为了万一订阅没生效也不至于完全收不到 ——
 * 和聊天那套（components/chat-realtime.ts）是同一个思路。
 */

const supabase = createClient()

export type Notice = {
  id: string
  kind: string
  title: string
  body: string | null
  link: string | null
  read_at: string | null
  created_at: string
}

/** 每种通知配一个图标，扫一眼就知道是什么事 */
function iconOf(kind: string) {
  switch (kind) {
    case 'mention':
      return 'comment' as const
    case 'report':
      return 'shield' as const
    case 'moderation':
      return 'alert' as const
    case 'mailbox':
      return 'mail' as const
    case 'friend':
      return 'users' as const
    default:
      return 'bell' as const
  }
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 60_000) return '刚刚'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)} 天前`
  return new Date(iso).toLocaleDateString('zh-CN')
}

/** 读通知 + 未读数，带兜底轮询 */
export function useNotifications(userId: string | null) {
  const [items, setItems] = useState<Notice[]>([])
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(true)
  const [missing, setMissing] = useState(false)
  /** 原始报错：出问题时把数据库的真实说法露出来，比"还没开通"有用得多 */
  const [errorText, setErrorText] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  const load = useCallback(async () => {
    if (!userId) return

    const { data, error } = await supabase
      .from('notifications')
      .select('id, kind, title, body, link, read_at, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      // 表还没建（或字段对不上）：记下来，页面里会显示数据库的原话
      if (/does not exist|PGRST205|schema cache|404/i.test(error.message)) {
        setMissing(true)
        setErrorText(error.message)
      } else {
        console.error('读通知失败:', error)
        setErrorText(error.message)
      }
      setLoading(false)
      return
    }

    setMissing(false)
    setErrorText('')
    const list = (data ?? []) as Notice[]
    setItems(list)
    setUnread(list.filter((n) => !n.read_at).length)
    setLoading(false)
  }, [userId])

  useEffect(() => {
    if (!userId || missing) return
    void (async () => {
      await load()
    })()

    // 兜底轮询：实时订阅才是主路，这里只是保险。
    // 放宽到 5 分钟，并且只看可见的标签页，避免后台标签白跑。
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load()
    }, 300_000)

    return () => window.clearInterval(timer)
  }, [userId, load, reloadKey, missing])

  /*
   * 实时订阅：别人一提到你、站主一回信，铃铛当场就变。
   *
   * 两点写法上的注意：
   *   · 回调必须在 subscribe() **之前**注册（订阅之后再 .on 会报
   *     "cannot add callbacks after subscribe()"，之前踩过一次）
   *   · 收到 INSERT 时先按 id 去重，避免和兜底轮询回来的那条重复
   */
  useEffect(() => {
    if (!userId) return

    let cancelled = false
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload) => {
          if (cancelled) return
          const row = payload.new as Notice
          setItems((prev) => (prev.some((n) => n.id === row.id) ? prev : [row, ...prev].slice(0, 50)))
          if (!row.read_at) setUnread((n) => n + 1)
          setLoading(false)
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload) => {
          if (cancelled) return
          // 别的标签页标了已读，这里跟着变
          const row = payload.new as Notice
          setItems((prev) => prev.map((n) => (n.id === row.id ? { ...n, read_at: row.read_at } : n)))
        },
      )
      .subscribe()

    return () => {
      cancelled = true
      void supabase.removeChannel(channel)
    }
  }, [userId])

  const markAllRead = useCallback(async () => {
    if (!userId) return
    const now = new Date().toISOString()
    setItems((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: now })))
    setUnread(0)
    await supabase.from('notifications').update({ read_at: now }).eq('user_id', userId).is('read_at', null)
  }, [userId])

  const markRead = useCallback(async (id: string) => {
    setItems((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read_at: n.read_at ?? new Date().toISOString() } : n)),
    )
    setUnread((n) => Math.max(0, n - 1))
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id)
  }, [])

  const clearAll = useCallback(async () => {
    if (!userId) return
    if (!confirm('清空所有通知？清掉之后就找不回来了。')) return
    setItems([])
    setUnread(0)
    const { error } = await supabase.from('notifications').delete().eq('user_id', userId)
    if (error) console.error('清空通知失败:', error)
  }, [userId])

  return {
    items,
    unread,
    loading,
    missing,
    errorText,
    markAllRead,
    markRead,
    clearAll,
    refresh: useCallback(() => setReloadKey((k) => k + 1), []),
  }
}

/** 导航上的小铃铛：有未读就带一个数字 */
export function NotificationBell({
  userId,
  className = '',
}: {
  userId: string | null
  className?: string
}) {
  const { unread, missing } = useNotifications(userId)

  /*
   * 以前"表还没建就整个不显示" —— 结果用户只看到"这里什么都没有"，
   * 分不清是自己没跑 SQL 还是功能坏了。改成**永远显示**：
   * 没开通时点进去，通知页里会告诉他"先执行 supabase-notifications.sql"。
   */
  return (
    <Link
      href="/me/notifications"
      title={missing ? '通知（还没开通）' : '通知'}
      className={`relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-base-300 bg-base-100/70 text-base-content/60 transition hover:text-primary ${className}`}
    >
      <Icon name="bell" className="h-4 w-4" />
      {unread > 0 && (
        <span className="absolute -right-0.5 -top-0.5 min-w-[16px] rounded-full bg-primary px-1 text-[11px] font-medium leading-4 text-primary-content">
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </Link>
  )
}

/** 通知列表（页面主体） */
export function NotificationsList({ userId }: { userId: string | null }) {
  const { items, unread, loading, missing, errorText, markAllRead, markRead, clearAll } =
    useNotifications(userId)

  if (missing) {
    return (
      <div className="rounded-box border border-base-300 bg-base-100/80 px-4 py-3 text-[11px] leading-relaxed text-base-content/60">
        <p>
          通知还没开通。需要在 Supabase 的 SQL Editor 里，执行{' '}
          <code>supabase-notifications.sql</code> 这个文件的
          <span className="font-medium text-primary">内容</span>
          （打开那个文件复制全文，不是把这行字打进去）。
        </p>
        <p className="mt-1.5 text-[11.5px] text-accent">
          没跑也不影响别的功能，只是收不到提醒。
        </p>
        {errorText && (
          <p className="mt-2.5 whitespace-pre-wrap rounded-box bg-primary/5 px-3 py-2 text-[11.5px] text-primary">
            数据库的原话：{errorText}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 px-1">
        <p className="text-[11px] text-base-content/60">
          {loading ? '读取中…' : unread > 0 ? `${unread} 条未读` : '都看过了'}
        </p>
        <div className="flex items-center gap-3">
          {unread > 0 && (
            <button
              type="button"
              onClick={() => void markAllRead()}
              className="text-[11px] text-base-content/60 transition hover:text-primary"
            >
              全部已读
            </button>
          )}
          {items.length > 0 && (
            <button
              type="button"
              onClick={() => void clearAll()}
              className="text-[11px] text-accent transition hover:text-red-500"
            >
              清空
            </button>
          )}
        </div>
      </div>

      {!loading && items.length === 0 ? (
        <div className="rounded-box border border-dashed border-base-300 bg-base-100/60 px-4 py-10 text-center">
          <p className="text-xs text-base-content/60">还没有通知</p>
          <p className="mt-1 text-[11.5px] text-accent">
            有人提到你、回了你的信、处理了你的举报，都会出现在这里。
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((notice) => {
            const inner = (
              <>
                <span className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary/5">
                  <Icon name={iconOf(notice.kind)} className="h-3.5 w-3.5 text-primary" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span
                      className={`min-w-0 truncate text-xs ${
                        notice.read_at ? 'text-base-content/60' : 'font-medium text-base-content'
                      }`}
                    >
                      {notice.title}
                    </span>
                    <span className="flex-shrink-0 text-[11px] text-accent">
                      {relativeTime(notice.created_at)}
                    </span>
                  </span>
                  {notice.body && (
                    <span className="mt-1 line-clamp-2 block text-[11.5px] leading-relaxed text-base-content/60">
                      {notice.body}
                    </span>
                  )}
                </span>
                {!notice.read_at && (
                  <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" />
                )}
              </>
            )

            const rowClass = `flex items-start gap-3 rounded-box border px-4 py-3 transition ${
              notice.read_at
                ? 'border-base-300 bg-base-100/60'
                : 'border-base-300 bg-base-100/90 shadow-sm'
            }`

            // 有链接就整条可点；点的时候顺手标记已读
            return (
              <li key={notice.id}>
                {notice.link ? (
                  <Link
                    href={notice.link}
                    onClick={() => void markRead(notice.id)}
                    className={`${rowClass} hover:border-accent`}
                  >
                    {inner}
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => void markRead(notice.id)}
                    className={`${rowClass} w-full text-left hover:border-accent`}
                  >
                    {inner}
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
