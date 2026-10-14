'use client'

import { useState } from 'react'
import { createClient } from '../../lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function SettingsPage() {
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const router = useRouter()
  const supabase = createClient()

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    setMessage('')

    if (password.length < 8) {
      setMessage('密码至少 8 位')
      return
    }
    if (!/[a-zA-Z]/.test(password)) {
      setMessage('密码必须包含字母')
      return
    }
    if (!/[0-9]/.test(password)) {
      setMessage('密码必须包含数字')
      return
    }
    if (/^(.)\1+$/.test(password)) {
      setMessage('密码不能是重复字符')
      return
    }
    const weakList = ['password', '12345678', 'qwertyui', 'abcd1234']
    if (weakList.includes(password.toLowerCase())) {
      setMessage('这个密码太常见了，换一个')
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setMessage('修改失败：' + error.message)
    } else {
      setMessage('密码已更新')
      setPassword('')
    }
    setLoading(false)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="min-h-screen p-6">
      <header className="max-w-2xl mx-auto mb-6">
        <Link href="/me" className="text-sm text-gray-500 hover:underline">
          ← 返回
        </Link>
        <h1 className="text-3xl font-bold mt-2">设置</h1>
      </header>

      <main className="max-w-2xl mx-auto space-y-4">
        <form onSubmit={handleChangePassword} className="bg-white p-6 rounded-lg shadow space-y-4">
          <h2 className="font-semibold">修改密码</h2>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="新密码（至少 8 位，含字母和数字）"
            minLength={8}
            required
            className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-orange-300"
          />
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 disabled:bg-gray-300"
          >
            {loading ? '保存中...' : '保存新密码'}
          </button>
          {message && (
            <p className={`text-sm ${message.includes('失败') || message.includes('必须') || message.includes('至少') || message.includes('不能') || message.includes('常见') ? 'text-red-500' : 'text-green-600'}`}>
              {message}
            </p>
          )}
        </form>

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