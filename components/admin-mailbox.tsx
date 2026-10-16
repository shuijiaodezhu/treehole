'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '../app/lib/supabase'
import { Icon } from './icons'
import { EmojiPicker } from './emoji-picker'
import { describeMailboxError, type MailboxErrorKind } from './mailbox'
import { MailboxSetup } from './mailbox-setup'

/**
 * 站主后台：冬日信箱收件箱
 *
 * 读的是**信箱自己的表** winter_letters，不碰好友私聊（conversations / messages），
 * 所以这里列出来的干干净净全是来信，不会和好友聊天混在一起。
 *
 * 为什么必须单独做：小屋的会话列表只列好友，不是好友的人写来的悄悄话
 * 在那里看不到——信箱必须有自己的收件箱。
 *
 * 谁能看到：由 winter_letters 的 RLS 决定（只有写信人本人和站主）。
 *
 * 匿名：这里**不查、也不显示**写信人的名字。列表里只给一个由 uuid 末尾
 * 随机四位组成的固定代号（如「来信人 7F3A」）——代号稳定，所以能跟同一
 * 个人的往来，但看不出是谁。（数据库里仍记着这封信属于哪个信箱，
 * 否则回信送不到；所以这是界面层面的匿名。）
 * 已读状态放在本地（localStorage 里一个 threadId → 时间 的表），
 * 不给表加 update 策略，信寄出去就改不了。
 */

const supabase = createClient()

const SEEN_KEY = (uid: string) => `treehole:seen:wintermail:${uid}`

type Letter = {
  id: string
  sender_id: string
  content: string
  created_at: string
}

type Row = {
  threadUserId: string
  /** 匿名代号，不是真名 */
  label: string
  lastAt: string
  lastText: string
  fromMe: boolean
  unread: boolean
}

function readSeenMap(uid: string): Record<string, string> {
  try {
    const raw = window.localStorage.getItem(SEEN_KEY(uid))
    return raw ? (JSON.parse(raw) as Record<string, string>) : {}
  } catch {
    return {}
  }
}

function writeSeenMap(uid: string, map: Record<string, string>) {
  try {
    window.localStorage.setItem(SEEN_KEY(uid), JSON.stringify(map))
  } catch {
    /* 隐私模式忽略 */
  }
}

/**
 * 匿名代号：取 uuid 去掉横线后的末尾四位。
 * uuid v4 末四位是随机的，不含任何身份信息；同一个信箱永远得到同一个代号，
 * 所以站主能延续同一段对话，却不知道对方是谁。
 */
function labelOf(threadUserId: string): string {
  return '来信人 ' + threadUserId.replace(/-/g, '').slice(-4).toUpperCase()
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
  const [letters, setLetters] = useState<Letter[]>([])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [threadLoading, setThreadLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [errorKind, setErrorKind] = useState<MailboxErrorKind | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error: loadError } = await supabase
        .from('winter_letters')
        .select('id, thread_user_id, sender_id, content, created_at')
        .order('created_at', { ascending: false })
        .limit(500)

      if (loadError) throw loadError

      const all = (data ?? []) as (Letter & { thread_user_id: string })[]
      if (all.length === 0) {
        setRows([])
        setError('')
        setErrorKind(null)
        return
      }

      // 每个信箱取最新一封
      const latest = new Map<string, Letter & { thread_user_id: string }>()
      for (const letter of all) {
        if (!latest.has(letter.thread_user_id)) latest.set(letter.thread_user_id, letter)
      }

      const seenNow = readSeenMap(adminId)
      const built: Row[] = [...latest.keys()]
        .map((threadUserId) => {
          const last = latest.get(threadUserId)!
          return {
            threadUserId,
            label: labelOf(threadUserId),
            lastAt: last.created_at,
            lastText: last.content,
            fromMe: last.sender_id === adminId,
            // 最新一封是对方写的、而且比上次看过的新 → 未读
            unread: last.sender_id !== adminId && last.created_at > (seenNow[threadUserId] ?? ''),
          }
        })
        .sort((a, b) => b.lastAt.localeCompare(a.lastAt))

      setRows(built)
      setError('')
      setErrorKind(null)
    } catch (err) {
      console.error('加载冬日信箱失败:', err)
      const described = describeMailboxError(err)
      setError(described.message)
      setErrorKind(described.kind)
    } finally {
      setLoading(false)
    }
  }, [adminId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  const openThread = useCallback(
    async (row: Row) => {
      setActive(row)
      setLetters([])
      setThreadLoading(true)
      setMessage('')
      try {
        const { data, error: loadError } = await supabase
          .from('winter_letters')
          .select('id, sender_id, content, created_at')
          .eq('thread_user_id', row.threadUserId)
          .order('created_at', { ascending: true })
          .limit(300)
        if (loadError) throw loadError
        setLetters((data ?? []) as Letter[])

        // 标记这个信箱已看过
        writeSeenMap(adminId, { ...readSeenMap(adminId), [row.threadUserId]: row.lastAt })
        setRows((prev) => prev.map((r) => (r.threadUserId === row.threadUserId ? { ...r, unread: false } : r)))
      } catch (err) {
        console.error('读取来信失败:', err)
        setMessage(describeMailboxError(err).message)
      } finally {
        setThreadLoading(false)
        window.requestAnimationFrame(() => {
          const el = listRef.current
          if (el) el.scrollTop = el.scrollHeight
        })
      }
    },
    [adminId],
  )

  async function handleReply() {
    const content = draft.trim()
    if (!content || !active) return
    setSending(true)
    setMessage('')
    try {
      const { data, error: sendError } = await supabase
        .from('winter_letters')
        .insert({ thread_user_id: active.threadUserId, sender_id: adminId, content })
        .select('id, sender_id, content, created_at')
        .single()
      if (sendError) throw sendError

      const letter = data as Letter
      setLetters((prev) => [...prev, letter])
      setDraft('')
      setRows((prev) =>
        prev.map((r) =>
          r.threadUserId === active.threadUserId
            ? { ...r, lastAt: letter.created_at, lastText: content, fromMe: true, unread: false }
            : r,
        ),
      )
      window.requestAnimationFrame(() => {
        const el = listRef.current
        if (el) el.scrollTop = el.scrollHeight
      })
    } catch (err) {
      console.error('回信失败:', err)
      setMessage(describeMailboxError(err).message)
    } finally {
      setSending(false)
    }
  }

  const total = useMemo(() => rows.length, [rows])
  const unreadTotal = useMemo(() => rows.filter((r) => r.unread).length, [rows])

  return (
    <section className="rounded-box border border-[#e0d4e8] bg-base-100/80 p-6 backdrop-blur shadow-sm">
      <div className="mb-5 flex items-start gap-3">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#f0e6f8]">
          <Icon name="mail" className="h-4 w-4 text-[#8a7aaa]" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="flex items-baseline gap-2 text-sm font-semibold text-base-content">
            冬日信箱
            {unreadTotal > 0 && (
              <span className="rounded-full bg-[#a88ab8] px-2 py-0.5 text-[11px] font-normal text-white">
                {unreadTotal} 封新的
              </span>
            )}
          </h2>
          <p className="mt-1 text-[11px] leading-relaxed text-[#8a7a9a]">
            这里收到的，都是他们不好意思跟别人说的话
          </p>
          <p className="mt-0.5 text-[11px] text-[#b8a8c8]">
            共 {total} 位来信人 · 匿名，你不会知道他们是谁
          </p>
          <p className="mt-0.5 text-[11px] text-[#b8a8c8]">
            回信会送到对方信箱，只有他看得到
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-1 rounded-box border border-[#e0d4e8] bg-base-100 px-3 py-1.5 text-xs text-[#8a7aaa] transition hover:bg-[#faf5ff]"
        >
          <Icon name="refresh" className="h-3.5 w-3.5" />
          刷新
        </button>
      </div>

      {errorKind === 'missing-table' ? (
        <div className="mb-4">
          <MailboxSetup accent="purple" onRetry={() => void load()} />
        </div>
      ) : (
        error && (
          <p className="mb-4 rounded-box border border-red-100 bg-red-50 px-4 py-3 text-xs text-red-600">{error}</p>
        )
      )}

      {loading && rows.length === 0 ? (
        <p className="py-10 text-center text-xs text-[#b8a8c8]">加载中…</p>
      ) : rows.length === 0 ? (
        <p className="py-10 text-center text-xs text-[#b8a8c8]">
          暂时还没有人来信。有人写下烦心事，就会出现在这里。
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-[260px_1fr]">
          {/* 来信人 */}
          <nav className="max-h-[420px] space-y-1.5 overflow-y-auto pr-1">
            {rows.map((r) => (
              <button
                key={r.threadUserId}
                type="button"
                onClick={() => void openThread(r)}
                className={`w-full rounded-box px-3 py-2.5 text-left transition ${
                  active?.threadUserId === r.threadUserId ? 'bg-[#f0e6f8]' : 'hover:bg-[#faf5ff]'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className="truncate text-xs font-medium text-base-content">{r.label}</span>
                  {r.unread && <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#a88ab8]" />}
                  <span className="ml-auto flex-shrink-0 text-[11px] text-[#b8a8c8]">{stamp(r.lastAt)}</span>
                </span>
                <span className="mt-0.5 block truncate text-[11px] text-[#8a7a9a]">
                  {r.fromMe ? '我：' : ''}
                  {r.lastText}
                </span>
              </button>
            ))}
          </nav>

          {/* 读信 / 回信 */}
          <div className="flex min-h-[320px] min-w-0 flex-col rounded-box border border-[#e0d4e8] bg-[#fcf8ff]">
            {!active ? (
              <p className="m-auto py-10 text-center text-xs text-[#b8a8c8]">左边选一个人，看看他写了什么</p>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-[#ece4f4] px-4 py-3">
                  <span className="text-xs font-medium text-base-content">{active.label}</span>
                  <span className="text-[11px] text-[#b8a8c8]">写来的</span>
                  <span className="ml-auto text-[11px] text-[#c8b8d8]">只有你和对方看得到</span>
                  {message && <span className="w-full text-[11px] text-[#8a7aaa]">{message}</span>}
                </div>

                <div ref={listRef} className="max-h-[300px] flex-1 space-y-3 overflow-y-auto px-4 py-4">
                  {threadLoading ? (
                    <p className="py-8 text-center text-xs text-[#b8a8c8]">开信箱中…</p>
                  ) : letters.length === 0 ? (
                    <p className="py-8 text-center text-xs text-[#b8a8c8]">这个信箱还没有信</p>
                  ) : (
                    letters.map((m) => {
                      const mine = m.sender_id === adminId
                      return (
                        <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                          <div
                            className={`max-w-[78%] rounded-box px-3.5 py-2.5 font-serif-cn text-[12.5px] leading-relaxed ${
                              mine
                                ? 'bg-gradient-to-r from-[#b89ac8] to-[#a88ab8] text-white'
                                : 'border border-[#ece4f4] bg-base-100 text-[#3a3229]'
                            }`}
                          >
                            <p className="whitespace-pre-wrap break-words">{m.content}</p>
                            <p className={`mt-1 text-[11px] ${mine ? 'text-white/70' : 'text-[#b8a8c8]'}`}>
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
                      placeholder={`回 ${active.label} 一封…`}
                      className="min-w-0 flex-1 resize-none rounded-box border border-[#e0d4e8] bg-base-100 px-3.5 py-2.5 font-serif-cn text-[12.5px] text-base-content focus:border-[#a88ab8] focus:outline-none"
                    />
                    <EmojiPicker onPick={(emoji) => setDraft((cur) => cur + emoji)} align="right" />
                    <button
                      type="button"
                      disabled={sending || !draft.trim()}
                      onClick={() => void handleReply()}
                      className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-[#b89ac8] to-[#a88ab8] text-white transition hover:shadow-sm disabled:opacity-50"
                      aria-label="回信"
                    >
                      <Icon name="send" className="h-4 w-4" />
                    </button>
                  </div>
                  <p className="mt-1.5 text-[11px] text-[#b8a8c8]">{draft.length}/500 · Ctrl+Enter 寄出</p>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
