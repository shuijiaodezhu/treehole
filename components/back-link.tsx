'use client'

/**
 * 统一的「← 返回」
 *
 * 为什么需要它（真事故）：
 *   以前各页面的返回都是**写死**的链接（比如「我的」直接 href="/"）
 *   → 从通知点进「我的」，按返回**必然回首页** ✗
 *   → 用户的原话：「点击消息然后返回还是会切到主页」
 *
 * 正确做法：
 *   · 有历史（是"点进来的"）→ **回到来时的页面** ✓
 *   · 没有历史（直接打开这个网址）→ 回 fallback（逻辑上的父页）✓
 *
 * 用 history.length 判断"有没有上一页"：够用且不会误判
 *   （点进来必然 ≥ 2；新标签页直接打开通常是 1）
 */

import { useRouter } from 'next/navigation'

export function BackLink({
  fallback,
  label = '← 返回',
  className,
}: {
  /** 没有上一页时去哪儿（比如「我的」回首页） */
  fallback: string
  /** 文字，默认「← 返回」 */
  label?: string
  /** 样式，默认和其他页面保持一致 */
  className?: string
}) {
  const router = useRouter()

  return (
    <button
      type="button"
      onClick={() => {
        try {
          if (typeof window !== 'undefined' && window.history.length > 1) {
            router.back()
            return
          }
        } catch {
          /* 读不到 history 就走 fallback */
        }
        router.push(fallback)
      }}
      className={
        className ?? 'text-sm text-base-content/60 transition hover:text-primary'
      }
    >
      {label}
    </button>
  )
}
