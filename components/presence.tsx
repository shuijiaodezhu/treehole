'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '../app/lib/supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'

/**
 * 在线状态与活跃上报
 *
 *  - <OnlinePresence />   挂在根 layout：登录用户进站上报当日活跃，并加入在线频道
 *  - useOnlineCount()     给后台用：读同一个频道的在线人数
 *
 * 关键点：supabase-js 里同名 channel 会复用同一个实例，而「已 subscribe 的频道
 * 不能再 on('presence')」会直接抛错。所以这里用模块级单例频道 + 引用计数，
 * 两个组件共享一个频道，计数通过订阅回调广播出去。
 *
 * 在线用 Realtime Presence（内存态，不需要建表也不需要加入发布）；
 * 日活用 user_activity 表（见 supabase-activity.sql）。
 */

const supabase = createClient()

const CHANNEL = 'online-users'
const SEEN_THROTTLE_MS = 60 * 1000

type OnlineSnapshot = { count: number; ready: boolean }

let sharedChannel: RealtimeChannel | null = null
let refCount = 0
let removeTimer: number | null = null
let snapshot: OnlineSnapshot = { count: 0, ready: false }
const listeners = new Set<(s: OnlineSnapshot) => void>()

function emit() {
  for (const fn of listeners) fn(snapshot)
}

/** 取得共享频道（不存在就建；已存在就只是加引用） */
function acquireChannel(key: string) {
  if (removeTimer !== null) {
    window.clearTimeout(removeTimer)
    removeTimer = null
  }

  if (sharedChannel) {
    refCount += 1
    return
  }

  const channel = supabase.channel(CHANNEL, { config: { presence: { key } } })

  // 必须在 subscribe 之前注册 presence 回调
  channel.on('presence', { event: 'sync' }, () => {
    snapshot = { ...snapshot, count: Object.keys(channel.presenceState()).length }
    emit()
  })

  channel.subscribe((status) => {
    snapshot = { ...snapshot, ready: status === 'SUBSCRIBED' }
    emit()
    if (status === 'SUBSCRIBED') {
      void channel.track({ at: new Date().toISOString() })
    }
  })

  sharedChannel = channel
  refCount = 1
}

/** 释放引用；最后一个使用者离开后延时拆除（躲开 StrictMode 的挂载-卸载-再挂载） */
function releaseChannel() {
  refCount = Math.max(0, refCount - 1)
  if (refCount > 0) return

  removeTimer = window.setTimeout(() => {
    removeTimer = null
    if (refCount > 0 || !sharedChannel) return
    const channel = sharedChannel
    sharedChannel = null
    snapshot = { count: 0, ready: false }
    emit()
    void supabase.removeChannel(channel)
  }, 1500)
}

/** 订阅在线人数变化（会立刻回调一次当前值） */
function subscribeOnlineCount(fn: (s: OnlineSnapshot) => void): () => void {
  listeners.add(fn)
  fn(snapshot)
  return () => {
    listeners.delete(fn)
  }
}

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
        /* 未登录或网络异常都忽略，不影响页面 */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!userId) return

    let disposed = false

    /** 上报当日活跃（一天一行，重复忽略）+ 刷新 last_seen_at（节流） */
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
    acquireChannel(userId)

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
      releaseChannel()
    }
  }, [userId])

  return null
}

/* ==================== 后台：实时在线人数 ==================== */

export type OnlineState = OnlineSnapshot

export function useOnlineCount(): OnlineState {
  const [state, setState] = useState<OnlineSnapshot>({ count: 0, ready: false })

  useEffect(() => {
    let cancelled = false
    let acquired = false
    let key = `anon-${Math.random().toString(36).slice(2, 8)}`

    void (async () => {
      try {
        const { data } = await supabase.auth.getUser()
        if (data.user?.id) key = data.user.id
      } catch {
        /* 用匿名 key 也能数在线人数 */
      }
      if (cancelled) return
      acquireChannel(key)
      acquired = true
    })()

    const unsubscribe = subscribeOnlineCount(setState)

    return () => {
      cancelled = true
      unsubscribe()
      // 只有真的 acquire 过才 release，避免引用计数错位
      if (acquired) releaseChannel()
    }
  }, [])

  return state
}
