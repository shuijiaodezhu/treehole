'use client'
/* eslint-disable @next/next/no-img-element -- 头像用原生 img 即可，尺寸固定 */

import { useEffect, useMemo, useState, useRef } from 'react'
import { createClient } from '../lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { markMomentsSeen, useMomentsBadge, useUnreadMessages } from '../../components/unread'
import { useBlocks } from '../../components/blocks'

type Friend = {
  friendship_id: string
  friend_id: string
  username: string
  nickname: string | null
  avatar_url: string | null
  signature: string | null
}

type Request = {
  friendship_id: string
  requester_id: string
  username: string
  nickname: string | null
  avatar_url: string | null
}

type Message = {
  id: string
  sender_id: string
  content: string
  created_at: string
}

type Comment = {
  id: string
  post_id: string
  author_id: string
  content: string
  created_at: string
  author_name: string
  author_avatar: string | null
  parent_id: string | null
  parent_name?: string | null
}

type SearchResult = {
  id: string
  username: string
  nickname: string | null
  avatar_url: string | null
  signature: string | null
}

type Moment = {
  id: string
  author_id: string
  content: string
  created_at: string
  author_name: string
  author_avatar: string | null
  like_count: number
  liked_by_me: boolean
  comments: Comment[]
}

function IconPlus({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
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

function IconHeart({ className = '', filled = false }: { className?: string; filled?: boolean }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  )
}

function IconComment({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  )
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function FriendsPage() {
  const [mode, setMode] = useState<'friends' | 'moments'>('friends')

  const [friends, setFriends] = useState<Friend[]>([])
  const [requests, setRequests] = useState<Request[]>([])
  const [loading, setLoading] = useState(true)
  const [meId, setMeId] = useState<string | null>(null)
  const [friendName, setFriendName] = useState('')
  const [currentFriend, setCurrentFriend] = useState<Friend | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [content, setContent] = useState('')
  const [sending, setSending] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)

  const [moments, setMoments] = useState<Moment[]>([])
  const [momentContent, setMomentContent] = useState('')
  const [postingMoment, setPostingMoment] = useState(false)

  const [openCommentId, setOpenCommentId] = useState<string | null>(null)
  const [commentInputs, setCommentInputs] = useState<{ [key: string]: string }>({})
  const [postingComment, setPostingComment] = useState<string | null>(null)
  const [replyingTo, setReplyingTo] = useState<Comment | null>(null)

  const [showAdd, setShowAdd] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null)
  const [searching, setSearching] = useState(false)
  const [searchMessage, setSearchMessage] = useState('')

  const [showChatOnMobile, setShowChatOnMobile] = useState(false)

  const router = useRouter()
  const supabase = createClient()
  const bottomRef = useRef<HTMLDivElement>(null)

  // 未读私信（按会话统计）+ 朋友圈是否有新动态
  const unread = useUnreadMessages(meId)
  const momentsHasNew = useMomentsBadge(meId, mode === 'moments')

  // 拉黑：被拉黑（含拉黑我的）的人不出现在好友列表 / 申请列表，其消息也不显示
  const blocks = useBlocks(meId)
  const hidden = blocks.hiddenIds
  const shownFriends = useMemo(
    () => friends.filter((f) => !hidden.has(f.friend_id)),
    [friends, hidden],
  )
  const shownRequests = useMemo(
    () => requests.filter((r) => !hidden.has(r.requester_id)),
    [requests, hidden],
  )
  const shownMessages = useMemo(
    () => messages.filter((m) => !hidden.has(m.sender_id)),
    [messages, hidden],
  )

  // 好友 id → 会话 id
  const conversationByFriend = useMemo(() => {
    const map: Record<string, string> = {}
    for (const [convId, friendId] of Object.entries(unread.friendIdByConversation)) {
      map[friendId] = convId
    }
    return map
  }, [unread.friendIdByConversation])

  useEffect(() => {
    // loadAll 是函数声明（提升），此处引用安全；规则无法识别
    // eslint-disable-next-line react-hooks/immutability
    loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (mode === 'moments' && meId) {
      // loadMoments 是函数声明（提升），此处引用安全；规则无法识别
      // eslint-disable-next-line react-hooks/immutability
      loadMoments(meId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, meId])

  // 切到朋友圈就算看过，顺便消除页签上的点
  useEffect(() => {
    if (mode !== 'moments' || !meId) return
    const frame = window.requestAnimationFrame(() => markMomentsSeen(meId))
    return () => window.cancelAnimationFrame(frame)
  }, [mode, meId])

  async function loadAll() {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      router.push('/login')
      return
    }
    const uid = userData.user.id
    setMeId(uid)

    const { data: accepted } = await supabase
      .from('friendships')
      .select('id, requester_id, addressee_id')
      .or(`requester_id.eq.${uid},addressee_id.eq.${uid}`)
      .eq('status', 'accepted')

    if (accepted && accepted.length > 0) {
      const friendIds = accepted.map((f) =>
        f.requester_id === uid ? f.addressee_id : f.requester_id
      )
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, username, nickname, avatar_url, signature')
        .in('id', friendIds)

      const list: Friend[] = accepted.map((f) => {
        const fid = f.requester_id === uid ? f.addressee_id : f.requester_id
        const p = profilesData?.find((x) => x.id === fid)
        return {
          friendship_id: f.id,
          friend_id: fid,
          username: p?.username || '未知',
          nickname: p?.nickname || null,
          avatar_url: p?.avatar_url || null,
          signature: p?.signature || null,
        }
      })
      setFriends(list)

      if (list.length > 0 && !currentFriend) {
        openFriend(list[0], uid)
      }
    } else {
      setFriends([])
    }

    const { data: pending } = await supabase
      .from('friendships')
      .select('id, requester_id')
      .eq('addressee_id', uid)
      .eq('status', 'pending')

    if (pending && pending.length > 0) {
      const reqIds = pending.map((r) => r.requester_id)
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, username, nickname, avatar_url')
        .in('id', reqIds)

      const list: Request[] = pending.map((r) => {
        const p = profilesData?.find((x) => x.id === r.requester_id)
        return {
          friendship_id: r.id,
          requester_id: r.requester_id,
          username: p?.username || '未知',
          nickname: p?.nickname || null,
          avatar_url: p?.avatar_url || null,
        }
      })
      setRequests(list)
    } else {
      setRequests([])
    }

    setLoading(false)
  }

  async function openFriend(friend: Friend, uid?: string) {
    const myId = uid || meId
    if (!myId) return
    setCurrentFriend(friend)
    setFriendName(friend.nickname || friend.username)
    setShowChatOnMobile(true)

    const [u1, u2] = [myId, friend.friend_id].sort()

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
        return
      }
      conv = created
    }

    if (conv) {
      setConversationId(conv.id)
      // 打开即视为已读：清掉这个好友的未读角标
      unread.markConversationRead(conv.id, friend.friend_id)
      await loadMessages(conv.id)
    }
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

  async function loadMoments(uid: string) {
    const { data: friendships } = await supabase
      .from('friendships')
      .select('requester_id, addressee_id')
      .or(`requester_id.eq.${uid},addressee_id.eq.${uid}`)
      .eq('status', 'accepted')

    const friendIds: string[] = []
    if (friendships) {
      friendships.forEach((f) => {
        friendIds.push(f.requester_id === uid ? f.addressee_id : f.requester_id)
      })
    }

    const allowedIds = [uid, ...friendIds]

    const { data: postsData } = await supabase
      .from('friend_posts')
      .select('id, author_id, content, created_at')
      .in('author_id', allowedIds)
      .order('created_at', { ascending: false })
      .limit(50)

    if (!postsData || postsData.length === 0) {
      setMoments([])
      return
    }

    const postIds = postsData.map((p) => p.id)
    const authorIds = [...new Set(postsData.map((p) => p.author_id))]

    const { data: likesData } = await supabase
      .from('friend_likes')
      .select('post_id, user_id')
      .in('post_id', postIds)

    const { data: commentsData } = await supabase
      .from('friend_comments')
      .select('id, post_id, author_id, content, created_at, parent_id')
      .in('post_id', postIds)
      .order('created_at', { ascending: true })

    const commentAuthorIds = commentsData
      ? [...new Set(commentsData.map((c) => c.author_id))]
      : []
    const allAuthorIds = [...new Set([...authorIds, ...commentAuthorIds])]

    const { data: allProfilesData } = await supabase
      .from('profiles')
      .select('id, username, nickname, avatar_url')
      .in('id', allAuthorIds)

    const list: Moment[] = postsData.map((p) => {
      const prof = allProfilesData?.find((x) => x.id === p.author_id)
      const postLikes = likesData?.filter((l) => l.post_id === p.id) || []
      const postComments = (commentsData || [])
        .filter((c) => c.post_id === p.id)
        .map((c) => {
          const cp = allProfilesData?.find((x) => x.id === c.author_id)
          let parentName: string | null = null
          if (c.parent_id) {
            const parentComment = commentsData?.find((x) => x.id === c.parent_id)
            if (parentComment) {
              const pp = allProfilesData?.find((x) => x.id === parentComment.author_id)
              parentName = pp?.nickname || pp?.username || '某人'
            }
          }
          return {
            id: c.id,
            post_id: c.post_id,
            author_id: c.author_id,
            content: c.content,
            created_at: c.created_at,
            author_name: cp?.nickname || cp?.username || '某人',
            author_avatar: cp?.avatar_url || null,
            parent_id: c.parent_id || null,
            parent_name: parentName,
          }
        })

      return {
        id: p.id,
        author_id: p.author_id,
        content: p.content,
        created_at: p.created_at,
        author_name: prof?.nickname || prof?.username || '某人',
        author_avatar: prof?.avatar_url || null,
        like_count: postLikes.length,
        liked_by_me: postLikes.some((l) => l.user_id === uid),
        comments: postComments,
      }
    })

    setMoments(list)
  }

  async function handlePostMoment(e: React.FormEvent) {
    e.preventDefault()
    if (!momentContent.trim() || !meId) return

    setPostingMoment(true)
    const { error } = await supabase.from('friend_posts').insert({
      author_id: meId,
      content: momentContent.trim(),
    })

    if (error) {
      alert('发布失败：' + error.message)
    } else {
      setMomentContent('')
      await loadMoments(meId)
    }
    setPostingMoment(false)
  }

  async function handleLike(postId: string, liked: boolean) {
    if (!meId) return

    if (liked) {
      await supabase
        .from('friend_likes')
        .delete()
        .eq('post_id', postId)
        .eq('user_id', meId)
    } else {
      await supabase.from('friend_likes').insert({
        post_id: postId,
        user_id: meId,
      })
    }
    if (meId) await loadMoments(meId)
  }

  async function handlePostComment(postId: string) {
    const text = commentInputs[postId]?.trim()
    if (!text || !meId) return

    setPostingComment(postId)
    const { error } = await supabase.from('friend_comments').insert({
      post_id: postId,
      author_id: meId,
      content: text,
      parent_id: replyingTo?.parent_id || replyingTo?.id || null,
    })

    if (error) {
      alert('评论失败：' + error.message)
    } else {
      setCommentInputs({ ...commentInputs, [postId]: '' })
      setReplyingTo(null)
      await loadMoments(meId)
    }
    setPostingComment(null)
  }

  async function handleSearch() {
    if (!searchInput.trim()) return
    setSearching(true)
    setSearchResult(null)
    setSearchMessage('')

    const keyword = searchInput.trim()
    const { data } = await supabase
      .from('profiles')
      .select('id, username, nickname, avatar_url, signature')
      .or(`username.eq.${keyword},nickname.eq.${keyword}`)
      .limit(1)

    if (data && data.length > 0) {
      const found = data[0]
      if (found.id === meId) {
        setSearchMessage('这是你自己')
      } else {
        setSearchResult(found)
      }
    } else {
      setSearchMessage('没找到这个人（要输入完整的用户名或昵称）')
    }
    setSearching(false)
  }

  async function handleAddFriend(targetId: string) {
    if (!meId) return

    const { data: existing } = await supabase
      .from('friendships')
      .select('id, status')
      .or(
        `and(requester_id.eq.${meId},addressee_id.eq.${targetId}),and(requester_id.eq.${targetId},addressee_id.eq.${meId})`
      )

    if (existing && existing.length > 0) {
      alert('你们已经是好友，或者已经发过申请了')
      return
    }

    const { error } = await supabase.from('friendships').insert({
      requester_id: meId,
      addressee_id: targetId,
      status: 'pending',
    })

    if (error) {
      alert('发送失败：' + error.message)
    } else {
      alert('好友申请已发送')
      setShowAdd(false)
      setSearchInput('')
      setSearchResult(null)
    }
  }

  async function handleAccept(friendshipId: string) {
    const { error } = await supabase
      .from('friendships')
      .update({ status: 'accepted' })
      .eq('id', friendshipId)

    if (error) {
      alert('操作失败：' + error.message)
    } else {
      loadAll()
    }
  }

  async function handleReject(friendshipId: string) {
    const { error } = await supabase.from('friendships').delete().eq('id', friendshipId)
    if (error) {
      alert('操作失败：' + error.message)
    } else {
      loadAll()
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>加载中...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f7f2ea] relative overflow-hidden">
      <div className="absolute -top-20 -right-20 w-96 h-96 bg-[#f0b078] opacity-15 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-20 -left-20 w-96 h-96 bg-[#d97757] opacity-[0.08] rounded-full blur-3xl pointer-events-none"></div>

      {/* pt-24：顶部空间更大，返回键不会被浏览器顶栏挡住 */}
      <div className="relative max-w-6xl mx-auto px-6 pt-24 pb-8">
        <header className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-[#8a827a] hover:text-[#c96447] transition"
          >
            ← 返回
          </Link>
          <h1 className="text-3xl font-bold text-[#2b2620] mt-4">小屋</h1>
          <p className="text-sm text-[#8a827a] mt-1">小屋里，慢慢说</p>

          <div className="flex gap-6 mt-5 border-b border-[#ece6dd]">
            <button
              onClick={() => setMode('friends')}
              className={`pb-2.5 text-sm transition flex items-center gap-1.5 ${
                mode === 'friends'
                  ? 'border-b-2 border-[#d97757] text-[#d97757] font-medium'
                  : 'text-[#8a827a] hover:text-[#2b2620]'
              }`}
            >
              好友
              {unread.total > 0 && (
                <span className="min-w-[16px] h-4 px-1 rounded-full bg-[#d97757] text-white text-[10px] leading-4 text-center font-medium">
                  {unread.total > 99 ? '99+' : unread.total}
                </span>
              )}
            </button>
            <button
              onClick={() => setMode('moments')}
              className={`pb-2.5 text-sm transition flex items-center gap-1.5 ${
                mode === 'moments'
                  ? 'border-b-2 border-[#d97757] text-[#d97757] font-medium'
                  : 'text-[#8a827a] hover:text-[#2b2620]'
              }`}
            >
              朋友圈
              {/* 半明显的点：有朋友发了新动态 */}
              {momentsHasNew && (
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-[#d97757] opacity-60 animate-ping" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[#d97757]" />
                </span>
              )}
            </button>
          </div>
        </header>

        {mode === 'friends' ? (
          <div className="flex gap-5 h-[calc(100vh-320px)] min-h-[500px]">
            <aside className={`w-72 flex-shrink-0 flex-col gap-3 ${showChatOnMobile ? 'hidden md:flex' : 'flex'}`}>
              <button
                onClick={() => setShowAdd(!showAdd)}
                className="w-full py-2.5 rounded-2xl bg-gradient-to-r from-[#e8a87c] to-[#d97757] text-white text-sm font-medium hover:shadow-[0_6px_20px_rgba(217,119,87,0.3)] transition-all flex items-center justify-center gap-2 flex-shrink-0"
              >
                <IconPlus className="w-4 h-4" />
                {showAdd ? '收起' : '加好友'}
              </button>

              {showAdd && (
                <div className="rounded-2xl border border-[#f0e4d4] bg-white/80 backdrop-blur p-4 shadow-[0_2px_12px_rgba(217,119,87,0.04)] flex-shrink-0">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                      placeholder="用户名或昵称"
                      className="flex-1 px-3 py-2 rounded-xl border border-[#ece6dd] bg-[#fefcf9] text-xs focus:outline-none focus:border-[#d97757] focus:ring-2 focus:ring-[#d97757]/10 transition"
                    />
                    <button
                      onClick={handleSearch}
                      disabled={searching}
                      className="px-3 py-2 rounded-xl bg-[#d97757] text-white text-xs hover:bg-[#c96447] transition disabled:opacity-60"
                    >
                      {searching ? '...' : '搜'}
                    </button>
                  </div>

                  {searchMessage && (
                    <p className="text-[10px] text-red-500 mt-2">{searchMessage}</p>
                  )}

                  {searchResult && (
                    <div className="mt-3 flex items-center justify-between p-2 rounded-xl bg-[#fefaf5]">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-7 h-7 rounded-full bg-[#fae0cc] flex items-center justify-center overflow-hidden flex-shrink-0">
                          {searchResult.avatar_url ? (
                            <img src={searchResult.avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-[10px] text-[#c96447]">
                              {(searchResult.nickname || searchResult.username)[0]}
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-medium truncate">
                          {searchResult.nickname || searchResult.username}
                        </p>
                      </div>
                      <button
                        onClick={() => handleAddFriend(searchResult.id)}
                        className="px-2.5 py-1 rounded-full bg-[#d97757] text-white text-[10px] hover:bg-[#c96447] transition flex-shrink-0"
                      >
                        加
                      </button>
                    </div>
                  )}
                </div>
              )}

              {shownRequests.length > 0 && (
                <div className="rounded-2xl border border-[#f0e4d4] bg-gradient-to-br from-[#fff8ef] to-[#fbeee4] p-3 flex-shrink-0">
                  <p className="text-[10px] text-[#c96447] font-medium mb-2 tracking-wide">
                    新的招呼 · {shownRequests.length}
                  </p>
                  <div className="space-y-2">
                    {shownRequests.map((r) => (
                      <div key={r.friendship_id} className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-[#fae0cc] flex items-center justify-center overflow-hidden flex-shrink-0">
                          {r.avatar_url ? (
                            <img src={r.avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-[10px] text-[#c96447]">
                              {(r.nickname || r.username)[0]}
                            </span>
                          )}
                        </div>
                        <p className="text-xs flex-1 truncate">{r.nickname || r.username}</p>
                        <button
                          onClick={() => handleAccept(r.friendship_id)}
                          className="text-[10px] px-2 py-0.5 rounded-full bg-[#d97757] text-white"
                        >
                          同意
                        </button>
                        <button
                          onClick={() => handleReject(r.friendship_id)}
                          className="text-[10px] px-2 py-0.5 rounded-full bg-white text-[#a88868] border border-[#ece6dd]"
                        >
                          拒
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="rounded-2xl border border-[#ece6dd] bg-white/80 backdrop-blur shadow-[0_2px_12px_rgba(217,119,87,0.04)] overflow-hidden flex-1 overflow-y-auto">
                <div className="px-4 py-3 border-b border-[#f0e4d4]">
                  <p className="text-[10px] text-[#a88868] tracking-wide">
                    我的好友 · {shownFriends.length}
                  </p>
                </div>
                {shownFriends.length === 0 ? (
                  <div className="p-6 text-center">
                    <p className="text-xs text-[#a88868]">还没有好友</p>
                  </div>
                ) : (
                  <div>
                    {shownFriends.map((f) => {
                      const convId = conversationByFriend[f.friend_id]
                      const unreadCount = convId ? unread.byConversation[convId] ?? 0 : 0
                      return (
                        <div key={f.friendship_id} className="relative">
                          <button
                            onClick={() => openFriend(f)}
                            className={`w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-[#fef7f2] transition border-b border-[#f7f2ea] last:border-b-0 ${
                              currentFriend?.friend_id === f.friend_id ? 'bg-[#fef7f2]' : ''
                            }`}
                          >
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#fae0cc] to-[#f9d5ba] flex items-center justify-center overflow-hidden flex-shrink-0">
                              {f.avatar_url ? (
                                <img src={f.avatar_url} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-xs text-[#c96447] font-semibold">
                                  {(f.nickname || f.username)[0]}
                                </span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-[#2b2620] truncate">
                                {f.nickname || f.username}
                              </p>
                              {f.signature && (
                                <p className="text-[10px] text-[#a88868] truncate">{f.signature}</p>
                              )}
                            </div>
                          </button>

                          {/* 这个好友的未读私信条数：右下角 */}
                          {unreadCount > 0 && (
                            <span className="pointer-events-none absolute bottom-2 right-3 min-w-[16px] h-4 px-1 rounded-full bg-[#d97757] text-white text-[10px] leading-4 text-center font-medium">
                              {unreadCount > 99 ? '99+' : unreadCount}
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </aside>

            <main className={`flex-1 flex-col min-w-0 ${showChatOnMobile ? 'flex' : 'hidden md:flex'}`}>
              <div className="rounded-2xl border border-[#ece6dd] bg-white/80 backdrop-blur shadow-[0_2px_12px_rgba(217,119,87,0.04)] overflow-hidden flex-1 flex flex-col">
                <div className="px-5 py-3 border-b border-[#f0e4d4] flex items-center gap-3 flex-shrink-0">
                  {currentFriend && (
                    <>
                      <button
                        onClick={() => setShowChatOnMobile(false)}
                        className="md:hidden text-[#8a827a] hover:text-[#c96447] mr-1"
                      >
                        ←
                      </button>
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#fae0cc] to-[#f9d5ba] flex items-center justify-center flex-shrink-0">
                        <span className="text-sm text-[#c96447] font-semibold">
                          {friendName[0]}
                        </span>
                      </div>
                      <h2 className="text-sm font-semibold text-[#2b2620] truncate">
                        {friendName}
                      </h2>
                    </>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-4">
                  {!currentFriend ? (
                    <div className="h-full flex flex-col items-center justify-center text-center">
                      <div className="w-14 h-14 rounded-full bg-[#fdf0e6] flex items-center justify-center mb-3">
                        <svg className="w-6 h-6 text-[#d97757]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                        </svg>
                      </div>
                      <p className="text-sm text-[#a88868]">选一个好友开始聊天</p>
                    </div>
                  ) : shownMessages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center">
                      <p className="text-sm text-[#a88868]">还没有消息</p>
                      <p className="text-xs text-[#b0a89e] mt-1">说点什么吧</p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {shownMessages.map((m) => {
                        const isMine = m.sender_id === meId
                        return (
                          <div
                            key={m.id}
                            className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
                          >
                            <div
                              className={`max-w-[70%] px-4 py-2.5 shadow-[0_4px_16px_rgba(217,119,87,0.08)] ${
                                isMine
                                  ? 'bg-gradient-to-br from-[#e8a87c] to-[#d97757] text-white rounded-[18px] rounded-tr-[4px]'
                                  : 'bg-white text-[#2b2620] rounded-[18px] rounded-tl-[4px] border border-[#f0e4d4]'
                              }`}
                            >
                              <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                                {m.content}
                              </p>
                              <p
                                className={`text-[10px] mt-1 ${
                                  isMine ? 'text-white/60' : 'text-[#b0a89e]'
                                }`}
                              >
                                {new Date(m.created_at).toLocaleTimeString('zh-CN', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </p>
                            </div>
                          </div>
                        )
                      })}
                      <div ref={bottomRef} />
                    </div>
                  )}
                </div>

                {currentFriend && (
                  <form
                    onSubmit={handleSend}
                    className="border-t border-[#f0e4d4] px-5 py-3 flex gap-2 flex-shrink-0"
                  >
                    <input
                      type="text"
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      placeholder="说点什么..."
                      className="flex-1 px-4 py-2.5 rounded-full border border-[#ece6dd] bg-[#fefcf9] text-sm focus:outline-none focus:border-[#d97757] focus:ring-2 focus:ring-[#d97757]/10 transition"
                      maxLength={500}
                    />
                    <button
                      type="submit"
                      disabled={sending || !content.trim()}
                      className="w-11 h-11 rounded-full bg-gradient-to-r from-[#e8a87c] to-[#d97757] text-white flex items-center justify-center hover:shadow-[0_6px_20px_rgba(217,119,87,0.3)] transition-all disabled:opacity-50 flex-shrink-0"
                    >
                      <IconSend className="w-4 h-4" />
                    </button>
                  </form>
                )}
              </div>
            </main>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto">
            <form
              onSubmit={handlePostMoment}
              className="rounded-2xl border border-[#f0e4d4] bg-white/80 backdrop-blur p-5 mb-5 shadow-[0_2px_12px_rgba(217,119,87,0.04)]"
            >
              <textarea
                value={momentContent}
                onChange={(e) => setMomentContent(e.target.value)}
                placeholder="今天有什么想说的？"
                rows={3}
                className="w-full px-4 py-3 rounded-xl border border-[#ece6dd] bg-[#fefcf9] text-sm resize-none focus:outline-none focus:border-[#d97757] focus:ring-2 focus:ring-[#d97757]/10 transition"
                maxLength={500}
              />
              <div className="flex justify-end mt-3">
                <button
                  type="submit"
                  disabled={postingMoment || !momentContent.trim()}
                  className="px-6 py-2 rounded-xl bg-gradient-to-r from-[#e8a87c] to-[#d97757] text-white text-sm font-medium hover:shadow-[0_6px_20px_rgba(217,119,87,0.3)] transition-all disabled:opacity-50"
                >
                  {postingMoment ? '发布中...' : '发布'}
                </button>
              </div>
            </form>

            <div className="space-y-3">
              {moments.length === 0 ? (
                <div className="rounded-2xl border border-[#f0e4d4] bg-white/60 backdrop-blur p-10 text-center">
                  <p className="text-sm text-[#a88868]">还没有内容</p>
                </div>
              ) : (
                moments.map((post) => (
                  <div
                    key={post.id}
                    className="rounded-2xl border border-[#ece6dd] bg-white/80 backdrop-blur p-5 shadow-[0_2px_12px_rgba(217,119,87,0.04)]"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#fae0cc] to-[#f9d5ba] flex items-center justify-center overflow-hidden flex-shrink-0">
                        {post.author_avatar ? (
                          <img src={post.author_avatar} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-sm text-[#c96447] font-semibold">
                            {post.author_name[0]}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#2b2620]">{post.author_name}</p>
                        <p className="text-[10px] text-[#b0a89e] mt-0.5">
                          {new Date(post.created_at).toLocaleString('zh-CN', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>

                    <p className="text-sm text-[#4a423c] whitespace-pre-wrap break-words leading-relaxed pl-1 mb-3">
                      {post.content}
                    </p>

                    <div className="flex items-center gap-4 pl-1 pt-3 border-t border-[#f0e4d4]">
                      <button
                        onClick={() => handleLike(post.id, post.liked_by_me)}
                        className={`flex items-center gap-1.5 text-xs transition ${
                          post.liked_by_me ? 'text-[#d97757]' : 'text-[#a88868] hover:text-[#d97757]'
                        }`}
                      >
                        <IconHeart className="w-4 h-4" filled={post.liked_by_me} />
                        <span>{post.like_count > 0 ? post.like_count : '赞'}</span>
                      </button>
                      <button
                        onClick={() => {
                          setOpenCommentId(openCommentId === post.id ? null : post.id)
                          setReplyingTo(null)
                        }}
                        className={`flex items-center gap-1.5 text-xs transition ${
                          openCommentId === post.id ? 'text-[#d97757]' : 'text-[#a88868] hover:text-[#d97757]'
                        }`}
                      >
                        <IconComment className="w-4 h-4" />
                        <span>{post.comments.length > 0 ? post.comments.length : '评论'}</span>
                      </button>
                    </div>

                    {post.comments.length > 0 && (
                      <div className="mt-3 pl-1 space-y-3">
                        {post.comments
                          .filter((c) => !c.parent_id)
                          .map((parent) => {
                            const replies = post.comments.filter(
                              (c) => c.parent_id === parent.id
                            )
                            return (
                              <div key={parent.id}>
                                <div className="flex gap-2">
                                  <div className="w-6 h-6 rounded-full bg-[#fae0cc] flex items-center justify-center overflow-hidden flex-shrink-0 mt-0.5">
                                    {parent.author_avatar ? (
                                      <img
                                        src={parent.author_avatar}
                                        alt=""
                                        className="w-full h-full object-cover"
                                      />
                                    ) : (
                                      <span className="text-[10px] text-[#c96447]">
                                        {parent.author_name[0]}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0 bg-[#fefaf5] rounded-xl px-3 py-2">
                                    <p className="text-[11px] font-medium text-[#c96447]">
                                      {parent.author_name}
                                    </p>
                                    <p className="text-xs text-[#4a423c] mt-0.5 whitespace-pre-wrap break-words">
                                      {parent.content}
                                    </p>
                                    <div className="flex items-center justify-between mt-1">
                                      <button
                                        onClick={() => {
                                          setReplyingTo(parent)
                                          setOpenCommentId(post.id)
                                        }}
                                        className="text-[10px] text-[#a88868] hover:text-[#d97757]"
                                      >
                                        回复
                                      </button>
                                      <span className="text-[10px] text-[#b0a89e]">
                                        {formatTime(parent.created_at)}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                {replies.length > 0 && (
                                  <div className="ml-8 mt-2 space-y-1.5">
                                    {replies.map((c) => (
                                      <div key={c.id} className="flex gap-2">
                                        <div className="w-5 h-5 rounded-full bg-[#fae0cc] flex items-center justify-center overflow-hidden flex-shrink-0 mt-0.5">
                                          {c.author_avatar ? (
                                            <img
                                              src={c.author_avatar}
                                              alt=""
                                              className="w-full h-full object-cover"
                                            />
                                          ) : (
                                            <span className="text-[9px] text-[#c96447]">
                                              {c.author_name[0]}
                                            </span>
                                          )}
                                        </div>
                                        <div className="flex-1 min-w-0 bg-[#fefaf5] rounded-xl px-3 py-1.5">
                                          <p className="text-[11px] text-[#4a423c] leading-relaxed">
                                            <span className="font-medium text-[#c96447]">
                                              {c.author_name}
                                            </span>
                                            {c.parent_name && (
                                              <>
                                                <span className="text-[#a88868]"> 回复 </span>
                                                <span className="font-medium text-[#c96447]">
                                                  {c.parent_name}
                                                </span>
                                              </>
                                            )}
                                            <span className="text-[#a88868]">：</span>
                                            <span className="ml-1">{c.content}</span>
                                          </p>
                                          <div className="flex items-center justify-between mt-1">
                                            <button
                                              onClick={() => {
                                                setReplyingTo(c)
                                                setOpenCommentId(post.id)
                                              }}
                                              className="text-[10px] text-[#a88868] hover:text-[#d97757]"
                                            >
                                              回复
                                            </button>
                                            <span className="text-[10px] text-[#b0a89e]">
                                              {formatTime(c.created_at)}
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                      </div>
                    )}

                    {openCommentId === post.id && (
                      <div className="mt-3">
                        {replyingTo && (
                          <div className="flex items-center justify-between mb-2 px-2">
                            <p className="text-[10px] text-[#a88868]">
                              正在回复{' '}
                              <span className="text-[#c96447] font-medium">
                                {replyingTo.author_name}
                              </span>
                            </p>
                            <button
                              onClick={() => setReplyingTo(null)}
                              className="text-[10px] text-[#a88868] hover:text-[#c96447]"
                            >
                              取消
                            </button>
                          </div>
                        )}
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={commentInputs[post.id] || ''}
                            onChange={(e) =>
                              setCommentInputs({ ...commentInputs, [post.id]: e.target.value })
                            }
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault()
                                handlePostComment(post.id)
                              }
                            }}
                            placeholder={
                              replyingTo ? `回复 ${replyingTo.author_name}...` : '写点什么...'
                            }
                            maxLength={200}
                            className="flex-1 px-4 py-2 rounded-full border border-[#ece6dd] bg-[#fefcf9] text-xs focus:outline-none focus:border-[#d97757] focus:ring-2 focus:ring-[#d97757]/10 transition"
                          />
                          <button
                            onClick={() => handlePostComment(post.id)}
                            disabled={
                              postingComment === post.id || !commentInputs[post.id]?.trim()
                            }
                            className="px-4 py-2 rounded-full bg-gradient-to-r from-[#e8a87c] to-[#d97757] text-white text-xs font-medium transition-all disabled:opacity-50"
                          >
                            {postingComment === post.id ? '...' : '发送'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}