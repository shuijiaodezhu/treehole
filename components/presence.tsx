'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '../app/lib/supabase'

/**
 * 在线状态与活跃上报
 *
 *  - <OnlinePresence />     挂在根 layout，登录用户进站时上报当日活跃并加入在线频道
 *  - useOnlineCount()       给后台用：订阅同一个频道，实时数出在线人数
 *
 * 在线用 Supabase Realtime 的 Presence（内存态，不需要建表、不需要发布）；
 * 日活用 user_activity 表（见 supabase-activity.sql）。
 */

const supabase = createClient()

/** 在线频道名：所有页面与后台都用它 */
const CHANNEL = 'online-users'

/** last_seen_at 的写入节流：两次写之间至少间隔这么久 */
const SEEN_THROTTLE_MS = 60 * 1000

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10)
}

/* ==================== 站点级：上报活跃 + 加入在线频道 ==================== */

export function OnlinePresence() {
  const [userId, setUserId] = useState<string | null>(null)
  const lastSeenRef = useRef(0)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const { data } = await supabase.auth.getUser()
        if (!cancelled) setUserId(data.user?.id ?? null)
      } catch {
        /* 未登录/网络异常都忽略，不影响页面 */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!userId) return

    let channel: ReturnType<typeof supabase.channel> | null = null
    let disposed = false

    /** 上报当日活跃（一天一行，重复插入忽略）+ 刷新 last_seen_at（节流） */
    const reportActivity = async (force = false) => {
      if (disposed) return
      const now = Date.now()
      if (!force && now - lastSeenRef.current < SEEN_THROTTLE_MS) return
      lastSeenRef.current = now

      try {
        await supabase
          .from('user_activity')
          .upsert(
            { user_id: userId, day: todayUTC() },
            { onConflict: 'user_id,day', ignoreDuplicates: true },
          )
      } catch (err) {
        console.error('上报当日活跃失败:', err)
      }

      try {
        await supabase.from('profiles').update({ last_seen_at: new Date().toISOString() }).eq('id', userId)
      } catch (err) {
        console.error('刷新 last_seen_at 失败:', err)
      }
    }

    void reportActivity(true)

    // 加入在线频道（presence 的 key 用 user id，多标签页算一个人）
    channel = supabase.channel(CHANNEL, { config: { presence: { key: userId } } })
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        void channel?.track({ user_id: userId, at: new Date().toISOString() })
      }
    })

    // 定时刷新：只在标签页可见时写，避免后台标签页一直刷
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void reportActivity()
    }, SEEN_THROTTLE_MS)

    const onVisible = () => {
      if (document.visibilityState === 'visible') void reportActivity(true)
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      disposed = true
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      if (channel) void supabase.removeChannel(channel)
    }
  }, [userId])

  return null
}

/* ==================== 后台：实时在线人数 ==================== */

export type OnlineState = {
  /** 当前在线人数（不同用户数，多标签页只算一个） */
  count: number
  /** 订阅是否正常 */
  ready: boolean
}

export function useOnlineCount(): OnlineState {
  const [count, setCount] = useState(0)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null

    void (async () => {
      const { data } = await supabase.auth.getUser()
      const key = data.user?.id ?? `anon-${Math.random().toString(36).slice(2, 8)}`

      channel = supabase.channel(CHANNEL, { config: { presence: { key } } })

      channel.on('presence', { event: 'sync' }, () => {
        const state = channel?.presenceState() ?? {}
        setCount(Object.keys(state).length)
      })

      channel.subscribe((status) => {
        setReady(status === 'SUBSCRIBED')
      })
    })()

    return () => {
      if (channel) void supabase.removeChannel(channel)
    }
  }, [])

  return { count, ready }
}
