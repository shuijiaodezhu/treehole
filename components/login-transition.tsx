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
 * 配色：全部取自当前页面的主色系，**不用纯白**——
 *   信封体 accent-soft（最淡）/ 内里 accent-line / 信纸 accent-light /
 *   封盖 accent-light，各层靠 accent 描边分开，在暖色纸底上不会跳出来一块白。
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
      <div className="th-envelope-in" style={{ perspective: '1100px' }}>
        {/* 背后一层柔光，让信封像浮起来 */}
        <div className="relative">
          <div className="absolute -inset-14 rounded-full bg-[var(--accent-soft)] blur-3xl" />

          <div className="relative h-[184px] w-[280px]">
            {/* 信封体 */}
            <div className="absolute inset-0 rounded-[22px] border-[3px] border-[var(--accent)] bg-[var(--accent-soft)] shadow-[0_28px_60px_-22px_rgba(80,50,35,0.3)]" />

            {/* 内里 */}
            <div className="absolute inset-x-[9px] top-[7px] h-[44%] rounded-[14px] bg-[var(--accent-line)]" />

            {/* 信纸（升起来的那张，暖色，不是白纸） */}
            <div className="th-letter absolute inset-x-[24px] bottom-[16px] top-[12px] z-10 rounded-[14px] border-2 border-[var(--accent)] bg-[var(--accent-light)]">
              <div className="mx-4 mt-5 space-y-2.5">
                <span className="block h-[5px] w-[78%] rounded-full bg-[var(--accent-soft)]" />
                <span className="block h-[5px] w-[58%] rounded-full bg-[var(--accent-soft)]" />
                <span className="block h-[5px] w-[38%] rounded-full bg-[var(--accent-soft)]" />
              </div>
            </div>

            {/* 信封前袋 + 袋口横线 */}
            <div className="absolute inset-x-0 bottom-0 top-[42%] z-20 rounded-b-[22px] border-[3px] border-t-0 border-[var(--accent)] bg-[var(--accent-soft)]" />
            <div className="absolute inset-x-0 top-[42%] z-20 h-[3px] bg-[var(--accent)]" />

            {/* 信封盖：绕顶边翻开 */}
            <div className="th-flap absolute inset-x-0 top-0 z-30 origin-top">
              <svg viewBox="0 0 280 88" className="block h-[88px] w-full" fill="none">
                <polygon
                  points="3,3 140,86 277,3"
                  fill="var(--accent-light)"
                  stroke="var(--accent)"
                  strokeWidth="3"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
