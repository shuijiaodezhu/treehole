/**
 * 首屏加载动画
 *
 * Next.js 在路由段加载时自动显示这个（app/loading.tsx）。
 * 用和表情按钮同一个可爱笑脸，轻轻呼吸，配一句「正在打开」。
 */

export default function Loading() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-[var(--paper)]">
      <svg
        className="animate-breathe h-14 w-14 text-[var(--accent)]"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9.2" stroke="currentColor" strokeWidth="1.4" />
        <path d="M8.4 10.5A1.2 1.05 0 0 1 10.8 10.5A1.2 0.35 0 0 0 8.4 10.5Z" fill="currentColor" />
        <path d="M13.2 10.5A1.2 1.05 0 0 1 15.6 10.5A1.2 0.35 0 0 0 13.2 10.5Z" fill="currentColor" />
        <path
          d="M9 14.2A3 1.35 0 0 0 15 14.2"
          stroke="currentColor"
          strokeWidth="1.15"
          strokeLinecap="round"
        />
        <circle cx="6.9" cy="13" r="0.85" fill="currentColor" opacity="0.32" />
        <circle cx="17.1" cy="13" r="0.85" fill="currentColor" opacity="0.32" />
      </svg>

      <p className="font-serif-cn text-xs tracking-wide text-[var(--accent-muted)]">正在打开…</p>
    </div>
  )
}
