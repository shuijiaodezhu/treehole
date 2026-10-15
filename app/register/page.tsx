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
  // 必须勾选条款才能注册
  const [agreed, setAgreed] = useState(false)
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
    const { data, error } = await supabase.auth.signUp({ email, password })

    if (error) {
      setMessage('注册失败：' + error.message)
      setLoading(false)
      return
    }

    /*
     * ③ 邮箱验证
     *
     * Supabase 里把「Confirm email」打开后，signUp 不会直接给会话 ——
     * 用户得先点邮件里的链接。这时不能当成功跳走：他到了登录页也登不进去，
     * 只会一脸茫然。所以按「有没有拿到会话」分成两条路。
     *
     * 怎么打开：Supabase → Authentication → Sign In / Providers → Email
     *          → 勾上 Confirm email
     *          （顺便确认 Redirect URLs 里填了你的站点地址）
     */
    if (data?.session) {
      setMessage('注册成功！正在跳转...')
      setTimeout(() => router.push('/login'), 1500)
    } else {
      setMessage(
        `确认邮件已发到 ${email}。点开邮件里的链接完成验证，再回来登录。\n（收件箱里没有的话，翻一下垃圾邮件）`,
      )
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center px-4">
      {/* 背景装饰光晕 */}
      <div className="absolute -top-20 -left-20 w-96 h-96 bg-[#f0b078] opacity-20 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-20 -right-20 w-96 h-96 bg-[#d97757] opacity-10 rounded-full blur-3xl pointer-events-none"></div>

      {/* 左侧装饰文字（大屏可见） */}
      <div className="hidden lg:block absolute left-20 top-1/2 -translate-y-1/2 max-w-sm">
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

      {/* 注册卡片 */}
      <div className="relative w-full max-w-sm ml-auto mr-auto lg:mr-32">
        <div className="rounded-3xl border border-[#f0e4d4] bg-white/80 backdrop-blur-lg p-8 shadow-[0_8px_40px_rgba(217,119,87,0.08)]">
          <div className="lg:hidden text-center mb-6">
            <h1 className="text-2xl font-bold text-[#2b2620]">你的来信</h1>
            <p className="mt-1 font-art italic text-[#c96447]">Dear You</p>
          </div>

          <h2 className="hidden lg:block text-lg font-semibold text-[#2b2620] mb-1">
            注册新账号
          </h2>
          <p className="hidden lg:block text-xs text-[#8a827a] mb-6">
            从写下第一句开始
          </p>

          <form onSubmit={handleRegister} className="space-y-4">
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
                placeholder="至少 8 位，包含字母和数字"
                required
                minLength={8}
                className="w-full px-4 py-2.5 rounded-xl border border-[#ece6dd] bg-[#fefcf9] text-sm focus:outline-none focus:border-[#d97757] focus:ring-2 focus:ring-[#d97757]/10 transition"
              />
              <p className="text-[10px] text-[#b0a89e] mt-1.5">
                至少 8 位，含字母和数字
              </p>

              {/* 关于密码的小诗 */}
              <div className="mt-3 pl-3 border-l-2 border-[#f0e4d4]">
                <p className="text-[11px] text-[#a88868] leading-loose font-serif-cn">
                  试试用一个你记得住的名字。
                  <br />
                  忘不掉的那种。
                  <br />
                  如果有一天忘了，也许还能想起 Ta。
                </p>
              </div>
            </div>

            {/* 条款勾选：不勾不能注册 */}
            <label className="flex cursor-pointer items-start gap-2 text-[11px] leading-relaxed text-[#8a827a]">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                required
                className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 accent-[#d97757]"
              />
              <span>
                我已阅读并同意
                <Link href="/p/terms" target="_blank" className="text-[#c96447] underline">
                  《用户协议》
                </Link>
                和
                <Link href="/p/privacy" target="_blank" className="text-[#c96447] underline">
                  《隐私政策》
                </Link>
                ，并会遵守
                <Link href="/p/community" target="_blank" className="text-[#c96447] underline">
                  《社区公约》
                </Link>
                。
              </span>
            </label>

            <button
              type="submit"
              disabled={loading || !agreed}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#e8a87c] to-[#d97757] text-white text-sm font-medium hover:shadow-[0_6px_20px_rgba(217,119,87,0.3)] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? '注册中...' : '注 册'}
            </button>

            {message && (
              <p className={`text-xs text-center whitespace-pre-line leading-relaxed ${message.includes('成功') || message.includes('确认邮件') ? 'text-green-600' : 'text-red-500'}`}>
                {message}
              </p>
            )}
          </form>

          <div className="mt-6 text-center">
            <p className="text-xs text-[#8a827a]">
              已经有账号？
              <Link href="/login" className="text-[#c96447] ml-1 hover:underline font-medium">
                去登录
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