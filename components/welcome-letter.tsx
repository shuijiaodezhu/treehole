'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '../app/lib/supabase'
import { findDefaultPage } from './site-page-defaults'
import { Icon } from './icons'
import { subscribeLoginTransition } from './login-transition'

/**
 * 致每一位来到这里的人（首次登录后浮出的一封信）
 *
 * 时机：**信封过场放完之后**再出现。
 *   · 过场总时长 2.2 秒（见 components/login-transition.tsx 的时间线），
 *     所以这里订阅那个状态，等它结束再等 400ms 淡入 —— 不写死延时，
 *     开了「减少动态效果」时过场只有 150ms，这里也会跟着提前，不会干等。
 *   · 不是"刚登录完"进来的（比如刷新、或本来就在站里）：
 *     那就直接等 400ms 出现，不必空等两秒。
 *
 * 只出现一次：按用户记在 localStorage（treehole:letter:seen:<uid>）里。
 * 放 localStorage 而不是数据库，是因为它只是个"读过了"的标记，
 * 不值得为它写一张表；代价是换设备会再看一次 —— 对一封信来说不算问题。
 *
 * 正文取自站内页面（slug = letter），所以站主可以在后台改它，
 * 改完这里跟着变；数据库里没有时用内置初稿。
 */

const SEEN_KEY = (uid: string) => `treehole:letter:seen:${uid}`
const FADE_MS = 400

const supabase = createClient()

export function WelcomeLetter({ userId }: { userId: string | null }) {
  /*
   * 正文的初始值就是内置初稿（所以不必在 effect 里同步 setState ——
   * 那条会被 react-hooks/set-state-in-effect 拦）；
   * effect 只负责去数据库取站主改过的那份，回来再覆盖。
   */
  const fallback = findDefaultPage('letter')
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState(fallback?.title ?? '致每一位来到这里的人')
  const [body, setBody] = useState(fallback?.body ?? '')

  /* ---------- 该不该出现 ---------- */
  useEffect(() => {
    if (!userId) return

    let seen = false
    try {
      seen = window.localStorage.getItem(SEEN_KEY(userId)) === '1'
    } catch {
      // 隐私模式读不到：那就当没看过，反正也只有这一次
      seen = false
    }
    if (seen) return

    let timer: number | null = null
    const schedule = (delay: number) => {
      timer = window.setTimeout(() => setOpen(true), delay)
    }

    // 过场还在播 → 等它结束；否则直接排一个短延时
    const unsubscribe = subscribeLoginTransition((active) => {
      if (!active && timer === null) schedule(FADE_MS)
    })
    schedule(2600) // 兜底：万一没收到过场结束的通知，也在 2.6s 后出现

    return () => {
      unsubscribe()
      if (timer) window.clearTimeout(timer)
    }
  }, [userId])

  /* ---------- 取正文（数据库优先，没有就用内置初稿） ---------- */
  useEffect(() => {
    if (!open) return

    let cancelled = false
    void (async () => {
      const { data, error } = await supabase
        .from('site_pages')
        .select('title, body')
        .eq('slug', 'letter')
        .maybeSingle()
      if (cancelled || error) return
      const row = data as { title?: string; body?: string } | null
      if (row?.body) {
        if (row.title) setTitle(row.title)
        setBody(row.body)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [open])

  const close = useCallback(() => {
    setOpen(false)
    if (!userId) return
    try {
      window.localStorage.setItem(SEEN_KEY(userId), '1')
    } catch {
      /* 忽略 */
    }
  }, [userId])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/35 px-4 py-8 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="flex max-h-full w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-[var(--accent-line)] bg-[var(--paper)] shadow-[0_24px_60px_rgba(120,80,60,0.22)]">
        {/* 信头 */}
        <div className="flex items-start gap-3 border-b border-[var(--accent-line)] bg-gradient-to-br from-[var(--accent-soft)] to-[var(--accent-line)] px-6 py-4">
          <span className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-white/80">
            <Icon name="mail" className="h-4 w-4 text-[var(--accent-deep)]" />
          </span>
          <div className="min-w-0">
            <h2 className="font-serif-cn text-sm font-semibold text-[#2b2430]">{title}</h2>
            <p className="mt-0.5 text-[10.5px] text-[var(--accent-muted)]">
              只有这一次会主动弹出来，之后它就安静地待在《致每一位来到这里的人》那一页里。
            </p>
          </div>
        </div>

        {/* 正文 */}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <p className="whitespace-pre-line font-serif-cn text-[12.5px] leading-[1.95] text-[#3a3229]">
            {body}
          </p>
        </div>

        {/* 底部 */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--accent-line)] px-6 py-4">
          <Link
            href="/p/community"
            onClick={close}
            className="text-[11px] text-[var(--accent-muted)] transition hover:text-[var(--accent-deep)]"
          >
            看看《社区公约》→
          </Link>
          <button
            type="button"
            onClick={close}
            className="rounded-xl bg-gradient-to-r from-[var(--accent-light)] to-[var(--accent)] px-5 py-2 text-xs font-medium text-white transition hover:shadow-[0_6px_20px_rgba(217,119,87,0.3)]"
          >
            我记住了
          </button>
        </div>
      </div>
    </div>
  )
}
