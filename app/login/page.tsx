'use client'

import { useState } from 'react'
import { createClient } from '../lib/supabase'
import { useRouter } from 'next/navigation'
import { AuthLayout, AuthSwitch } from '../../components/auth-layout'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const router = useRouter()
  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setMessage('登录失败：' + error.message)
    } else {
      router.push('/')
    }
    setLoading(false)
  }

  return (
    <AuthLayout heading="欢迎回来" subheading="继续你的来信">
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs text-[#8a6a4a] mb-1.5 tracking-wide">邮箱</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full px-4 py-2.5 rounded-xl border border-[#ece6dd] bg-[#fefcf9] text-sm focus:outline-none focus:border-[#d97757] focus:ring-2 focus:ring-[#d97757]/10 transition"
              />
            </div>

            <div>
              <label className="block text-xs text-[#8a6a4a] mb-1.5 tracking-wide">密码</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-4 py-2.5 rounded-xl border border-[#ece6dd] bg-[#fefcf9] text-sm focus:outline-none focus:border-[#d97757] focus:ring-2 focus:ring-[#d97757]/10 transition"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#e8a87c] to-[#d97757] text-white text-sm font-medium hover:shadow-[0_6px_20px_rgba(217,119,87,0.3)] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? '登录中...' : '登 录'}
            </button>

            {message && (
              <p className="text-xs text-center text-red-500">{message}</p>
            )}
          </form>

          <AuthSwitch text="还没有账号？" href="/register" label="去注册" />
        </AuthLayout>
  )
}
