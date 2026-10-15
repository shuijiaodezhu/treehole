'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '../app/lib/supabase'

/**
 * 「对方正在输入…」
 *
 * 用 Supabase Realtime 的 Presence（不是数据库表，所以**不需要跑任何 SQL**）：
 * 每个会话一条频道，进来的人 track 自己的状态，其他人的变化通过 sync 事件推过来。
 *
 * 三条约束，都是为了不打扰人：
 *   · 输入时**节流**上报（2 秒一次），不是每敲一个字都发
 *   · 停手 3 秒后自己撤销标记，避免"一直在输入"挂在那儿
 *   · 只上报 true/false 两个状态，不发输入内容（内容不该经过这条通道）
 *
 * 关于频道的写法：Presence 的回调必须在 subscribe() **之前**注册，
 * 订阅之后再 .on('presence', ...) 会报
 * "cannot add callbacks after subscribe()" —— 之前踩过一次，这里按顺序写。
 */

const supabase = createClient()

/** 节流：至少隔这么久才再报一次"我在输入" */
const REPORT_GAP_MS = 2000
/** 停手多久后撤销 */
const IDLE_MS = 3000

type PresenceMeta = { typing?: boolean }

export function useTypingIndicator(
  conversationId: string | null,
  meId: string | null,
  friendId: string | null,
) {
  const [friendTyping, setFriendTyping] = useState(false)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const lastReportRef = useRef(0)
  const idleTimerRef = useRef<number | null>(null)

  useEffect(() => {
    if (!conversationId || !meId || !friendId) return

    let cancelled = false
    const channel = supabase.channel(`typing:${conversationId}`, {
      config: { presence: { key: meId } },
    })

    channel
      .on('presence', { event: 'sync' }, () => {
        if (cancelled) return
        const state = channel.presenceState() as Record<string, PresenceMeta[]>
        const metas = state[friendId] ?? []
        setFriendTyping(metas.some((m) => m?.typing))
      })
      // 回调都注册完了才订阅
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') void channel.track({ typing: false })
      })

    channelRef.current = channel

    return () => {
      cancelled = true
      channelRef.current = null
      setFriendTyping(false)
      if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current)
      void supabase.removeChannel(channel)
    }
  }, [conversationId, meId, friendId])

  /** 在输入框 onChange 里调用 */
  const reportTyping = useCallback(() => {
    const channel = channelRef.current
    if (!channel) return

    const now = Date.now()
    if (now - lastReportRef.current >= REPORT_GAP_MS) {
      lastReportRef.current = now
      void channel.track({ typing: true })
    }

    // 每次输入都把"撤销"往后推
    if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current)
    idleTimerRef.current = window.setTimeout(() => {
      void channel.track({ typing: false })
    }, IDLE_MS)
  }, [])

  /** 发出去之后立刻撤销，别让对方还看着"正在输入" */
  const stopTyping = useCallback(() => {
    if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current)
    lastReportRef.current = 0
    void channelRef.current?.track({ typing: false })
  }, [])

  return { friendTyping, reportTyping, stopTyping }
}
