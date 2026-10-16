'use client'

/**
 * 骨架屏
 *
 * 之前各个页面加载时都是一句「加载中...」，会闪、也显得空。
 * 这里给几种常用的骨架块，按页面结构拼出来。
 *
 * 扫光动画与 .skeleton 样式在 app/globals.css。
 */

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} />
}

/** 多行文字骨架，最后一根短一点更像文字 */
export function SkeletonText({ lines = 3, className = '' }: { lines?: number; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={`h-3 ${i === lines - 1 ? 'w-2/3' : i % 2 ? 'w-11/12' : 'w-full'}`} />
      ))}
    </div>
  )
}

/** 一张卡片：头像 + 名字 + 正文 */
export function SkeletonCard({ lines = 3, className = '' }: { lines?: number; className?: string }) {
  return (
    <div
      className={`rounded-box border border-base-300 bg-base-100/70 p-5 backdrop-blur ${className}`}
    >
      <div className="mb-3 flex items-center gap-3">
        <Skeleton className="h-9 w-9 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-2.5 w-16" />
        </div>
      </div>
      <SkeletonText lines={lines} />
    </div>
  )
}

export function SkeletonList({ count = 3, lines = 3 }: { count?: number; lines?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} lines={lines} />
      ))}
    </div>
  )
}

/** 首页那种「左栏三张卡 + 右侧卡片网格」 */
export function SkeletonHome() {
  return (
    <div className="mx-auto flex max-w-5xl gap-8 px-8 py-10">
      <aside className="flex w-64 flex-shrink-0 flex-col gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-box border border-base-300 bg-base-100/70 p-5">
            <Skeleton className="mb-3 h-4 w-20" />
            <SkeletonText lines={2} />
          </div>
        ))}
      </aside>
      <main className="flex flex-1 flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-box border border-base-300 bg-base-100/70 p-5">
              <Skeleton className="mb-3 h-9 w-9 rounded-box" />
              <Skeleton className="mb-2 h-4 w-20" />
              <Skeleton className="h-3 w-28" />
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}

/** 列表页那种「左边一列 + 右边一大块」（小屋） */
export function SkeletonSplit() {
  return (
    <div className="flex gap-5">
      <div className="flex w-72 flex-shrink-0 flex-col gap-3">
        <Skeleton className="h-11 w-full rounded-box" />
        <div className="rounded-box border border-base-300 bg-base-100/70 p-3">
          <Skeleton className="mb-3 h-3 w-16" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="mb-2 flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="h-3 flex-1" />
            </div>
          ))}
        </div>
      </div>
      <div className="flex-1 rounded-box border border-base-300 bg-base-100/70 p-5">
        <SkeletonList count={3} lines={2} />
      </div>
    </div>
  )
}
