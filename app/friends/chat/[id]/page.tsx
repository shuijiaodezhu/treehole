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
    <div className="min-h-screen flex flex-col">
      <header className="border-b bg-white p-4 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Link href="/friends" className="text-sm text-gray-500 hover:underline">
            ← 返回
          </Link>
          <h1 className="text-lg font-semibold">{friendName}</h1>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4">
        <div className="max-w-2xl mx-auto space-y-3">
          {messages.length === 0 ? (
            <p className="text-center text-gray-400 py-10">还没有消息，说点什么吧。</p>
          ) : (
            messages.map((m) => {
              const isMine = m.sender_id === meId
              return (
                <div key={m.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[70%] px-4 py-2 rounded-2xl ${
                      isMine ? 'bg-orange-500 text-white' : 'bg-white text-gray-800 shadow'
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{m.content}</p>
                    <p className={`text-xs mt-1 ${isMine ? 'text-orange-100' : 'text-gray-400'}`}>
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

      <footer className="border-t bg-white p-4 sticky bottom-0">
        <form onSubmit={handleSend} className="max-w-2xl mx-auto flex gap-2">
          <input
            type="text"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="说点什么..."
            className="flex-1 p-2 border rounded-full px-4 focus:outline-none focus:ring-2 focus:ring-orange-300"
            maxLength={500}
          />
          <button
            type="submit"
            disabled={sending || !content.trim()}
            className="px-4 py-2 bg-orange-500 text-white rounded-full hover:bg-orange-600 disabled:bg-gray-300"
          >
            发送
          </button>
        </form>
      </footer>
    </div>
  )
}

export default function ChatPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">加载中...</div>}>
      <ChatInner />
    </Suspense>
  )
}