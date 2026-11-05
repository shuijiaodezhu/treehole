'use client'

import { useSyncExternalStore } from 'react'
import V4Page from './v4/page'
import { useEffect, useState } from 'react'
import { HomeCurrent } from '../components/home-current'
import { HomeClassic } from '../components/home-classic'
import { HOME_STYLE_KEY, readHomeStyle, type HomeStyle } from '../components/home-style'
import './v4-skin.css'

/**
 * 首页 —— 只做一件事：按"个性化"里选的样式，渲染对应的一版。
 *
 * 两种样式：
 *   current（默认）—— 现在的版本：毛笔标题 + 卡片 + 引言/信箱/雪中分别
 *   classic        —— 最初那版（用得最久的）：左栏三张卡 + 四张彩色渐变卡
 *
 * 为什么用 useSyncExternalStore，而不是 useEffect + setState：
 *   · 在 effect 里同步 setState 会触发级联渲染（eslint 的
 *     react-hooks/set-state-in-effect 会直接报错），首帧还会先渲染默认值再跳一下；
 *   · useSyncExternalStore 是"读浏览器里的外部状态"的正规写法：
 *     服务端给 getServerSnapshot（默认 current），客户端读 localStorage，
 *     既不水合不一致、也不闪。
 *
 * 切换能**立刻生效**：写偏好时会 dispatch 一个同名事件（见 home-style.ts）。
 *
 * v4 皮肤：外面这层 th-v4skin 负责冬日视频背景 + 把白面板换成暖色玻璃，
 * 具体规则都在 app/v4-skin.css。不想要就删掉这个 class 和那个文件。
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

/** 桌面判宽：≥1101px 走 v4 正式版；窄屏保持原来的手机版 */
function useIsDesktop(): boolean {
  const [wide, setWide] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1101px)')
    const on = () => setWide(mq.matches)
    const f = window.requestAnimationFrame(on)
    mq.addEventListener('change', on)
    return () => {
      window.cancelAnimationFrame(f)
      mq.removeEventListener('change', on)
    }
  }, [])
  return wide
}

export default function HomePage() {
  const wide = useIsDesktop()
  const style: HomeStyle = useSyncExternalStore(
    subscribe,
    readHomeStyle,
    () => 'current' as HomeStyle,
  )

  /* 桌面：/v4 正式版 */
  if (wide) return <V4Page />

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
