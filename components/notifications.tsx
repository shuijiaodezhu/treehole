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
 * 刷新方式：进页面/打开组件时拉一次，之后每 45 秒兜底轮询一次
 * （只在标签页可见时轮询）。没走 Realtime 是因为 supabase_realtime 发布里
 * 只加了聊天那几张表，加通知表要再跑一段 SQL —— 45 秒延迟对通知够用。
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
      // 表还没建：安静地不显示（而不是每次进页面都弹错）
      if (/does not exist|PGRST205|schema cache|404/i.test(error.message)) setMissing(true)
      else console.error('读通知失败:', error)
      setLoading(false)
      return
    }

    setMissing(false)
    const list = (data ?? []) as Notice[]
    setItems(list)
    setUnread(list.filter((n) => !n.read_at).length)
    setLoading(false)
  }, [userId])

  useEffect(() => {
    if (!userId) return
    void (async () => {
      await load()
    })()

    // 兜底轮询：只看可见的标签页，避免后台标签白跑
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load()
    }, 45_000)

    return () => window.clearInterval(timer)
  }, [userId, load, reloadKey])

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
  if (missing) return null

  return (
    <Link
      href="/me/notifications"
      title="通知"
      className={`relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--accent-line)] bg-white/70 text-[var(--accent-muted)] transition hover:text-[var(--accent-deep)] ${className}`}
    >
      <Icon name="bell" className="h-4 w-4" />
      {unread > 0 && (
        <span className="absolute -right-0.5 -top-0.5 min-w-[16px] rounded-full bg-[var(--accent)] px-1 text-[10px] font-medium leading-4 text-white">
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </Link>
  )
}

/** 通知列表（页面主体） */
export function NotificationsList({ userId }: { userId: string | null }) {
  const { items, unread, loading, missing, markAllRead, markRead, clearAll } = useNotifications(userId)

  if (missing) {
    return (
      <p className="rounded-2xl border border-[var(--accent-line)] bg-white/80 px-4 py-3 text-[11px] leading-relaxed text-[var(--accent-muted)]">
        通知还没开通：先在 Supabase 里执行 <code>supabase-notifications.sql</code>。
        （没跑也不影响别的功能，只是收不到提醒）
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 px-1">
        <p className="text-[11px] text-[var(--accent-muted)]">
          {loading ? '读取中…' : unread > 0 ? `${unread} 条未读` : '都看过了'}
        </p>
        <div className="flex items-center gap-3">
          {unread > 0 && (
            <button
              type="button"
              onClick={() => void markAllRead()}
              className="text-[11px] text-[var(--accent-muted)] transition hover:text-[var(--accent-deep)]"
            >
              全部已读
            </button>
          )}
          {items.length > 0 && (
            <button
              type="button"
              onClick={() => void clearAll()}
              className="text-[11px] text-[var(--accent-light)] transition hover:text-red-500"
            >
              清空
            </button>
          )}
        </div>
      </div>

      {!loading && items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--accent-line)] bg-white/60 px-4 py-10 text-center">
          <p className="text-xs text-[var(--accent-muted)]">还没有通知</p>
          <p className="mt-1 text-[10.5px] text-[var(--accent-light)]">
            有人提到你、回了你的信、处理了你的举报，都会出现在这里。
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((notice) => {
            const inner = (
              <>
                <span className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)]">
                  <Icon name={iconOf(notice.kind)} className="h-3.5 w-3.5 text-[var(--accent-deep)]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span
                      className={`min-w-0 truncate text-xs ${
                        notice.read_at ? 'text-[var(--accent-muted)]' : 'font-medium text-[#2b2430]'
                      }`}
                    >
                      {notice.title}
                    </span>
                    <span className="flex-shrink-0 text-[10px] text-[var(--accent-light)]">
                      {relativeTime(notice.created_at)}
                    </span>
                  </span>
                  {notice.body && (
                    <span className="mt-1 line-clamp-2 block text-[10.5px] leading-relaxed text-[var(--accent-muted)]">
                      {notice.body}
                    </span>
                  )}
                </span>
                {!notice.read_at && (
                  <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[var(--accent)]" />
                )}
              </>
            )

            const rowClass = `flex items-start gap-3 rounded-2xl border px-4 py-3 transition ${
              notice.read_at
                ? 'border-[var(--accent-line)] bg-white/60'
                : 'border-[var(--accent-line)] bg-white/90 shadow-[0_2px_10px_rgba(217,119,87,0.06)]'
            }`

            // 有链接就整条可点；点的时候顺手标记已读
            return (
              <li key={notice.id}>
                {notice.link ? (
                  <Link
                    href={notice.link}
                    onClick={() => void markRead(notice.id)}
                    className={`${rowClass} hover:border-[var(--accent-light)]`}
                  >
                    {inner}
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => void markRead(notice.id)}
                    className={`${rowClass} w-full text-left hover:border-[var(--accent-light)]`}
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
