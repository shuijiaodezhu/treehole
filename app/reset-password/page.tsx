'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '../lib/supabase'

/**
 * ② 忘记密码 —— 第二步：设新密码
 *
 * 用户点邮件里的链接会回到这里。Supabase 的 JS SDK 默认会处理地址里的
 * 一次性令牌（detectSessionInUrl），所以进到这一页时**通常已经拿到会话**，
 * 直接 updateUser 改密码就行。
 *
 * 但不是每次都顺：链接可能过期、可能被别的邮箱客户端提前点掉、
 * 也可能浏览器把令牌吃掉了。所以这里**先看有没有会话**，
 * 没有就明确说「链接失效了，重新申请一封」，而不是让用户对着一个
 * 点了没反应的按钮发愣。
 */

const supabase = createClient()

export default function ResetPasswordPage() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const [hasSession, setHasSession] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const { data } = await supabase.auth.getSession()
      if (cancelled) return
      setHasSession(Boolean(data.session))
      setChecking(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMessage('')

    if (password.length < 8 || !/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
      setMessage('密码至少 8 位，含字母和数字')
      return
    }
    if (password !== confirm) {
      setMessage('两次输入的不一样')
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (error) {
      setMessage('没改成：' + error.message)
      return
    }
    setDone(true)
    window.setTimeout(() => router.push('/login'), 1200)
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="card w-full max-w-sm rounded-box border border-base-300 bg-base-100/80 p-7 backdrop-blur shadow-sm">
        <h1 className="font-serif-cn text-lg font-semibold text-base-content">设置新密码</h1>

        {checking ? (
          <p className="mt-6 font-serif-cn text-[11.5px] text-base-content/60">正在确认链接…</p>
        ) : done ? (
          <div className="mt-6 rounded-box border border-base-300 bg-base-content/5 px-4 py-4">
            <p className="font-serif-cn text-[12px] leading-relaxed text-base-content">改好了。</p>
            <p className="mt-1.5 font-serif-cn text-[11px] text-base-content/60">正在带你去登录…</p>
          </div>
        ) : !hasSession ? (
          <div className="card mt-6 rounded-box border border-base-300 bg-base-100 px-4 py-4">
            <p className="font-serif-cn text-[12px] leading-relaxed text-base-content">
              这个链接已经失效了。
            </p>
            <p className="mt-1.5 font-serif-cn text-[11px] leading-relaxed text-base-content/60">
              重置链接只能用一次，而且有时间限制。重新申请一封就好。
            </p>
            <Link
              href="/forgot-password"
              className="mt-3 inline-block rounded-full bg-primary px-4 py-2 font-serif-cn text-[11.5px] text-primary-content"
            >
              重新申请
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-3">
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="新密码（至少 8 位，含字母和数字）"
              autoComplete="new-password"
              className="w-full rounded-box border border-base-300 bg-base-content/5 px-4 py-3 font-serif-cn text-[13px] text-base-content placeholder:text-base-content/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10"
            />
            <input
              type="password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="再输一次"
              autoComplete="new-password"
              className="w-full rounded-box border border-base-300 bg-base-content/5 px-4 py-3 font-serif-cn text-[13px] text-base-content placeholder:text-base-content/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10"
            />
            {message && <p className="text-[11px] text-red-500">{message}</p>}
            <button
              type="submit"
              disabled={loading || !password || !confirm}
              className="btn btn-primary w-full font-serif-cn transition hover:shadow-sm disabled:opacity-50"
            >
              {loading ? '保存中…' : '保存新密码'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
