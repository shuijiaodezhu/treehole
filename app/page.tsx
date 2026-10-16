'use client'

import { useSyncExternalStore } from 'react'
import { HomeCurrent } from '../components/home-current'
import { HomeClassic } from '../components/home-classic'
import { HOME_STYLE_KEY, readHomeStyle, type HomeStyle } from '../components/home-style'

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

export default function HomePage() {
  const style: HomeStyle = useSyncExternalStore(
    subscribe,
    readHomeStyle,
    () => 'current' as HomeStyle,
  )

  return style === 'classic' ? <HomeClassic /> : <HomeCurrent />
}
