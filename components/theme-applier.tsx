'use client'

import { useEffect } from 'react'
import { applyTheme, readTheme } from './themes'

/**
 * 进站时把存下来的主题贴到 <html data-theme="…"> 上。
 *
 * 为什么单独一个小客户端组件：
 *   app/layout.tsx 是**服务端组件** ✗ 里面不能直接写 useEffect ✓
 *   所以由它 import 这个小的客户端组件 ✓
 */
export function ThemeApplier() {
  useEffect(() => {
    applyTheme(readTheme())
  }, [])
  return null
}
