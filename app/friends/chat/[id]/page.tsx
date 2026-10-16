'use client'

/* eslint-disable @next/next/no-img-element -- 头像用原生 img 即可，尺寸固定 */

import { useEffect, useState, useRef, Suspense } from 'react'
import { createClient } from '../../../lib/supabase'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { EmojiPicker, useEmojiInsert } from '../../../../components/emoji-picker'
import { ChatMessages } from '../../../../components/chat-bubbles'
import { useChatRealtime } from '../../../../components/chat-realtime'
import { useTypingIndicator } from '../../../../components/chat-typing'
import { useUnreadMessages } from '../../../../components/unread'
import { AffinityScore, readAffinityHidden, useAffinity } from '../../../../components/affinity'
import { StatusLabel, useStatusText } from '../../../../components/status'
import { pageAccentVars } from '../../../../components/theme'

type Message = {
  id: string
  sender_id: string
  content: string
  created_at: string
}

function IconArrow({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  )
}

function IconSend({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  )
}

function ChatInner() {
  const params = useParams()
  const friendId = params.id as string

  const [messages, setMessages] = useState<Message[]>([])
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [meId, setMeId] = useState<string | null>(null)
  const [friendName, setFriendName] = useState('好友')
  const [friendAvatar, setFriendAvatar] = useState<string | null>(null)
  const [conversationId, setConversationId] = useState<string | null>(null)

  /** 输入框的表情插入（插到光标处） */
  const { ref: inputRef, insert: insertEmoji } = useEmojiInsert<HTMLInputElement>(content, setContent)

  const router = useRouter()
  const supabase = createClient()
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // init 定义在组件内部，每次渲染都是新函数。把它写进依赖数组，
    // 这个 effect 每次渲染都会重跑 —— 也就是每渲染一次就重新拉一遍消息。
    // 这里本来就只想在「换了好友」时重新加载，所以刻意只依赖 friendId。
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [friendId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // 好感度（互动值）
  const affinity = useAffinity(meId, friendId)
  // 好友自己设的状态（没设就不显示）
  const friendStatus = useStatusText(friendId)
  const [affinityHidden, setAffinityHidden] = useState(false)
  useEffect(() => {
    if (!meId) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAffinityHidden(readAffinityHidden(meId))
  }, [meId])

  // 「对方正在输入…」（Presence，不需要 SQL）
  const { friendTyping, reportTyping, stopTyping } = useTypingIndicator(conversationId, meId, friendId)

  /*
   * 未读标记：**进来读了就要清掉**。
   * 之前这一页没有做这件事 —— 在小屋里点开聊会清，但（手机上或从展示页
   * 「去小屋聊聊」进来的）独立聊天页读完不清，于是首页/小屋的角标一直挂着。
   */
  const { markConversationRead } = useUnreadMessages(meId)

  useEffect(() => {
    if (conversationId && friendId) markConversationRead(conversationId, friendId)
  }, [conversationId, friendId, markConversationRead])

  // 实时收消息（实现见 components/chat-realtime.ts）
  useChatRealtime(conversationId, (incoming) => {
    setMessages((prev) => (prev.some((m) => m.id === incoming.id) ? prev : [...prev, incoming]))
    // 正看着这个会话，来的消息当场算读过
    if (conversationId && incoming.sender_id !== meId) {
      markConversationRead(conversationId, friendId)
    }
  }, () => {
    if (conversationId) void loadMessages(conversationId)
  })

  async function init() {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      router.push('/login')
      return
    }
    const uid = userData.user.id
    setMeId(uid)

    const { data: friendProfile } = await supabase
      .from('profiles')
      .select('username, nickname, avatar_url')
      .eq('id', friendId)
      .single()
    if (friendProfile) {
      setFriendName(friendProfile.nickname || friendProfile.username)
      setFriendAvatar(friendProfile.avatar_url ?? null)
    }

    const [u1, u2] = [uid, friendId].sort()

    let { data: conv } = await supabase
      .from('conversations')
      .select('id')
      .eq('user1_id', u1)
      .eq('user2_id', u2)
      .maybeSingle()

    if (!conv) {
      const { data: created, error } = await supabase
        .from('conversations')
        .insert({ user1_id: u1, user2_id: u2 })
        .select('id')
        .single()
      if (error) {
        console.error('创建会话失败', error)
      } else {
        conv = created
      }
    }

    if (conv) {
      setConversationId(conv.id)
      await loadMessages(conv.id)
    }

    setLoading(false)
  }

  async function loadMessages(convId: string) {
    const { data } = await supabase
      .from('messages')
      .select('id, sender_id, content, created_at')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true })

    if (data) setMessages(data as Message[])
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!content.trim() || !meId || !conversationId) return

    setSending(true)
    const text = content.trim()
    setContent('')

    const { error } = await supabase.from('messages').insert({
      conversation_id: conversationId,
      sender_id: meId,
      content: text,
    })

    if (error) {
      alert('发送失败：' + error.message)
      setContent(text)
    } else {
      stopTyping()
      stopTyping()
      await loadMessages(conversationId)
    }
    setSending(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>加载中...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-primary/5 relative" style={pageAccentVars('friends')}>
      {/* 背景光晕 */}

      {/* 顶部 */}
      <header className="fixed top-0 left-0 right-0 z-20 border-b border-base-300 bg-base-100/95 backdrop-blur-lg shadow-sm">
        <div className="max-w-xl mx-auto px-5 py-4 flex items-center gap-3">
          <Link
            href="/friends"
            className="text-base-content/60 hover:text-primary transition p-1.5 rounded-lg hover:bg-primary/5"
          >
            <IconArrow className="w-5 h-5" />
          </Link>
          {/* 点头像或名字 → 他的展示页 */}
          <Link
            href={`/u/${friendId}`}
            className="flex min-w-0 flex-shrink-0 items-center gap-2.5 transition hover:opacity-80"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-base-300 to-base-300 flex items-center justify-center flex-shrink-0 overflow-hidden">
              {friendAvatar ? (
                <img src={friendAvatar} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-sm text-primary font-semibold">{friendName[0]}</span>
              )}
            </div>
            <h1 className="min-w-0 truncate text-sm font-semibold text-base-content">{friendName}</h1>
          </Link>
          {friendStatus && <StatusLabel text={friendStatus} />}
          {friendTyping && (
            <span className="font-serif-cn text-[11px] leading-none text-accent">正在输入…</span>
          )}
          {!affinityHidden && <AffinityScore amount={affinity.mine} friendName={friendName} />}
        </div>
      </header>

      {/* 消息列表 */}
      <main className="relative z-10 px-5 pt-24 pb-32">
        <div className="max-w-xl mx-auto space-y-3">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-full bg-primary/5 flex items-center justify-center mb-4">
                <svg className="w-7 h-7 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <p className="text-sm text-base-content/60">还没有消息</p>
              <p className="text-xs text-base-content/60 mt-1.5">说点什么吧</p>
            </div>
          ) : (
            <ChatMessages messages={messages} meId={meId} friendName={friendName} bottomRef={bottomRef} />
          )}
        </div>
      </main>

      {/* 底部 */}
      <footer className="fixed bottom-0 left-0 right-0 z-20 border-t border-base-300 bg-base-100/95 backdrop-blur-lg shadow-sm">
        <form onSubmit={handleSend} className="max-w-xl mx-auto px-5 py-4 flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={content}
            onChange={(e) => {
              setContent(e.target.value)
              reportTyping()
            }}
            placeholder="说点什么... 也可以发个表情"
            className="flex-1 px-4 py-2.5 rounded-full border border-base-300 bg-primary/5 text-sm text-base-content focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition placeholder:text-base-content/60"
            maxLength={500}
          />
          <EmojiPicker onPick={insertEmoji} align="right" size="md" />
          <button
            type="submit"
            disabled={sending || !content.trim()}
            className="w-11 h-11 rounded-full bg-primary text-primary-content flex items-center justify-center hover:shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
          >
            <IconSend className="w-4 h-4" />
          </button>
        </form>
      </footer>
    </div>
  )
}

export default function ChatPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <p>加载中...</p>
        </div>
      }
    >
      <ChatInner />
    </Suspense>
  )
}