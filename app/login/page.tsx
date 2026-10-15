'use client'

import { useState } from 'react'
import { createClient } from '../lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { loginNavigateDelay, startLoginTransition } from '../../components/login-transition'
import { markJustLoggedIn } from '../../components/login-handoff'
import { logLogin } from '../../components/login-log'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  // 登录成功后先放过场动画，动画结束再跳主页
  const [entering, setEntering] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      /*
       * 打开 Confirm email 之后，没验证过就来登录会拿到英文报错
       * 「Email not confirmed」——用户看不懂，也不知道下一步该干嘛。
       * 这里换成人话，并直接告诉他去点邮件里的链接。
       */
      const raw = error.message ?? ''
      if (/email not confirmed/i.test(raw)) {
        setMessage('这个邮箱还没验证。去收件箱点一下确认链接，再回来登录（垃圾邮件里也翻一下）')
      } else {
        setMessage('登录失败：' + raw)
      }
      setLoading(false)
      return
    }
    // 过场动画由 layout 上的覆盖层负责（这样换页也不会中断）：
    // 先让登录页两边淡出、幕布合上，再把主页换到后面去加载
    setEntering(true)
    startLoginTransition()
    // 记一条登录日志（设备管理那一节用的就是它）；写失败不打扰用户
    if (data?.user?.id) void logLogin(data.user.id)
    window.setTimeout(() => {
      markJustLoggedIn()
      router.push('/')
    }, loginNavigateDelay())
  }

  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center px-4">
      {/* 背景装饰光晕 */}
      <div className="absolute -top-20 -left-20 w-96 h-96 bg-[#f0b078] opacity-20 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-20 -right-20 w-96 h-96 bg-[#d97757] opacity-10 rounded-full blur-3xl pointer-events-none"></div>

      {/* 左侧装饰文字（大屏可见） */}
      <div className={`hidden lg:block absolute left-20 top-1/2 -translate-y-1/2 max-w-sm ${entering ? 'th-page-out' : ''}`}>
        <h1 className="text-5xl font-bold text-[#2b2620] leading-tight">你的来信</h1>
        <p className="mt-4 text-[#8a6a4a] flex items-baseline gap-2">
          <span className="font-art text-3xl text-[#c96447]">Dear You</span>
        </p>
        <p className="mt-6 text-[#8a827a] text-sm leading-relaxed">
          这里有一封，你的来信。
          <br />
          陌生人、朋友，和自己。
        </p>

        {/* 一点点装饰：短线 + 小信封 + 短线（中间那片空就留着） */}
        <div className="mt-8 flex items-center gap-2.5">
          <span className="h-px w-6 bg-[#ecd6c4]" />
          <svg
            className="h-3.5 w-3.5 flex-shrink-0 text-[#e5bca3]"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            aria-hidden="true"
          >
            <rect x="2.5" y="6" width="19" height="12.5" rx="2" />
            <path d="M3.4 7 12 13.2 20.6 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="h-px w-10 bg-[#f2e3d6]" />
        </div>
      </div>

      {/* 登录卡片 */}
      <div className={`relative w-full max-w-sm ml-auto mr-auto lg:mr-32 ${entering ? 'th-page-out' : ''}`}>
        <div className="rounded-3xl border border-[#f0e4d4] bg-white/80 backdrop-blur-lg p-8 shadow-[0_8px_40px_rgba(217,119,87,0.08)]">
          <div className="lg:hidden text-center mb-6">
            <h1 className="text-2xl font-bold text-[#2b2620]">你的来信</h1>
            <p className="mt-1 font-art italic text-[#c96447]">Dear You</p>
          </div>

          <h2 className="hidden lg:block text-lg font-semibold text-[#2b2620] mb-1">
            欢迎回来
          </h2>
          <p className="hidden lg:block text-xs text-[#8a827a] mb-6">
            继续你的来信
          </p>

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

          <div className="mt-6 text-center">
            <p className="text-xs text-[#8a827a]">
              还没有账号？
              <Link href="/forgot-password" className="text-xs text-[var(--accent-muted)] hover:text-[var(--accent-deep)] transition">
              忘记密码？
            </Link>

              <Link href="/register" className="text-[#c96447] ml-1 hover:underline font-medium">
                去注册
              </Link>
            </p>
          </div>
        </div>

        <p className="text-center text-[10px] text-[#b0a89e] mt-4 tracking-wider">
          © 你的来信 · Dear You
        </p>
      </div>
    </div>
  )
}