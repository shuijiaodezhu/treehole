'use client'

import { useEffect, useState } from 'react'

/**
 * 登录 → 主页的交接
 *
 * 需求来自实际观感：
 *   1. 登录那段信封动画本身已经表达了「正在加载」，
 *      所以紧接着打开主页时**不要再出现一次首屏加载动画**（重复、啰嗦）。
 *      但平常点导航切页面时，首屏加载动画要照旧。
 *   2. 登录后目标页要**整体淡入**，和登录页的淡出一呼一应；
 *      平常切到主页则保持原样，不加任何额外效果。
 *
 * 做法：登录成功跳转前往 sessionStorage 放一个**带时间戳**的标记，
 * 目标页读一次就清掉。
 *   · 带时间戳：万一标记没被消费掉（比如登录后立刻关了标签），
 *     5 秒后自然失效，不会在下次进站时误播一次淡入。
 *   · 放 sessionStorage 而不是 localStorage：只在这一个标签页里有效。
 *
 * 为什么要等 effect 再判断，而不是直接在渲染时读：
 * app/loading.tsx 会被预渲染进 HTML，渲染期读 sessionStorage 会导致
 * 服务端与客户端首帧不一致（hydration 报错）。
 */

const KEY = 'treehole:justLoggedIn'
const TTL_MS = 5000

/** 登录成功、跳转之前调用 */
export function markJustLoggedIn() {
  try {
    window.sessionStorage.setItem(KEY, String(Date.now()))
  } catch {
    /* 隐私模式下写不了，忽略：只是少一次淡入而已 */
  }
}

function peekJustLoggedIn(): boolean {
  try {
    const raw = window.sessionStorage.getItem(KEY)
    if (!raw) return false
    const at = Number(raw)
    if (!Number.isFinite(at) || Date.now() - at > TTL_MS) {
      window.sessionStorage.removeItem(KEY)
      return false
    }
    return true
  } catch {
    return false
  }
}

/** 清掉标记（过场结束时调用：此后 loading 动画恢复正常） */
export function clearJustLoggedIn() {
  try {
    window.sessionStorage.removeItem(KEY)
  } catch {
    /* 忽略 */
  }
}

/** 首屏加载动画；刚登录完的那一次不显示（登录动画已经表达过加载了） */
export function AppLoading() {
  // 默认显示：与服务端一致（loading 会被预渲染进 HTML），
  // 所以硬加载慢路由时照旧立刻有动画，不会白一帧。
  // 客户端挂载后再看标记——刚登录完那一次才藏掉。
  const [show, setShow] = useState(true)

  useEffect(() => {
    // 只「看」不「消费」——标记要留给目标页播淡入
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (peekJustLoggedIn()) setShow(false)
  }, [])

  if (!show) return null

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-[var(--paper)]">
      <svg
        className="animate-float h-14 w-14 text-primary"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        {/* 速度线 */}
        <g stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.45">
          <path d="M0.9 8.4h2.2" />
          <path d="M0.4 12h1.8" />
          <path d="M1.1 15.6h2" />
        </g>
        {/* 信封 */}
        <rect x="5" y="6.5" width="16" height="11" rx="1.8" stroke="currentColor" strokeWidth="1.7" />
        <path
          d="M5.7 7.2 13 12.3 20.3 7.2"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="13" cy="12.8" r="1.25" fill="currentColor" />
      </svg>

      <p className="font-serif-cn text-xs tracking-wide text-base-content/60">正在打开…</p>
    </div>
  )
}
