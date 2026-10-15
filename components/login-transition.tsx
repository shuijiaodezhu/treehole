'use client'

import { useEffect, useRef } from 'react'

/**
 * 登录成功后的过场动画
 *
 * 顺序：两边文字与登录框淡出（登录页自己加 .th-page-out）
 *   → 0.18s 一封长信封用 0.6s 从左边斜着飞进来、带一点回弹
 *   → 0.82s 封盖绕顶边翻开（就是「打开」的那一下）
 *   → 1.50s 整幕淡出并轻微放大，同时跳到主页
 *   → 1.85s 调用 onDone（router.push('/')）
 *
 * 造型上刻意做减法：**简笔画的信封**——只有粗描边的外框 + 一个 V 形封盖，
 * 不放信纸（放信纸反而啰嗦），也没有柔光和投影，就是几根线。
 * 颜色取自当前页面的主色系，所以不会在暖色纸底上跳出一块白。
 *
 * 覆盖层故意**不加背景色**：底下的登录页要能被看见地淡出。
 * 系统开了「减少动态效果」时直接跳转（动画由 globals.css 关掉）。
 */

const TOTAL_MS = 1850
const REDUCED_MS = 120

/** 信封比例偏长：340 × 200 */
const ENV_W = 340
const ENV_H = 200

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
      <div className="th-envelope-in" style={{ perspective: '1200px' }}>
        <div className="relative" style={{ width: ENV_W, height: ENV_H }}>
          {/* 信封体：粗描边 + 极淡的暖色底 */}
          <div className="absolute inset-0 rounded-[26px] border-[5px] border-[var(--accent)] bg-[var(--accent-soft)]" />

          {/* 封盖：一个 V，绕顶边翻开就是「打开」 */}
          <div className="th-flap absolute inset-x-0 top-0 z-10 origin-top">
            <svg viewBox="0 0 340 100" className="block h-[100px] w-full" fill="none">
              <path
                d="M7 7 L170 95 L333 7"
                stroke="var(--accent)"
                strokeWidth="5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>
      </div>
    </div>
  )
}
