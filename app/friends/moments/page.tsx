'use client'

import { useEffect, useState } from 'react'
import { createClient } from '../../lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

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
    <div className="min-h-screen p-6">
      <header className="max-w-2xl mx-auto mb-6">
        <Link href="/friends" className="text-sm text-gray-500 hover:underline">
          ← 返回小屋
        </Link>
        <h1 className="text-3xl font-bold mt-2">朋友圈</h1>
        <p className="text-sm text-gray-500 mt-1">只有好友看得到</p>
      </header>

      <main className="max-w-2xl mx-auto">
        <form onSubmit={handlePost} className="bg-white p-4 rounded-lg shadow mb-6">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="说点什么，只有好友看得到..."
            rows={3}
            className="w-full p-2 border rounded resize-none focus:outline-none focus:ring-2 focus:ring-orange-300"
            maxLength={500}
          />
          <div className="flex justify-end mt-3">
            <button
              type="submit"
              disabled={posting || !content.trim()}
              className="px-4 py-1.5 bg-orange-500 text-white rounded hover:bg-orange-600 disabled:bg-gray-300"
            >
              {posting ? '发布中...' : '发布'}
            </button>
          </div>
        </form>

        <div className="space-y-4">
          {posts.length === 0 ? (
            <p className="text-center text-gray-400 py-10">还没有内容，写第一条吧。</p>
          ) : (
            posts.map((post) => (
              <div key={post.id} className="bg-white p-4 rounded-lg shadow">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-9 h-9 rounded-full bg-orange-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {post.author_avatar ? (
                      <img src={post.author_avatar} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-sm">{post.author_name[0]}</span>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{post.author_name}</p>
                    <p className="text-xs text-gray-400">
                      {new Date(post.created_at).toLocaleString('zh-CN')}
                    </p>
                  </div>
                </div>
                <p className="text-gray-800 whitespace-pre-wrap">{post.content}</p>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  )
}