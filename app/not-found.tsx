import Link from 'next/link'

/**
 * 404 页面
 *
 * 不用 Next.js 默认那套黑白样式，做成「信寄丢了」的语气，
 * 保留回首页与去条款页的入口。
 */

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--paper)] px-6">
      <div className="animate-fade-up w-full max-w-md text-center">
        {/* 一张飘走的信 */}
        <svg
          className="animate-float mx-auto h-24 w-24 text-primary"
          viewBox="0 0 64 64"
          fill="none"
          aria-hidden="true"
        >
          <rect x="10" y="20" width="44" height="30" rx="4" stroke="currentColor" strokeWidth="1.6" />
          <path d="M10 24l22 15 22-15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <path
            d="M18 14c2-3 6-4 9-2"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            opacity="0.5"
          />
          <path
            d="M48 12c-2-2-5-2-7-1"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            opacity="0.5"
          />
        </svg>

        <h1 className="font-serif-cn mt-6 text-2xl font-semibold tracking-wide text-base-content">
          这封信寄丢了
        </h1>
        <p className="font-serif-cn mt-2 text-sm leading-relaxed text-base-content/60">
          你要找的页面不在了，或者地址写错了一个字。
        </p>

        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/"
            className="rounded-box bg-primary px-5 py-2.5 text-sm font-medium text-primary-content transition hover:shadow-sm"
          >
            回首页
          </Link>
          <Link
            href="/p"
            className="rounded-box border border-base-300 px-5 py-2.5 text-sm text-primary transition hover:bg-base-content/5"
          >
            看看条款与说明
          </Link>
        </div>
      </div>
    </div>
  )
}
