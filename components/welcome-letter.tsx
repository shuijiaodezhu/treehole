'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '../app/lib/supabase'
import { findDefaultPage } from './site-page-defaults'
import { Icon } from './icons'
import { isLoginTransitioning, subscribeLoginTransition } from './login-transition'

/**
 * 致每一位来到这里的人（登录后浮出的一封信）
 *
 * 出现规则：**记住"读过哪一版"**。
 *   · 浏览器里存的是这封信内容的指纹（不是简单的 1/0）
 *   · 指纹和分析当前内容算出来的不一致 → 说明信改过了 → 再出现一次
 *   · 一致 → 什么都不做
 *   所以：平时只出现一次；你改过这封信，读过的人下次登录会看到新版。
 *   （第一版存的是 '1'，和任何指纹都不相等，所以已经读过的人会再看一次新版 ——
 *     这正好符合"内容改了才再出现"。）
 *
 * 出现时机：**信封过场放完之后**。
 *   · 订阅 login-transition 的状态，过场结束再等 400ms 淡入，
 *     不写死延时——系统开了「减少动态效果」时过场只有 150ms，这里也跟着提前
 *   · 不是刚登录进来的（刷新、或本来就在站里）→ 直接 400ms 后出现
 *   · 另有 2.6s 兜底，万一没收到过场结束的通知也不会一直不出来
 *
 * 正文本着"内容改了才再出现"的规则，所以**挂载时就取**（不等打开才取），
 * 这样等过场那两秒里请求早回来了，不会因为网络慢而拖延弹窗。
 * 正文取自站内页面（slug = letter），站主可以在后台改，改完指纹变了，
 * 大家下次登录就会看到新版。
 */

const SEEN_KEY = (uid: string) => `treehole:letter:seen:${uid}`

const supabase = createClient()

/** 内容指纹：够用就行，不需要加密强度 */
function fingerprint(title: string, body: string): string {
  const text = title + '\u0000' + body
  let h1 = 0x811c9dc5
  let h2 = 0x01000193
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i)
    h1 = Math.imul(h1 ^ c, 16777619) >>> 0
    h2 = Math.imul(h2 + c, 2246822519) >>> 0
  }
  return `${h1.toString(36)}-${h2.toString(36)}-${text.length.toString(36)}`
}

type Letter = { title: string; body: string; sig: string }

export function WelcomeLetter({ userId }: { userId: string | null }) {
  /*
   * 初始值就用内置初稿（惰性初始化）—— 这样不必在 effect 里同步 setState，
   * react-hooks/set-state-in-effect 不会拦，也少一次多余渲染。
   * effect 只负责去数据库取站主改过的那份。
   */
  const [letter, setLetter] = useState<Letter | null>(() => {
    const builtin = findDefaultPage('letter')
    if (!builtin) return null
    return {
      title: builtin.title,
      body: builtin.body,
      sig: fingerprint(builtin.title, builtin.body),
    }
  })
  const [open, setOpen] = useState(false)

  /* ---------- 挂载就取正文（数据库优先，没有就用内置初稿） ---------- */
  useEffect(() => {
    const builtin = findDefaultPage('letter')

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
        const title = row.title || builtin?.title || '致每一位来到这里的人'
        setLetter({ title, body: row.body, sig: fingerprint(title, row.body) })
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  /* ---------- 该不该出现：比对指纹 ---------- */
  useEffect(() => {
    if (!userId || !letter) return

    let read = ''
    try {
      read = window.localStorage.getItem(SEEN_KEY(userId)) ?? ''
    } catch {
      // 隐私模式读不到：那就当没读过，出现一次
      read = ''
    }
    if (read === letter.sig) {
      // 这封信不用弹了：也通知首页，标题照样"写"一遍
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('dsh:letter-done'))
      return
    }

    /*
     * 它现在是一道**门**，所以不留 400ms 的余地：
     *   · 过场还在播 → 等它结束，结束就立刻出现（过场本来就把屏幕盖住了，不会露馅）
     *   · 没有过场（刷新、或本来就在站里）→ 立刻出现
     * 早先那版是"浮层"，等 400ms 淡入更好看；现在铺满整屏，
     * 那 400ms 反而会先闪一下主页，所以去掉。
     */
    let timer: number | null = null
    const show = () => setOpen(true)

    if (isLoginTransitioning()) {
      const unsubscribe = subscribeLoginTransition((active) => {
        if (!active) show()
      })
      scheduleFallback()
      return () => {
        unsubscribe()
        if (timer) window.clearTimeout(timer)
      }
    }

    show()
    return undefined

    /** 万一没收到过场结束的通知，也别一直不出现 */
    function scheduleFallback() {
      timer = window.setTimeout(show, 2600)
    }
  }, [userId, letter])

  /* ---------- 开门期间锁住背景滚动 ---------- */
  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  const close = useCallback(() => {
    setOpen(false)
    // 通知首页：信看完了，标题可以开始"写"了
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('dsh:letter-done'))
    if (!userId || !letter) return
    try {
      // 存指纹，不是存 '1'：下次内容变了就会不一样
      window.localStorage.setItem(SEEN_KEY(userId), letter.sig)
    } catch {
      /* 忽略 */
    }
  }, [userId, letter])

  if (!open || !letter) return null

  /*
   * 铺满整屏、不透明：这是一道门，不是浮层。
   * 主页在它后面（数据已经加载好了），但看不到也点不到；
   * 点「我记住了」才把它撤掉 —— 所以"确认过才进主页"。
   */
  return (
    <div
      className="animate-fade-in fixed inset-0 z-[60] flex flex-col bg-[var(--paper)]"
      role="dialog"
      aria-modal="true"
      aria-label={letter.title}
    >
      {/* 信头 */}
      <div className="flex flex-shrink-0 items-start gap-3 border-b border-base-300 bg-primary/5 px-6 py-5">
        <span className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-base-100/80">
          <Icon name="mail" className="h-4 w-4 text-primary" />
        </span>
        <div className="mx-auto min-w-0 max-w-xl flex-1">
          <h2 className="font-serif-cn text-sm font-semibold text-base-content">{letter.title}</h2>
          <p className="mt-0.5 text-[11.5px] text-base-content/60">
            读完点下面的按钮就好 —— 它不常出现，只在内容更新后露一次面。
          </p>
        </div>
        {/* 和信头左边图标占位对称，让标题居中那一列对齐 */}
        <span className="hidden h-9 w-9 flex-shrink-0 sm:block" aria-hidden="true" />
      </div>

      {/* 正文：可滚动，居中一列 */}
      <div data-lenis-prevent className="min-h-0 flex-1 overflow-y-auto px-6 py-8">
        <p className="mx-auto max-w-xl whitespace-pre-line font-serif-cn text-[12.5px] leading-[1.95] text-base-content">
          {letter.body}
        </p>
      </div>

      {/* 底部：确认 */}
      <div className="flex-shrink-0 border-t border-base-300 bg-base-100/70 px-6 py-4">
        <div className="mx-auto flex max-w-xl flex-wrap items-center justify-between gap-3">
          <Link
            href="/p/community"
            onClick={close}
            className="text-[11px] text-base-content/60 transition hover:text-primary"
          >
            看看《社区公约》→
          </Link>
          <button
            type="button"
            onClick={close}
            className="btn btn-primary btn-sm transition hover:shadow-sm"
          >
            我记住了，进去吧
          </button>
        </div>
      </div>
    </div>
  )
}
