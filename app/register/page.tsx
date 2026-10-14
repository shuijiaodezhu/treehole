'use client'

import { useState } from 'react'
import { createClient } from '../lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function RegisterPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const router = useRouter()
  const supabase = createClient()

  function checkPassword(pwd: string): string | null {
    if (pwd.length < 8) return '密码至少 8 位'
    if (!/[a-zA-Z]/.test(pwd)) return '密码必须包含字母'
    if (!/[0-9]/.test(pwd)) return '密码必须包含数字'
    if (/^(.)\1+$/.test(pwd)) return '密码不能是重复字符'
    const weakList = ['password', '12345678', 'qwertyui', 'abcd1234']
    if (weakList.includes(pwd.toLowerCase())) return '这个密码太常见了，换一个'
    return null
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setMessage('')

    const err = checkPassword(password)
    if (err) {
      setMessage(err)
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.signUp({ email, password })

    if (error) {
      setMessage('注册失败：' + error.message)
    } else {
      setMessage('注册成功！正在跳转...')
      setTimeout(() => router.push('/login'), 1500)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <form onSubmit={handleRegister} className="bg-white p-8 rounded-lg shadow-md w-96">
        <h1 className="text-2xl font-bold mb-6 text-center">注册账号</h1>

        <input
          type="email"
          placeholder="邮箱"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full p-2 border rounded mb-4"
        />

        <input
          type="password"
          placeholder="密码（至少 8 位，含字母和数字）"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          className="w-full p-2 border rounded mb-4"
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-green-500 text-white p-2 rounded hover:bg-green-600 disabled:bg-gray-400"
        >
          {loading ? '注册中...' : '注册'}
        </button>

        {message && (
          <p className={`mt-4 text-sm text-center ${message.includes('成功') ? 'text-green-600' : 'text-red-500'}`}>
            {message}
          </p>
        )}

        <p className="mt-4 text-sm text-center">
          已有账号？<Link href="/login" className="text-blue-500">去登录</Link>
        </p>
      </form>
    </div>
  )
}
