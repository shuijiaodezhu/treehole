'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '../app/lib/supabase'
import { Icon } from './icons'
import { EmojiPicker } from './emoji-picker'

/**
 * 站主后台：冬日信箱收件箱
 *
 * 为什么必须单独做：小屋的会话列表只列**好友**，
 * 不是好友的人写来的悄悄话在那里看不到。这里直接按「我是参与人」
 * 把所有会话列出来，所以谁写的都能收到并回信。
 *
 * 不需要任何新表：用户端写在 conversations + messages，
 * 这里读同一批数据、以站主身份回信。
 */

const supabase = createClient()

type Message = {
  id: string
  sender_id: string
  content: string
  created_at: string
}

type Row = {
  conversationId: string
  otherId: string
  otherName: string
  lastAt: string
  lastText: string
  fromMe: boolean
}

function stamp(iso: string): string {
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

export function AdminMailbox({ adminId }: { adminId: string }) {
  const [rows, setRows] = useState<Row[]>([])
  const [active, setActive] = useState<Row | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [threadLoading, setThreadLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const listRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data: convs, error: convError } = await supabase
        .from('conversations')
        .select('id, user1_id, user2_id')
        .or(`user1_id.eq.${adminId},user2_id.eq.${adminId}`)

      if (convError) throw convError
      const list = (convs ?? []) as { id: string; user1_id: string; user2_id: string }[]
      if (list.length === 0) {
        setRows([])
        setError('')
        return
      }

      const convIds = list.map((c) => c.id)
      const otherIds = [...new Set(list.map((c) => (c.user1_id === adminId ? c.user2_id : c.user1_id)))]

      const [{ data: profiles }, { data: msgs }] = await Promise.all([
        supabase.from('profiles').select('id, nickname, username').in('id', otherIds),
        supabase
          .from('messages')
          .select('conversation_id, sender_id, content, created_at')
          .in('conversation_id', convIds)
          .order('created_at', { ascending: false })
          .limit(500),
      ])

      const nameOf = (id: string) => {
        const p = (profiles ?? []).find((x) => x.id === id)
        return p?.nickname || p?.username || '某人'
      }

      // 每个会话取最新一条
      const lastByConv = new Map<string, Message & { conversation_id: string }>()
      for (const m of (msgs ?? []) as (Message & { conversation_id: string })[]) {
        if (!lastByConv.has(m.conversation_id)) lastByConv.set(m.conversation_id, m)
      }

      const built: Row[] = list
        .map((c) => {
          const otherId = c.user1_id === adminId ? c.user2_id : c.user1_id
          const last = lastByConv.get(c.id)
          return {
            conversationId: c.id,
            otherId,
            otherName: nameOf(otherId),
            lastAt: last?.created_at ?? '',
            lastText: last?.content ?? '（还没有消息）',
            fromMe: last?.sender_id === adminId,
          }
        })
        .sort((a, b) => (b.lastAt || '').localeCompare(a.lastAt || ''))

      setRows(built)
      setError('')
    } catch (err) {
      console.error('加载信箱失败:', err)
      setError('加载失败（conversations / messages 的读取策略可能没生效）')
    } finally {
      setLoading(false)
    }
  }, [adminId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  const openThread = useCallback(async (row: Row) => {
    setActive(row)
    setMessages([])
    setThreadLoading(true)
    setMessage('')
    try {
      const { data, error: msgError } = await supabase
        .from('messages')
        .select('id, sender_id, content, created_at')
        .eq('conversation_id', row.conversationId)
        .order('created_at', { ascending: true })
        .limit(300)
      if (msgError) throw msgError
      setMessages((data ?? []) as Message[])
    } catch (err) {
      console.error('读取短信失败:', err)
      setMessage('这封信打不开')
    } finally {
      setThreadLoading(false)
      window.requestAnimationFrame(() => {
        const el = listRef.current
        if (el) el.scrollTop = el.scrollHeight
      })
    }
  }, [])

  async function handleReply() {
    const body = draft.trim()
    if (!body || !active) return
    setSending(true)
    setMessage('')
    try {
      const { data, error: sendError } = await supabase
        .from('messages')
        .insert({ conversation_id: active.conversationId, sender_id: adminId, content: body })
        .select('id, sender_id, content, created_at')
        .single()
      if (sendError) throw sendError

      setMessages((prev) => [...prev, data as Message])
      setDraft('')
      // 顺手更新列表里的最新一条
      setRows((prev) =>
        prev.map((r) =>
          r.conversationId === active.conversationId
            ? { ...r, lastAt: (data as Message).created_at, lastText: body, fromMe: true }
            : r,
        ),
      )
      window.requestAnimationFrame(() => {
        const el = listRef.current
        if (el) el.scrollTop = el.scrollHeight
      })
    } catch (err) {
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: unknown }).message)
          : String(err)
      setMessage('回信失败：' + msg)
    } finally {
      setSending(false)
    }
  }

  const total = useMemo(() => rows.length, [rows])

  return (
    <section className="rounded-3xl border border-[#e0d4e8] bg-white/80 p-6 backdrop-blur shadow-[0_2px_12px_rgba(168,138,184,0.06)]">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f0e6f8]">
          <Icon name="mail" className="h-4 w-4 text-[#8a7aaa]" />
        </div>
        <div className="flex-1">
          <h2 className="text-sm font-semibold text-[#2b2430]">冬日信箱</h2>
          <p className="mt-0.5 text-[10px] text-[#b8a8c8]">
            用户从首页写给你的悄悄话 · 共 {total} 个来信人（含好友私信）
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-1 rounded-xl border border-[#e0d4e8] bg-white px-3 py-1.5 text-xs text-[#8a7aaa] transition hover:bg-[#faf5ff]"
        >
          <Icon name="refresh" className="h-3.5 w-3.5" />
          刷新
        </button>
      </div>

      {error && (
        <p className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-xs text-red-600">{error}</p>
      )}

      {loading && rows.length === 0 ? (
        <p className="py-10 text-center text-xs text-[#b8a8c8]">加载中…</p>
      ) : rows.length === 0 ? (
        <p className="py-10 text-center text-xs text-[#b8a8c8]">还没有人来信</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-[260px_1fr]">
          {/* 来信人列表 */}
          <nav className="max-h-[420px] space-y-1.5 overflow-y-auto pr-1">
            {rows.map((r) => (
              <button
                key={r.conversationId}
                type="button"
                onClick={() => void openThread(r)}
                className={`w-full rounded-xl px-3 py-2.5 text-left transition ${
                  active?.conversationId === r.conversationId
                    ? 'bg-[#f0e6f8]'
                    : 'hover:bg-[#faf5ff]'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className="truncate text-xs font-medium text-[#2b2430]">{r.otherName}</span>
                  <span className="ml-auto flex-shrink-0 text-[9px] text-[#b8a8c8]">{stamp(r.lastAt)}</span>
                </span>
                <span className="mt-0.5 block truncate text-[10px] text-[#8a7a9a]">
                  {r.fromMe ? '我：' : ''}
                  {r.lastText}
                </span>
              </button>
            ))}
          </nav>

          {/* 读信 / 回信 */}
          <div className="flex min-h-[320px] min-w-0 flex-col rounded-2xl border border-[#e0d4e8] bg-[#fcf8ff]">
            {!active ? (
              <p className="m-auto py-10 text-center text-xs text-[#b8a8c8]">
                左边选一个人，看看他写了什么
              </p>
            ) : (
              <>
                <div className="flex items-center gap-2 border-b border-[#ece4f4] px-4 py-3">
                  <span className="text-xs font-medium text-[#2b2430]">{active.otherName}</span>
                  <span className="text-[10px] text-[#b8a8c8]">的来信</span>
                  {message && <span className="ml-auto text-[10px] text-[#8a7aaa]">{message}</span>}
                </div>

                <div ref={listRef} className="max-h-[300px] flex-1 space-y-3 overflow-y-auto px-4 py-4">
                  {threadLoading ? (
                    <p className="py-8 text-center text-xs text-[#b8a8c8]">开信箱中…</p>
                  ) : messages.length === 0 ? (
                    <p className="py-8 text-center text-xs text-[#b8a8c8]">这个会话还没有消息</p>
                  ) : (
                    messages.map((m) => {
                      const mine = m.sender_id === adminId
                      return (
                        <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                          <div
                            className={`max-w-[78%] rounded-2xl px-3.5 py-2.5 font-serif-cn text-[12.5px] leading-relaxed ${
                              mine
                                ? 'bg-gradient-to-r from-[#b89ac8] to-[#a88ab8] text-white'
                                : 'border border-[#ece4f4] bg-white text-[#3a3229]'
                            }`}
                          >
                            <p className="whitespace-pre-wrap break-words">{m.content}</p>
                            <p className={`mt-1 text-[9px] ${mine ? 'text-white/70' : 'text-[#b8a8c8]'}`}>
                              {stamp(m.created_at)}
                            </p>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>

                <div className="border-t border-[#ece4f4] px-3 py-3">
                  <div className="flex items-end gap-2">
                    <textarea
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                          e.preventDefault()
                          void handleReply()
                        }
                      }}
                      rows={2}
                      maxLength={500}
                      placeholder={`回 ${active.otherName} 一封…`}
                      className="min-w-0 flex-1 resize-none rounded-2xl border border-[#e0d4e8] bg-white px-3.5 py-2.5 font-serif-cn text-[12.5px] text-[#2b2430] focus:border-[#a88ab8] focus:outline-none"
                    />
                    <EmojiPicker onPick={(emoji) => setDraft((cur) => cur + emoji)} align="right" />
                    <button
                      type="button"
                      disabled={sending || !draft.trim()}
                      onClick={() => void handleReply()}
                      className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-[#b89ac8] to-[#a88ab8] text-white transition hover:shadow-[0_6px_20px_rgba(168,138,184,0.3)] disabled:opacity-50"
                      aria-label="回信"
                    >
                      <Icon name="send" className="h-4 w-4" />
                    </button>
                  </div>
                  <p className="mt-1.5 text-[9px] text-[#b8a8c8]">{draft.length}/500 · Ctrl+Enter 寄出</p>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
