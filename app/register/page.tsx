'use client'

import { useState } from 'react'
import { createClient } from '../lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AuthLayout, AuthSwitch } from '../../components/auth-layout'

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
    <AuthLayout heading="注册新账号" subheading="从写下第一句开始">
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
              <p className={`text-xs text-center ${message.includes('成功') ? 'text-green-600' : 'text-red-500'}`}>
                {message}
              </p>
            )}
          </form>

          <AuthSwitch text="已经有账号？" href="/login" label="去登录" />
        </AuthLayout>
  )
}
