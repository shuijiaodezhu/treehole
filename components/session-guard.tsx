'use client'

import { useEffect } from 'react'
import { createClient } from '../app/lib/supabase'

/**
 * 会话保护：**关掉浏览器就退出登录**
 *
 * 你的反馈：登录完，下一次打开还直接是登录状态 —— 这不好 ✓
 *
 * 做法（不猜 cookie 的 API ✗ 用最确定的办法 ✓）：
 *   · 浏览器**标签页会话**（sessionStorage）里放一个"本次会话"的标记 ✓
 *   · 进站时看这个标记：
 *       有标记      → 同一次会话（刷新、页内跳转）→ **不动** ✓ 不掉线 ✓
 *       没有标记    → 说明**浏览器整个关过**（sessionStorage 被清掉了 ✓）
 *                     → 但我们却还能读到登录状态 ✗ → 那就**主动退出** ✓
 *   · 然后在标记里记下"本次会话见过你了" ✓
 *
 * 分寸（如实说 ✓）：
 *   · 刷新页面 → 不掉线 ✓
 *   · 关掉浏览器再来 → **要重新登录** ✓✓（你要的 ✓）
 *   · 手机上只是"切到后台"而不是真的关掉 → 仍算同一次会话 ✓（系统行为 ✓ 这个拦不住 ✓）
 */
const SESSION_FLAG = 'treehole:session'

export function SessionGuard() {
  useEffect(() => {
    let cancelled = false

    // ① 同一次会话里有标记 → 什么都不做（刷新、页内跳转都不掉线 ✓）
    try {
      if (window.sessionStorage.getItem(SESSION_FLAG)) return
    } catch {
      return // 隐私模式读不了 → 不动，免得每次刷新都把人踢出去 ✗
    }

    // ② 新的一次浏览器会话：先记上标记（避免下面异步期间重复触发 ✓）
    try {
      window.sessionStorage.setItem(SESSION_FLAG, String(Date.now()))
    } catch {
      return
    }

    // ③ 如果这时候还留着登录状态 ✗ → 说明是"上次没退出"残留下来的 → 主动退出 ✓
    void (async () => {
      const supabase = createClient()
      const { data } = await supabase.auth.getSession()
      if (cancelled) return
      if (data?.session) {
        await supabase.auth.signOut()
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  return null
}
