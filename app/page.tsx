'use client'

import { useEffect, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import { HomeCurrent } from '../components/home-current'
import { HomeClassic } from '../components/home-classic'
import { HomeDesktop } from '../components/home-desktop'
import { HOME_STYLE_KEY, readHomeStyle, type HomeStyle } from '../components/home-style'
import { markRedirectingToLogin } from '../components/login-handoff'
import { createClient } from './lib/supabase'
import './v4-skin.css'

/**
 * 首页 —— 按屏幕宽度决定给哪一套：
 *
 *   ≥1101px（电脑）→ <HomeDesktop />：液态玻璃 + 深色窄栏 + 冬日视频（正式版）
 *   ≤1100px（手机）→ 原来的首页，完全不动（个性化里的 current / classic 只在这边生效）
 *
 * 为什么用 useSyncExternalStore 读宽度：
 *   · matchMedia 是"浏览器里的外部状态"，这是它的正规写法；
 *   · 服务端没有宽度 → getServerSnapshot 给 null，先渲染一行"正在展开这封信…"
 *     （和原来首页的加载态长得一模一样），水合之后才切成 v4 或原首页，两边都不闪错版。
 *
 * 电脑端仍然保持原来的规矩：没登录先去登录页。
 *
 * 个性化（current / classic）：
 *   current（默认）—— 毛笔标题 + 卡片 + 引言/信箱/雪中分别
 *   classic        —— 最初那版：左栏三张卡 + 四张彩色渐变卡
 */
function subscribe(onChange: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === HOME_STYLE_KEY) onChange()
  }
  window.addEventListener('treehole:home-style', onChange)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener('treehole:home-style', onChange)
    window.removeEventListener('storage', onStorage)
  }
}

const DESKTOP_QUERY = '(min-width: 1101px)'

function subscribeViewport(onChange: () => void): () => void {
  const mq = window.matchMedia(DESKTOP_QUERY)
  mq.addEventListener('change', onChange)
  return () => mq.removeEventListener('change', onChange)
}

/** true = 电脑版；false = 手机版；null = 还不知道（服务端/首帧）*/
function useIsDesktop(): boolean | null {
  return useSyncExternalStore<boolean | null>(
    subscribeViewport,
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => null,
  )
}

/** 首帧的过渡：和原来首页的加载态同一句话，换版时不至于闪一块空白 */
function HomeBoot() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-base-100">
      <p className="font-serif-cn text-sm tracking-[0.1em] text-base-content/35 animate-pulse">
        正在展开这封信…
      </p>
    </div>
  )
}

/**
 * 电脑版外壳：界面立刻给出来（不闪加载页），登录校验在背后跑；
 * 确实没登录就照原来的规矩送去 /login。
 */
function DesktopHome() {
  const router = useRouter()

  useEffect(() => {
    let alive = true
    void createClient()
      .auth.getUser()
      .then(({ data }) => {
        if (!alive) return
        if (data.user) return
        markRedirectingToLogin()
        router.replace('/login')
      })
      .catch(() => {
        if (!alive) return
        markRedirectingToLogin()
        router.replace('/login')
      })
    return () => {
      alive = false
    }
  }, [router])

  return <HomeDesktop />
}

export default function HomePage() {
  const style: HomeStyle = useSyncExternalStore(
    subscribe,
    readHomeStyle,
    () => 'current' as HomeStyle,
  )
  const isDesktop = useIsDesktop()

  // 还不知道宽窄：给一行加载字（电脑/手机看到的是同一个，水合后各自切换）
  if (isDesktop === null) return <HomeBoot />

  // 电脑：就是那个 v4 界面（它自带冬日视频背景与玻璃外壳）
  if (isDesktop) return <DesktopHome />

  // 手机：原来的首页，一个字节都没动
  return (
    <div className={"th-v4skin"}>
      <div className={"v4-bg"}>
        <video className={"v4-video"} autoPlay muted loop playsInline preload="auto">
          <source src="/bg-winter.mp4" type="video/mp4" />
        </video>
        <div className={"v4-scrim"} />
        <div className={"v4-glow v4-glow1"} />
        <div className={"v4-glow v4-glow2"} />
        <div className={"v4-glow v4-glow3"} />
      </div>
      <div className={"th-v4skin-inner"}>
        {style === 'classic' ? <HomeClassic /> : <HomeCurrent />}
      </div>
    </div>
  )
}
