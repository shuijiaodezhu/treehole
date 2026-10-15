'use client'
/* eslint-disable @next/next/no-img-element -- 头像用原生 img 即可，尺寸固定 */

import { useEffect, useMemo, useState, useRef } from 'react'
import { createClient } from '../lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { markMomentsSeen, useMomentsBadge, useUnreadMessages } from '../../components/unread'
import { useBlocks } from '../../components/blocks'
import { ImagePicker } from '../../components/media'
import { HashtagList } from '../../components/hashtags'
import { MentionInput, renderMentions } from '../../components/mentions'
import { useEditContent } from '../../components/edit-content'
import { useFavorites } from '../../components/favorites'
import {
  VISIBILITY_HINT,
  VISIBILITY_LABEL,
  VISIBILITY_ORDER,
  VISIBILITY_SHORT,
  canViewPost,
  expandGroupMembers,
  fetchAudienceMap,
  useFriendGroups,
  useFriendList,
  type Visibility,
} from '../../components/visibility'
import { VaultView } from '../../components/vault-view'
import { PlansView } from '../../components/plans-view'
import { ImageWall } from '../../components/image-wall'
import { EmojiPicker, useEmojiInsert } from '../../components/emoji-picker'
import { pageAccentVars } from '../../components/theme'
import { SkeletonSplit } from '../../components/skeleton'
import { EmptyState } from '../../components/empty-state'

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
  visibility: string
  image_urls: string[] | null
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
  const [mode, setMode] = useState<'friends' | 'moments' | 'vault' | 'plans'>('friends')

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

  /* ---------- 朋友圈：图片 / 可见范围 / 编辑 / 收藏 ---------- */
  const [momentImages, setMomentImages] = useState<string[]>([])
  const [visibility, setVisibility] = useState<Visibility>('public')
  const [selectedFriends, setSelectedFriends] = useState<string[]>([])
  const [selectedGroups, setSelectedGroups] = useState<string[]>([])
  const [showPicker, setShowPicker] = useState(false)
  const [audienceMap, setAudienceMap] = useState<Map<string, Set<string>>>(new Map())

  const { friends: visFriends } = useFriendList(meId)
  const { groups: visGroups } = useFriendGroups(meId)
  const momentEditor = useEditContent(meId)
  const momentFavorites = useFavorites(meId)
  const mentionNames = useMemo(() => visFriends.map((f) => f.name), [visFriends])

  /** 朋友圈发帖框的表情插入（插到光标处） */
  const { ref: momentRef, insert: insertMomentEmoji } = useEmojiInsert<HTMLTextAreaElement>(
    momentContent,
    setMomentContent,
  )

  /** 朋友圈最终展示列表：先去掉被拉黑的，再按可见范围过滤 */
  const visibleMoments = useMemo(
    () =>
      moments
        .filter((m) => !hidden.has(m.author_id))
        .filter((m) => canViewPost(m, meId, audienceMap)),
    [moments, hidden, meId, audienceMap],
  )
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
      .select('id, author_id, content, created_at, visibility, image_urls')
      .in('author_id', allowedIds)
      .order('created_at', { ascending: false })
      .limit(50)

    if (!postsData || postsData.length === 0) {
      setMoments([])
      return
    }

    // 可见名单（用于过滤别人的动态）
    const audience = await fetchAudienceMap(
      postsData.filter((p) => p.author_id !== uid).map((p) => p.id),
    )
    setAudienceMap(audience)

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
        visibility: (p as { visibility?: string | null }).visibility ?? 'public',
        image_urls: ((p as { image_urls?: string[] | null }).image_urls ?? null),
      }
    })

    setMoments(list)
  }

  async function handlePostMoment(e: React.FormEvent) {
    e.preventDefault()
    // 允许「只有图片没文字」
    if ((!momentContent.trim() && momentImages.length === 0) || !meId) return

    // 分组可见 → 按发布时名单展开
    const audienceIds =
      visibility === 'friends'
        ? selectedFriends
        : visibility === 'groups'
          ? expandGroupMembers(visGroups, selectedGroups)
          : []

    if ((visibility === 'friends' || visibility === 'groups') && audienceIds.length === 0) {
      alert('还没选人，这条谁都看不到。先选好友或分组，或改成其他可见范围。')
      return
    }

    setPostingMoment(true)
    try {
      const { data: created, error } = await supabase
        .from('friend_posts')
        .insert({
          author_id: meId,
          content: momentContent.trim(),
          visibility,
          image_urls: momentImages.length > 0 ? momentImages : null,
        })
        .select('id')
        .single()

      if (error) throw error

      if (created && audienceIds.length > 0) {
        const { error: audienceError } = await supabase
          .from('friend_post_audience')
          .insert(audienceIds.map((friend_id) => ({ post_id: created.id, friend_id })))
        if (audienceError) throw audienceError
      }

      setMomentContent('')
      setMomentImages([])
      setVisibility('public')
      setSelectedFriends([])
      setSelectedGroups([])
      setShowPicker(false)
      await loadMoments(meId)
    } catch (err) {
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: unknown }).message)
          : String(err)
      alert('发布失败：' + msg)
    } finally {
      setPostingMoment(false)
    }
  }

  /* ---------- 朋友圈：编辑 / 删除 ---------- */
  async function handleSaveMoment(postId: string) {
    const text = momentEditor.draft.trim()
    const result = await momentEditor.save('moment', postId, text)
    if (!result.ok) {
      alert('保存失败：' + (result.message ?? '未知错误'))
      return
    }
    setMoments((prev) => prev.map((m) => (m.id === postId ? { ...m, content: text } : m)))
  }

  async function handleDeleteMoment(postId: string, authorId: string) {
    if (!meId || authorId !== meId) return
    if (!confirm('删除这条动态？不可恢复。')) return
    try {
      // 先清图片，别留孤儿文件
      const target = moments.find((m) => m.id === postId)
      const urls = (target?.image_urls ?? []).filter(Boolean)
      await supabase.from('friend_likes').delete().eq('post_id', postId)
      await supabase.from('friend_comments').delete().eq('post_id', postId)
      const { error } = await supabase.from('friend_posts').delete().eq('id', postId).eq('author_id', meId)
      if (error) throw error

      if (urls.length > 0) {
        const paths = urls
          .map((url) => {
            const marker = '/object/public/media/'
            const at = url.indexOf(marker)
            return at >= 0 ? url.slice(at + marker.length) : null
          })
          .filter((p): p is string => Boolean(p))
        if (paths.length > 0) {
          const { error: storageError } = await supabase.storage.from('media').remove(paths)
          if (storageError) console.error('清理图片失败:', storageError)
        }
      }

      setMoments((prev) => prev.filter((m) => m.id !== postId))
    } catch (err) {
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: unknown }).message)
          : String(err)
      alert('删除失败：' + msg)
    }
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
      <div className="min-h-screen bg-[var(--accent-soft)] px-6 pt-24" style={pageAccentVars('friends')}>
        <div className="mx-auto max-w-5xl">
          <SkeletonSplit />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--accent-soft)] relative overflow-hidden">
      <div className="absolute -top-20 -right-20 w-96 h-96 bg-[var(--accent-light)] opacity-15 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-20 -left-20 w-96 h-96 bg-[var(--accent)] opacity-[0.08] rounded-full blur-3xl pointer-events-none"></div>

      {/* pt-24：顶部空间更大，返回键不会被浏览器顶栏挡住 */}
      <div className="relative max-w-6xl mx-auto px-6 pt-24 pb-8">
        <header className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-[var(--accent-muted)] hover:text-[var(--accent-deep)] transition"
          >
            ← 返回
          </Link>
          <h1 className="text-3xl font-bold text-[#2b2620] mt-4">小屋</h1>
          <p className="text-sm text-[var(--accent-muted)] mt-1">小屋里，慢慢说</p>

          <div className="flex gap-6 mt-5 border-b border-[var(--accent-line)]">
            <button
              onClick={() => setMode('friends')}
              className={`pb-2.5 text-sm transition flex items-center gap-1.5 ${
                mode === 'friends'
                  ? 'border-b-2 border-[var(--accent)] text-[var(--accent)] font-medium'
                  : 'text-[var(--accent-muted)] hover:text-[#2b2620]'
              }`}
            >
              好友
              {unread.total > 0 && (
                <span className="min-w-[16px] h-4 px-1 rounded-full bg-[var(--accent)] text-white text-[10px] leading-4 text-center font-medium">
                  {unread.total > 99 ? '99+' : unread.total}
                </span>
              )}
            </button>
            <button
              onClick={() => setMode('moments')}
              className={`pb-2.5 text-sm transition flex items-center gap-1.5 ${
                mode === 'moments'
                  ? 'border-b-2 border-[var(--accent)] text-[var(--accent)] font-medium'
                  : 'text-[var(--accent-muted)] hover:text-[#2b2620]'
              }`}
            >
              朋友圈
              {/* 半明显的点：有朋友发了新动态 */}
              {momentsHasNew && (
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-[var(--accent)] opacity-60 animate-ping" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--accent)]" />
                </span>
              )}
            </button>
            <button
              onClick={() => setMode('vault')}
              className={`pb-2.5 text-sm transition flex items-center gap-1.5 ${
                mode === 'vault'
                  ? 'border-b-2 border-[var(--accent)] text-[var(--accent)] font-medium'
                  : 'text-[var(--accent-muted)] hover:text-[#2b2620]'
              }`}
            >
              储物箱
            </button>
            <button
              onClick={() => setMode('plans')}
              className={`pb-2.5 text-sm transition flex items-center gap-1.5 ${
                mode === 'plans'
                  ? 'border-b-2 border-[var(--accent)] text-[var(--accent)] font-medium'
                  : 'text-[var(--accent-muted)] hover:text-[#2b2620]'
              }`}
            >
              计划书
            </button>
          </div>
        </header>

        {mode === 'friends' ? (
          <div className="flex gap-5 h-[calc(100vh-320px)] min-h-[500px]">            <aside className={`w-72 flex-shrink-0 flex-col gap-3 ${showChatOnMobile ? 'hidden md:flex' : 'flex'}`}>
              <button
                onClick={() => setShowAdd(!showAdd)}
                className="w-full py-2.5 rounded-2xl bg-gradient-to-r from-[var(--accent-light)] to-[var(--accent)] text-white text-sm font-medium hover:shadow-[0_6px_20px_rgba(217,119,87,0.3)] transition-all flex items-center justify-center gap-2 flex-shrink-0"
              >
                <IconPlus className="w-4 h-4" />
                {showAdd ? '收起' : '加好友'}
              </button>

              {showAdd && (
                <div className="rounded-2xl border border-[var(--accent-line)] bg-white/80 backdrop-blur p-4 shadow-[0_2px_12px_rgba(217,119,87,0.04)] flex-shrink-0">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                      placeholder="用户名或昵称"
                      className="flex-1 px-3 py-2 rounded-xl border border-[var(--accent-line)] bg-[var(--accent-soft)] text-xs focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/10 transition"
                    />
                    <button
                      onClick={handleSearch}
                      disabled={searching}
                      className="px-3 py-2 rounded-xl bg-[var(--accent)] text-white text-xs hover:bg-[var(--accent-deep)] transition disabled:opacity-60"
                    >
                      {searching ? '...' : '搜'}
                    </button>
                  </div>

                  {searchMessage && (
                    <p className="text-[10px] text-red-500 mt-2">{searchMessage}</p>
                  )}

                  {searchResult && (
                    <div className="mt-3 flex items-center justify-between p-2 rounded-xl bg-[var(--accent-soft)]">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-7 h-7 rounded-full bg-[var(--accent-light)] flex items-center justify-center overflow-hidden flex-shrink-0">
                          {searchResult.avatar_url ? (
                            <img src={searchResult.avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-[10px] text-[var(--accent-deep)]">
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
                        className="px-2.5 py-1 rounded-full bg-[var(--accent)] text-white text-[10px] hover:bg-[var(--accent-deep)] transition flex-shrink-0"
                      >
                        加
                      </button>
                    </div>
                  )}
                </div>
              )}

              {shownRequests.length > 0 && (
                <div className="rounded-2xl border border-[var(--accent-line)] bg-gradient-to-br from-[var(--accent-soft)] to-[var(--accent-soft)] p-3 flex-shrink-0">
                  <p className="text-[10px] text-[var(--accent-deep)] font-medium mb-2 tracking-wide">
                    新的招呼 · {shownRequests.length}
                  </p>
                  <div className="space-y-2">
                    {shownRequests.map((r) => (
                      <div key={r.friendship_id} className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-[var(--accent-light)] flex items-center justify-center overflow-hidden flex-shrink-0">
                          {r.avatar_url ? (
                            <img src={r.avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-[10px] text-[var(--accent-deep)]">
                              {(r.nickname || r.username)[0]}
                            </span>
                          )}
                        </div>
                        <p className="text-xs flex-1 truncate">{r.nickname || r.username}</p>
                        <button
                          onClick={() => handleAccept(r.friendship_id)}
                          className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--accent)] text-white"
                        >
                          同意
                        </button>
                        <button
                          onClick={() => handleReject(r.friendship_id)}
                          className="text-[10px] px-2 py-0.5 rounded-full bg-white text-[var(--accent-muted)] border border-[var(--accent-line)]"
                        >
                          拒
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="rounded-2xl border border-[var(--accent-line)] bg-white/80 backdrop-blur shadow-[0_2px_12px_rgba(217,119,87,0.04)] overflow-hidden flex-1 overflow-y-auto">
                <div className="px-4 py-3 border-b border-[var(--accent-line)]">
                  <p className="text-[10px] text-[var(--accent-muted)] tracking-wide">
                    我的好友 · {shownFriends.length}
                  </p>
                </div>
                {shownFriends.length === 0 ? (
                  <EmptyState art="friends" compact title="还没有好友" hint="在上面搜昵称，加一个试试" />
                ) : (
                  <div>
                    {shownFriends.map((f) => {
                      const convId = conversationByFriend[f.friend_id]
                      const unreadCount = convId ? unread.byConversation[convId] ?? 0 : 0
                      return (
                        <div key={f.friendship_id} className="relative">
                          <button
                            onClick={() => openFriend(f)}
                            className={`w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-[var(--accent-soft)] transition border-b border-[var(--accent-soft)] last:border-b-0 ${
                              currentFriend?.friend_id === f.friend_id ? 'bg-[var(--accent-soft)]' : ''
                            }`}
                          >
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[var(--accent-light)] to-[var(--accent-light)] flex items-center justify-center overflow-hidden flex-shrink-0">
                              {f.avatar_url ? (
                                <img src={f.avatar_url} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-xs text-[var(--accent-deep)] font-semibold">
                                  {(f.nickname || f.username)[0]}
                                </span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-[#2b2620] truncate">
                                {f.nickname || f.username}
                              </p>
                              {f.signature && (
                                <p className="text-[10px] text-[var(--accent-muted)] truncate">{f.signature}</p>
                              )}
                            </div>
                          </button>

                          {/* 这个好友的未读私信条数：右下角 */}
                          {unreadCount > 0 && (
                            <span className="pointer-events-none absolute bottom-2 right-3 min-w-[16px] h-4 px-1 rounded-full bg-[var(--accent)] text-white text-[10px] leading-4 text-center font-medium">
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
              <div className="rounded-2xl border border-[var(--accent-line)] bg-white/80 backdrop-blur shadow-[0_2px_12px_rgba(217,119,87,0.04)] overflow-hidden flex-1 flex flex-col">
                <div className="px-5 py-3 border-b border-[var(--accent-line)] flex items-center gap-3 flex-shrink-0">
                  {currentFriend && (
                    <>
                      <button
                        onClick={() => setShowChatOnMobile(false)}
                        className="md:hidden text-[var(--accent-muted)] hover:text-[var(--accent-deep)] mr-1"
                      >
                        ←
                      </button>
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[var(--accent-light)] to-[var(--accent-light)] flex items-center justify-center flex-shrink-0">
                        <span className="text-sm text-[var(--accent-deep)] font-semibold">
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
                      <div className="w-14 h-14 rounded-full bg-[var(--accent-soft)] flex items-center justify-center mb-3">
                        <svg className="w-6 h-6 text-[var(--accent)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                        </svg>
                      </div>
                      <p className="text-sm text-[var(--accent-muted)]">选一个好友开始聊天</p>
                    </div>
                  ) : shownMessages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center">
                      <EmptyState art="mail" title="还没有消息" hint="说点什么吧" />
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
                                  ? 'bg-gradient-to-br from-[var(--accent-light)] to-[var(--accent)] text-white rounded-[18px] rounded-tr-[4px]'
                                  : 'bg-white text-[#2b2620] rounded-[18px] rounded-tl-[4px] border border-[var(--accent-line)]'
                              }`}
                            >
                              <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                                {m.content}
                              </p>
                              <p
                                className={`text-[10px] mt-1 ${
                                  isMine ? 'text-white/60' : 'text-[var(--accent-muted)]'
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
                    className="border-t border-[var(--accent-line)] px-5 py-3 flex gap-2 flex-shrink-0"
                  >
                    <input
                      type="text"
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      placeholder="说点什么... 也可以发个表情"
                      className="flex-1 px-4 py-2.5 rounded-full border border-[var(--accent-line)] bg-[var(--accent-soft)] text-sm focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/10 transition"
                      maxLength={500}
                    />
                    <EmojiPicker onPick={(emoji) => setContent((cur) => cur + emoji)} align="right" size="md" />
                    <button
                      type="submit"
                      disabled={sending || !content.trim()}
                      className="w-11 h-11 rounded-full bg-gradient-to-r from-[var(--accent-light)] to-[var(--accent)] text-white flex items-center justify-center hover:shadow-[0_6px_20px_rgba(217,119,87,0.3)] transition-all disabled:opacity-50 flex-shrink-0"
                    >
                      <IconSend className="w-4 h-4" />
                    </button>
                  </form>
                )}
              </div>
            </main>
          </div>
        ) : mode === 'moments' ? (
          <div className="max-w-2xl mx-auto">
            <form
              onSubmit={handlePostMoment}
              className="rounded-2xl border border-[var(--accent-line)] bg-white/80 backdrop-blur p-5 mb-5 shadow-[0_2px_12px_rgba(217,119,87,0.04)]"
            >
              <textarea
                ref={momentRef}
                value={momentContent}
                onChange={(e) => setMomentContent(e.target.value)}
                placeholder="今天有什么想说的？用 #话题# 加标签，也可以发个表情"
                rows={3}
                className="w-full px-4 py-3 rounded-xl border border-[var(--accent-line)] bg-[var(--accent-soft)] text-sm resize-none focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/10 transition"
                maxLength={500}
              />

              {/* 图片 */}
              <ImagePicker
                userId={meId}
                urls={momentImages}
                onChange={setMomentImages}
                disabled={postingMoment}
              />

              {/* 谁可以看 */}
              <div className="mt-3">
                <div className="flex flex-wrap gap-2">
                  {VISIBILITY_ORDER.map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => {
                        setVisibility(v)
                        setShowPicker(v === 'friends' || v === 'groups')
                      }}
                      className={`rounded-full px-3 py-1 text-[11px] transition ${
                        visibility === v
                          ? 'bg-[var(--accent)] text-white'
                          : 'border border-[var(--accent-line)] bg-white text-[var(--accent-muted)] hover:border-[var(--accent-light)]'
                      }`}
                    >
                      {VISIBILITY_LABEL[v]}
                    </button>
                  ))}
                </div>

                <p className="mt-2 text-[10px] text-[var(--accent-muted)]">{VISIBILITY_HINT[visibility]}</p>

                {showPicker && visibility === 'friends' && (
                  <div className="mt-2 max-h-40 overflow-y-auto rounded-xl border border-[var(--accent-line)] bg-[var(--accent-soft)] p-3">
                    {visFriends.length === 0 ? (
                      <p className="text-[11px] text-[var(--accent-muted)]">还没有好友</p>
                    ) : (
                      visFriends.map((f) => (
                        <label key={f.id} className="flex cursor-pointer items-center gap-2 py-1 text-xs text-[#4a423c]">
                          <input
                            type="checkbox"
                            checked={selectedFriends.includes(f.id)}
                            onChange={(e) =>
                              setSelectedFriends((prev) =>
                                e.target.checked ? [...prev, f.id] : prev.filter((id) => id !== f.id),
                              )
                            }
                            className="accent-[var(--accent)]"
                          />
                          <span className="truncate">{f.name}</span>
                        </label>
                      ))
                    )}
                  </div>
                )}

                {showPicker && visibility === 'groups' && (
                  <div className="mt-2 rounded-xl border border-[var(--accent-line)] bg-[var(--accent-soft)] p-3">
                    {visGroups.length === 0 ? (
                      <p className="text-[11px] leading-relaxed text-[var(--accent-muted)]">
                        还没有分组。去{' '}
                        <Link href="/me/settings" className="text-[var(--accent-deep)] underline">
                          设置
                        </Link>{' '}
                        里建一个。
                      </p>
                    ) : (
                      visGroups.map((g) => (
                        <label key={g.id} className="flex cursor-pointer items-center gap-2 py-1 text-xs text-[#4a423c]">
                          <input
                            type="checkbox"
                            checked={selectedGroups.includes(g.id)}
                            onChange={(e) =>
                              setSelectedGroups((prev) =>
                                e.target.checked ? [...prev, g.id] : prev.filter((id) => id !== g.id),
                              )
                            }
                            className="accent-[var(--accent)]"
                          />
                          <span className="truncate">{g.name}</span>
                          <span className="text-[10px] text-[var(--accent-muted)]">{g.memberIds.length} 人</span>
                        </label>
                      ))
                    )}
                  </div>
                )}
              </div>
              <div className="flex items-center justify-end gap-2 mt-3">
                <EmojiPicker onPick={insertMomentEmoji} align="right" />
                <button
                  type="submit"
                  disabled={postingMoment || (!momentContent.trim() && momentImages.length === 0)}
                  className="px-6 py-2 rounded-xl bg-gradient-to-r from-[var(--accent-light)] to-[var(--accent)] text-white text-sm font-medium hover:shadow-[0_6px_20px_rgba(217,119,87,0.3)] transition-all disabled:opacity-50"
                >
                  {postingMoment ? '发布中...' : '发布'}
                </button>
              </div>
            </form>

            <div className="space-y-3">
              {visibleMoments.length === 0 ? (
                <div className="rounded-2xl border border-[var(--accent-line)] bg-white/60 backdrop-blur">
                  <EmptyState art="heart" title="这里还很安静" hint="写下第一条，朋友就看得见了" />
                </div>
              ) : (
                visibleMoments.map((post) => (
                  <div
                    key={post.id}
                    className="rounded-2xl border border-[var(--accent-line)] bg-white/80 backdrop-blur p-5 shadow-[0_2px_12px_rgba(217,119,87,0.04)]"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[var(--accent-light)] to-[var(--accent-light)] flex items-center justify-center overflow-hidden flex-shrink-0">
                        {post.author_avatar ? (
                          <img src={post.author_avatar} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-sm text-[var(--accent-deep)] font-semibold">
                            {post.author_name[0]}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#2b2620]">{post.author_name}</p>
                        <p className="text-[10px] text-[var(--accent-muted)] mt-0.5">
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

                    {momentEditor.isEditing('moment', post.id) ? (
                      <div className="pl-1 mb-3">
                        <textarea
                          value={momentEditor.draft}
                          onChange={(e) => momentEditor.setDraft(e.target.value)}
                          rows={3}
                          maxLength={momentEditor.maxLength.moment}
                          autoFocus
                          className="w-full rounded-xl border border-[var(--accent-line)] bg-[var(--accent-soft)] px-3 py-2 text-sm text-[#4a423c] resize-none focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/10 transition"
                        />
                        <div className="mt-2 flex items-center gap-3">
                          <button
                            type="button"
                            disabled={momentEditor.isBusy('moment', post.id)}
                            onClick={() => void handleSaveMoment(post.id)}
                            className="rounded-lg bg-[var(--accent)] px-3 py-1 text-xs text-white hover:bg-[var(--accent-deep)] transition disabled:opacity-50"
                          >
                            {momentEditor.isBusy('moment', post.id) ? '保存中…' : '保存'}
                          </button>
                          <button
                            type="button"
                            onClick={() => momentEditor.cancel()}
                            className="rounded-lg border border-[var(--accent-line)] px-3 py-1 text-xs text-[var(--accent-muted)] transition"
                          >
                            取消
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-[#4a423c] whitespace-pre-wrap break-words leading-relaxed pl-1 mb-3">
                        {post.content}
                        {momentEditor.wasSaved('moment', post.id) && (
                          <span className="ml-2 text-[10px] text-[#7ea86a]">已保存</span>
                        )}
                      </p>
                    )}

                    {/* 图片墙（每张可单独收藏） */}
                    <ImageWall
                      urls={post.image_urls}
                      context={post.content}
                      authorName={post.author_name}
                      favorites={momentFavorites}
                      className="mt-1 mb-3 pl-1"
                    />

                    {/* 话题标签 */}
                    <HashtagList
                      content={post.content}
                      className="mb-3 pl-1"
                      chipClassName="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[11px] text-[var(--accent-deep)] hover:bg-[var(--accent-soft)] transition"
                    />

                    <div className="flex items-center gap-4 pl-1 pt-3 border-t border-[var(--accent-line)]">
                      <button
                        onClick={() => handleLike(post.id, post.liked_by_me)}
                        className={`flex items-center gap-1.5 text-xs transition ${
                          post.liked_by_me ? 'text-[var(--accent)]' : 'text-[var(--accent-muted)] hover:text-[var(--accent)]'
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
                          openCommentId === post.id ? 'text-[var(--accent)]' : 'text-[var(--accent-muted)] hover:text-[var(--accent)]'
                        }`}
                      >
                        <IconComment className="w-4 h-4" />
                        <span>{post.comments.length > 0 ? post.comments.length : '评论'}</span>
                      </button>

                      {/* 自己的动态：可见范围标签 + 编辑 + 删除 */}
                      {post.author_id === meId && post.visibility !== 'public' && (
                        <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] text-[var(--accent-deep)]">
                          {VISIBILITY_SHORT[(post.visibility ?? 'public') as Visibility]}
                        </span>
                      )}

                      {momentEditor.canEdit(post.author_id) && !momentEditor.isEditing('moment', post.id) && (
                        <button
                          type="button"
                          onClick={() => momentEditor.start('moment', post.id, post.content)}
                          className="ml-auto flex items-center gap-1 text-xs text-[var(--accent-muted)] hover:text-[var(--accent-deep)] transition"
                        >
                          编辑
                        </button>
                      )}
                      {post.author_id === meId && (
                        <button
                          type="button"
                          onClick={() => void handleDeleteMoment(post.id, post.author_id)}
                          className={`${momentEditor.canEdit(post.author_id) ? '' : 'ml-auto'} text-xs text-[var(--accent-muted)] hover:text-red-500 transition`}
                        >
                          删除
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={momentFavorites.busyKey === `moment:${post.id}`}
                        onClick={() =>
                          void momentFavorites.toggle({
                            kind: 'moment',
                            targetId: post.id,
                            content: post.content,
                            authorName: post.author_name,
                          })
                        }
                        className={`flex items-center gap-1 text-xs transition disabled:opacity-50 ${
                          momentFavorites.isFavorited('moment', post.id)
                            ? 'text-[var(--accent)]'
                            : 'text-[var(--accent-muted)] hover:text-[var(--accent)]'
                        }`}
                      >
                        {momentFavorites.isFavorited('moment', post.id) ? '已收藏' : '收藏'}
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
                                  <div className="w-6 h-6 rounded-full bg-[var(--accent-light)] flex items-center justify-center overflow-hidden flex-shrink-0 mt-0.5">
                                    {parent.author_avatar ? (
                                      <img
                                        src={parent.author_avatar}
                                        alt=""
                                        className="w-full h-full object-cover"
                                      />
                                    ) : (
                                      <span className="text-[10px] text-[var(--accent-deep)]">
                                        {parent.author_name[0]}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0 bg-[var(--accent-soft)] rounded-xl px-3 py-2">
                                    <p className="text-[11px] font-medium text-[var(--accent-deep)]">
                                      {parent.author_name}
                                    </p>
                                    <p className="text-xs text-[#4a423c] mt-0.5 whitespace-pre-wrap break-words">
                                      {renderMentions(parent.content, mentionNames)}
                                    </p>
                                    <div className="flex items-center justify-between mt-1">
                                      <button
                                        onClick={() => {
                                          setReplyingTo(parent)
                                          setOpenCommentId(post.id)
                                        }}
                                        className="text-[10px] text-[var(--accent-muted)] hover:text-[var(--accent)]"
                                      >
                                        回复
                                      </button>
                                      <span className="text-[10px] text-[var(--accent-muted)]">
                                        {formatTime(parent.created_at)}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                {replies.length > 0 && (
                                  <div className="ml-8 mt-2 space-y-1.5">
                                    {replies.map((c) => (
                                      <div key={c.id} className="flex gap-2">
                                        <div className="w-5 h-5 rounded-full bg-[var(--accent-light)] flex items-center justify-center overflow-hidden flex-shrink-0 mt-0.5">
                                          {c.author_avatar ? (
                                            <img
                                              src={c.author_avatar}
                                              alt=""
                                              className="w-full h-full object-cover"
                                            />
                                          ) : (
                                            <span className="text-[9px] text-[var(--accent-deep)]">
                                              {c.author_name[0]}
                                            </span>
                                          )}
                                        </div>
                                        <div className="flex-1 min-w-0 bg-[var(--accent-soft)] rounded-xl px-3 py-1.5">
                                          <p className="text-[11px] text-[#4a423c] leading-relaxed">
                                            <span className="font-medium text-[var(--accent-deep)]">
                                              {c.author_name}
                                            </span>
                                            {c.parent_name && (
                                              <>
                                                <span className="text-[var(--accent-muted)]"> 回复 </span>
                                                <span className="font-medium text-[var(--accent-deep)]">
                                                  {c.parent_name}
                                                </span>
                                              </>
                                            )}
                                            <span className="text-[var(--accent-muted)]">：</span>
                                            <span className="ml-1">{renderMentions(c.content, mentionNames)}</span>
                                          </p>
                                          <div className="flex items-center justify-between mt-1">
                                            <button
                                              onClick={() => {
                                                setReplyingTo(c)
                                                setOpenCommentId(post.id)
                                              }}
                                              className="text-[10px] text-[var(--accent-muted)] hover:text-[var(--accent)]"
                                            >
                                              回复
                                            </button>
                                            <span className="text-[10px] text-[var(--accent-muted)]">
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
                            <p className="text-[10px] text-[var(--accent-muted)]">
                              正在回复{' '}
                              <span className="text-[var(--accent-deep)] font-medium">
                                {replyingTo.author_name}
                              </span>
                            </p>
                            <button
                              onClick={() => setReplyingTo(null)}
                              className="text-[10px] text-[var(--accent-muted)] hover:text-[var(--accent-deep)]"
                            >
                              取消
                            </button>
                          </div>
                        )}
                        <div className="flex gap-2">
                          <MentionInput
                            meId={meId}
                            value={commentInputs[post.id] || ''}
                            onChange={(next) => setCommentInputs({ ...commentInputs, [post.id]: next })}
                            onEnter={() => handlePostComment(post.id)}
                            placeholder={
                              replyingTo ? `回复 ${replyingTo.author_name}… 输入 @ 叫人` : '写点什么… 输入 @ 叫人'
                            }
                            maxLength={200}
                            withEmoji
                            className="w-full px-4 py-2 rounded-full border border-[var(--accent-line)] bg-[var(--accent-soft)] text-xs focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/10 transition"
                          />
                          <button
                            onClick={() => handlePostComment(post.id)}
                            disabled={
                              postingComment === post.id || !commentInputs[post.id]?.trim()
                            }
                            className="px-4 py-2 rounded-full bg-gradient-to-r from-[var(--accent-light)] to-[var(--accent)] text-white text-xs font-medium transition-all disabled:opacity-50"
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
        ) : mode === 'vault' ? (
          /* 储物箱：号主私有文件（≤10MB，按类别归档） */
          <VaultView userId={meId} />
        ) : (
          /* 计划书：计划 / 目标 / 待办任务 */
          <PlansView userId={meId} />
        )}
      </div>
    </div>
  )
}