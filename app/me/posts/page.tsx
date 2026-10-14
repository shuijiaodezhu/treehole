'use client'

import { useEffect, useState } from 'react'
import { createClient } from '../../lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Post = {
  id: string
  content: string
  is_anonymous: boolean
  created_at: string
  status: string
  is_hidden: boolean
}

export default function MyPostsPage() {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) {
        router.push('/login')
        return
      }

      const { data } = await supabase
        .from('world_posts')
        .select('id, content, is_anonymous, created_at, status, is_hidden')
        .eq('author_id', userData.user.id)
        .order('created_at', { ascending: false })

      if (data) setPosts(data as Post[])
      setLoading(false)
    }
    load()
  }, [])

  async function handleDelete(id: string) {
    if (!confirm('确定要删除这条帖子吗？')) return
    const { error } = await supabase.from('world_posts').delete().eq('id', id)
    if (error) {
      alert('删除失败：' + error.message)
    } else {
      setPosts(posts.filter((p) => p.id !== id))
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
    <div className="min-h-screen p-6">
      <header className="max-w-2xl mx-auto mb-6">
        <Link href="/me" className="text-sm text-gray-500 hover:underline">
          ← 返回
        </Link>
        <h1 className="text-3xl font-bold mt-2">我的帖子</h1>
        <p className="text-sm text-gray-500 mt-1">我一共发了 {posts.length} 条</p>
      </header>

      <main className="max-w-2xl mx-auto space-y-4">
        {posts.length === 0 ? (
          <p className="text-center text-gray-400 py-10">你还没发过帖子。</p>
        ) : (
          posts.map((post) => (
            <div key={post.id} className="bg-white p-4 rounded-lg shadow">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs text-gray-400">
                  {new Date(post.created_at).toLocaleString('zh-CN')}
                </span>
                <div className="flex gap-2 items-center">
                  {post.is_anonymous && (
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">匿名</span>
                  )}
                  {post.is_hidden && (
                    <span className="text-xs bg-red-100 text-red-500 px-2 py-0.5 rounded">已隐藏</span>
                  )}
                  <button
                    onClick={() => handleDelete(post.id)}
                    className="text-xs text-red-400 hover:text-red-600"
                  >
                    删除
                  </button>
                </div>
              </div>
              <p className="text-gray-800 whitespace-pre-wrap">{post.content}</p>
            </div>
          ))
        )}
      </main>
    </div>
  )
}