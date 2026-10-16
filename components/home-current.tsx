'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '../app/lib/supabase'

import {
  FriendRequestBanner,
} from './home'
import { IconSearch } from './icons'
import {
  QUOTE_SLOT_MS,
  calcLoginStreak,
  formatDateText,
  getQuoteByTime,
  msUntilNextQuoteSlot,
  pickProfile,
  resolveDisplayName,
} from './utils'
import { useWeather } from './weather'
import { markModuleSeen, useModuleBadges } from './module-badges'
import { TiltCard } from './tilt-card'
import { cn } from '../lib/utils'
import { NotificationBell } from './notifications'
import { WelcomeLetter } from './welcome-letter'
import { isLoginTransitioning, subscribeLoginTransition } from './login-transition'
import { motion, useScroll, useTransform } from 'motion/react'
import { ChevronRight, House, PartyPopper, Trees, UserRound } from 'lucide-react'
import { Button } from './ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog'
import { toast } from 'sonner'
import type { FriendRequest, FriendshipRow, LoginStreak } from './types'
import { pageAccentVars } from './theme'
import { MailboxDialog, useMailbox } from './mailbox'
import { MailboxArt } from './mailbox-art'
import { WinterScene } from './winter-scene'
import { FallingBits } from './paper-pattern'

// 客户端单例：放在模块级，保证引用稳定（useCallback / useEffect 不会每次渲染都重跑）
const supabase = createClient()

export function HomeCurrent() {
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

  /* 四个模块：daisyUI 卡片要用的定义（图标 + 文案 + 角标键） */
  /*
   * 每块一个**暖家谱里的不同调子**：火漆红 / 蜜金 / 陶红 / 可可。
   * daisyUI 给的是统一的骨架，这里给每块一点自己的颜色 ——
   * 四块分得开，又不至于变成彩虹。
   */
  const moduleCards = [
    {
      key: 'friends',
      href: '/friends',
      title: '小屋',
      desc: '好友与私聊，慢慢说',
      Icon: House,
      tint: 'bg-primary/10',
      ink: 'text-primary',
    },
    {
      key: 'world',
      href: '/world',
      title: '院子',
      desc: '大家在想什么',
      Icon: Trees,
      tint: 'bg-primary/10',
      ink: 'text-primary',
    },
    {
      key: 'play',
      href: '/play',
      title: '聚会',
      desc: '活动、小工具、一起听歌',
      Icon: PartyPopper,
      tint: 'bg-primary/10',
      ink: 'text-primary',
    },
    {
      key: 'me',
      href: '/me',
      title: '我的',
      desc: '资料、收藏、设置',
      Icon: UserRound,
      tint: 'bg-primary/10',
      ink: 'text-primary',
    },
  ] as const

  /*
   * 标题"写一遍"的计数器：每次 +1 就让 h1 重新挂载（key 变了），
   * CSS 动画于是从头再放一遍。触发时机 = 那封信关掉（或判定不弹）之后。
   */
  const [writeKey, setWriteKey] = useState(0)
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
      setWriteKey((k) => k + 1)
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
      setWriteKey((k) => k + 1)
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

  /* ---------- ③ 连续滚动（视差） ----------
     往下滚：站名向上位移并淡出，滚动提示先消失。
     这是"连续"那一档 —— 跟手、可逆、和滚动位置一一对应。 */
  const { scrollY } = useScroll()
  const heroY = useTransform(scrollY, [0, 460], [0, -84])
  const heroOpacity = useTransform(scrollY, [0, 320], [1, 0.12])
  const hintOpacity = useTransform(scrollY, [0, 110], [1, 0])
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
        // 「没有会话」不是错误：未登录是正常状态，下面按未登录处理（跳登录页）
        if (error && error.name !== 'AuthSessionMissingError') throw error
        if (!mountedRef.current) return

        const user = data?.user ?? null
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
      {/* 顶部色带：navbar 与 hero 合成一整块（同色，避免"浅条 + 深条"） */}
      <div className="bg-base-200 border-b border-base-300">
      {/* 顶栏：daisyUI navbar；站名用毛笔字 */}
      <div className="navbar mx-auto w-full max-w-6xl px-4 pt-8">
        <div className="navbar-start">
          <Link href="/" className="font-brush text-2xl tracking-[0.04em] sm:text-3xl">
            你的来信
          </Link>
        </div>

        <div className="navbar-end gap-1">
          <span className="mr-2 hidden text-xs opacity-60 sm:inline">{email || '朋友'}</span>

          <NotificationBell userId={userId} />

          <Link href="/search" className="btn btn-ghost btn-circle btn-sm" aria-label="搜索">
            <IconSearch className="h-[18px] w-[18px]" />
          </Link>

          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirmLogout(true)}>
            退出登录
          </button>
        </div>
      </div>

      {/* hero：daisyUI hero + hero-content（居中主视觉） */}
      <section className="hero">
        <div className="hero-content px-4 py-16 text-center sm:py-24">
          <motion.div style={{ y: heroY, opacity: heroOpacity }} className="max-w-2xl">
            <h1
              key={writeKey}
              className="dsh-hero-title font-brush text-[56px] leading-[1.1] tracking-[0.04em] sm:text-[80px]"
            >
              {[...'你的来信'].map((ch, i) => (
                <span key={i}>{ch}</span>
              ))}
            </h1>

            <p className="mt-4 font-art text-2xl text-primary sm:text-3xl">Dear You</p>

            <p className="mt-8 text-sm opacity-60">
              {dateText} · {weather.city} {weather.condition} {weather.temp}° / {weather.tempMin}°
              <span className="mx-2 opacity-40">|</span>
              陪你走过 {streak.days} 天
            </p>

            <motion.a
              href="#modules"
              style={{ opacity: hintOpacity }}
              className="btn btn-outline btn-sm mt-10 rounded-full"
            >
              ↓ 往下看看
            </motion.a>
          </motion.div>
        </div>
      </section>
      </div>

      {/* 出错时给一条可重试的提示（原来是页面里插一行红字，现在用 daisyUI alert） */}
      {(authError || requestError) && (
        <div className="mx-auto w-full max-w-6xl px-4 pt-4">
          <div className="alert alert-error">
            <span>{authError || requestError}</span>
            <button type="button" className="btn btn-sm" onClick={handleRetry}>
              重试
            </button>
          </div>
        </div>
      )}

      {/* 四个模块：daisyUI card */}
      <section id="modules" className="mx-auto w-full max-w-6xl px-4 py-12 sm:py-16">
        <FriendRequestBanner requests={requests} />

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {moduleCards.map((card, i) => (
            <motion.div
              key={card.href}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.45, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }}
              className="h-full"
            >
              <TiltCard className="relative h-full">
                <Link
                  href={card.href}
                  onClick={() => markModuleSeen(card.key as Parameters<typeof markModuleSeen>[0])}
                  /* 套上这张卡所属模块的调色板：primary / accent 于是变成那个模块的颜色 */
                  style={pageAccentVars(card.key as Parameters<typeof pageAccentVars>[0])}
                  className="card card-border group h-full overflow-hidden bg-primary/5 transition-all duration-200 [--radius-box:1rem] hover:-translate-y-0.5 hover:shadow-xl"
                >
                  <div className="card-body flex-row items-center gap-5 py-6">
                    <span
                      className={cn(
                        'flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-box transition-transform duration-200 group-hover:scale-105',
                        card.tint,
                        card.ink,
                      )}
                    >
                      <card.Icon className="h-[26px] w-[26px]" strokeWidth={1.6} />
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <h2 className="font-serif-cn text-[18px] leading-none">{card.title}</h2>
                        {badges?.[card.key]?.count ? (
                          <span className="badge badge-primary badge-sm">
                            {badges[card.key]!.count! > 99 ? '99+' : badges[card.key]!.count}
                          </span>
                        ) : badges?.[card.key]?.dot ? (
                          <span className="badge badge-primary badge-xs" />
                        ) : null}
                      </div>
                      <p className="mt-2 truncate text-[13px] opacity-60">{card.desc}</p>
                    </div>

                    <ChevronRight
                      className="h-5 w-5 flex-shrink-0 opacity-40 transition-transform duration-200 group-hover:translate-x-1 group-hover:opacity-80"
                      strokeWidth={1.8}
                    />
                  </div>
                </Link>
              </TiltCard>
            </motion.div>
          ))}
        </div>
      </section>

      <div className="mx-auto w-full max-w-6xl px-4">
        <div className="divider" />
      </div>

      {/* 引言 + 信箱 + 雪中分别 */}
      <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:py-16">
        <div className="grid items-center gap-12 sm:grid-cols-2 sm:gap-16">
          <div className="sm:mr-8 sm:justify-self-end">
            {quote && (
              <motion.blockquote
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: false, margin: '-80px' }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className="border-l-4 border-primary/40 pl-8 py-1"
              >
                <p className="font-serif-cn text-2xl leading-[1.8] sm:text-[28px]">「{quote}」</p>
                <footer className="mt-4 text-[13px] tracking-[0.06em] opacity-65">
                  来自陌生人的问候 · <span className="text-primary">睡觉的猪</span>
                </footer>
              </motion.blockquote>
            )}

            {/* 信箱：中心落在**引文的正下方**（引文有 pl-8 缩进，所以这里也加 pl-8
                再用 flex 居中，中心才和引文对齐） */}
            <div className="mt-6 flex justify-center pl-2">
              <div className="relative w-[170px]">
                <FallingBits className="-inset-x-8 -top-4 bottom-6" />
                <MailboxArt onOpen={() => setMailboxOpen(true)} />
              </div>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false, margin: '-80px' }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-[320px] sm:ml-8 sm:justify-self-start"
          >
            <FallingBits className="-inset-x-6 -top-6 bottom-2" />
            <WinterScene className="w-full" />
          </motion.div>
        </div>
      </section>

      {/* 页脚：daisyUI footer */}
      <footer className="mx-auto mt-auto flex w-full max-w-6xl flex-wrap items-end gap-x-6 gap-y-3 px-4 pb-8 pt-6 text-xs opacity-75">
        <nav className="flex flex-wrap gap-x-6 gap-y-2 border-t border-base-300 pt-4">
          {[
            { slug: 'community', label: '社区公约' },
            { slug: 'reporting', label: '举报与申诉' },
            { slug: 'privacy', label: '隐私政策' },
            { slug: 'terms', label: '用户协议' },
            { slug: 'about', label: '关于' },
          ].map((item) => (
            <Link key={item.slug} href={`/p/${item.slug}`} className="link link-hover">
              {item.label}
            </Link>
          ))}
        </nav>
        <Link href="/p" className="link link-hover ml-auto border-t border-base-300 pt-4">
          全部条款 →
        </Link>
      </footer>

      {/* 冬日信箱：读信 / 写信 */}
      <MailboxDialog mailbox={mailbox} open={mailboxOpen} onClose={() => setMailboxOpen(false)} />

      {/* 退出登录二次确认 */}
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
