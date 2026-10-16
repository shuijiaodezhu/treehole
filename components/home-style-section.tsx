'use client'

import { useSyncExternalStore } from 'react'
import {
  HOME_STYLE_KEY,
  HOME_STYLES,
  readHomeStyle,
  writeHomeStyle,
  type HomeStyle,
} from './home-style'

/**
 * 个性化 · 首页样式（模板页 —— 整站统一的写法示例）
 *
 * 这一块**一个色值都没写死**：只用 daisyUI 的语义类
 *   card card-border      卡片与细边（边色来自主题的 base-300）
 *   bg-base-100           卡面 = 主题的"信纸色"
 *   text-base-content/60  次要文字（自动按主题派生）
 *   radio radio-primary   单选（主色 = 主题的蜡封红）
 * → 以后要换整站配色，只改主题里那几行，这里一个字都不用动。
 *
 * 用 useSyncExternalStore 读偏好：写的时候 home-style.ts 会广播事件，
 * 所以设置页这里立刻显示选中状态，首页那边也立刻换版。
 */
function subscribe(onChange: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === HOME_STYLE_KEY) onChange()
  }
  window.addEventListener(HOME_STYLE_KEY, onChange)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(HOME_STYLE_KEY, onChange)
    window.removeEventListener('storage', onStorage)
  }
}

export function HomeStyleSection() {
  const current: HomeStyle = useSyncExternalStore(
    subscribe,
    readHomeStyle,
    () => 'current' as HomeStyle,
  )

  return (
    <section className="card card-border bg-base-100">
      <div className="card-body gap-3">
        <h2 className="card-title text-base">个性化 · 首页样式</h2>
        <p className="text-xs text-base-content/60">
          换一版首页的样子。只存在这台设备上，别人看不到。
        </p>

        <div className="mt-1 space-y-2">
          {HOME_STYLES.map((item) => {
            const active = item.value === current
            return (
              <label
                key={item.value}
                className={
                  'flex cursor-pointer items-start gap-3 rounded-box border p-3 transition ' +
                  (active
                    ? 'border-primary bg-primary/5'
                    : 'border-base-300 hover:border-primary/60')
                }
              >
                <input
                  type="radio"
                  name="treehole-home-style"
                  className="input radio radio-sm radio-primary mt-0.5"
                  checked={active}
                  onChange={() => writeHomeStyle(item.value)}
                />
                <span className="min-w-0">
                  <span className="flex items-baseline gap-2">
                    <span className="text-sm">{item.label}</span>
                    {active && <span className="badge badge-primary badge-xs">当前</span>}
                  </span>
                  <span className="mt-0.5 block text-xs text-base-content/60">{item.desc}</span>
                </span>
              </label>
            )
          })}
        </div>
      </div>
    </section>
  )
}
