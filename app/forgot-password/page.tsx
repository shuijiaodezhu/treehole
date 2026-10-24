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

  /*
   * 第二步：输入邮件里的 6 位验证码 + 设置新密码
   *
   * 为什么不用"点链接"那套 ✗
   *   链接指向 supabase.co（国外）→ 国内直连被墙 → 用户点了就是 ERR_CONNECTION_RESET ✓
   *   （用户报过"每次都进不去"，重装/换浏览器都没用 ✓）
   * 验证码方案：
   *   · 邮件里只发 6 位数字（模板用 {{ .Token }}）
   *   · 用户在我们自己的页面上输入 ✓
   *   · verifyOtp / updateUser 都是**发到 API 的 POST 请求** ✓
   *     不是"点开一个网页" ✗ 所以不依赖浏览器能不能打开 supabase.co ✓✓
   */
  const [code, setCode] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [resetDone, setResetDone] = useState(false)

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    if (!code.trim()) {
      setMessage('先把邮件里那串数字填上。')
      return
    }
    if (newPwd.length < 6) {
      setMessage('新密码至少 6 位。')
      return
    }

    setVerifying(true)
    setMessage('')

    const { error: vErr } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: 'recovery',
    })
    if (vErr) {
      setMessage('验证码不对或已过期。看邮件里**最新**那封，再输入一次。')
      setVerifying(false)
      return
    }

    const { error: pErr } = await supabase.auth.updateUser({ password: newPwd })
    if (pErr) {
      setMessage('设新密码失败：' + (pErr.message || '再试一次'))
      setVerifying(false)
      return
    }

    setResetDone(true)
    setVerifying(false)
  }

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
      /*
       * 把 "Failed to fetch" 翻成人话
       *   它的意思**不是**"发不出去" ✗，而是**请求没到服务器** ✓
       *   常见原因：代理/信号瞬断、浏览器插件拦截
       *   （服务端我验过：预检 200 ✓ POST 200 ✓ 所以不是配置问题）
       */
      const raw = error.message || ''

      /*
       * Supabase 的限流提示是英文的：
       *   "For security purposes, you can only request this after 23 seconds."
       * 用户看不懂 ✗ 翻成人话，并把秒数提出来 ✓
       */
      const waitMatch = raw.match(/after (\d+) seconds?/i)
      if (/for security purposes/i.test(raw) && waitMatch) {
        setMessage('发得太快啦，请等 ' + waitMatch[1] + ' 秒再试一次。')
        setLoading(false)
        return
      }
      const networkish = /failed to fetch|network ?error|load failed|err_/i.test(raw)
      setMessage(
        networkish
          ? '网络没连上服务器（可能代理或信号不稳）。等几秒再点一次；还不行就换个网络，或者用浏览器打开试试。'
          : '发送失败：' + raw,
      )
      setLoading(false)
      return
    }

    setSent(true)
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="card w-full max-w-sm rounded-box border border-base-300 bg-base-100/80 p-7 backdrop-blur shadow-sm">
        <h1 className="font-serif-cn text-lg font-semibold text-base-content">找回密码</h1>
        <p className="mt-1.5 font-serif-cn text-[11.5px] leading-relaxed text-base-content/60">
          填注册用的邮箱，我们把重置链接寄过去。
        </p>

        {sent ? (
          resetDone ? (
            /* 第二步完成 */
            <div className="mt-6 space-y-4 rounded-box border border-base-300 bg-base-content/5 px-4 py-4">
              <p className="font-serif-cn text-[12.5px] leading-relaxed text-base-content">
                新密码设置好了 ✓
              </p>
              <p className="font-serif-cn text-[11px] leading-relaxed text-base-content/60">
                用新密码登录就行。
              </p>
              <Link href="/login" className="btn btn-primary w-full font-serif-cn">
                去登录
              </Link>
            </div>
          ) : (
            /* 第二步：输验证码 + 设新密码 */
            <form onSubmit={handleVerify} className="mt-6 space-y-3.5">
              <p className="font-serif-cn text-[12px] leading-relaxed text-base-content">
                验证码已经发到 {email} ✓
              </p>
              <p className="font-serif-cn text-[11px] leading-relaxed text-base-content/60">
                邮件里是<strong>一串数字</strong>（不是链接 ✗ 这样国内也能用 ✓）。
                <br />
                没收到就翻一下垃圾邮件；再没收到，过一会儿重新点一次「寄出」。
              </p>

              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="邮件里的验证码"
                className="w-full rounded-box border border-base-300 bg-base-content/5 px-4 py-3 text-center font-mono text-lg tracking-[0.4em] text-base-content placeholder:text-base-content/40 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10"
              />

              <input
                type="password"
                autoComplete="new-password"
                required
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
                placeholder="新密码（至少 6 位）"
                className="w-full rounded-box border border-base-300 bg-base-content/5 px-4 py-3 font-serif-cn text-[13px] text-base-content placeholder:text-base-content/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10"
              />

              {message && <p className="text-[11px] text-red-500">{message}</p>}

              <button
                type="submit"
                disabled={verifying}
                className="btn btn-primary w-full font-serif-cn transition hover:shadow-sm disabled:opacity-50"
              >
                {verifying ? '设置中…' : '验证并设置新密码'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setSent(false)
                  setMessage('')
                }}
                className="w-full text-center font-serif-cn text-[11px] text-base-content/60 transition hover:text-primary"
              >
                邮箱填错了？回去改
              </button>
            </form>
          )
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="你的邮箱"
              autoComplete="email"
              className="w-full rounded-box border border-base-300 bg-base-content/5 px-4 py-3 font-serif-cn text-[13px] text-base-content placeholder:text-base-content/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10"
            />
            {message && <p className="text-[11px] text-red-500">{message}</p>}
            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="btn btn-primary w-full font-serif-cn transition hover:shadow-sm disabled:opacity-50"
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
