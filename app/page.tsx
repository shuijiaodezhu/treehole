'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from './lib/supabase'

import {
  FriendRequestBanner,
} from '../components/home'
import { IconSearch } from '../components/icons'
import {
  QUOTE_SLOT_MS,
  calcLoginStreak,
  formatDateText,
  msUntilNextQuoteSlot,
  pickProfile,
  resolveDisplayName,
} from '../components/utils'
import { useWeather, weatherAdvice } from '../components/weather'
import { markModuleSeen, useModuleBadges } from '../components/module-badges'
import { cn } from '../lib/utils'
import { NotificationBell } from '../components/notifications'
import { WelcomeLetter } from '../components/welcome-letter'
import { isLoginTransitioning, subscribeLoginTransition } from '../components/login-transition'
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
import { getDailyPoem } from '../components/little-poems'
import { MailboxDialog, useMailbox } from '../components/mailbox'
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
  const [poem, setPoem] = useState<string[]>([])
  const [dateText, setDateText] = useState('')

  /*
   * 出场动画的开关：挂上 .dsh-open 就播一次（整页朦胧 → 四个字一起弹 → 立刻清晰），
   * 1.4 秒后摘掉，所以不会反复播。
   */
  const [opening, setOpening] = useState(false)
  /*
   * waiting：**首帧就是模糊的**（不是等动画开始才糊）。
   * 一开始 true → 页面一出来就是朦胧的；动画播完（约 2.1s）后才撤掉，
   * 所以不会出现"先清晰、再故意糊一下"那种丑。
   */
  const [waiting, setWaiting] = useState(true)

  useEffect(() => {
    function onDone() {
      setOpening(true)
      window.setTimeout(() => {
        setOpening(false)
        setWaiting(false)
      }, 900)
    }
    window.addEventListener('dsh:letter-done', onDone)
    return () => window.removeEventListener('dsh:letter-done', onDone)
  }, [])

  /*
   * 再挂一个时机：**登录过场结束时**也让标题写一遍。
   * 为什么需要它：
   *   那封信"判定不必弹"时虽然会派发 dsh:letter-done，
   *   但那一刻信封动画还盖在屏幕上，标题在背后就写完了 —— 你看不见。
   *   （如果信确实要弹，它关掉时还会再触发一次，两次都保留。）
   * 注意用 setTimeout 而不是直接 setState：effect 里同步 setState 会被
   * react-hooks/set-state-in-effect 拦下。
   */
  useEffect(() => {
    let done = false
    const bump = () => {
      if (done) return
      done = true
      setOpening(true)
      window.setTimeout(() => {
        setOpening(false)
        setWaiting(false)
      }, 900)
    }

    if (isLoginTransitioning()) {
      const unsubscribe = subscribeLoginTransition((active) => {
        if (!active) bump()
      })
      return unsubscribe
    }

    const timer = window.setTimeout(bump, 140)
    return () => window.clearTimeout(timer)
  }, [])

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
      setPoem(getDailyPoem())
      setDateText(formatDateText(new Date()))
    })

    const timeoutId = window.setTimeout(() => {
      setPoem(getDailyPoem())
      intervalId = window.setInterval(() => {
        if (!mountedRef.current) return
        setPoem(getDailyPoem())
      }, QUOTE_SLOT_MS)
    }, msUntilNextQuoteSlot())

    const handleVisible = () => {
      if (document.visibilityState === 'visible') setPoem(getDailyPoem())
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
    /*
     * 加载态：**不再用灰块骨架屏**（占位卡一片灰，像模板）。
     * 只留一行小字，安静地待在纸中间 —— 加载通常不到半秒，
     * 比起一排假卡片，这样更不像"页面还在拼装"。
     */
    return (
      <div
        className="flex min-h-screen items-center justify-center bg-base-100"
        style={pageAccentVars('home')}
      >
        <p className="font-serif-cn text-sm tracking-[0.1em] text-base-content/35 animate-pulse">
          正在展开这封信…
        </p>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'flex min-h-screen flex-col bg-base-100 text-base-content',
        waiting && 'dsh-wait-blur',
        opening && 'dsh-open',
      )}
      style={pageAccentVars('home')}
    >
      {/* ── 右上功能区（不能丢）── */}
      <div className="mx-auto flex w-full max-w-6xl items-center justify-end gap-3 px-5 pt-5 text-[13px] text-[#8a7a68] sm:px-8">
        <span className="hidden truncate sm:inline">{email || '朋友'}</span>
        <NotificationBell userId={userId} />
        <Link
          href="/search"
          aria-label="搜索"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#e0d3bd] transition hover:border-[#a8563a] hover:text-[#a8563a]"
        >
          <IconSearch className="h-[17px] w-[17px]" />
        </Link>
        <button
          type="button"
          onClick={() => setConfirmLogout(true)}
          className="transition hover:text-[#a8563a]"
        >
          退出登录
        </button>
      </div>

      {/* ── 出错提示（保留重试）── */}
      {(authError || requestError) && (
        <div className="mx-auto w-full max-w-6xl px-5 pt-4 sm:px-8">
          <div className="alert alert-error">
            <span>{authError || requestError}</span>
            <button type="button" className="btn btn-sm" onClick={handleRetry}>重试</button>
          </div>
        </div>
      )}

      {/* ── 桌面：一摞东西（lg 以上互相压着，手机上干净竖列）── */}
      <main className="mx-auto w-full max-w-3xl px-5 py-10 sm:px-8 lg:py-16">
        <div className="flex flex-col gap-6 lg:gap-0">

          {/* 信纸：标题＝信头 */}
          <section className="rounded-2xl border border-[#ece0cd] bg-[#fdf9f2] px-7 py-9 shadow-[0_28px_60px_-40px_rgba(90,64,52,0.5)] sm:px-10 sm:py-11 lg:-rotate-[1.2deg]">
            <h1 className="dsh-hero-title font-brush text-[38px] leading-[1.05] tracking-[0.03em] sm:text-[46px]">
              你的来信
            </h1>
            <p className="mt-2 text-[11.5px] tracking-[0.18em] text-[#a2937f]">
              DEAR YOU · {dateText}
            </p>

            <div className="mt-6 h-px bg-[#ece0cd]" />

{poem.length > 0 && (
              <div className="mt-7 space-y-2 font-serif-cn text-[21px] leading-[1.85] text-[#3a2f26] sm:text-[23px]">
                {poem.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
            )}

            <p className="mt-7 text-[13px] text-[#6f5d4c]">
              {weather.city} · {weather.condition}{' '}
              <span className="text-[#3a2f26]">{weather.temp}°</span>
              <span className="text-[#a2937f]"> / {weather.tempMin}°</span>
            </p>
            <p className="mt-1.5 text-[12.5px] text-[#8a6a4a]">{weatherAdvice(weather)}</p>

            <p className="mt-2.5 text-[12px] tracking-[0.1em] text-[#a2937f]">
              陪你走过 {streak.days} 天
              {streak.sinceLast <= 1 ? ' · 今天是重逢的第一天' : ` · 距上次见面 ${streak.sinceLast} 天`}
            </p>

            <div className="mt-8 flex justify-end">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[radial-gradient(circle_at_34%_30%,#c2674a,#a8563a)] shadow-[0_10px_20px_-10px_rgba(120,50,30,0.55)]">
                <span className="font-brush text-[19px] leading-none text-[#fdf8f0]">来</span>
              </span>
            </div>
          </section>

          {/* 冬日信箱：小照片，靠右，压住信纸右下角 */}
          <section className="rounded-2xl border border-[#ece0cd] bg-white p-3 pb-3 shadow-[0_26px_58px_-40px_rgba(90,64,52,0.5)] lg:-mt-14 lg:ml-auto lg:mr-10 lg:w-[44%] lg:rotate-[1.2deg]">
            <div className="rounded-lg bg-[#f8f0e4] px-2 pt-1">
              <MailboxArt onOpen={() => setMailboxOpen(true)} />
            </div>
            <div className="mt-1 flex items-baseline justify-between px-1">
              <span className="font-brush text-[17px] leading-none">冬日信箱</span>
              <span className="text-[11px] text-[#a2937f]">点它写信</span>
            </div>
          </section>

          {/* 好友申请 */}
          <div className="lg:mt-8">
            <FriendRequestBanner requests={requests} />
          </div>

          {/* 信封：小屋（放大、加高）*/}
          <Link
            href="/friends"
            onClick={() => markModuleSeen('friends')}
            className="group relative rounded-2xl border border-[#e3d4bd] bg-[#f8eee2] px-7 pb-8 pt-11 shadow-[0_24px_54px_-38px_rgba(90,64,52,0.55)] transition hover:-translate-y-0.5 sm:px-9 lg:-mt-10 lg:mr-auto lg:ml-10 lg:w-[80%] lg:rotate-[1.2deg]"
          >
            <svg viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true"
                 className="absolute inset-x-0 top-0 h-8 w-full">
              <path d="M0 0 L50 26 L100 0 Z" fill="rgba(226,211,189,0.5)" />
              <path d="M0 0 L50 26 L100 0" fill="none" stroke="#dcc9ae" strokeWidth="1.2" />
            </svg>

            <span className="flex items-baseline gap-3">
              <span className="font-brush text-[27px] leading-none">小屋</span>
              {badges?.friends?.count ? (
                <span className="whitespace-nowrap text-[12px] tabular-nums text-[#a8563a]">
                  未读 {badges.friends.count} 封
                </span>
              ) : badges?.friends?.dot ? (
                <span className="h-1.5 w-1.5 rounded-full bg-[#a8563a]" />
              ) : null}
            </span>
            <p className="mt-2.5 text-[13px] text-[#8a7a68]">那几个人还在等你回话</p>
          </Link>

          {/* 票根：聚会 */}
          <Link
            href="/play"
            onClick={() => markModuleSeen('play')}
            className="relative rounded-xl border border-[#e6c3ae] bg-[#fbeae3] px-6 py-5 shadow-[0_20px_44px_-30px_rgba(168,86,58,0.5)] transition hover:-translate-y-0.5 lg:-mt-10 lg:ml-auto lg:mr-10 lg:w-[62%] lg:-rotate-[1.2deg]"
          >
            <span className="text-[9px] tracking-[0.2em] text-[#a98a78]">NO. 0031 · ADMIT ONE</span>
            <span className="mt-1.5 flex items-baseline gap-2.5">
              <span className="font-brush text-[21px] leading-none">聚会</span>
              {badges?.play?.count ? (
                <span className="text-[11px] tabular-nums text-[#a8563a]">{badges.play.count}</span>
              ) : badges?.play?.dot ? (
                <span className="h-1.5 w-1.5 rounded-full bg-[#a8563a]" />
              ) : null}
            </span>
            <p className="mt-1.5 text-[12px] text-[#9c7566]">有人在放一首很旧的歌</p>
          </Link>

          {/* 便签：院子 */}
          <Link
            href="/world"
            onClick={() => markModuleSeen('world')}
            className="relative rounded-lg border border-[#e4d6b8] bg-[#f7efdc] px-5 py-4 shadow-[0_16px_36px_-26px_rgba(90,64,52,0.5)] transition hover:-translate-y-0.5 lg:-mt-10 lg:mr-auto lg:ml-10 lg:w-[50%] lg:rotate-[1.2deg]"
          >
            <span className="flex items-baseline gap-2.5">
              <span className="font-brush text-[20px] leading-none">院子</span>
              {badges?.world?.count ? (
                <span className="text-[11px] tabular-nums text-[#a8563a]">{badges.world.count}</span>
              ) : badges?.world?.dot ? (
                <span className="h-1.5 w-1.5 rounded-full bg-[#a8563a]" />
              ) : null}
            </span>
            <p className="mt-1.5 text-[12px] text-[#8a7a68]">今晚有人在这里说了梦</p>
          </Link>

          {/* 本子：我的 */}
          <Link
            href="/me"
            className="relative rounded-xl border border-[#d3bfa0] bg-[linear-gradient(155deg,#e7d8c0,#d8c6a8)] px-7 py-6 pl-9 shadow-[0_24px_52px_-34px_rgba(90,64,52,0.55)] transition hover:-translate-y-0.5 lg:-mt-10 lg:ml-auto lg:mr-10 lg:w-[44%] lg:-rotate-[1.2deg]"
          >
            <span className="absolute left-3.5 top-2 bottom-2 w-[2px] rounded bg-[#c3ab86]" />
            <span className="absolute right-4 top-0 bottom-0 w-[2px] rounded bg-[#a87f56]/40" />
            <span className="flex items-baseline gap-2.5">
              <span className="font-brush text-[21px] leading-none text-[#4b3826]">我的</span>
              {badges?.me?.count ? (
                <span className="text-[11px] tabular-nums text-[#a8563a]">{badges.me.count}</span>
              ) : badges?.me?.dot ? (
                <span className="h-1.5 w-1.5 rounded-full bg-[#a8563a]" />
              ) : null}
            </span>
            <p className="mt-1.5 text-[12px] text-[#6d5942]">资料、收藏、设置</p>
          </Link>
        </div>
      </main>

      {/* ── 页脚：隐私文件紧凑 + 两段断线 ── */}
      <footer className="mx-auto mt-auto flex w-full max-w-6xl flex-wrap items-end gap-x-6 gap-y-3 px-5 pb-8 text-[11.5px] text-[#8a7a68] sm:px-8">
        <nav className="flex flex-wrap gap-x-4 gap-y-2 border-t border-[#e3d4bd] pt-3.5">
          {[
            { slug: 'community', label: '社区公约' },
            { slug: 'reporting', label: '举报与申诉' },
            { slug: 'privacy', label: '隐私政策' },
            { slug: 'terms', label: '用户协议' },
            { slug: 'about', label: '关于' },
          ].map((item) => (
            <Link key={item.slug} href={`/p/${item.slug}`} className="transition hover:text-[#a8563a]">
              {item.label}
            </Link>
          ))}
        </nav>
        <Link
          href="/p"
          className="ml-auto border-t border-[#e3d4bd] pt-3.5 transition hover:text-[#a8563a]"
        >
          全部条款 →
        </Link>
      </footer>

      <MailboxDialog mailbox={mailbox} open={mailboxOpen} onClose={() => setMailboxOpen(false)} />

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

      <WelcomeLetter userId={userId} />
    </div>
  )
}
