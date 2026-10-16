'use client'

import { useEffect } from 'react'
import Link from 'next/link'

/**
 * 页面级错误边界
 *
 * 之前没有这个文件：任何页面里一处运行时报错，用户看到的就是**整屏空白**，
 * 既不知道发生了什么，也没有路可走。现在至少给出人话 + 两个出口。
 *
 * 注意这是客户端组件，Next 要求接收 error 与 reset 两个 prop。
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // 生产环境里这条会进 Vercel 的运行时日志，方便回头查
    console.error('页面出错:', error)
  }, [error])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <svg
        className="h-14 w-14 text-accent"
        viewBox="0 0 32 32"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {/* 一封折了的信 */}
        <rect x="4" y="9" width="24" height="16" rx="2.4" />
        <path d="M5.2 10.4 16 18.4l10.8-8" />
        <path d="M12 24.5 16 20l4 4.5" />
      </svg>

      <h1 className="mt-5 font-serif-cn text-base font-semibold text-base-content">这一页出了点问题</h1>
      <p className="mt-2 max-w-xs font-serif-cn text-[12px] leading-relaxed text-base-content/60">
        不是你的操作有错。刷新一下多半就好；
        要是一直这样，跟站主说一声。
      </p>

      {error.digest && (
        <p className="mt-2 font-mono text-[11px] text-base-content/60">编号 {error.digest}</p>
      )}

      <div className="mt-6 flex items-center gap-2">
        <button
          type="button"
          onClick={reset}
          className="rounded-full bg-primary px-5 py-2.5 font-serif-cn text-[12.5px] text-primary-content transition hover:shadow-sm"
        >
          再试一次
        </button>
        <Link
          href="/"
          className="rounded-full border border-base-300 bg-base-100/70 px-5 py-2.5 font-serif-cn text-[12.5px] text-primary transition hover:bg-base-100"
        >
          回首页
        </Link>
      </div>
    </div>
  )
}
