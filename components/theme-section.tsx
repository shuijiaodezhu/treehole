'use client'

import { useSyncExternalStore } from 'react'
import {
  DEFAULT_THEME,
  THEMES,
  readTheme,
  serverTheme,
  subscribeTheme,
  writeTheme,
} from './themes'

/**
 * 主题选择（放在 我的 → 设置 → 个性化 里）
 *
 * 交互上注意的几件事：
 *   · 点一下就换 ✓ 不用刷新、不用确认、不用"保存"按钮（写本地 + 派发事件）
 *   · 每个选项卡**自带真实预览**：卡上套 data-theme="…"，
 *     里面的色块用的是那套主题**真实的**变量 —— 不是画出来的假图 ✓
 *   · 用真的 radio ✓ 键盘方向键能切 ✓ 选中态是明确的环 ✓
 *   · 只过渡颜色 160ms ✓ 不跳动、不缩放（你之前说过不要"跳"）
 */
export function ThemeSection() {
  const current = useSyncExternalStore(subscribeTheme, readTheme, serverTheme)

  return (
    <section className="card card-border bg-base-100 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-serif-cn text-[15px]">
            主题
          </h2>
          <p className="mt-1 text-[12px] leading-relaxed text-base-content/60">
            换的是纸、卡、墨和强调色。每个地方自己的颜色（院子绿、我的紫）不受影响。
          </p>
        </div>
        <span className="badge badge-sm badge-ghost">
          {THEMES.find((t) => t.id === current)?.name ?? DEFAULT_THEME}
        </span>
      </div>

      <div
        role="radiogroup"
        aria-label="选择主题"
        className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4"
      >
        {THEMES.map((t) => {
          const active = t.id === current
          return (
            <label
              key={t.id}
              data-theme={t.id}
              className={
                'group relative cursor-pointer rounded-box bg-[var(--sheet)] p-3 transition-colors duration-150 ' +
                (active ? 'ring-2 ring-[var(--wax)]' : 'hover:bg-[var(--card)]')
              }
            >
              <input
                type="radio"
                name="theme"
                value={t.id}
                checked={active}
                onChange={() => writeTheme(t.id)}
                className="sr-only"
              />
              {/* 真实预览：这四个色块就是这套主题的纸 / 卡 / 墨 / 强调色 */}
              <span className="flex items-center gap-1.5" aria-hidden="true">
                <span className="theme-swatch theme-swatch-bg h-6 w-6 ring-1 ring-[var(--line)]" />
                <span className="theme-swatch theme-swatch-card h-6 w-6 ring-1 ring-[var(--line)]" />
                <span className="theme-swatch theme-swatch-ink h-6 w-6" />
                <span className="theme-swatch theme-swatch-accent h-6 w-6" />
              </span>
              <span className="mt-2 block text-[13px] font-medium text-[var(--ink)]">
                {t.name}
              </span>
              <span className="mt-0.5 block text-[11px] leading-snug text-[var(--muted)]">
                {t.desc}
              </span>
            </label>
          )
        })}
      </div>
    </section>
  )
}
