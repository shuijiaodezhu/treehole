'use client'

import { useEffect, useState } from 'react'
import { createClient } from '../lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Post = {
  id: string
  content: string
  is_anonymous: boolean
  author_id: string | null
  created_at: string
  profiles?: { username: string } | null
}

export default function WorldPage() {
  const [posts, setPosts] = useState<Post[]>([])
  const [content, setContent] = useState('')
  const [isAnonymous, setIsAnonymous] = useState(true)
  const [loading, setLoading] = useState(true)
  const [posting, setPosting] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function init() {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) {
        router.push('/login')
        return
      }
      setUserId(userData.user.id)
      await loadPosts()
      setLoading(false)
    }
    init()
  }, [])

  async function loadPosts() {
    const { data, error } = await supabase
      .from('world_posts')
      .select('id, content, is_anonymous, author_id, created_at')
      .eq('status', 'published')
      .eq('is_hidden', false)
      .order('created_at', { ascending: false })
      .limit(50)

    if (!error && data) {
      setPosts(data as any)
    }
  }

  async function handlePost(e: React.FormEvent) {
    e.preventDefault()
    if (!content.trim() || !userId) return

    setPosting(true)
    const { error } = await supabase.from('world_posts').insert({
      author_id: userId,
      content: content.trim(),
      is_anonymous: isAnonymous,
      category: 'yard',
      status: 'published',
    })

    if (error) {
      alert('发帖失败：' + error.message)
    } else {
      setContent('')
      await loadPosts()
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
        <Link href="/" className="text-sm text-gray-500 hover:underline">
          ← 返回
        </Link>
        <h1 className="text-3xl font-bold mt-2">院子</h1>
        <p className="text-sm text-gray-500 mt-1">院子里，陌生人路过</p>
      </header>

      <main className="max-w-2xl mx-auto">
        {/* 发帖区 */}
        <form onSubmit={handlePost} className="bg-white p-4 rounded-lg shadow mb-6">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="写点什么，院子里的人都看得到..."
            rows={3}
            className="w-full p-2 border rounded resize-none focus:outline-none focus:ring-2 focus:ring-orange-300"
            maxLength={500}
          />
          <div className="flex justify-between items-center mt-3">
            <label className="flex items-center text-sm text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={isAnonymous}
                onChange={(e) => setIsAnonymous(e.target.checked)}
                className="mr-2"
              />
              匿名发布
            </label>
            <button
              type="submit"
              disabled={posting || !content.trim()}
              className="px-4 py-1.5 bg-orange-500 text-white rounded hover:bg-orange-600 disabled:bg-gray-300"
            >
              {posting ? '发送中...' : '发送'}
            </button>
          </div>
        </form>

        {/* 帖子列表 */}
        <div className="space-y-4">
          {posts.length === 0 ? (
            <p className="text-center text-gray-400 py-10">院子里还空空的，写第一条吧。</p>
          ) : (
            posts.map((post) => (
              <div key={post.id} className="bg-white p-4 rounded-lg shadow">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-500">
                    {post.is_anonymous
                      ? '匿名'
                      : post.profiles?.username || '某人'}
                  </span>
                  <span className="text-xs text-gray-400">
                    {new Date(post.created_at).toLocaleString('zh-CN')}
                  </span>
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