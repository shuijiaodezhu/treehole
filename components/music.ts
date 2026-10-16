'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '../app/lib/supabase'

/**
 * 听音乐：上传、播放、在场人数、聊天
 *
 * 几件要说清楚的事：
 *
 * 1. **音频不压缩**（和图片不同）—— 浏览器里没有现成可靠的音频转码，
 *    所以靠**限制大小**（15MB）而不是压。免费版存储 1GB，
 *    也就是说大概 60-70 首就满了，超过要清理或升级。
 *
 * 2. **「几个人在听」用 Realtime Presence**，不是数据库表：
 *    进房间的人 track 一下自己，离开自动消失。所以数字是实时的、也不会残留。
 *
 * 3. **匿名是界面层面的**：选了匿名，别人看到「匿名用户 XXXXXXXX」，
 *    但 sender_id 照常记录（否则本人删不掉、站主也没法处理举报）。
 *    这一点和院子的匿名帖口径一致，不藏着。
 */

const MUSIC_BUCKET = 'music'

/** 单首上限：15MB（约 3-6 分钟 128-320kbps） */
export const MAX_AUDIO_BYTES = 15 * 1024 * 1024

/** 只收浏览器普遍能直接播的格式 */
const ALLOWED_AUDIO = [
  'audio/mpeg', // mp3
  'audio/mp3',
  'audio/mp4', // m4a / aac
  'audio/aac',
  'audio/ogg',
  'audio/webm',
  'audio/wav',
  'audio/x-wav',
  'audio/flac',
  'audio/x-flac',
]

export type Track = {
  id: string
  uploader_id: string
  title: string
  artist: string | null
  url: string
  size_bytes: number
  duration_sec: number | null
  created_at: string
}

export type MusicMessage = {
  id: string
  track_id: string
  sender_id: string
  is_anonymous: boolean
  anonymous_id: string | null
  content: string
  created_at: string
}

/** 匿名时用的代号：和院子那套一样，八位数字 */
export function newAnonymousId(): string {
  return String(Math.floor(10000000 + Math.random() * 90000000))
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function formatDuration(sec: number | null | undefined): string {
  if (!sec || !Number.isFinite(sec) || sec <= 0) return '--:--'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

export type UploadAudioResult = {
  track?: Omit<Track, 'id' | 'created_at' | 'duration_sec'>
  error?: string
}

/** 上传一首音频，返回可写入 music_tracks 的字段 */
export async function uploadAudio(
  file: File,
  userId: string,
  title: string,
  artist: string,
): Promise<UploadAudioResult> {
  if (!ALLOWED_AUDIO.includes(file.type) && !/\.(mp3|m4a|aac|ogg|wav|flac|weba)$/i.test(file.name)) {
    return { error: '只支持 MP3 / M4A / AAC / OGG / WAV / FLAC' }
  }
  if (file.size > MAX_AUDIO_BYTES) {
    return { error: `音频不能超过 ${Math.round(MAX_AUDIO_BYTES / 1024 / 1024)}MB（免费版存储只有 1GB，所以卡得比较紧）` }
  }

  const ext = (file.name.split('.').pop() ?? 'mp3').toLowerCase().replace(/[^a-z0-9]/g, '') || 'mp3'
  // 路径规律和图片一致：<uid>/<时间戳>-<随机6位>.<扩展名>
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

  const { error } = await supabase.storage.from(MUSIC_BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || 'audio/mpeg',
  })

  if (error) {
    console.error('上传音频失败:', error)
    return { error: error.message || '上传失败（可能还没建 music 桶）' }
  }

  const { data } = supabase.storage.from(MUSIC_BUCKET).getPublicUrl(path)
  return {
    track: {
      uploader_id: userId,
      title: title.trim() || file.name.replace(/\.[^.]+$/, ''),
      artist: artist.trim() || null,
      url: data.publicUrl,
      size_bytes: file.size,
    },
  }
}

/** 读一段音频的时长（用来在列表里显示 3:24） */
export function probeDuration(url: string): Promise<number | null> {
  return new Promise((resolve) => {
    try {
      const audio = document.createElement('audio')
      audio.preload = 'metadata'
      audio.onloadedmetadata = () => {
        const d = audio.duration
        resolve(Number.isFinite(d) && d > 0 ? Math.round(d) : null)
      }
      audio.onerror = () => resolve(null)
      // 超时就放弃（别让列表卡住）
      window.setTimeout(() => resolve(null), 8000)
      audio.src = url
    } catch {
      resolve(null)
    }
  })
}

const supabase = createClient()

/** 曲目列表（实时：别人传了新歌，列表当场多一首） */
export function useTracks(enabled: boolean) {
  const [tracks, setTracks] = useState<Track[]>([])
  const [loading, setLoading] = useState(true)
  const [missing, setMissing] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('music_tracks')
      .select('id, uploader_id, title, artist, url, size_bytes, duration_sec, created_at')
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) {
      if (/does not exist|PGRST205|schema cache|404/i.test(error.message)) setMissing(true)
      else console.error('读曲目失败:', error)
      setLoading(false)
      return
    }
    setMissing(false)
    setTracks((data ?? []) as Track[])
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!enabled) return
    void (async () => {
      await load()
    })()

    let timer: number | null = null
    const channel = supabase
      .channel('music:list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'music_tracks' }, () => {
        if (timer) window.clearTimeout(timer)
        timer = window.setTimeout(() => void load(), 500)
      })
      .subscribe()

    return () => {
      if (timer) window.clearTimeout(timer)
      void supabase.removeChannel(channel)
    }
  }, [enabled, load, reloadKey])

  return {
    tracks,
    loading,
    missing,
    refresh: useCallback(() => setReloadKey((k) => k + 1), []),
    removeTrack: useCallback(async (id: string) => {
      const { error } = await supabase.from('music_tracks').delete().eq('id', id)
      if (error) return error.message
      setTracks((prev) => prev.filter((t) => t.id !== id))
      return null
    }, []),
  }
}

/**
 * 在场人数：Presence
 *
 * 进房间 track 自己，离开 removeChannel 会自动把自己摘掉。
 * 顺便把自己正在听的状态带上（谁在听、听到了第几秒不做同步 ——
 * 这一版只显示"几个人在听"，不做"一起同步播放"，那是另一件事）。
 */
export function useListeners(trackId: string | null, meId: string | null) {
  /*
   * 人数带着"这是哪条曲目"的 key 一起存：
   * effect 里就不需要同步 setCount(0) 去清空（那条会被
   * react-hooks/set-state-in-effect 拦），换歌时 key 对不上自然显示 0。
   */
  const [state, setState] = useState<{ key: string; n: number } | null>(null)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  useEffect(() => {
    if (!trackId || !meId) return

    let cancelled = false
    const channel = supabase.channel(`music:room:${trackId}`, {
      config: { presence: { key: meId } },
    })

    channel
      .on('presence', { event: 'sync' }, () => {
        if (cancelled) return
        setState({ key: trackId, n: Object.keys(channel.presenceState()).length })
      })
      // presence 回调必须在 subscribe() 之前注册
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') void channel.track({ at: new Date().toISOString() })
      })

    channelRef.current = channel
    return () => {
      cancelled = true
      channelRef.current = null
      void supabase.removeChannel(channel)
    }
  }, [trackId, meId])

  return state && state.key === trackId ? state.n : 0
}

/** 某个曲目下的聊天（实时） */
export function useMusicChat(trackId: string | null, meId: string | null) {
  // 同样带 key：换歌时旧消息不会闪一下，也就不用在 effect 里同步清空
  const [store, setStore] = useState<{ key: string; list: MusicMessage[] } | null>(null)
  const [missing, setMissing] = useState(false)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (!trackId) return

    let cancelled = false
    void (async () => {
      const { data, error } = await supabase
        .from('music_messages')
        .select('id, track_id, sender_id, is_anonymous, anonymous_id, content, created_at')
        .eq('track_id', trackId)
        .order('created_at', { ascending: true })
        .limit(200)

      if (cancelled) return
      if (error) {
        if (/does not exist|PGRST205|schema cache|404/i.test(error.message)) setMissing(true)
        else console.error('读音乐聊天失败:', error)
        return
      }
      setMissing(false)
      setStore({ key: trackId, list: (data ?? []) as MusicMessage[] })
    })()

    // 实时：别人说话当场出现
    const channel = supabase
      .channel(`music:chat:${trackId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'music_messages', filter: `track_id=eq.${trackId}` },
        (payload) => {
          if (cancelled) return
          const row = payload.new as MusicMessage
          setStore((prev) =>
            prev && prev.key === trackId && !prev.list.some((m) => m.id === row.id)
              ? { key: trackId, list: [...prev.list, row] }
              : (prev ?? { key: trackId, list: [row] }),
          )
        },
      )
      .subscribe()

    return () => {
      cancelled = true
      void supabase.removeChannel(channel)
    }
  }, [trackId, meId])

  const send = useCallback(
    async (content: string, anonymous: boolean) => {
      if (!trackId || !meId) return '还没登录'
      const text = content.trim()
      if (!text) return ''

      setSending(true)
      const { data, error } = await supabase
        .from('music_messages')
        .insert({
          track_id: trackId,
          sender_id: meId,
          is_anonymous: anonymous,
          anonymous_id: anonymous ? newAnonymousId() : null,
          content: text,
        })
        .select('id, track_id, sender_id, is_anonymous, anonymous_id, content, created_at')
        .single()
      setSending(false)

      if (error) return error.message
      if (data) {
        const row = data as MusicMessage
        setStore((prev) =>
          prev && prev.key === trackId && !prev.list.some((m) => m.id === row.id)
            ? { key: trackId, list: [...prev.list, row] }
            : (prev ?? { key: trackId, list: [row] }),
        )
      }
      return ''
    },
    [trackId, meId],
  )

  const messages = store && store.key === trackId ? store.list : []
  return { messages, missing, sending, send }
}
