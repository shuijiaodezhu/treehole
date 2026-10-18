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

    /*
     * "文件没加载到"（发布过程中换了文件）→ **自动重载一次**就恢复了
     *   现象：Failed to load chunk /xxx.js from module … / Loading chunk … failed
     *   原因：页面是上一版 HTML，它引用的那个 js 已经被新部署换掉 ✗
     *   为什么可以自动修：重载会拿到**最新 HTML** → 引用**最新文件** → 正常
     *   防死循环：一个会话里只自动重试一次（记在 sessionStorage）
     */
    const msg = String(error?.message || '')
    const chunkish = /Failed to load chunk|Loading chunk .* failed|Importing a module script failed|error loading dynamically imported module/i.test(msg)
    if (chunkish) {
      const KEY = 'treehole:chunk-reload'
      let tried = ''
      try {
        tried = window.sessionStorage.getItem(KEY) ?? ''
      } catch {
        tried = ''
      }
      if (tried !== '1') {
        try {
          window.sessionStorage.setItem(KEY, '1')
        } catch {
          /* 忽略 */
        }
        window.setTimeout(() => window.location.reload(), 300)
      }
    }
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

      {/*
        把**真正的报错**显示出来（可以选中复制）
        为什么：以前只给一句"出了点问题"，排查只能靠猜；
        现在用户截一张图，就能直接看到是哪里、哪一句报的错
      */}
      <p className="mt-3 max-w-sm select-text break-words px-2 text-left font-mono text-[10.5px] leading-relaxed text-base-content/45">
        {String(error?.message || error || '未知错误')}
        {error?.digest ? `  (编号 ${error.digest})` : ''}
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={reset}
          className="btn btn-primary font-serif-cn transition hover:shadow-sm"
        >
          再试一次
        </button>
        {/*
          「清缓存重载」：自己就能修，不用卸载重装
          —— 注销 Service Worker + 清掉所有缓存 + 强制重新拉取
          （只有在这个错误页上才会出现，平时不影响任何东西）
        */}
        <button
          type="button"
          onClick={() => {
            void (async () => {
              try {
                if ('serviceWorker' in navigator) {
                  const regs = await navigator.serviceWorker.getRegistrations()
                  await Promise.all(regs.map((r) => r.unregister()))
                }
              } catch {
                /* 忽略 */
              }
              try {
                if ('caches' in window) {
                  const keys = await caches.keys()
                  await Promise.all(keys.map((k) => caches.delete(k)))
                }
              } catch {
                /* 忽略 */
              }
              window.location.reload()
            })()
          }}
          className="rounded-full border border-base-300 bg-base-100/70 px-5 py-2.5 font-serif-cn text-[12.5px] text-primary transition hover:bg-base-100"
        >
          清缓存重载
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
