'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from './lib/supabase'

import {
  DailyQuoteCard,
  FriendRequestBanner,
  LoginStreakCard,
  NavCardGrid,
  WeatherCard,
} from '../components/home'
import { IconMail, IconRefresh, IconSearch } from '../components/icons'
import {
  QUOTE_SLOT_MS,
  calcLoginStreak,
  formatDateText,
  getQuoteByTime,
  msUntilNextQuoteSlot,
  pickProfile,
  resolveDisplayName,
} from '../components/utils'
import { useWeather } from '../components/weather'
import { useModuleBadges } from '../components/module-badges'
import type { FriendRequest, FriendshipRow, LoginStreak } from '../components/types'

// 客户端单例：放在模块级，保证引用稳定（useCallback / useEffect 不会每次渲染都重跑）
const supabase = createClient()

export default function HomePage() {
  const router = useRouter()
  const mountedRef = useRef(true)

  const [email, setEmail] = useState('')
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState('')
  const [requestError, setRequestError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  // 时间相关内容全部放到 hydration 之后再取：Next 16 不允许在预渲染阶段读 Date.now()
  const [quote, setQuote] = useState('')
  const [dateText, setDateText] = useState('')
  const [streak, setStreak] = useState<LoginStreak>({ days: 1, sinceLast: 1 })
  const [requests, setRequests] = useState<FriendRequest[]>([])
  const [confirmLogout, setConfirmLogout] = useState(false)

  const weather = useWeather()
  // 卡片提示：小屋 = 待处理申请 + 未读私信；院子/派对 = 新内容点（院子另有回复数）
  const badges = useModuleBadges(userId)

  /* ---------- 好友申请：一次联表查询搞定（不再分两次查表） ---------- */
  const loadRequests = useCallback(async (uid: string) => {
    const { data, error } = await supabase
      .from('friendships')
      .select(`
        id,
        requester_id,
        profiles:requester_id (
          username,
          nickname,
          avatar_url
        )
      `)
      .eq('addressee_id', uid)
      .eq('status', 'pending')

    if (error) throw error

    const rows = (data ?? []) as unknown as FriendshipRow[]

    setRequests(
      rows.map((row) => {
        const profile = pickProfile(row.profiles)
        return {
          friendship_id: row.id,
          requester_id: row.requester_id,
          username: resolveDisplayName(profile),
          nickname: profile?.nickname ?? null,
          avatar_url: profile?.avatar_url ?? null,
        }
      }),
    )
  }, [])

  /* ---------- 用户校验 + 数据加载（含异常捕获，失败可重试） ---------- */
  useEffect(() => {
    mountedRef.current = true

    async function checkUser() {
      try {
        const { data, error } = await supabase.auth.getUser()
        if (error) throw error
        if (!mountedRef.current) return

        const user = data.user
        if (!user) {
          router.replace('/login')
          return
        }

        setUserId(user.id)
        setEmail(user.email ?? '')
        setStreak(calcLoginStreak(user.created_at, user.last_sign_in_at))

        try {
          await loadRequests(user.id)
          if (mountedRef.current) setRequestError('')
        } catch (err) {
          console.error('加载好友申请失败:', err)
          if (!mountedRef.current) return
          setRequestError('好友申请加载失败，稍后可重试')
        }
      } catch (err) {
        console.error('页面初始化失败:', err)
        if (!mountedRef.current) return
        setAuthError('页面加载失败，请重试或重新登录')
      } finally {
        if (mountedRef.current) setLoading(false)
      }
    }

    void checkUser()
    return () => {
      mountedRef.current = false
    }
  }, [loadRequests, router, reloadKey])

  /* ---------- 每日一句 + 日期：hydration 后取一次，到点自动换 ---------- */
  useEffect(() => {
    let intervalId: number | null = null

    // 用 rAF 推迟到首帧之后：既避开预渲染限制，也不在 effect 里同步 setState
    const firstFrame = window.requestAnimationFrame(() => {
      setQuote(getQuoteByTime())
      setDateText(formatDateText(new Date()))
    })

    const timeoutId = window.setTimeout(() => {
      setQuote(getQuoteByTime())
      intervalId = window.setInterval(() => {
        if (!mountedRef.current) return
        setQuote(getQuoteByTime())
      }, QUOTE_SLOT_MS)
    }, msUntilNextQuoteSlot())

    const handleVisible = () => {
      if (document.visibilityState === 'visible') setQuote(getQuoteByTime())
    }
    document.addEventListener('visibilitychange', handleVisible)

    return () => {
      window.cancelAnimationFrame(firstFrame)
      window.clearTimeout(timeoutId)
      if (intervalId !== null) window.clearInterval(intervalId)
      document.removeEventListener('visibilitychange', handleVisible)
    }
  }, [])

  /* ---------- 退出登录（二次确认） ---------- */
  async function handleLogout() {
    setConfirmLogout(false)
    try {
      await supabase.auth.signOut()
      router.replace('/login')
    } catch (err) {
      console.error('退出登录失败:', err)
      if (mountedRef.current) setAuthError('退出登录失败，请重试')
    }
  }

  function handleRetry() {
    setAuthError('')
    setRequestError('')
    setLoading(true)
    setReloadKey((key) => key + 1)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-[#a88868]">加载中...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      {/* 顶部 header */}
      <header className="w-full bg-gradient-to-br from-[#fdf0e6] via-[#fae4d4] to-[#f5d5bc] border-b border-[#e8c8b5] relative overflow-hidden shadow-[0_2px_16px_rgba(217,119,87,0.06)]">
        <div className="absolute -top-10 -right-10 w-48 h-48 bg-[#d97757] opacity-10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-[#d97757] opacity-[0.07] rounded-full blur-3xl pointer-events-none"></div>

        <div className="max-w-5xl mx-auto px-8 py-10 flex justify-between items-center relative">
          <div>
            <h1 className="text-3xl font-bold text-[#2b2620]">你的来信</h1>
            <p className="mt-2 text-[#8a6a4a] flex items-baseline gap-2">
              <span className="font-art text-2xl text-[#c96447]">Dear You</span>
              <span className="text-sm">· 这里有一封，你的来信</span>
            </p>
          </div>

          <div className="text-right">
            <p className="text-sm mb-2">
              <span className="text-[#c96447] font-medium">欢迎回来，</span>
              <span className="text-[#8a827a]">{email || '朋友'}</span>
            </p>

            <div className="flex items-center justify-end gap-3">
              <Link
                href="/search"
                aria-label="搜索"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#ecd6c4] bg-white/60 text-[#b09070] hover:bg-white/90 hover:text-[#c96447] transition"
              >
                <IconSearch className="w-[18px] h-[18px]" />
              </Link>
              <button
                type="button"
                onClick={() => setConfirmLogout(true)}
                className="text-sm text-[#c96447] hover:underline font-medium"
              >
                退出登录
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* 错误提示条 + 重试 */}
      {(authError || requestError) && (
        <div className="max-w-5xl mx-auto px-8 pt-6">
          <div className="flex items-center justify-between gap-3 rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">
            <span>{authError || requestError}</span>
            <button
              type="button"
              onClick={handleRetry}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-2.5 py-1 text-xs text-red-600 hover:bg-red-50 transition"
            >
              <IconRefresh className="w-3.5 h-3.5" />
              重试
            </button>
          </div>
        </div>
      )}

      <div className="max-w-5xl mx-auto px-8 py-10 flex gap-8 items-stretch">
        {/* 左侧面板 */}
        <aside className="w-64 flex-shrink-0 flex flex-col gap-4">
          <WeatherCard weather={weather} dateText={dateText} />
          <LoginStreakCard streak={streak} />
          <DailyQuoteCard quote={quote} />
        </aside>

        {/* 右侧主内容 */}
        <main className="flex-1 flex flex-col gap-4">
          <FriendRequestBanner requests={requests} />
          <NavCardGrid badges={badges} />
        </main>
      </div>

      {/* 退出登录二次确认 */}
      {confirmLogout && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm px-4"
          onClick={() => setConfirmLogout(false)}
        >
          <div
            className="w-full max-w-xs rounded-3xl bg-white p-6 shadow-2xl text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-3 w-11 h-11 rounded-full bg-[#fdf0e6] flex items-center justify-center">
              <IconMail className="w-5 h-5 text-[#d97757]" />
            </div>
            <h2 className="text-base font-semibold text-[#2b2620]">要走了吗？</h2>
            <p className="mt-1 text-xs text-[#a88868] leading-relaxed">
              退出后需要重新登录才能看到你的来信。
            </p>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmLogout(false)}
                className="flex-1 rounded-xl border border-[#ece6dd] px-4 py-2 text-sm text-[#6a6058] hover:bg-[#fdf7f2] transition"
              >
                再待会儿
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="flex-1 rounded-xl bg-gradient-to-r from-[#e08a63] to-[#d97757] px-4 py-2 text-sm font-medium text-white hover:shadow-[0_6px_20px_rgba(217,119,87,0.3)] transition-all"
              >
                退出登录
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
