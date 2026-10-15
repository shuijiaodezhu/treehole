'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '../app/lib/supabase'

/**
 * 订阅某张表的变更，收到就回调（共用的小工具）
 *
 * 和 components/notifications.tsx 里那套是同一个思路，抽出来给
 * 好友申请、朋友圈、冬日信箱复用。三件事都做：
 *   · **节流合并**：一次批量操作可能连着来好几条，500ms 内的合并成一次回调，
 *     不然会连着重拉好几遍
 *   · **回调放在 ref 里**：调用方传的多半是内联函数，每次都变；
 *     放进依赖会让频道不断重建（也就不断来回订阅）
 *   · **回调在 subscribe() 之前注册**：订阅之后再 .on 会报
 *     "cannot add callbacks after subscribe()"（之前踩过一次）
 *
 * ⚠️ 前提：这张表要在 supabase_realtime 发布里（见 supabase-realtime*.sql），
 *    否则订阅不会收到任何东西 —— 调用方应该同时保留一个兜底刷新。
 *
 * 关于权限：Supabase 的 postgres_changes 会按 RLS 过滤，
 * 所以不写 filter 时也只会收到"我有权读"的那些行。
 */

const supabase = createClient()

export function useTableRealtime(
  name: string,
  table: string,
  onEvent: () => void,
  options: { filter?: string; enabled?: boolean; debounceMs?: number } = {},
) {
  const { filter, enabled = true, debounceMs = 500 } = options

  // 回调放进 ref，并且只在 effect 里更新（不在渲染期间写 ref）
  const callbackRef = useRef(onEvent)
  useEffect(() => {
    callbackRef.current = onEvent
  }, [onEvent])

  useEffect(() => {
    if (!enabled) return

    let timer: number | null = null
    const fire = () => {
      if (timer) window.clearTimeout(timer)
      timer = window.setTimeout(() => callbackRef.current(), debounceMs)
    }

    const channel = supabase
      .channel(name)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table, ...(filter ? { filter } : {}) },
        fire,
      )
      .subscribe()

    return () => {
      if (timer) window.clearTimeout(timer)
      void supabase.removeChannel(channel)
    }
  }, [name, table, filter, enabled, debounceMs])
}
