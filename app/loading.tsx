/**
 * 首屏加载动画
 *
 * Next.js 在路由段加载时自动显示这个（app/loading.tsx）。
 * 一封信在飞（左侧几道速度线），轻轻上下浮动。
 */

export default function Loading() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-[var(--paper)]">
      <svg
        className="animate-float h-14 w-14 text-[var(--accent)]"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        {/* 速度线 */}
        <g stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.45">
          <path d="M0.9 8.4h2.2" />
          <path d="M0.4 12h1.8" />
          <path d="M1.1 15.6h2" />
        </g>
        {/* 信封 */}
        <rect x="5" y="6.5" width="16" height="11" rx="1.8" stroke="currentColor" strokeWidth="1.7" />
        <path
          d="M5.7 7.2 13 12.3 20.3 7.2"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="13" cy="12.8" r="1.25" fill="currentColor" />
      </svg>

      <p className="font-serif-cn text-xs tracking-wide text-[var(--accent-muted)]">正在打开…</p>
    </div>
  )
}
