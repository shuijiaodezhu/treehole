'use client'

import { useEffect, useRef } from 'react'

/**
 * 登录成功后的过场动画
 *
 * 顺序：两边文字与登录框淡出（登录页自己加 .th-page-out）
 *   → 0.20s 一封信用 0.62s 从左边斜着飞进来、带一点回弹
 *   → 0.90s 信封盖绕顶边翻开
 *   → 1.06s 里面的信纸升起来
 *   → 1.78s 整幕淡出并轻微放大，同时跳到主页
 *   → 2.15s 调用 onDone（router.push('/')）
 *
 * 覆盖层故意**不加背景色**：底下的登录页要能被看见地淡出，
 * 信封是飞在正在淡出的页面上的。
 *
 * 系统开了「减少动态效果」时直接跳转（动画由 globals.css 关掉）。
 */

const TOTAL_MS = 2150
const REDUCED_MS = 120

export function LoginTransition({ onDone }: { onDone: () => void }) {
  // 用 ref 存回调，避免父组件重渲染时把定时器重置掉
  // （在 effect 里更新，渲染期间不写 ref）
  const doneRef = useRef(onDone)

  useEffect(() => {
    doneRef.current = onDone
  }, [onDone])

  useEffect(() => {
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const timer = window.setTimeout(() => doneRef.current(), reduce ? REDUCED_MS : TOTAL_MS)
    return () => window.clearTimeout(timer)
  }, [])

  return (
    <div
      aria-hidden="true"
      className="th-overlay-out pointer-events-none fixed inset-0 z-[80] flex items-center justify-center"
    >
      <div className="th-envelope-in" style={{ perspective: '760px' }}>
        <div className="relative h-[124px] w-[180px]">
          {/* 信封背板 */}
          <div className="absolute inset-0 rounded-2xl border-2 border-[var(--accent)] bg-white" />

          {/* 信纸（升起来的那张） */}
          <div className="th-letter absolute inset-x-4 bottom-3 top-3 z-10 rounded-lg border border-[var(--accent-line)] bg-[var(--accent-soft)]">
            <div className="mx-3.5 mt-5 space-y-2">
              <span className="block h-1.5 w-4/5 rounded-full bg-white/80" />
              <span className="block h-1.5 w-3/5 rounded-full bg-white/80" />
              <span className="block h-1.5 w-2/5 rounded-full bg-white/80" />
            </div>
          </div>

          {/* 信封前袋：挡住信纸下半截，做出「从信封里抽出来」的感觉 */}
          <div className="absolute inset-x-0 bottom-0 z-20 h-[60%] rounded-b-2xl border-2 border-t-0 border-[var(--accent)] bg-white" />

          {/* 信封盖 */}
          <div className="th-flap absolute inset-x-0 top-0 z-30 origin-top">
            <svg viewBox="0 0 180 54" className="block h-[54px] w-full" fill="none">
              <path
                d="M4 4 L90 51 L176 4"
                stroke="var(--accent)"
                strokeWidth="2.5"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>
      </div>
    </div>
  )
}
