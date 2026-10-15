'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from './lib/supabase'

import {
  FriendRequestBanner,
  NavCardGrid,
} from '../components/home'
import { IconRefresh, IconSearch } from '../components/icons'
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
import { NotificationBell } from '../components/notifications'
import { WelcomeLetter } from '../components/welcome-letter'
import { Button } from '../components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog'
import { toast } from 'sonner'
import type { FriendRequest, FriendshipRow, LoginStreak } from '../components/types'
import { pageAccentVars } from '../components/theme'
import { SkeletonHome } from '../components/skeleton'
import { MailboxDialog, MailboxTrigger, useMailbox } from '../components/mailbox'
import { MailboxArt } from '../components/mailbox-art'

// 客户端单例：放在模块级，保证引用稳定（useCallback / useEffect 不会每次渲染都重跑）
const supabase = createClient()

export default function HomePage() {
  const router = useRouter()
  const mountedRef = useRef(true)

  const [email, setEmail] = useState('')
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  /** 冬日信箱：写给站主的悄悄话 */
  const mailbox = useMailbox(userId)
  const [mailboxOpen, setMailboxOpen] = useState(false)
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
    // 统一走 toast 反馈（之前各处的成功/失败都是页面里插一行字）

    setConfirmLogout(false)
    try {
      await supabase.auth.signOut()
      router.replace('/login')
    } catch (err) {
      console.error('退出登录失败:', err)
      if (mountedRef.current) setAuthError('退出登录失败，请重试')
    }
    toast.success('已退出登录')
  }

  function handleRetry() {
    setAuthError('')
    setRequestError('')
    setLoading(true)
    setReloadKey((key) => key + 1)
  }

  if (loading) {
    return (
      <div className="page-theme min-h-screen" style={pageAccentVars('home')}>
        <SkeletonHome />
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      {/* 顶部 header */}
      <header className="relative w-full overflow-hidden border-b border-[#e0d3bd] bg-[#f4ebdd] text-[#3a2f26]">

        <div className="max-w-5xl mx-auto px-8 py-10 flex justify-between items-center relative">
          <div>

            <h1 className="font-serif-cn text-4xl leading-none sm:text-5xl">你的来信</h1>
            <p className="mt-3 flex items-baseline gap-2 text-[#8a7a68]">
              <span className="font-art text-3xl text-[#a8563a]">Dear You</span>
              <span className="text-sm">· 这里有一封，你的来信</span>
            </p>
          </div>

          <div className="text-right">
            <p className="text-sm mb-2">
              <span className="font-medium text-[#8a6a4a]">欢迎回来，</span>
              <span className="text-[#8a7a68]">{email || '朋友'}</span>
            </p>

            <div className="flex items-center justify-end gap-3">
              <span className="2xl:hidden">
                <MailboxTrigger mailbox={mailbox} onOpen={() => setMailboxOpen(true)} />
              </span>
              <NotificationBell userId={userId} />
              <Link
                href="/search"
                aria-label="搜索"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#e0d3bd] text-[#8a7a68] transition hover:border-[#a8563a] hover:text-[#a8563a]"
              >
                <IconSearch className="w-[18px] h-[18px]" />
              </Link>
              <button
                type="button"
                onClick={() => setConfirmLogout(true)}
                className="text-sm font-medium text-[#8a7a68] transition hover:text-[#a8563a]"
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

      <div className="relative mx-auto w-full max-w-2xl flex-1 px-6 py-16 sm:px-8 sm:py-20">
        {/* 2xl 以上才出现的信箱插图（相对内容容器定位，不参与布局） */}
        <div className="absolute -left-[176px] top-[36px] hidden w-[168px] 2xl:block">
          <MailboxArt onOpen={() => setMailboxOpen(true)} />
        </div>

        <div>
          {/* 一行小字：日期、天气、陪你走过 */}
          <p className="text-[12px] leading-relaxed tracking-[0.08em] text-[#9c8f7d]">
            {dateText} · {weather.city} {weather.condition} {weather.temp}° / {weather.tempMin}°
          </p>
          <p className="mt-1.5 text-[12px] tracking-[0.08em] text-[#9c8f7d]">
            陪你走过 {streak.days} 天
          </p>

          <FriendRequestBanner requests={requests} />

          <nav className="mt-14">
            <NavCardGrid badges={badges} />
          </nav>

          {quote && (
            <div className="mt-16">
              <p className="font-serif-cn text-[16px] leading-[2.1] text-[#3f332a]">「{quote}」</p>
              <p className="mt-4 text-right text-[12px] tracking-[0.08em] text-[#9c8f7d]">
                来自陌生人的问候
              </p>
              <p className="mt-1 text-right font-serif-cn text-[11px] text-[#a8563a]">
                —— 睡觉的猪
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 页脚：条款与说明入口 */}
      <footer className="mx-auto w-full max-w-2xl px-6 pb-12 sm:px-8">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-[#ece3d4] pt-6 text-[12px]">
          {[
            { slug: 'community', label: '社区公约' },
            { slug: 'reporting', label: '举报与申诉' },
            { slug: 'privacy', label: '隐私政策' },
            { slug: 'terms', label: '用户协议' },
            { slug: 'about', label: '关于' },
          ].map((item) => (
            <Link
              key={item.slug}
              href={`/p/${item.slug}`}
              className="text-[11px] text-[var(--accent-muted)] transition hover:text-[var(--accent-deep)]"
            >
              {item.label}
            </Link>
          ))}
          <Link
            href="/p"
            className="ml-auto text-[11px] text-[var(--accent-muted)] transition hover:text-[var(--accent-deep)]"
          >
            全部条款 →
          </Link>
        </div>
      </footer>

      {/* 冬日信箱：读信 / 写信 */}
      <MailboxDialog mailbox={mailbox} open={mailboxOpen} onClose={() => setMailboxOpen(false)} />

      {/* 退出登录二次确认：换成 Radix Dialog —— 焦点陷阱、Esc 关闭、滚动锁都交给它 */}
      <Dialog open={confirmLogout} onOpenChange={setConfirmLogout}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>要走了吗？</DialogTitle>
            <DialogDescription>退出后需要重新登录才能看到你的来信。</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmLogout(false)}>
              再待会儿
            </Button>
            <Button onClick={handleLogout}>退出登录</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 第一次登录、信封动画放完之后，浮出这封信（只出现一次） */}
      <WelcomeLetter userId={userId} />
    </div>
  )
}
