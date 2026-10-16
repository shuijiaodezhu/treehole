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
 * 个性化 · 首页样式
 *
 * 为什么放这里：这是"每个人自己喜欢什么"，不是账号资料 ——
 * 所以只存在浏览器本地，不进数据库（换设备会回到默认，这是有意的）。
 *
 * 用 useSyncExternalStore 读：写的时候 home-style.ts 会广播事件，
 * 于是设置页这里**立刻**显示选中状态，首页那边也**立刻**换版。
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
    <section className="rounded-2xl border border-[var(--accent-line)] bg-white p-6 shadow-sm">
      <h2 className="text-sm font-semibold text-[#2b2430]">个性化 · 首页样式</h2>
      <p className="mt-1 text-xs text-[var(--accent-muted)]">
        换一版首页的样子。只存在这台设备上，别人看不到。
      </p>

      <div className="mt-4 space-y-2">
        {HOME_STYLES.map((item) => {
          const active = item.value === current
          return (
            <button
              key={item.value}
              type="button"
              onClick={() => writeHomeStyle(item.value)}
              aria-pressed={active}
              className={
                'flex w-full items-start gap-3 rounded-xl border p-3 text-left transition ' +
                (active
                  ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
                  : 'border-[var(--accent-line)] hover:border-[var(--accent)]')
              }
            >
              {/* 单选点 */}
              <span
                className={
                  'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ' +
                  (active ? 'border-[var(--accent)]' : 'border-[var(--accent-line)]')
                }
              >
                {active && <span className="h-2 w-2 rounded-full bg-[var(--accent)]" />}
              </span>
              <span className="min-w-0">
                <span className="block text-sm text-[#2b2430]">{item.label}</span>
                <span className="mt-0.5 block text-xs text-[var(--accent-muted)]">{item.desc}</span>
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
