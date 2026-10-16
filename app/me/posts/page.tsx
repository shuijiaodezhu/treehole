'use client'

import { useEffect, useState } from 'react'
import { createClient } from '../../lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { SkeletonCard } from '../../../components/skeleton'

type Post = { id: string; content: string; is_anonymous: boolean; created_at: string; status: string; is_hidden: boolean }

function IconTrash({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  )
}

function IconDoc({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  )
}

export default function MyPostsPage() {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) { router.push('/login'); return }
      const { data } = await supabase.from('world_posts').select('id, content, is_anonymous, created_at, status, is_hidden').eq('author_id', userData.user.id).order('created_at', { ascending: false })
      if (data) setPosts(data as Post[])
      setLoading(false)
    }
    // supabase 是组件内 createClient() 出来的，每次渲染都是新对象；
    // 把它和 router 一起写进依赖数组，effect 会每次渲染都重跑、无限重取。
    // 这里只在挂载时加载一次。
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleDelete(id: string) {
    if (!confirm('确定要删除这条帖子吗？')) return
    const { error } = await supabase.from('world_posts').delete().eq('id', id)
    if (error) { alert('删除失败：' + error.message) }
    else { setPosts(posts.filter((p) => p.id !== id)) }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-xl px-6 pt-24">
        <SkeletonCard lines={3} />
      </div>
    )
  }

  return (
    <div className="min-h-screen relative overflow-hidden">

      <div className="relative max-w-xl mx-auto px-6 py-10">
        <header className="mb-6">
          <Link href="/me" className="text-sm text-base-content/60 hover:text-base-content/60 transition">← 返回</Link>
          <h1 className="text-3xl font-bold text-base-content mt-2">我的帖子</h1>
          <p className="text-sm text-base-content/60 mt-1">一共发过 <span className="text-base-content/60 font-medium">{posts.length}</span> 条</p>
        </header>

        <main className="space-y-3">
          {posts.length === 0 ? (
            <div className="card rounded-box border border-base-300 bg-base-100/60 backdrop-blur p-10 text-center">
              <div className="w-12 h-12 rounded-full bg-base-content/5 flex items-center justify-center mx-auto mb-3">
                <IconDoc className="w-5 h-5 text-base-content/60" />
              </div>
              <p className="text-sm text-base-content/60">你还没发过帖子。</p>
              <Link href="/world" className="inline-block mt-4 text-xs text-base-content/60 hover:underline">去院子写一条 →</Link>
            </div>
          ) : (
            posts.map((post) => (
              <div key={post.id} className="card group rounded-box border border-base-300 bg-base-100 p-5 hover:shadow-sm transition-all relative overflow-hidden">
                <div className="flex justify-between items-start mb-3">
                  <span className="text-[11px] text-base-content/40 tracking-wide">
                    {new Date(post.created_at).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <div className="flex gap-2 items-center flex-shrink-0">
                    {post.is_anonymous && (<span className="text-[11px] bg-base-content/5 text-base-content/60 px-2 py-0.5 rounded-full font-medium">匿名</span>)}
                    {post.is_hidden && (<span className="text-[11px] bg-red-50 text-red-500 px-2 py-0.5 rounded-full font-medium">已隐藏</span>)}
                    <button onClick={() => handleDelete(post.id)} className="text-base-content/40 hover:text-red-500 transition p-1 rounded-md hover:bg-red-50" title="删除">
                      <IconTrash className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <p className="text-sm text-base-content whitespace-pre-wrap break-words leading-relaxed">{post.content}</p>
              </div>
            ))
          )}
        </main>
      </div>
    </div>
  )
}