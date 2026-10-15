'use client'

import { useEffect, useState, useRef, Suspense } from 'react'
import { createClient } from '../../../lib/supabase'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

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
  const [conversationId, setConversationId] = useState<string | null>(null)

  const router = useRouter()
  const supabase = createClient()
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    init()
  }, [friendId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

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
      .select('username, nickname')
      .eq('id', friendId)
      .single()
    if (friendProfile) {
      setFriendName(friendProfile.nickname || friendProfile.username)
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
    <div className="min-h-screen bg-[#f7f2ea] relative">
      {/* 背景光晕 */}
      <div className="fixed -top-20 -right-20 w-96 h-96 bg-[#f0b078] opacity-15 rounded-full blur-3xl pointer-events-none"></div>
      <div className="fixed -bottom-20 -left-20 w-96 h-96 bg-[#d97757] opacity-[0.08] rounded-full blur-3xl pointer-events-none"></div>

      {/* 顶部 */}
      <header className="fixed top-0 left-0 right-0 z-20 border-b border-[#e8dcc8] bg-white/95 backdrop-blur-lg shadow-[0_2px_12px_rgba(217,119,87,0.06)]">
        <div className="max-w-xl mx-auto px-5 py-4 flex items-center gap-3">
          <Link
            href="/friends"
            className="text-[#8a827a] hover:text-[#c96447] transition p-1.5 rounded-lg hover:bg-[#fef7f2]"
          >
            <IconArrow className="w-5 h-5" />
          </Link>
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#fae0cc] to-[#f9d5ba] flex items-center justify-center flex-shrink-0">
            <span className="text-sm text-[#c96447] font-semibold">{friendName[0]}</span>
          </div>
          <h1 className="text-sm font-semibold text-[#2b2620]">{friendName}</h1>
        </div>
      </header>

      {/* 消息列表 */}
      <main className="relative z-10 px-5 pt-24 pb-32">
        <div className="max-w-xl mx-auto space-y-3">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-full bg-[#fdf0e6] flex items-center justify-center mb-4">
                <svg className="w-7 h-7 text-[#d97757]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <p className="text-sm text-[#a88868]">还没有消息</p>
              <p className="text-xs text-[#b0a89e] mt-1.5">说点什么吧</p>
            </div>
          ) : (
            messages.map((m) => {
              const isMine = m.sender_id === meId
              return (
                <div key={m.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[70%] px-4 py-2.5 rounded-2xl shadow-[0_2px_12px_rgba(217,119,87,0.06)] ${
                      isMine
                        ? 'bg-gradient-to-br from-[#e8a87c] to-[#d97757] text-white rounded-tr-md'
                        : 'bg-white/95 backdrop-blur text-[#2b2620] rounded-tl-md'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{m.content}</p>
                    <p className={`text-[10px] mt-1 ${isMine ? 'text-white/70' : 'text-[#b0a89e]'}`}>
                      {new Date(m.created_at).toLocaleTimeString('zh-CN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              )
            })
          )}
          <div ref={bottomRef} />
        </div>
      </main>

      {/* 底部 */}
      <footer className="fixed bottom-0 left-0 right-0 z-20 border-t border-[#e8dcc8] bg-white/95 backdrop-blur-lg shadow-[0_-2px_12px_rgba(217,119,87,0.06)]">
        <form onSubmit={handleSend} className="max-w-xl mx-auto px-5 py-4 flex gap-2">
          <input
            type="text"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="说点什么..."
            className="flex-1 px-4 py-2.5 rounded-full border border-[#ece6dd] bg-[#fefcf9] text-sm text-[#2b2620] focus:outline-none focus:border-[#d97757] focus:ring-2 focus:ring-[#d97757]/10 transition placeholder:text-[#c0b8ae]"
            maxLength={500}
          />
          <button
            type="submit"
            disabled={sending || !content.trim()}
            className="w-11 h-11 rounded-full bg-gradient-to-r from-[#e8a87c] to-[#d97757] text-white flex items-center justify-center hover:shadow-[0_6px_20px_rgba(217,119,87,0.3)] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
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