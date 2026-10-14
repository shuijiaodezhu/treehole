'use client'

import { useEffect, useState } from 'react'
import { createClient } from '../lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Profile = {
  id: string
  username: string
  nickname: string | null
  avatar_url: string | null
  bio: string | null
  signature: string | null
  location: string | null
  birthday: string | null
  created_at: string
}

export default function MePage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [email, setEmail] = useState('')
  const [postCount, setPostCount] = useState(0)
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

      setEmail(userData.user.email || '')

      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userData.user.id)
        .single()

      if (profileData) setProfile(profileData as Profile)

      const { count } = await supabase
        .from('world_posts')
        .select('*', { count: 'exact', head: true })
        .eq('author_id', userData.user.id)

      setPostCount(count || 0)
      setLoading(false)
    }
    load()
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>加载中...</p>
      </div>
    )
  }

  const displayName = profile?.nickname || profile?.username || '未命名'

  return (
    <div className="min-h-screen p-6">
      <header className="max-w-2xl mx-auto mb-6">
        <Link href="/" className="text-sm text-gray-500 hover:underline">
          ← 返回
        </Link>
        <h1 className="text-3xl font-bold mt-2">我的</h1>
        <p className="text-sm text-gray-500 mt-1">我的东西，放在这</p>
      </header>

      <main className="max-w-2xl mx-auto space-y-4">
        {/* 个人信息卡 */}
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center text-2xl overflow-hidden flex-shrink-0">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                <span>{displayName[0]}</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-semibold">{displayName}</h2>
              <p className="text-sm text-gray-500 mt-0.5">{email}</p>
              {profile?.signature && (
                <p className="text-sm text-gray-700 mt-2">“{profile.signature}”</p>
              )}
              <div className="flex flex-wrap gap-3 text-xs text-gray-500 mt-3">
                {profile?.location && <span>📍 {profile.location}</span>}
                {profile?.birthday && <span>🎂 {profile.birthday}</span>}
                {profile?.created_at && (
                  <span>加入于 {new Date(profile.created_at).toLocaleDateString('zh-CN')}</span>
                )}
              </div>
            </div>
          </div>

          <Link
            href="/me/edit"
            className="mt-4 inline-block px-4 py-1.5 bg-orange-500 text-white text-sm rounded hover:bg-orange-600"
          >
            编辑资料
          </Link>
        </div>

        {/* 数据统计 */}
        <div className="bg-white p-4 rounded-lg shadow grid grid-cols-2 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold">{postCount}</p>
            <p className="text-xs text-gray-500 mt-1">已发帖</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-300">—</p>
            <p className="text-xs text-gray-500 mt-1">收到的赞</p>
          </div>
        </div>

        {/* 入口 */}
        <div className="bg-white rounded-lg shadow divide-y">
          <Link href="/me/posts" className="flex items-center justify-between p-4 hover:bg-gray-50">
            <span>📝 我的帖子</span>
            <span className="text-gray-400">→</span>
          </Link>
          <Link href="/me/favorites" className="flex items-center justify-between p-4 hover:bg-gray-50">
            <span>⭐ 我的收藏</span>
            <span className="text-gray-400">→</span>
          </Link>
          <Link href="/me/settings" className="flex items-center justify-between p-4 hover:bg-gray-50">
            <span>⚙️ 设置</span>
            <span className="text-gray-400">→</span>
          </Link>
        </div>

        {/* 退出登录 */}
        <div className="bg-white rounded-lg shadow">
          <button
            onClick={handleLogout}
            className="w-full text-left p-4 text-red-500 hover:bg-red-50"
          >
            退出登录
          </button>
        </div>
      </main>
    </div>
  )
}