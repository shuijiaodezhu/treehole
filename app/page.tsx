'use client'

import { useEffect, useState } from 'react'
import { createClient } from './lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function HomePage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function checkUser() {
      const { data } = await supabase.auth.getUser()
      if (!data.user) {
        router.push('/login')
      } else {
        setEmail(data.user.email || '')
        setLoading(false)
      }
    }
    checkUser()
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

  const sections = [
    { href: '/world', title: '院子', desc: '院子里，陌生人路过', emoji: '🌿' },
    { href: '/friends', title: '小屋', desc: '小屋里，只有熟人', emoji: '🛖' },
    { href: '/play', title: '聚会', desc: '来聚一聚，随便玩', emoji: '🎈' },
    { href: '/me', title: '我的', desc: '我的东西，放在这', emoji: '📦' },
  ]

  return (
    <div className="min-h-screen p-6">
      <header className="max-w-2xl mx-auto mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">你的来信</h1>
          <p className="text-sm text-gray-500 mt-1">Dear You · 这里有一封，你的来信</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-600 mb-2">{email}</p>
          <button
            onClick={handleLogout}
            className="text-sm text-red-500 hover:underline"
          >
            退出登录
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-4">
        {sections.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="block p-6 bg-white rounded-lg shadow hover:shadow-md transition border border-gray-100"
          >
            <div className="text-3xl mb-2">{s.emoji}</div>
            <h2 className="text-lg font-semibold">{s.title}</h2>
            <p className="text-sm text-gray-500 mt-1">{s.desc}</p>
          </Link>
        ))}
      </main>
    </div>
  )
}