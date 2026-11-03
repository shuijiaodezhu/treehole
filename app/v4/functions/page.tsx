'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase'
import { usePlans } from '@/components/plans'
import { PlansPanel } from './plans-panel'
import { VaultView } from '@/components/vault-view'
import './functions.css'

/**
 * 功能区：日历 / 计划书 / 储物箱
 *
 * 日历与计划书的联动：
 *   · 计划书里的条目（计划 / 目标 / 任务）如果填了 due（截止日期），
 *     就会**自动出现在日历对应的那一天**上（读取同一份 usePlans 数据）
 *   · 日历里自己加的事件存在 localStorage（按用户隔离），不需要新表
 *   · 在日历上点某天 → 可以给那天写一条事件；如果那天有计划书的 due，会列在下面
 */

type CalEvent = { id: string; date: string; title: string; note?: string }

const WEEK = ['日', '一', '二', '三', '四', '五', '六']

function pad(n: number) {
  return n < 10 ? '0' + n : String(n)
}
function ymd(y: number, m: number, d: number) {
  return y + '-' + pad(m + 1) + '-' + pad(d)
}
function todayYmd() {
  const t = new Date()
  return ymd(t.getFullYear(), t.getMonth(), t.getDate())
}

export default function FunctionsPage() {
  const router = useRouter()
  const [tab, setTab] = useState<'calendar' | 'plans' | 'vault'>('calendar')
  const [userId, setUserId] = useState<string | null>(null)
  const [email, setEmail] = useState<string | null>(null)

  useEffect(() => {
    const sb = createClient()
    sb.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null)
      setEmail(data.user?.email ?? null)
    })
  }, [])

  /* ── 登录态 ── */
  const account = (
    <div className={"fn-account"}>
      <span className={"fn-email"}>{email || '未登录'}</span>
      {email ? (
        <button
          className={"fn-logout"}
          type="button"
          onClick={async () => {
            await createClient().auth.signOut()
            router.push('/')
          }}
        >
          退出登录
        </button>
      ) : (
        <Link href="/login" className={"fn-logout"}>
          登录
        </Link>
      )}
    </div>
  )

  return (
    <div className={"v4-page fn-page"}>
      {/* 背景沿用 v4 的冬日视频 */}
      <div className={"v4-bg"}>
        <video className={"v4-video"} autoPlay muted loop playsInline preload="auto">
          <source src="/bg-winter.mp4" type="video/mp4" />
        </video>
        <div className={"v4-scrim"} />
        <div className={"v4-glow v4-glow1"} />
        <div className={"v4-glow v4-glow2"} />
        <div className={"v4-glow v4-glow3"} />
      </div>

      <div className={"fn-wrap"}>
        <header className={"fn-top"}>
          <Link href="/v4" className={"fn-brand"}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/wordmark-light.png" alt="你的来信" className={"v4-wordmark"} />
            <span>DEAR YOU</span>
          </Link>
          <span className={"v4-spacer"} />
          {account}
        </header>

        <div className={"fn-tabs"}>
          {(
            [
              ['calendar', '日历'],
              ['plans', '计划书'],
              ['vault', '储物箱'],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              className={"fn-tab" + (tab === k ? ' fn-tabOn' : '')}
              onClick={() => setTab(k)}
            >
              {label}
            </button>
          ))}
          <span className={"v4-spacer"} />
          <Link href="/v4" className={"fn-back"}>
            ← 回院子
          </Link>
        </div>

        <main className={"fn-main"}>
          {tab === 'calendar' && <CalendarView userId={userId} />}
          {tab === 'plans' && <PlansPanel userId={userId} />}
          {tab === 'vault' && <VaultView userId={userId} />}
        </main>
      </div>
    </div>
  )
}

/* ═══════════════ 日历 ═══════════════ */

function CalendarView({ userId }: { userId: string | null }) {
  const plans = usePlans(userId)
  const storeKey = 'th-cal-' + (userId ?? 'anon')

  const [events, setEvents] = useState<CalEvent[]>([])
  const [cursor, setCursor] = useState(() => {
    const t = new Date()
    return { y: t.getFullYear(), m: t.getMonth() }
  })
  const [picked, setPicked] = useState<string>(todayYmd())
  const [draft, setDraft] = useState('')

  /* 读本地事件（放到 rAF 里，避免在 effect 中同步 setState） */
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try {
        const raw = localStorage.getItem(storeKey)
        if (raw) setEvents(JSON.parse(raw) as CalEvent[])
      } catch {
        /* 忽略 */
      }
    })
    return () => window.cancelAnimationFrame(frame)
  }, [storeKey])

  /* 写本地事件 */
  const save = useCallback(
    (next: CalEvent[]) => {
      setEvents(next)
      try {
        localStorage.setItem(storeKey, JSON.stringify(next))
      } catch {
        /* 忽略 */
      }
    },
    [storeKey],
  )

  /* 计划书的 due → 按日期索引（这就是"联动"） */
  const plansByDate = useMemo(() => {
    const map: Record<string, { id: string; title: string; kind: string }[]> = {}
    for (const p of plans.items ?? []) {
      if (!p.due_date) continue
      const d = p.due_date.slice(0, 10)
      if (!map[d]) map[d] = []
      map[d].push({ id: p.id, title: p.title, kind: p.kind })
    }
    return map
  }, [plans.items])

  const eventsByDate = useMemo(() => {
    const map: Record<string, CalEvent[]> = {}
    for (const e of events) {
      if (!map[e.date]) map[e.date] = []
      map[e.date].push(e)
    }
    return map
  }, [events])

  /* 月份网格 */
  const grid = useMemo(() => {
    const first = new Date(cursor.y, cursor.m, 1)
    const startDay = first.getDay()
    const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate()
    const cells: { d: number | null; key: string }[] = []
    for (let i = 0; i < startDay; i++) cells.push({ d: null, key: 'pad' + i })
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ d, key: ymd(cursor.y, cursor.m, d) })
    }
    while (cells.length % 7 !== 0) cells.push({ d: null, key: 'tail' + cells.length })
    return cells
  }, [cursor])

  const addEvent = () => {
    const title = draft.trim()
    if (!title) return
    const e: CalEvent = {
      id: Date.now() + '-' + Math.random().toString(36).slice(2, 7),
      date: picked,
      title,
    }
    save([...events, e])
    setDraft('')
  }

  const removeEvent = (id: string) => save(events.filter((e) => e.id !== id))

  const dayPlans = plansByDate[picked] ?? []
  const dayEvents = eventsByDate[picked] ?? []
  const today = todayYmd()

  return (
    <div className={"cal-wrap"}>
      {/* 左：月历 */}
      <section className={"cal-card v4-glass"}>
        <div className={"cal-head"}>
          <button
            type="button"
            className={"cal-nav"}
            onClick={() => setCursor((c) => (c.m === 0 ? { y: c.y - 1, m: 11 } : { y: c.y, m: c.m - 1 }))}
            aria-label="上个月"
          >
            ‹
          </button>
          <span className={"cal-title"}>
            {cursor.y} 年 {cursor.m + 1} 月
          </span>
          <button
            type="button"
            className={"cal-nav"}
            onClick={() => setCursor((c) => (c.m === 11 ? { y: c.y + 1, m: 0 } : { y: c.y, m: c.m + 1 }))}
            aria-label="下个月"
          >
            ›
          </button>
        </div>

        <div className={"cal-week"}>
          {WEEK.map((w) => (
            <span key={w}>{w}</span>
          ))}
        </div>

        <div className={"cal-grid"}>
          {grid.map((cell) => {
            if (cell.d === null) return <span key={cell.key} className={"cal-pad"} />
            const key = cell.key
            const evs = eventsByDate[key]?.length ?? 0
            const pls = plansByDate[key]?.length ?? 0
            const isToday = key === today
            const isPicked = key === picked
            return (
              <button
                key={key}
                type="button"
                onClick={() => setPicked(key)}
                className={
                  'cal-day' +
                  (isToday ? ' cal-dayToday' : '') +
                  (isPicked ? ' cal-dayOn' : '')
                }
              >
                <span className={"cal-dayNum"}>{cell.d}</span>
                <span className={"cal-dots"}>
                  {pls > 0 && <i className={"cal-dot cal-dotPlan"} title={'计划书 ' + pls} />}
                  {evs > 0 && <i className={"cal-dot cal-dotEvent"} title={'事件 ' + evs} />}
                </span>
              </button>
            )
          })}
        </div>

        <div className={"cal-legend"}>
          <span>
            <i className={"cal-dot cal-dotPlan"} /> 计划书
          </span>
          <span>
            <i className={"cal-dot cal-dotEvent"} /> 日历事件
          </span>
        </div>
      </section>

      {/* 右：当天 */}
      <section className={"cal-card v4-glass cal-side"}>
        <div className={"cal-sideHead"}>
          <span className={"cal-sideDate"}>{picked}</span>
          <span className={"cal-sideHint"}>{picked === today ? '今天' : ''}</span>
        </div>

        <div className={"cal-block"}>
          <div className={"cal-blockTitle"}>写下这天的事</div>
          <div className={"cal-add"}>
            <input
              className={"cal-input"}
              value={draft}
              placeholder="比如：下午三点去看牙"
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') addEvent()
              }}
            />
            <button type="button" className={"cal-addBtn"} onClick={addEvent}>
              添加
            </button>
          </div>
          {dayEvents.length === 0 ? (
            <p className={"cal-empty"}>这天还没有事件</p>
          ) : (
            <ul className={"cal-list"}>
              {dayEvents.map((e) => (
                <li key={e.id} className={"cal-item"}>
                  <span className={"cal-itemDot"} />
                  <span className={"cal-itemText"}>{e.title}</span>
                  <button
                    type="button"
                    className={"cal-del"}
                    onClick={() => removeEvent(e.id)}
                    aria-label="删除"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={"cal-block cal-link"}>
          <div className={"cal-blockTitle"}>
            计划书里这天的
            <span className={"cal-linkTag"}>自动联动</span>
          </div>
          {dayPlans.length === 0 ? (
            <p className={"cal-empty"}>计划书里没有这天的条目</p>
          ) : (
            <ul className={"cal-list"}>
              {dayPlans.map((p) => (
                <li key={p.id} className={"cal-item"}>
                  <span className={"cal-itemDot cal-dotPlan"} />
                  <span className={"cal-itemText"}>{p.title}</span>
                </li>
              ))}
            </ul>
          )}
          <p className={"cal-foot"}>
            在计划书里给条目填上截止日期，它就会出现在这里 ✓
          </p>
        </div>
      </section>
    </div>
  )
}
