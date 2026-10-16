'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '../lib/supabase'

/**
 * ② 忘记密码 —— 第一步：填邮箱，发重置信
 *
 * 走 Supabase 的 resetPasswordForEmail。邮件里的链接会带着一次性令牌
 * 回到 /reset-password（由 redirectTo 指定），那一页负责设新密码。
 *
 * ⚠️ redirectTo 的地址必须出现在 Supabase 的白名单里：
 *    Authentication → URL Configuration → Redirect URLs
 *    本地开发加 http://localhost:3000/**，上线后加你的正式域名
 *    没加的话，用户点邮件里的链接会跳到一个空白/报错页。
 *
 * 另外：不管邮箱存不存在，这里都提示「已发送」——
 * 否则这个页面就变成了「查某个邮箱有没有注册过」的工具。
 */

const supabase = createClient()

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [message, setMessage] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return

    setLoading(true)
    setMessage('')

    const redirectTo =
      typeof window === 'undefined' ? undefined : `${window.location.origin}/reset-password`

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo })

    // 报错也多半只是网络或限流；只有真出错才提示，其余一律当成功
    if (error && /email rate limit|rate limit exceeded|over_email_send_rate_limit/i.test(error.message)) {
      setMessage(
        '重置邮件发得太频繁了。这个站用的是免费自带的邮件服务，一小时只能发几封，' +
          '过一小时再试就好；急着用的话直接找站主。',
      )
      setLoading(false)
      return
    }

    if (error && !/user not found/i.test(error.message)) {
      setMessage('发送失败：' + error.message)
      setLoading(false)
      return
    }

    setSent(true)
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-box border border-base-300 bg-base-100/80 p-7 backdrop-blur shadow-sm">
        <h1 className="font-serif-cn text-lg font-semibold text-base-content">找回密码</h1>
        <p className="mt-1.5 font-serif-cn text-[11.5px] leading-relaxed text-base-content/60">
          填注册用的邮箱，我们把重置链接寄过去。
        </p>

        {sent ? (
          <div className="mt-6 rounded-box border border-base-300 bg-primary/5 px-4 py-4">
            <p className="font-serif-cn text-[12px] leading-relaxed text-base-content">
              重置链接已经发出去了（如果这个邮箱注册过的话）。
            </p>
            <p className="mt-2 font-serif-cn text-[11px] leading-relaxed text-base-content/60">
              去收件箱点开链接，就能设新密码。
              <br />
              没收到的话，翻一下垃圾邮件，或者过一会儿再试一次。
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="你的邮箱"
              autoComplete="email"
              className="w-full rounded-box border border-base-300 bg-primary/5 px-4 py-3 font-serif-cn text-[13px] text-base-content placeholder:text-base-content/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10"
            />
            {message && <p className="text-[11px] text-red-500">{message}</p>}
            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="w-full rounded-box bg-primary py-3 font-serif-cn text-[13px] text-primary-content transition hover:shadow-sm disabled:opacity-50"
            >
              {loading ? '发送中…' : '寄出重置链接'}
            </button>
          </form>
        )}

        <div className="mt-6 flex items-center justify-between font-serif-cn text-[11.5px]">
          <Link href="/login" className="text-primary hover:underline">
            回登录
          </Link>
          <Link href="/register" className="text-base-content/60 hover:text-primary">
            还没有账号
          </Link>
        </div>
      </div>
    </div>
  )
}
