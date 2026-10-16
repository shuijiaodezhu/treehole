'use client'

import { useEffect, useState } from 'react'
import { clearJustLoggedIn } from './login-handoff'

/**
 * 登录过场：一封长信封从左侧飞来、翻开盖子，然后化开露出主页
 *
 * 关键设计：这个覆盖层挂在**根 layout** 上，不在登录页里。
 * 原因是登录成功后会**立刻换页**（让主页在后面开始加载数据），
 * 覆盖层若挂在登录页里会随页面一起被卸载，动画就断了。
 * 挂在 layout 上它就能横跨整次跳转，动画从头到尾不断。
 *
 * 时间线（从 startLoginTransition() 起算）：
 *   0.00s  登录页两边淡出（登录页自己加 .th-page-out，0.34s）
 *   0.28s  纸色幕布淡入（把后面正在加载的主页盖住，避免露出骨架屏）
 *   0.45s  登录页执行 router.push('/') —— 幕布已经盖上了
 *   0.40s  信封飞入（0.6s，带一点回弹）
 *   1.05s  封盖翻开（0.46s）
 *   1.75s  整幕淡出（0.45s）
 *   2.20s  覆盖层自行卸载，标记一并清掉
 *
 * 于是观感是：两边淡出 → 幕布合上 → 信封飞来翻开 → 幕布化开，
 * 后面已经是**加载完成的主页**，中间不会闪出骨架屏。
 *
 * 系统开了「减少动态效果」时不做动画，直接换页。
 */

const TOTAL_MS = 2200
const REDUCED_MS = 150
/** 等登录页两边淡完就换页 */
const NAVIGATE_MS = 450

type Listener = (active: boolean) => void

let transitioning = false
const listeners = new Set<Listener>()

function notify() {
  for (const l of listeners) l(transitioning)
}

/** 登录成功后调用：开始过场（覆盖层在 layout 上，会横跨跳转继续播） */
export function startLoginTransition() {
  if (transitioning) return
  transitioning = true
  notify()
}

/** 等两边淡完再换页；返回给调用方做 router.push 用 */
export function loginNavigateDelay(): number {
  if (typeof window === 'undefined') return 0
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? REDUCED_MS : NAVIGATE_MS
}

/** 现在是否正在播过场（首次登录那封信要等它结束再出现） */
export function isLoginTransitioning(): boolean {
  return transitioning
}

/**
 * 订阅过场状态（true = 正在播）。
 * 给「等动画放完再出现」的东西用，比如首次登录后那封信。
 * 返回值是退订函数。
 */
export function subscribeLoginTransition(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function LoginTransitionOverlay() {
  const [active, setActive] = useState(transitioning)

  useEffect(() => {
    const listener: Listener = (next) => setActive(next)
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }, [])

  // 播完自行卸载，并清掉「刚登录完」标记
  useEffect(() => {
    if (!active) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const timer = window.setTimeout(
      () => {
        transitioning = false
        clearJustLoggedIn()
        notify()
      },
      reduce ? REDUCED_MS : TOTAL_MS,
    )
    return () => window.clearTimeout(timer)
  }, [active])

  if (!active) return null

  return (
    <div
      aria-hidden="true"
      className="th-overlay-out pointer-events-none fixed inset-0 z-[80] flex items-center justify-center"
    >
      {/* 纸色幕布：换页前淡入，把后面正在加载的主页盖住 */}
      <div className="th-veil absolute inset-0 bg-[var(--paper)]" />

      {/* 长信封：简笔画，只有粗描边外框 + 一个 V 形封盖 */}
      <div className="th-envelope-in relative" style={{ perspective: '1200px' }}>
        <div className="relative h-[200px] w-[340px]">
          <div className="absolute inset-0 rounded-[26px] border-[5px] border-primary bg-base-content/5" />

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
