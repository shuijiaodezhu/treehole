'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '../app/lib/supabase'

/**
 * 聊天实时收取：对方发来的消息当场出现，不用刷新。
 *
 * 两个聊天界面共用（小屋页内聊天、独立的 /friends/chat/[id]）。
 *
 * 两条路一起走 —— 因为 Realtime 还需要在 Supabase 里把 messages 加进
 * supabase_realtime 发布，**那个开关我在代码里验证不了**：
 *   · 订阅 postgres_changes：配置正常时毫秒级到达
 *   · 每 20 秒兜底重取一次：万一没开 Realtime，也能收到，只是慢一点
 * 两条路都交给调用方做去重，所以不会冒出重复气泡。
 *
 * 回调放在 ref 里：调用方每次渲染都会传新函数，直接写进依赖会让订阅反复重建。
 */

const supabase = createClient()

export type RealtimeMessage = {
  id: string
  sender_id: string
  content: string
  created_at: string
}

export function useChatRealtime(
  conversationId: string | null,
  onIncoming: (message: RealtimeMessage) => void,
  onFallbackPoll?: () => void,
) {
  const incomingRef = useRef(onIncoming)
  const pollRef = useRef(onFallbackPoll)

  useEffect(() => {
    incomingRef.current = onIncoming
    pollRef.current = onFallbackPoll
  }, [onIncoming, onFallbackPoll])

  useEffect(() => {
    if (!conversationId) return

    let cancelled = false

    const channel = supabase
      .channel(`chat:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          if (cancelled) return
          incomingRef.current(payload.new as RealtimeMessage)
        },
      )
      .subscribe()

    // 兜底：Realtime 没配好时也能收到（切到后台就不拉，省流量）
    const timer = window.setInterval(() => {
      if (cancelled || document.visibilityState !== 'visible') return
      pollRef.current?.()
    }, 20_000)

    return () => {
      cancelled = true
      window.clearInterval(timer)
      void supabase.removeChannel(channel)
    }
  }, [conversationId])
}
