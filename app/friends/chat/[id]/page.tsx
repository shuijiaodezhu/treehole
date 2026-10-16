'use client'

/* eslint-disable @next/next/no-img-element -- 头像用原生 img 即可，尺寸固定 */

import { useEffect, useState, useRef, Suspense } from 'react'
import { peek, save } from '../../../../components/local-store'
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

  /*
   * 聊天也「先给本机那份」
   *
   * 以前打开对话要等一次跨境请求（拉最近 200 条）才见到内容
   * 现在：本机存过这个对话 → 立刻铺上（消息本身仍然照常去同步）
   * 用 0 延迟铺数据：避开「effect 里同步 setState」的规则，也避免连锁渲染
   */
  useEffect(() => {
    if (!conversationId) return
    const paint = window.setTimeout(() => {
      const cached = peek<Message[]>('chat:' + conversationId, 30 * 60 * 1000)
      if (!cached || cached.length === 0) return
      setMessages(cached)
      setLoading(false)
    }, 0)
    // 兜底：最多 1.2 秒也撤掉等待（和首页/我的同一套思路）
    const bail = window.setTimeout(() => setLoading(false), 700)
    return () => {
      window.clearTimeout(paint)
      window.clearTimeout(bail)
    }
  }, [conversationId])

  /* 消息有变化就写回本机（包含实时收到的那条） */
  useEffect(() => {
    if (!conversationId || messages.length === 0) return
    save('chat:' + conversationId, messages)
  }, [conversationId, messages])

  /** 输入框的表情插入（插到光标处） */
  const { ref: inputRef, insert: insertEmoji } = useEmojiInsert<HTMLInputElement>(content, setContent)

  const router = useRouter()
  const supabase = createClient()
  const bottomRef = useRef<HTMLDivElement>(null)
  /** 消息滚动容器（唯一可滚区域）：只滚它，绝不碰窗口 */
  const listRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    // init 定义在组件内部，每次渲染都是新函数。把它写进依赖数组，
    // 这个 effect 每次渲染都会重跑 —— 也就是每渲染一次就重新拉一遍消息。
    // 这里本来就只想在「换了好友」时重新加载，所以刻意只依赖 friendId。
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [friendId])

  useEffect(() => {
    /*
     * 滚**消息区自己**（现在它是唯一可滚区域 → 不会碰窗口 ✓）
     *   · 首次铺消息 / 切换好友：dataset.stick 还是空的 → 落到**最新一条** ✓
     *   · 用户正往上翻历史：stick='0' → **绝不打扰** ✓
     * 所以进来就能看到最新，往上翻也稳 ✓✓
     */
    const box = listRef.current
    if (box && box.dataset.stick !== '0') box.scrollTop = box.scrollHeight
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
    /*
     * 只取最近 200 条。
     * 原来这句是 .order('created_at', { ascending: true }) 且**没有 limit** ✗
     * → 一个聊了几千条的会话会把全部消息拉回来（出站流量 + 打开变慢）。
     * 注意顺序：先倒序取 200 条（取到的是"最近"的），再翻回正序给界面用 ✓
     * 加 limit 却不改排序的话，取到的会是"最早 200 条" ✗
     */
    const { data } = await supabase
      .from('messages')
      .select('id, sender_id, content, created_at')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: false })
      .limit(200)

    if (data) setMessages([...(data as Message[])].reverse())
    if (data && conversationId) save('chat:' + conversationId, [...(data as Message[])].reverse())
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
    /*
  聊天页的正确结构（用户建议的、也是聊天软件的标准做法）：
    整页锁成**一屏高**、flex 竖排 → 页面本身**不滚动**
    只有中间的**消息区**自己滚 ✓
    → 进来能落在**最新一条** ✓ 又不会把整个页面拽下去 ✓
    → 往上翻历史也不会被拉回来 ✓
*/
    <div
      className="flex h-[100dvh] flex-col overflow-hidden bg-base-content/5 relative"
      style={pageAccentVars('friends')}
    >
      {/* 背景光晕 */}

      {/* 顶部 */}
      <header className="z-20 flex-shrink-0 bg-base-100/95 backdrop-blur-lg shadow-sm">
        <div className="max-w-xl mx-auto px-5 py-4 flex items-center gap-3">
          <Link
            href="/friends"
            className="text-base-content/60 hover:text-primary transition p-1.5 rounded-lg hover:bg-base-content/5"
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
                <img loading="lazy" decoding="async" src={friendAvatar} alt="" className="w-full h-full object-cover" />
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
      {/*
          消息区：**唯一可滚动的区域**
          onScroll 记下"用户是不是贴着底部"（dataset，不触发重渲染）
        */}
        <main
          ref={listRef}
          onScroll={(e) => {
            const el = e.currentTarget
            el.dataset.stick = el.scrollHeight - el.scrollTop - el.clientHeight < 120 ? '1' : '0'
          }}
          className="relative z-10 min-h-0 flex-1 overflow-y-auto px-5 py-4"
        >
        <div className="max-w-xl mx-auto space-y-3">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-full bg-base-content/5 flex items-center justify-center mb-4">
                <svg className="w-7 h-7 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <p className="text-sm text-base-content/60">还没有消息</p>
              <p className="text-xs text-base-content/60 mt-1.5">说点什么吧</p>
            </div>
          ) : (
            <ChatMessages messages={messages} meId={meId} bottomRef={bottomRef} />
          )}
        </div>
      </main>

      {/* 底部 */}
      <footer className="z-20 flex-shrink-0 bg-base-100/95 backdrop-blur-lg shadow-sm">
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
            className="flex-1 px-4 py-2.5 rounded-full border border-base-300 bg-base-content/5 text-sm text-base-content focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition placeholder:text-base-content/60"
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