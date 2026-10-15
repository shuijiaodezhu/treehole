'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../app/lib/supabase'
import { Icon } from './icons'
import { SkeletonList } from './skeleton'
import { checkRate, filterHint, filterText, noteSent } from './content-guard'
import {
  MAX_AUDIO_BYTES,
  formatBytes,
  formatDuration,
  probeDuration,
  uploadAudio,
  useListeners,
  useMusicChat,
  useTracks,
  type Track,
} from './music'

/**
 * 听音乐（放在「聚会 → 小程序」里的那一块）
 *
 * 左边曲目、右边播放 + 在场人数 + 聊天（可匿名）。
 * 「几个人在听」用 Presence 实时算，不进数据库；聊天进 music_messages 并走实时订阅。
 *
 * 两处刻意的取舍：
 *   · 播放器用**原生 audio 控件** —— 自绘的进度条好看但容易在移动端出问题，
 *     而这里真正要的是"能放、能拖、能调音量"，先保证可靠
 *   · 音频**不压缩**（浏览器里没有现成可靠的音频转码），改成限制单首 15MB；
 *     免费版存储 1GB，大概 60-70 首就会满 —— 列表下方会显示已用多少
 */

const supabase = createClient()

type ChatRow = {
  id: string
  content: string
  is_anonymous: boolean
  anonymous_id: string | null
  sender_id: string
  created_at: string
  name: string
}

export function MusicRoom() {
  const router = useRouter()

  const [meId, setMeId] = useState<string | null>(null)
  const [nickname, setNickname] = useState('我')
  const [checked, setChecked] = useState(false)
  const [current, setCurrent] = useState<Track | null>(null)
  const [showRoomOnMobile, setShowRoomOnMobile] = useState(false)
  const [chat, setChat] = useState<ChatRow[]>([])
  const [profileNames, setProfileNames] = useState<Record<string, string>>({})

  // 上传
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [artist, setArtist] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadHint, setUploadHint] = useState('')

  // 聊天
  const [draft, setDraft] = useState('')
  const [anonymous, setAnonymous] = useState(false)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)

  const { tracks, loading, missing, refresh, removeTrack } = useTracks(checked)
  const listeners = useListeners(current?.id ?? null, meId)
  const { messages, missing: chatMissing, sending, send } = useMusicChat(current?.id ?? null, meId)

  /* ---------- 取当前用户 ---------- */
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const { data } = await supabase.auth.getUser()
      if (cancelled) return
      if (!data.user) {
        router.push('/login')
        return
      }
      setMeId(data.user.id)
      const { data: profile } = await supabase
        .from('profiles')
        .select('nickname, username')
        .eq('id', data.user.id)
        .maybeSingle()
      if (!cancelled) {
        setNickname(
          (profile as { nickname?: string; username?: string } | null)?.nickname ||
            (profile as { username?: string } | null)?.username ||
            '我',
        )
        setChecked(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [router])

  /* ---------- 聊天的显示名 ---------- */
  useEffect(() => {
    const ids = [...new Set(messages.filter((m) => !m.is_anonymous).map((m) => m.sender_id))]
    const unknown = ids.filter((id) => !(id in profileNames) && id !== meId)
    if (unknown.length === 0) return

    let cancelled = false
    void (async () => {
      const { data } = await supabase.from('profiles').select('id, nickname, username').in('id', unknown)
      if (cancelled) return
      const next: Record<string, string> = {}
      for (const p of (data ?? []) as { id: string; nickname: string | null; username: string | null }[]) {
        next[p.id] = p.nickname || p.username || '某人'
      }
      setProfileNames((prev) => ({ ...prev, ...next }))
    })()
    return () => {
      cancelled = true
    }
    // profileNames 故意不进依赖：否则每次写入都会再触发一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, meId])

  /* ---------- 把 messages 拼上显示名 ---------- */
  useEffect(() => {
    const rows: ChatRow[] = messages.map((m) => ({
      ...m,
      name: m.is_anonymous
        ? `匿名用户${m.anonymous_id ?? '00000000'}`
        : m.sender_id === meId
          ? nickname
          : (profileNames[m.sender_id] ?? '某人'),
    }))
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setChat(rows)
  }, [messages, profileNames, meId, nickname])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chat])

  const totalBytes = useMemo(() => tracks.reduce((sum, t) => sum + (t.size_bytes ?? 0), 0), [tracks])

  /* ---------- 上传 ---------- */
  async function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    if (!meId) return
    if (!file) {
      setUploadHint('先选一个音频文件')
      return
    }

    const rate = checkRate('music')
    if (!rate.ok) {
      setUploadHint(rate.message)
      return
    }

    const nameCheck = filterText(title || file.name)
    if (nameCheck.hits.length > 0) setUploadHint(filterHint(nameCheck.hits))

    setUploading(true)
    setUploadHint('上传中…')

    const result = await uploadAudio(file, meId, title, artist)
    if (result.error || !result.track) {
      setUploading(false)
      setUploadHint(result.error ?? '上传失败')
      return
    }

    // 时长：读一次元数据再写库（读不到就留空，不影响播放）
    const duration = await probeDuration(result.track.url)

    const { error } = await supabase.from('music_tracks').insert({
      uploader_id: result.track.uploader_id,
      title: result.track.title,
      artist: result.track.artist,
      url: result.track.url,
      size_bytes: result.track.size_bytes,
      duration_sec: duration,
    })

    setUploading(false)

    if (error) {
      setUploadHint('文件传上去了，但没记进曲库：' + error.message)
      return
    }

    noteSent('music')
    setFile(null)
    setTitle('')
    setArtist('')
    setUploadHint('上传好了，点右边的曲目就能听')
    refresh()
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!draft.trim()) return

    const nameCheck = filterText(draft)
    if (nameCheck.hits.length > 0) setUploadHint(filterHint(nameCheck.hits))

    const rate = checkRate('comment')
    if (!rate.ok) {
      setUploadHint(rate.message)
      return
    }

    const error = await send(draft, anonymous)
    if (error) {
      setUploadHint(error)
      return
    }
    noteSent('comment')
    setDraft('')
  }

  function openTrack(track: Track) {
    setCurrent(track)
    setShowRoomOnMobile(true)
    setUploadHint('')
  }

  if (!checked) {
    return (
      <div className="mx-auto max-w-5xl px-6 pt-24">
        <SkeletonList count={3} lines={2} />
      </div>
    )
  }

  return (
    <section className="mt-8">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-[#2b2430]">听音乐</h2>
        <p className="text-[10.5px] text-[var(--accent-muted)]">
          传一首，或者听别人传的。同一条曲目下可以说话，也可以匿名说。
        </p>
      </div>

        {missing ? (
          <p className="rounded-2xl border border-[var(--accent-line)] bg-white/80 px-4 py-3 text-[11px] leading-relaxed text-[var(--accent-muted)]">
            曲库还没开通：先在 Supabase 里执行 <code>supabase-music.sql</code>。
          </p>
        ) : (
          <div className="flex flex-col gap-5 md:flex-row md:items-start">
            {/* ============ 左：曲库 + 上传 ============ */}
            <div className={`w-full space-y-4 md:w-[46%] ${showRoomOnMobile ? 'hidden md:block' : ''}`}>
              {/* 上传 */}
              <form
                onSubmit={handleUpload}
                className="rounded-3xl border border-[var(--accent-line)] bg-white/80 p-5 backdrop-blur"
              >
                <h2 className="text-sm font-semibold text-[#2b2430]">上传一首</h2>
                <p className="mt-1 text-[10.5px] leading-relaxed text-[var(--accent-muted)]">
                  支持 MP3 / M4A / OGG / WAV / FLAC，单首不超过 {Math.round(MAX_AUDIO_BYTES / 1024 / 1024)}MB。
                  音频不做压缩（浏览器里没有可靠的转码），所以传之前挑一下码率。
                </p>

                <div className="mt-3 space-y-2">
                  <input
                    type="file"
                    accept="audio/*"
                    onChange={(e) => {
                      const picked = e.target.files?.[0] ?? null
                      setFile(picked)
                      if (picked && !title) setTitle(picked.name.replace(/\.[^.]+$/, ''))
                    }}
                    className="block w-full text-[11px] text-[var(--accent-muted)] file:mr-3 file:rounded-xl file:border-0 file:bg-[var(--accent-soft)] file:px-3 file:py-2 file:text-[11px] file:text-[var(--accent-deep)]"
                  />
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="曲名"
                    maxLength={60}
                    className="w-full rounded-xl border border-[var(--accent-line)] bg-[var(--accent-soft)] px-3 py-2 text-xs text-[#2b2430] placeholder:text-[var(--accent-light)] focus:border-[var(--accent)] focus:outline-none"
                  />
                  <input
                    type="text"
                    value={artist}
                    onChange={(e) => setArtist(e.target.value)}
                    placeholder="歌手 / 来源（可空）"
                    maxLength={60}
                    className="w-full rounded-xl border border-[var(--accent-line)] bg-[var(--accent-soft)] px-3 py-2 text-xs text-[#2b2430] placeholder:text-[var(--accent-light)] focus:border-[var(--accent)] focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={uploading || !file}
                  className="mt-3 w-full rounded-xl bg-gradient-to-r from-[var(--accent-light)] to-[var(--accent)] px-4 py-2 text-xs font-medium text-white transition hover:shadow-[0_6px_20px_rgba(217,119,87,0.3)] disabled:opacity-50"
                >
                  {uploading ? '上传中…' : '上传'}
                </button>

                {uploadHint && (
                  <p className="mt-2 text-[10.5px] leading-relaxed text-[var(--accent-muted)]">{uploadHint}</p>
                )}
              </form>

              {/* 曲库 */}
              <div className="rounded-3xl border border-[var(--accent-line)] bg-white/80 p-5 backdrop-blur">
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="text-sm font-semibold text-[#2b2430]">曲库 · {tracks.length}</h2>
                  <span className="text-[10px] text-[var(--accent-light)]">已用 {formatBytes(totalBytes)}</span>
                </div>

                {loading ? (
                  <p className="mt-3 text-xs text-[var(--accent-muted)]">读取中…</p>
                ) : tracks.length === 0 ? (
                  <p className="mt-3 text-[11px] leading-relaxed text-[var(--accent-muted)]">
                    还没有人传过。你可以是第一个。
                  </p>
                ) : (
                  <ul className="mt-3 space-y-1.5">
                    {tracks.map((track) => {
                      const active = current?.id === track.id
                      return (
                        <li key={track.id}>
                          <div
                            className={`flex items-center gap-2 rounded-2xl border px-3 py-2.5 transition ${
                              active
                                ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
                                : 'border-[var(--accent-line)] bg-white/60 hover:border-[var(--accent-light)]'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => openTrack(track)}
                              className="min-w-0 flex-1 text-left"
                            >
                              <span className="block truncate text-xs text-[#2b2430]">
                                {active && (
                                  <Icon name="music" className="mr-1 inline h-3 w-3 text-[var(--accent-deep)]" />
                                )}
                                {track.title}
                              </span>
                              <span className="mt-0.5 block truncate text-[10px] text-[var(--accent-light)]">
                                {track.artist ? `${track.artist} · ` : ''}
                                {formatDuration(track.duration_sec)} · {formatBytes(track.size_bytes)}
                              </span>
                            </button>
                            {track.uploader_id === meId && (
                              <button
                                type="button"
                                title="删除"
                                onClick={async () => {
                                  if (!confirm(`删除《${track.title}》？对所有人都没了。`)) return
                                  const error = await removeTrack(track.id)
                                  if (error) setUploadHint('删除失败：' + error)
                                  if (current?.id === track.id) setCurrent(null)
                                }}
                                className="flex-shrink-0 text-[var(--accent-light)] transition hover:text-red-500"
                              >
                                <Icon name="trash" className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            </div>

            {/* ============ 右：播放 + 在场 + 聊天 ============ */}
            <div className={`w-full space-y-4 md:flex-1 ${showRoomOnMobile ? '' : 'hidden md:block'}`}>
              {!current ? (
                <div className="flex h-64 flex-col items-center justify-center rounded-3xl border border-dashed border-[var(--accent-line)] bg-[var(--accent-soft)]/40 px-6 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/80">
                    <Icon name="music" className="h-6 w-6 text-[var(--accent)]" />
                  </div>
                  <p className="mt-4 text-sm text-[#2b2430]">选一首歌</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-[var(--accent-muted)]">
                    点左边的曲目就开始听。
                    <br />
                    同一首歌下可以说说话，也可以匿名说。
                  </p>
                </div>
              ) : (
                <>
                  {/* 播放器 */}
                  <div className="rounded-3xl border border-[var(--accent-line)] bg-white/85 p-5 backdrop-blur">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="truncate text-sm font-semibold text-[#2b2430]">{current.title}</h2>
                        {current.artist && (
                          <p className="mt-0.5 truncate text-[10.5px] text-[var(--accent-muted)]">
                            {current.artist}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-shrink-0 items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setShowRoomOnMobile(false)}
                          className="text-[11px] text-[var(--accent-muted)] transition hover:text-[var(--accent-deep)] md:hidden"
                        >
                          返回列表
                        </button>
                        {/* 几个人在听 */}
                        <span
                          title="正在听这首歌的人（实时）"
                          className="flex items-center gap-1 rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-[10px] text-[var(--accent-deep)]"
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
                          {listeners} 人在听
                        </span>
                      </div>
                    </div>

                    {/* 原生控件：可靠优先 */}
                    <audio
                      ref={audioRef}
                      src={current.url}
                      controls
                      autoPlay
                      preload="metadata"
                      className="mt-4 w-full"
                    />

                    <p className="mt-2 text-[10px] text-[var(--accent-light)]">
                      {formatDuration(current.duration_sec)} · {formatBytes(current.size_bytes)}
                    </p>
                  </div>

                  {/* 聊天 */}
                  <div className="rounded-3xl border border-[var(--accent-line)] bg-white/85 backdrop-blur">
                    <div className="flex items-center justify-between gap-3 border-b border-[var(--accent-line)] px-5 py-3">
                      <h2 className="text-xs font-semibold text-[#2b2430]">边听边说</h2>
                      <label className="flex cursor-pointer items-center gap-1.5 text-[10.5px] text-[var(--accent-muted)]">
                        <input
                          type="checkbox"
                          checked={anonymous}
                          onChange={(e) => setAnonymous(e.target.checked)}
                          className="h-3.5 w-3.5 accent-[var(--accent)]"
                        />
                        匿名说
                      </label>
                    </div>

                    <div className="max-h-80 space-y-2.5 overflow-y-auto px-5 py-4">
                      {chatMissing ? (
                        <p className="text-[11px] leading-relaxed text-[var(--accent-muted)]">
                          聊天还没开通：先执行 <code>supabase-music.sql</code>。
                        </p>
                      ) : chat.length === 0 ? (
                        <p className="text-[11px] leading-relaxed text-[var(--accent-muted)]">
                          还没有人说话。说一句试试——别人会当场看到。
                        </p>
                      ) : (
                        chat.map((row) => {
                          const mine = row.sender_id === meId
                          return (
                            <div key={row.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                              <div className="max-w-[85%]">
                                <p
                                  className={`mb-0.5 text-[9.5px] ${
                                    row.is_anonymous
                                      ? 'text-[var(--accent-light)]'
                                      : 'text-[var(--accent-muted)]'
                                  } ${mine ? 'text-right' : ''}`}
                                >
                                  {row.name}
                                  {row.is_anonymous && ' · 匿名'}
                                </p>
                                <p
                                  className={`whitespace-pre-wrap rounded-2xl px-3 py-2 text-xs leading-relaxed ${
                                    mine
                                      ? 'bg-[var(--accent)] text-white'
                                      : 'bg-[var(--accent-soft)] text-[#3a3229]'
                                  }`}
                                >
                                  {row.content}
                                </p>
                              </div>
                            </div>
                          )
                        })
                      )}
                      <div ref={bottomRef} />
                    </div>

                    <form
                      onSubmit={handleSend}
                      className="flex items-center gap-2 border-t border-[var(--accent-line)] px-5 py-3"
                    >
                      <input
                        type="text"
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        maxLength={200}
                        placeholder={anonymous ? '匿名说点什么…' : `以「${nickname}」的身份说点什么…`}
                        className="min-w-0 flex-1 rounded-full border border-[var(--accent-line)] bg-[var(--accent-soft)] px-4 py-2 text-xs text-[#2b2430] placeholder:text-[var(--accent-light)] focus:border-[var(--accent)] focus:outline-none"
                      />
                      <button
                        type="submit"
                        disabled={sending || !draft.trim()}
                        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-white transition hover:opacity-90 disabled:opacity-40"
                      >
                        <Icon name="send" className="h-4 w-4" />
                      </button>
                    </form>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
    </section>
  )
}
