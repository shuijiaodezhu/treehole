'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '../app/lib/supabase'
import { Icon } from './icons'
import { EmojiPicker, useEmojiInsert } from './emoji-picker'
import { ADMIN_UUID } from './utils'

/**
 * 冬日信箱
 *
 * 写烦心事、悄悄话给站主，点对点，只有站主看得到。
 *
 * 数据上直接复用现有的私信表：conversations（按排序后的两个 uid 建会话）
 * + messages。所以**不需要任何新的 SQL**，站主也能在原来的好友聊天里回信。
 *
 * 未读数自己记：把「上次读到的时间」放在 localStorage，
 * 不跟好友私信的已读标记混在一起。
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
  conversationId: string | null
  messages: MailboxMessage[]
  unread: number
  loading: boolean
  sending: boolean
  error: string
  send: (text: string) => Promise<{ ok: boolean; message?: string }>
  markRead: () => void
  refresh: () => void
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
  const [conversationId, setConversationId] = useState<string | null>(null)
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
    if (!meId || meId === ADMIN_UUID) {
      const frame = window.requestAnimationFrame(() => {
        setConversationId(null)
        setMessages([])
      })
      return () => window.cancelAnimationFrame(frame)
    }

    let cancelled = false
    void (async () => {
      setLoading(true)
      try {
        // 会话按「排序后的两个 uid」唯一，和好友私信同一套规则
        const [u1, u2] = [meId, ADMIN_UUID].sort()

        let { data: conv } = await supabase
          .from('conversations')
          .select('id')
          .eq('user1_id', u1)
          .eq('user2_id', u2)
          .maybeSingle()

        if (!conv) {
          const { data: created, error: createError } = await supabase
            .from('conversations')
            .insert({ user1_id: u1, user2_id: u2 })
            .select('id')
            .single()
          if (createError) throw createError
          conv = created
        }

        if (!conv) throw new Error('没能建立信箱')
        if (cancelled) return
        setConversationId(conv.id)

        const { data, error: msgError } = await supabase
          .from('messages')
          .select('id, sender_id, content, created_at')
          .eq('conversation_id', conv.id)
          .order('created_at', { ascending: true })
          .limit(200)

        if (msgError) throw msgError
        if (!cancelled) {
          setMessages((data ?? []) as MailboxMessage[])
          setError('')
        }
      } catch (err) {
        console.error('打开冬日信箱失败:', err)
        if (!cancelled) setError('信箱暂时打不开，稍后再试')
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
      const body = text.trim()
      if (!meId) return { ok: false, message: '请先登录' }
      if (!conversationId) return { ok: false, message: '信箱还没准备好' }
      if (!body) return { ok: false, message: '写点什么呢' }

      setSending(true)
      try {
        const { data, error: sendError } = await supabase
          .from('messages')
          .insert({ conversation_id: conversationId, sender_id: meId, content: body })
          .select('id, sender_id, content, created_at')
          .single()

        if (sendError) throw sendError
        setMessages((prev) => [...prev, data as MailboxMessage])
        return { ok: true }
      } catch (err) {
        const msg =
          err && typeof err === 'object' && 'message' in err
            ? String((err as { message: unknown }).message)
            : String(err)
        console.error('寄信失败:', err)
        return { ok: false, message: msg }
      } finally {
        setSending(false)
      }
    },
    [meId, conversationId],
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
    conversationId,
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
              {isOwner ? '大家写给你的悄悄话' : '只有站主看得到，一封一封回'}
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
            <div className="py-10 text-center">
              <p className="font-serif-cn text-sm text-[#5a4a3a]">信箱还是空的</p>
              <p className="mt-1.5 font-serif-cn text-[11px] leading-relaxed text-[var(--accent-muted)]">
                烦心事、说不出口的话，
                <br />
                写下来，站主会看。
              </p>
            </div>
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

        {/* 写信 */}
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
              placeholder={isOwner ? '回一封…' : '写给站主…'}
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
      </div>
    </div>
  )
}
