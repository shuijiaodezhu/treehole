'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '../app/lib/supabase'
import { Icon } from './icons'
import { useOnlineCount } from './presence'

/**
 * 站主后台：规模与活跃统计
 *
 *   注册人数   ← profiles 行数（还有今日新增 / 近 7 天新增）
 *   在线人数   ← Realtime Presence 实时订阅 + 「最近 5 分钟活跃」兜底
 *   日活跃     ← user_activity(user_id, day)，可算今日/近 7 日/近 30 日与 14 天趋势
 *   内容规模   ← 帖子 / 评论 / 活动 / 朋友圈 数量
 *
 * 依赖 supabase-activity.sql（user_activity 表 + profiles.last_seen_at）。
 */

const supabase = createClient()

const TREND_DAYS = 14
const ONLINE_WINDOW_MIN = 5

type Counts = {
  registered: number
  newToday: number
  newWeek: number
  activeOnline: number
  dauToday: number
  wau: number
  mau: number
  posts: number
  comments: number
  activities: number
  moments: number
}

type TrendPoint = { day: string; count: number }

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function daysAgo(n: number): Date {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  d.setUTCDate(d.getUTCDate() - n)
  return d
}

/** 从 Supabase 的 count 响应里取值（不在泛型上做文章，避免类型爆栈） */
function toCount(res: { count: number | null; error: unknown }): number {
  if (res.error) throw res.error
  return res.count ?? 0
}

export function AdminStats() {
  const [counts, setCounts] = useState<Counts | null>(null)
  const [trend, setTrend] = useState<TrendPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  const online = useOnlineCount()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const today = dayKey(daysAgo(0))
      const weekAgo = dayKey(daysAgo(6))
      const monthAgo = dayKey(daysAgo(29))
      const isoWeekAgo = daysAgo(6).toISOString()
      const isoToday = daysAgo(0).toISOString()
      const onlineSince = new Date(Date.now() - ONLINE_WINDOW_MIN * 60 * 1000).toISOString()

      const [
        profilesAll,
        profilesToday,
        profilesWeek,
        profilesOnline,
        postsRes,
        commentsRes,
        activitiesRes,
        momentsRes,
        activityRows,
      ] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', isoToday),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', isoWeekAgo),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('last_seen_at', onlineSince),
        supabase
          .from('world_posts')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'published')
          .eq('is_hidden', false),
        supabase.from('world_comments').select('id', { count: 'exact', head: true }),
        supabase.from('play_activities').select('id', { count: 'exact', head: true }).eq('status', 'published'),
        supabase.from('friend_posts').select('id', { count: 'exact', head: true }),
        // 近 14 天的活跃明细（数据量小，直接拉回来在本地聚合）
        supabase.from('user_activity').select('user_id, day').gte('day', dayKey(daysAgo(TREND_DAYS - 1))),
      ])

      if (activityRows.error) throw activityRows.error

      const registered = toCount(profilesAll)
      const newToday = toCount(profilesToday)
      const newWeek = toCount(profilesWeek)
      const activeOnline = toCount(profilesOnline)
      const posts = toCount(postsRes)
      const comments = toCount(commentsRes)
      const activities = toCount(activitiesRes)
      const moments = toCount(momentsRes)

      const rows = (activityRows.data ?? []) as { user_id: string; day: string }[]

      // 近 14 天趋势
      const byDay = new Map<string, Set<string>>()
      for (let i = TREND_DAYS - 1; i >= 0; i--) byDay.set(dayKey(daysAgo(i)), new Set())
      for (const row of rows) {
        const set = byDay.get(row.day)
        if (set) set.add(row.user_id)
      }
      setTrend([...byDay.entries()].map(([day, set]) => ({ day, count: set.size })))

      // 日活 / 周活 / 月活（去重用户）
      const dauSet = byDay.get(today) ?? new Set<string>()
      const wauSet = new Set<string>()
      const mauSet = new Set<string>()
      for (const row of rows) {
        if (row.day >= weekAgo) wauSet.add(row.user_id)
        if (row.day >= monthAgo) mauSet.add(row.user_id)
      }

      setCounts({
        registered,
        newToday,
        newWeek,
        activeOnline,
        dauToday: dauSet.size,
        wau: wauSet.size,
        mau: mauSet.size,
        posts,
        comments,
        activities,
        moments,
      })
      setError('')
    } catch (err) {
      console.error('加载统计失败:', err)
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: unknown }).message)
          : String(err)
      setError('统计加载失败：' + msg + '（可能还没跑 supabase-activity.sql）')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // load 是 async 函数，setState 都在 await 之后；规则无法识别
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load, reloadKey])

  const maxTrend = Math.max(1, ...trend.map((t) => t.count))

  return (
    <section className="card mb-5 rounded-box border border-base-300 bg-base-100/80 p-6 backdrop-blur shadow-sm">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-base-content/5">
          <Icon name="users" className="h-4 w-4 text-base-content/60" />
        </div>
        <div className="flex-1">
          <h2 className="text-sm font-semibold text-base-content">规模与活跃</h2>
          <p className="mt-0.5 text-[11px] text-base-content/40">
            在线为实时；日活按每人每天记一次
          </p>
        </div>
        <button
          type="button"
          onClick={() => setReloadKey((k) => k + 1)}
          className="card inline-flex items-center gap-1 rounded-box border border-base-300 bg-base-100 px-3 py-1.5 text-xs text-base-content/60 transition hover:bg-base-content/5"
        >
          <Icon name="refresh" className="h-3.5 w-3.5" />
          刷新
        </button>
      </div>

      {error && (
        <p className="mb-4 rounded-box border border-red-100 bg-red-50 px-4 py-3 text-xs text-red-600">{error}</p>
      )}

      {loading && !counts && <p className="py-8 text-center text-xs text-base-content/40">统计中…</p>}

      {counts && (
        <>
          {/* 四个核心数字 */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="card rounded-box border border-base-300 bg-base-100 p-4">
              <p className="text-[11px] text-base-content/40">注册人数</p>
              <p className="mt-1 text-2xl font-bold text-primary">{counts.registered}</p>
              <p className="mt-1 text-[11px] text-base-content/40">
                今日 +{counts.newToday} · 近 7 天 +{counts.newWeek}
              </p>
            </div>

            <div className="card rounded-box border border-base-300 bg-base-100 p-4">
              <p className="flex items-center gap-1.5 text-[11px] text-base-content/70">
                <span className="relative flex h-2 w-2">
                  {online.count > 0 && (
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
                  )}
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                </span>
                当前在线
              </p>
              <p className="mt-1 text-2xl font-bold text-primary">{online.count}</p>
              <p className="mt-1 text-[11px] text-base-content/70">
                {online.ready ? `近 ${ONLINE_WINDOW_MIN} 分钟活跃 ${counts.activeOnline}` : '订阅中…'}
              </p>
            </div>

            <div className="card rounded-box border border-base-300 bg-base-100 p-4">
              <p className="text-[11px] text-base-content/40">今日活跃（DAU）</p>
              <p className="mt-1 text-2xl font-bold text-primary">{counts.dauToday}</p>
              <p className="mt-1 text-[11px] text-base-content/40">
                占注册 {counts.registered > 0 ? Math.round((counts.dauToday / counts.registered) * 100) : 0}%
              </p>
            </div>

            <div className="card rounded-box border border-base-300 bg-base-100 p-4">
              <p className="text-[11px] text-base-content/40">7 日 / 30 日活跃</p>
              <p className="mt-1 text-2xl font-bold text-primary">
                {counts.wau}
                <span className="text-sm font-normal text-base-content/40"> / {counts.mau}</span>
              </p>
              <p className="mt-1 text-[11px] text-base-content/40">去重用户数</p>
            </div>
          </div>

          {/* 近 14 天趋势 */}
          <div className="card mt-4 rounded-box border border-base-300 bg-base-100 p-4">
            <p className="mb-3 text-[11px] text-base-content/40">近 {TREND_DAYS} 天日活</p>
            <div className="flex h-24 items-end gap-1">
              {trend.map((point) => (
                <div key={point.day} className="group flex flex-1 flex-col items-center gap-1">
                  <span className="text-[11px] text-base-content/40 opacity-0 transition group-hover:opacity-100">
                    {point.count}
                  </span>
                  <div
                    className="w-full rounded-t bg-gradient-to-t from-primary/20 to-primary/10"
                    style={{ height: `${Math.max(2, (point.count / maxTrend) * 70)}px` }}
                    title={`${point.day}：${point.count} 人`}
                  />
                </div>
              ))}
            </div>
            <div className="mt-1.5 flex justify-between text-[11px] text-base-content/40">
              <span>{trend[0]?.day.slice(5)}</span>
              <span>{trend[trend.length - 1]?.day.slice(5)}</span>
            </div>
          </div>

          {/* 内容规模 */}
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              { label: '院子帖子', value: counts.posts },
              { label: '帖子评论', value: counts.comments },
              { label: '聚会活动', value: counts.activities },
              { label: '朋友圈', value: counts.moments },
            ].map((item) => (
              <div key={item.label} className="card rounded-box border border-base-300 bg-base-100 p-3">
                <p className="text-[11px] text-base-content/40">{item.label}</p>
                <p className="mt-0.5 text-lg font-semibold text-base-content">{item.value}</p>
              </div>
            ))}
          </div>

          <p className="mt-4 text-[11px] leading-relaxed text-base-content/40">
            「当前在线」由 Realtime Presence 实时统计（同一账号多标签页算一个人）；「近 {ONLINE_WINDOW_MIN} 分钟活跃」
            与「今日活跃」来自数据库记录，关闭页面后仍保留。
          </p>
        </>
      )}
    </section>
  )
}
