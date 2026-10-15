'use client'

import { useEffect, useState } from 'react'
import { createClient } from '../../lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useFocusQuery } from '../../../components/use-focus-query'
import { useFavorites } from '../../../components/favorites'
import { useDeleteContent } from '../../../components/delete-content'
import { useBlocks } from '../../../components/blocks'
import { Icon } from '../../../components/icons'

type Post = {
  id: string
  author_id: string
  content: string
  created_at: string
  author_name: string
  author_avatar: string | null
}

export default function MomentsPage() {
  const [posts, setPosts] = useState<Post[]>([])
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [posting, setPosting] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  // 从搜索页精确跳转：/friends/moments?post=<id> → 高亮并滚到那条
  const focusPostId = useFocusQuery('post')

  // 收藏
  const favorites = useFavorites(userId)

  // 删除自己发的朋友圈（两步确认）
  const deleter = useDeleteContent(userId)

  // 拉黑：被拉黑（含拉黑我的）的动态不显示
  const blocks = useBlocks(userId)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  async function handleDeleteMoment(momentId: string, authorId: string) {
    const result = await deleter.deleteMoment(momentId, authorId)
    setConfirmDelete(null)
    if (!result.ok) alert('删除失败：' + (result.message ?? '未知错误'))
  }

  useEffect(() => {
    if (!focusPostId) return
    const frame = window.requestAnimationFrame(() => {
      const el = document.querySelector(`[data-moment-id="${focusPostId}"]`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [focusPostId, posts])

  useEffect(() => {
    init()
  }, [])

  async function init() {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      router.push('/login')
      return
    }
    setUserId(userData.user.id)
    await loadPosts(userData.user.id)
    setLoading(false)
  }

  async function loadPosts(uid: string) {
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

    if (!postsData) {
      setPosts([])
      return
    }

    const authorIds = [...new Set(postsData.map((p) => p.author_id))]
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, username, nickname, avatar_url')
      .in('id', authorIds)

    const list: Post[] = postsData.map((p) => {
      const prof = profilesData?.find((x) => x.id === p.author_id)
      return {
        id: p.id,
        author_id: p.author_id,
        content: p.content,
        created_at: p.created_at,
        author_name: prof?.nickname || prof?.username || '某人',
        author_avatar: prof?.avatar_url || null,
      }
    })

    setPosts(list)
  }

  async function handlePost(e: React.FormEvent) {
    e.preventDefault()
    if (!content.trim() || !userId) return

    setPosting(true)
    const { error } = await supabase.from('friend_posts').insert({
      author_id: userId,
      content: content.trim(),
    })

    if (error) {
      alert('发布失败：' + error.message)
    } else {
      setContent('')
      await loadPosts(userId)
    }
    setPosting(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>加载中...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* 背景光晕 */}
      <div className="absolute -top-20 -right-20 w-96 h-96 bg-[#f0b078] opacity-20 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-20 -left-20 w-96 h-96 bg-[#d97757] opacity-10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="relative max-w-xl mx-auto px-6 py-10">
        <header className="mb-6">
          <Link href="/friends" className="text-sm text-[#8a827a] hover:text-[#c96447] transition">
            ← 返回小屋
          </Link>
          <h1 className="text-3xl font-bold text-[#2b2620] mt-2">朋友圈</h1>
          <p className="text-sm text-[#8a827a] mt-1">只有好友看得到</p>

          {/* 标签切换 */}
          <div className="flex gap-6 mt-5 border-b border-[#ece6dd]">
            <Link
              href="/friends"
              className="pb-2.5 text-[#8a827a] hover:text-[#2b2620] text-sm transition"
            >
              好友
            </Link>
            <span className="pb-2.5 border-b-2 border-[#d97757] text-[#d97757] font-medium text-sm">
              朋友圈
            </span>
          </div>
        </header>

        <main className="space-y-5">
          {/* 发布区 */}
          <form
            onSubmit={handlePost}
            className="rounded-3xl border border-[#f0e4d4] bg-white/80 backdrop-blur p-5 shadow-[0_2px_16px_rgba(217,119,87,0.05)] relative overflow-hidden"
          >
            <div className="absolute -top-6 -right-6 w-24 h-24 bg-[#f0b078] opacity-[0.1] rounded-full blur-2xl pointer-events-none"></div>

            <div className="relative">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="说点什么，只有好友看得到..."
                rows={3}
                className="w-full px-4 py-3 rounded-xl border border-[#ece6dd] bg-[#fefcf9] text-sm text-[#2b2620] resize-none focus:outline-none focus:border-[#d97757] focus:ring-2 focus:ring-[#d97757]/10 transition placeholder:text-[#c0b8ae]"
                maxLength={500}
              />
              <div className="flex justify-end mt-3">
                <button
                  type="submit"
                  disabled={posting || !content.trim()}
                  className="px-6 py-2 rounded-xl bg-gradient-to-r from-[#e8a87c] to-[#d97757] text-white text-sm font-medium hover:shadow-[0_6px_20px_rgba(217,119,87,0.3)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {posting ? '发布中...' : '发布'}
                </button>
              </div>
            </div>
          </form>

          {/* 帖子列表 */}
          <div className="space-y-3">
            {posts.length === 0 ? (
              <div className="rounded-2xl border border-[#f0e4d4] bg-white/60 backdrop-blur p-10 text-center">
                <p className="text-sm text-[#8a827a]">还没有内容，写第一条吧。</p>
              </div>
            ) : (
              posts
                .filter((p) => deleter.momentVisible(p))
                .filter((p) => !blocks.hiddenIds.has(p.author_id))
                .map((post) => (
                <div
                  key={post.id}
                  data-moment-id={post.id}
                  className={`rounded-2xl border bg-white/80 backdrop-blur p-5 shadow-[0_2px_12px_rgba(217,119,87,0.04)] relative overflow-hidden transition ${
                    focusPostId === post.id
                      ? 'border-[#d97757] ring-2 ring-[#d97757]/25'
                      : 'border-[#ece6dd]'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#fae0cc] to-[#f9d5ba] flex items-center justify-center overflow-hidden flex-shrink-0 shadow-sm">
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

                  <p className="text-sm text-[#4a423c] whitespace-pre-wrap break-words leading-relaxed pl-1">
                    {post.content}
                  </p>

                  {/* 收藏 / 删除自己发的 */}
                  <div className="mt-3 pt-3 border-t border-[#f2ece4] flex items-center justify-end gap-4">
                    {deleter.canDelete(post.author_id) && (
                      confirmDelete === post.id ? (
                        <button
                          type="button"
                          disabled={deleter.busyId === post.id}
                          onClick={() => void handleDeleteMoment(post.id, post.author_id)}
                          className="flex items-center gap-1.5 text-xs text-red-500 hover:underline disabled:opacity-50"
                        >
                          <Icon name="trash" className="w-3.5 h-3.5" />
                          {deleter.busyId === post.id ? '删除中…' : '确认删除'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setConfirmDelete(post.id)
                            window.setTimeout(
                              () => setConfirmDelete((cur) => (cur === post.id ? null : cur)),
                              4000,
                            )
                          }}
                          className="flex items-center gap-1.5 text-xs text-[#b0a89e] hover:text-red-500 transition"
                        >
                          <Icon name="trash" className="w-3.5 h-3.5" />
                          删除
                        </button>
                      )
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        void favorites.toggle({
                          kind: 'moment',
                          targetId: post.id,
                          content: post.content,
                          authorName: post.author_name,
                        })
                      }
                      disabled={favorites.busyKey === `moment:${post.id}`}
                      className={`flex items-center gap-1.5 text-xs transition disabled:opacity-50 ${
                        favorites.isFavorited('moment', post.id)
                          ? 'text-[#d97757]'
                          : 'text-[#b0a89e] hover:text-[#d97757]'
                      }`}
                    >
                      <Icon name={favorites.isFavorited('moment', post.id) ? 'heartfill' : 'heart'} className="w-3.5 h-3.5" />
                      {favorites.isFavorited('moment', post.id) ? '已收藏' : '收藏'}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </main>
      </div>
    </div>
  )
}