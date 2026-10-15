'use client'

import { useEffect, useState } from 'react'

/**
 * 读取 URL 上的定位参数（例如 /world?post=<id>、/play?activity=<id>）
 *
 * 直接用 window.location.search 而不是 useSearchParams：
 * 这些页面是静态预渲染的，用 useSearchParams 必须额外包 <Suspense>；
 * 而定位参数只在「从搜索页跳进来」时用一次，不需要响应后续的客户端路由变化。
 *
 * 首次渲染返回 null（与预渲染结果一致），hydration 后再给出真实值。
 */
export function useFocusQuery(key: string): string | null {
  const [value, setValue] = useState<string | null>(null)

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try {
        setValue(new URLSearchParams(window.location.search).get(key))
      } catch {
        setValue(null)
      }
    })
    return () => window.cancelAnimationFrame(frame)
  }, [key])

  return value
}
