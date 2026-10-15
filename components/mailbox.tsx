'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { createClient } from '../app/lib/supabase'
import { Icon } from './icons'
import { EmojiPicker, useEmojiInsert } from './emoji-picker'
import { ADMIN_UUID } from './utils'

/**
 * 冬日信箱
 *
 * 写烦心事、悄悄话给站主，点对点，只有站主看得到。
 *
 * 数据上用**自己的一张表** winter_letters，和好友私聊（conversations / messages）
 * 完全分开——共用一个频道会让用户的好友列表里凭空多出一个和站主的会话，
 * 站主后台也会把好友私聊一并列出来，两边都乱。
 * 隐私由这张表的 RLS 保证：只有写信人本人和站主能读。
 *
 * 未读数自己记：把「上次读到的时间」放在 localStorage。
 */

const supabase = createClient()

const SEEN_KEY = (uid: string) => `treehole:seen:mailbox:${uid}`

export type MailboxMessage = {
  id: string
  sender_id: string
  content: string
  created_at: string
}

export type Mailbox = {
  meId: string | null
  messages: MailboxMessage[]
  unread: number
  loading: boolean
  sending: boolean
  error: string
  send: (text: string) => Promise<{ ok: boolean; message?: string }>
  markRead: () => void
  refresh: () => void
}

/** 把底层报错翻译成能照着做的话（后台也用） */
export function describeMailboxError(err: unknown): string {
  const text =
    err && typeof err === 'object' && 'message' in err
      ? String((err as { message: unknown }).message)
      : String(err)
  if (/does not exist|PGRST205|schema cache|404/i.test(text)) {
    return '信箱还没开通：先在 Supabase 里执行 supabase-winter-mailbox.sql'
  }
  if (/row-level security|permission denied|42501/i.test(text)) {
    return '没有权限：检查 winter_letters 的 RLS 策略是否已建好'
  }
  return '信箱暂时打不开，稍后再试'
}

function readSeenAt(uid: string): string {
  try {
    return window.localStorage.getItem(SEEN_KEY(uid)) ?? ''
  } catch {
    return ''
  }
}

function writeSeenAt(uid: string, iso: string) {
  try {
    window.localStorage.setItem(SEEN_KEY(uid), iso)
  } catch {
    /* 隐私模式忽略 */
  }
}

export function useMailbox(meId: string | null): Mailbox {
  const [messages, setMessages] = useState<MailboxMessage[]>([])
  const [seenAt, setSeenAt] = useState('')
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  // 首次挂载后再读本地记录，避免预渲染时访问 localStorage
  useEffect(() => {
    if (!meId) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSeenAt(readSeenAt(meId))
  }, [meId])

  useEffect(() => {
    // 站主不用这个入口，来信都在后台的「冬日信箱」里
    if (!meId || meId === ADMIN_UUID) {
      const frame = window.requestAnimationFrame(() => setMessages([]))
      return () => window.cancelAnimationFrame(frame)
    }

    let cancelled = false
    void (async () => {
      setLoading(true)
      try {
        // 独立的表：一行一封信，thread_user_id = 自己的信箱
        const { data, error: loadError } = await supabase
          .from('winter_letters')
          .select('id, sender_id, content, created_at')
          .eq('thread_user_id', meId)
          .order('created_at', { ascending: true })
          .limit(200)

        if (loadError) throw loadError
        if (!cancelled) {
          setMessages((data ?? []) as MailboxMessage[])
          setError('')
        }
      } catch (err) {
        console.error('打开冬日信箱失败:', err)
        if (!cancelled) setError(describeMailboxError(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [meId, reloadKey])

  const send = useCallback(
    async (text: string) => {
      const content = text.trim()
      if (!meId) return { ok: false, message: '请先登录' }
      if (!content) return { ok: false, message: '写点什么呢' }

      setSending(true)
      try {
        const { data, error: sendError } = await supabase
          .from('winter_letters')
          .insert({ thread_user_id: meId, sender_id: meId, content })
          .select('id, sender_id, content, created_at')
          .single()

        if (sendError) throw sendError
        setMessages((prev) => [...prev, data as MailboxMessage])
        return { ok: true }
      } catch (err) {
        console.error('寄信失败:', err)
        return { ok: false, message: describeMailboxError(err) }
      } finally {
        setSending(false)
      }
    },
    [meId],
  )

  const markRead = useCallback(() => {
    if (!meId) return
    const latest = messages.length > 0 ? messages[messages.length - 1].created_at : new Date().toISOString()
    writeSeenAt(meId, latest)
    setSeenAt(latest)
  }, [meId, messages])

  /** 站主发来、且比上次读到的更新 → 未读 */
  const unread = useMemo(() => {
    if (!seenAt) return messages.filter((m) => m.sender_id !== meId).length
    return messages.filter((m) => m.sender_id !== meId && m.created_at > seenAt).length
  }, [messages, seenAt, meId])

  return {
    meId,
    messages,
    unread,
    loading,
    sending,
    error,
    send,
    markRead,
    refresh: () => setReloadKey((k) => k + 1),
  }
}

/* ==================== 窄屏时的入口按钮（放在页头） ==================== */

export function MailboxTrigger({ mailbox, onOpen }: { mailbox: Mailbox; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="冬日信箱"
      title="冬日信箱"
      className="relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--accent-line)] bg-white/60 text-[var(--accent-muted)] transition hover:bg-white/90 hover:text-[var(--accent-deep)]"
    >
      <svg
        className="h-[18px] w-[18px]"
        viewBox="0 0 32 32"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M6 14a4 4 0 0 1 4-4h12a4 4 0 0 1 4 4v12H6z" />
        <path d="M6 22h6a2 2 0 0 1 4 0 2 2 0 0 0 4 0h6" />
        <path d="M22 10V6.5A1.5 1.5 0 0 1 23.5 5h3A1.5 1.5 0 0 1 28 6.5V10" />
      </svg>
      {mailbox.unread > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--accent)] px-1 text-[9px] text-white">
          {mailbox.unread > 9 ? '9+' : mailbox.unread}
        </span>
      )}
    </button>
  )
}

/* ==================== 读信 / 写信的对话框 ==================== */

function formatStamp(iso: string): string {
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso))
  } catch {
    return ''
  }
}

export function MailboxDialog({
  mailbox,
  open,
  onClose,
}: {
  mailbox: Mailbox
  open: boolean
  onClose: () => void
}) {
  const [draft, setDraft] = useState('')
  const [hint, setHint] = useState('')
  const listRef = useRef<HTMLDivElement>(null)
  const { ref: inputRef, insert: insertEmoji } = useEmojiInsert<HTMLTextAreaElement>(draft, setDraft)

  // 打开时标记已读 + 滚到底
  useEffect(() => {
    if (!open) return
    mailbox.markRead()
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mailbox.messages.length])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const isOwner = mailbox.meId === ADMIN_UUID

  async function handleSend() {
    setHint('')
    const result = await mailbox.send(draft)
    if (!result.ok) {
      setHint(result.message ?? '没寄出去')
      return
    }
    setDraft('')
    window.requestAnimationFrame(() => {
      const el = listRef.current
      if (el) el.scrollTop = el.scrollHeight
    })
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/25 px-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[82vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-[var(--accent-line)] bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 抬头 */}
        <div className="flex items-start gap-3 border-b border-[var(--accent-line)] bg-[var(--accent-soft)] px-5 py-4">
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-2xl bg-white/70">
            <svg
              className="h-5 w-5 text-[var(--accent)]"
              viewBox="0 0 32 32"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M6 14a4 4 0 0 1 4-4h12a4 4 0 0 1 4 4v12H6z" />
              <path d="M6 22h6a2 2 0 0 1 4 0 2 2 0 0 0 4 0h6" />
              <path d="M22 10V6.5A1.5 1.5 0 0 1 23.5 5h3A1.5 1.5 0 0 1 28 6.5V10" />
            </svg>
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-serif-cn text-sm font-semibold text-[#2b2620]">冬日信箱</h2>
            <p className="mt-0.5 font-serif-cn text-[10px] text-[var(--accent-muted)]">
              {isOwner ? '你是站主 · 大家写来的烦心事都在后台' : '写给站主一个人 · 不公开，别人看不到'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关上信箱"
            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[var(--accent-muted)] transition hover:bg-white/70"
          >
            <Icon name="x" className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* 信 */}
        <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {mailbox.loading && mailbox.messages.length === 0 ? (
            <p className="py-10 text-center font-serif-cn text-xs text-[var(--accent-muted)]">开信箱中…</p>
          ) : mailbox.error ? (
            <p className="py-10 text-center text-xs text-red-500">{mailbox.error}</p>
          ) : mailbox.messages.length === 0 ? (
            isOwner ? (
              /* 站主自己在前台点开：指个路，别让他以为要在前台写信 */
              <div className="px-1 py-8 text-center">
                <p className="font-serif-cn text-[13px] leading-relaxed text-[#3a3229]">
                  你是站主
                </p>
                <p className="mt-2 font-serif-cn text-[11px] leading-relaxed text-[var(--accent-muted)]">
                  大家写来的烦心事都在后台的「冬日信箱」里，
                  <br />
                  在那边一封一封回。
                </p>
                <Link
                  href="/admin"
                  className="mt-5 inline-flex items-center gap-1.5 rounded-full border border-[var(--accent-line)] bg-[var(--accent-soft)] px-4 py-2 font-serif-cn text-[11.5px] text-[var(--accent-deep)] transition hover:bg-[var(--accent-line)]"
                >
                  去后台看信
                  <Icon name="arrow" className="h-3 w-3" />
                </Link>
              </div>
            ) : (
              /* 第一次打开：把「怎么用」讲清楚，措辞先安慰人 */
              <div className="px-1 py-4">
                <p className="text-center font-serif-cn text-[13px] leading-relaxed text-[#3a3229]">
                  有什么不好开口的，
                  <br />
                  写在这里就好。
                </p>
                <p className="mt-2 text-center font-serif-cn text-[11px] leading-relaxed text-[var(--accent-muted)]">
                  不用组织语言，也不必写得体面。
                </p>

              <ol className="mt-6 space-y-3">
                {[
                  { t: '想到什么写什么', d: '写一句也行，慢慢说也行' },
                  { t: '站主会认真回', d: '读得仔细，也尽量帮你想办法' },
                  { t: '只有你和他看得到', d: '不公开、不进动态，别人不会知道' },
                ].map((step, i) => (
                  <li key={step.t} className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] font-serif-cn text-[10px] text-[var(--accent-deep)]">
                      {i + 1}
                    </span>
                    <span className="min-w-0">
                      <span className="block font-serif-cn text-[12px] text-[#3a3229]">{step.t}</span>
                      <span className="mt-0.5 block font-serif-cn text-[10.5px] leading-relaxed text-[var(--accent-muted)]">
                        {step.d}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>

                <p className="mt-5 text-center font-serif-cn text-[10.5px] text-[var(--accent-light)]">
                  说完就轻松一点了。
                </p>
              </div>
            )
          ) : (
            mailbox.messages.map((m) => {
              const mine = m.sender_id === mailbox.meId
              return (
                <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[78%] rounded-2xl px-3.5 py-2.5 font-serif-cn text-[12.5px] leading-relaxed ${
                      mine
                        ? 'bg-[var(--accent)] text-white'
                        : 'border border-[var(--accent-line)] bg-[var(--accent-soft)] text-[#3a3229]'
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{m.content}</p>
                    <p className={`mt-1 text-[9px] ${mine ? 'text-white/70' : 'text-[var(--accent-muted)]'}`}>
                      {formatStamp(m.created_at)}
                    </p>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* 写信：站主不在前台写，他回信在后台 */}
        {!isOwner && (
          <div className="border-t border-[var(--accent-line)] px-4 py-3">
            {hint && <p className="mb-2 text-[10px] text-red-500">{hint}</p>}
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault()
                    void handleSend()
                  }
                }}
                rows={2}
                maxLength={500}
                placeholder="写点想说的…"
                className="min-w-0 flex-1 resize-none rounded-2xl border border-[var(--accent-line)] bg-[var(--accent-soft)] px-3.5 py-2.5 font-serif-cn text-[12.5px] text-[#2b2620] placeholder:text-[var(--accent-muted)] focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/10"
              />
            <EmojiPicker onPick={insertEmoji} align="right" />
              <button
                type="button"
                disabled={mailbox.sending || !draft.trim()}
                onClick={() => void handleSend()}
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-[var(--accent-light)] to-[var(--accent)] text-white transition hover:shadow-[0_6px_20px_rgba(217,119,87,0.3)] disabled:opacity-50"
                aria-label="寄出"
              >
                <Icon name="send" className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-1.5 text-[9px] text-[var(--accent-muted)]">
              {draft.length}/500 · Ctrl+Enter 寄出
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
