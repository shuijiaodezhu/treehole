'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { fetchWorldFeed } from './world-feed'
import SONGS from '../content/songs.json'
import { useEffect, useState } from 'react'
import { peek } from './local-store'
import { createClient } from '../app/lib/supabase'
import { useWeather, type WeatherState } from './weather'
import {
  QUOTE_SLOT_MS,
  calcLoginStreak,
  getQuoteByTime,
  msUntilNextQuoteSlot,
} from './utils'
import { markRedirectingToLogin } from './login-handoff'
import { markModuleSeen, useModuleBadges, type ModuleBadge } from './module-badges'

/**
 * 电脑版首页（液态玻璃 + 深色窄栏）—— 正式版，宽屏打开 `/` 就是它
 *
 * 分工：
 *   · `/`      —— ≥1101px 走这里；≤1100px 仍然是原来的首页（HomeCurrent / HomeClassic）
 *   · 老地址 `/v4` 现在只是重定向回 `/`
 *
 * 数据（2026-10 从原来的首页搬过来，不重写查询）：
 *   · 天气 / 定位 —— components/weather 的 useWeather（资料里的城市 → GPS → IP → 徐州兜底）
 *   · 陪伴天数 —— calcLoginStreak(created_at, last_sign_in_at)，注册那天算第 1 天
 *   · 今日一句话 —— getQuoteByTime()，2 小时一个时间片，全站同刻同句
 *   · 帖子流 / 分区 —— 原来的 fetchWorldFeed / categories / posts / comments
 *   · 信箱 —— 原来的 useMailbox（入口在 /mailbox，见 components/mailbox 的 MailboxPanel）
 *
 * 设计要点（都是前几轮踩出来的）：
 *   · 玻璃 = 模糊 + 边缘光 + 斜向镜面（三层，缺一层就假）
 *   · 背景必须有细节（大字 / 网格），否则看不出玻璃 ✗
 *   · 深色窄栏用**烟熏玻璃**（不是实色 ✗ 否则和右边不是一种材料）
 *   · 大字 41px/300、数字 34px/300（大字号配细字重才高级）
 */

type Post = {
  category_id?: string | null
  id: string
  author_id?: string | null
  content?: string | null
  created_at?: string | null
  image_urls?: string[] | null
}
type Me = { id: string; nickname?: string | null; username?: string | null }

type Cat = { id: string; name: string; n: number }

const SECTIONS_FALLBACK: Cat[] = [
  { id: 'all', name: '全部', n: 0 },
]


function rel(iso?: string | null): string {
  if (!iso) return ''
  const ms = Date.now() - Date.parse(iso)
  if (!Number.isFinite(ms) || ms < 0) return ''
  const m = Math.floor(ms / 60000)
  if (m < 1) return '刚刚'
  if (m < 60) return m + ' 分钟前'
  const h = Math.floor(m / 60)
  if (h < 24) return h + ' 小时前'
  return Math.floor(h / 24) + ' 天前'
}

/** 按作者 id 生成头像底色：同一个人永远同一个颜色，不同人不同色 */
function avatarBg(id?: string | null): string {
  const s = id || 'anon'
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360
  return 'linear-gradient(135deg, hsl(' + h + ' 46% 84%), hsl(' + ((h + 24) % 360) + ' 42% 74%))'
}

/** 今天在听：按"今年第几天"取模，同一天所有人看到同一首，隔天自动换 */
function pickTodaySong(): string {
  const list = SONGS as string[]
  if (!list.length) return '我不配'
  const t = new Date()
  const day = Math.floor(
    (t.getTime() - new Date(t.getFullYear(), 0, 0).getTime()) / 86400000,
  )
  return list[day % list.length]
}

/**
 * 天气 → hero 上那张手写图（/wg-*.png）
 *
 * 和原来 v4 的分档一致，但只认**真实天气**：
 *   · 定位/请求还没回来 → unknown（就是那张"先用占位数据陪你一会儿"）
 *   · 冷一档只有 cool 那一张（clearcold.png 不存在，原来写 clear-cold 会 404）
 */
function heroKeyOf(w: WeatherState): string {
  if (!w.isLive) return 'unknown'
  if (w.icon === 'storm') return 'storm'
  if (w.icon === 'snow') return 'snow'
  if (w.icon === 'fog') return 'fog'
  if (w.icon === 'rain' || w.icon === 'drizzle') return 'rain'
  const head = w.icon === 'sun' ? 'clear' : 'cloud'
  const t = w.temp
  return t >= 30 ? head + '-hot' : t <= 15 ? head + '-cool' : head + '-mild'
}

/** 窄条上的角标：有数字给数字，只有"有新东西"给一个点（和首页卡片同一套规则）*/
function RailBadge({ badge }: { badge?: ModuleBadge }) {
  if (!badge) return null
  if (badge.count && badge.count > 0) {
    return <span className={"v4-badge"}>{badge.count > 99 ? '99+' : badge.count}</span>
  }
  if (badge.dot) return <span className={"v4-badge v4-badgeDot"} aria-hidden="true" />
  return null
}

/** 注册那天（本地时区）：陪伴卡下面那句用它，和天数对得上 */
function sinceTextOf(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日'
}

export function HomeDesktop() {
  const router = useRouter()
  const [posts, setPosts] = useState<Post[]>([])
  const [me, setMe] = useState<Me | null>(null)
  const [email, setEmail] = useState('')
  const [userId, setUserId] = useState<string | null>(null)
  const [days, setDays] = useState(1)
  const [sinceText, setSinceText] = useState('')
  const [todaySong, setTodaySong] = useState('我不配')
  const [quote, setQuote] = useState('')
  const [cats, setCats] = useState<Cat[]>(SECTIONS_FALLBACK)
  const [activeCat, setActiveCat] = useState('all')
  const [myPosts, setMyPosts] = useState(0)
  const [repliesToMe, setRepliesToMe] = useState(0)

  /* 定位 + 天气：直接复用首页那套 useWeather（资料城市 → GPS → IP → 兜底）*/
  const weather = useWeather()

  /* 角标：小屋/院子/聚会，接首页那套真实未读（数字 = 待处理，点 = 有新东西）*/
  const badges = useModuleBadges(userId)

  useEffect(() => {
    window.requestAnimationFrame(() => setTodaySong(pickTodaySong()))

    const sb = createClient()
    /* ── 真正拉一次帖子流（v4 之前只 peek 本地缓存，缓存空了就一片空白）── */
    ;(async () => {
      try {
        const { data: u } = await sb.auth.getUser()
        const meId = u.user?.id ?? null
        const feed = await fetchWorldFeed(null, meId)
        if (feed && feed.posts.length) {
          const mapped = feed.posts.map((p) => ({
            id: p.id,
            author_id: p.author_id,
            content: p.content,
            created_at: p.created_at,
            image_urls: p.image_urls,
            category_id: p.category_id,
          }))
          window.requestAnimationFrame(() => setPosts(mapped))
        }
      } catch {
        /* 失败就保留缓存 */
      }
    })()
    /* ── 真实数据：分区 + 我的帖子数 + 收到的回复数 ── */
    ;(async () => {
      try {
        const { data: cs } = await sb
          .from('categories')
          .select('id, name, parent_id, sort_order')
          .eq('status', 'approved')
          .order('sort_order', { ascending: true })
        const list = (cs ?? []) as { id: string; name: string; parent_id: string | null }[]
        /* 只取一级分区，并把每个分区下的帖子数数出来 */
        const top = list.filter((c) => !c.parent_id)
        const { data: ps } = await sb.from('posts').select('category_id').limit(2000)
        const counts = new Map<string, number>()
        for (const p of (ps ?? []) as { category_id: string | null }[]) {
          if (!p.category_id) continue
          counts.set(p.category_id, (counts.get(p.category_id) ?? 0) + 1)
        }
        const total = (ps ?? []).length
        const next: Cat[] = [
          { id: 'all', name: '全部', n: total },
          ...top.map((c) => ({ id: c.id, name: c.name, n: counts.get(c.id) ?? 0 })),
        ]
        window.requestAnimationFrame(() => setCats(next))
      } catch {
        /* 读取失败就保留兜底 */
      }
    })()
    ;(async () => {
      try {
        const { data: u } = await sb.auth.getUser()
        const uid = u.user?.id
        if (!uid) return
        const { count: mp } = await sb
          .from('posts')
          .select('id', { count: 'exact', head: true })
          .eq('author_id', uid)
        window.requestAnimationFrame(() => setMyPosts(mp ?? 0))
        const { data: mine } = await sb.from('posts').select('id').eq('author_id', uid).limit(500)
        const ids = (mine ?? []).map((r: { id: string }) => r.id)
        if (ids.length) {
          const { count: rc } = await sb
            .from('comments')
            .select('id', { count: 'exact', head: true })
            .in('post_id', ids)
          window.requestAnimationFrame(() => setRepliesToMe(rc ?? 0))
        }
      } catch {
        /* 忽略 */
      }
    })()

    const t = window.setTimeout(() => {
      /*
       * 账号：邮箱 + 陪伴天数
       * 天数用原来的算法（calcLoginStreak：注册那天算第 1 天，按 UTC 零点相减，
       * 不会因为时区少算一天）—— 之前 v4 用 localStorage 的"第一次访问"，
       * 新设备/清缓存就从 1 开始，所以会算出 9 天这种数。
       */
      void createClient()
        .auth.getUser()
        .then(({ data }) => {
          const u = data?.user
          if (!u) return
          setEmail(u.email ?? '')
          setUserId(u.id)
          setDays(calcLoginStreak(u.created_at, u.last_sign_in_at).days)
          setSinceText(sinceTextOf(u.created_at))
        })
        .catch(() => {
          /* 没登录：保持"未登录"，天数留 1 */
        })

      const profile = peek<Me>('me-profile')
      if (profile) setMe(profile)

      const cached = peek<Post[]>('world-posts-hall', 24 * 60 * 60 * 1000)
      if (Array.isArray(cached) && cached.length) {
        setPosts(cached.slice(0, 6))
      }
    }, 0)
    return () => window.clearTimeout(t)
  }, [])

  /* ── 今日一句话：和首页同一份数据，2 小时一个时间片，到点自动换 ── */
  useEffect(() => {
    let intervalId: number | null = null

    // 用 rAF 推迟到首帧之后：既不撞预渲染限制，也不在 effect 里同步 setState
    const firstFrame = window.requestAnimationFrame(() => setQuote(getQuoteByTime()))

    const timeoutId = window.setTimeout(() => {
      setQuote(getQuoteByTime())
      intervalId = window.setInterval(() => setQuote(getQuoteByTime()), QUOTE_SLOT_MS)
    }, msUntilNextQuoteSlot())

    const onVisible = () => {
      if (document.visibilityState === 'visible') setQuote(getQuoteByTime())
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      window.cancelAnimationFrame(firstFrame)
      window.clearTimeout(timeoutId)
      if (intervalId !== null) window.clearInterval(intervalId)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  /* ── 退出登录：真的 signOut（原来只是跳到 /login，人其实还登着）── */
  async function handleLogout() {
    try {
      await createClient().auth.signOut()
    } catch {
      /* 忽略：本地会话已经清掉也算退出 */
    }
    markRedirectingToLogin()
    router.replace('/login')
  }

  /* 分区筛选：选了具体分区就只显示该分区的帖子 */
  const shown = activeCat === 'all' ? posts : posts.filter((p) => p.category_id === activeCat)

  /* 天气一句话：城市 / 天气 / 温度，缺哪个就不说哪个（宁可不说，也不说错的城市）*/
  const weatherText = weather.isLive
    ? [weather.city, weather.condition, weather.temp + '°'].filter(Boolean).join(' · ')
    : weather.city

  return (
    <div className={"v4-page"}>
      {/* 背景：冬日圣诞树视频 + 暖色压暗 */}
      <div className={"v4-bg"} aria-hidden>
        <video
          className={"v4-video"}
          src="/bg-winter.mp4"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
        />
        <div className={"v4-scrim"} />
        <i className={"v4-glow v4-glow1"} />
        <i className={"v4-glow v4-glow2"} />
        <i className={"v4-glow v4-glow3"} />
      </div>

      {/* 窄屏提示 */}
      <div className={"v4-mobileNote"}>
        这一版是电脑版（液态玻璃要宽屏才成立）
        <br />
        手机上请用 yourletters.cn 原来的首页
        <br />
        <Link href="/" style={{ color: '#a0563f' }}>
          回首页 →
        </Link>
      </div>

      <div className={"v4-wrap"}>
        {/* 顶部 */}
        <div className={"v4-top"}>
          <div className={"v4-brand"}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className={"v4-wordmark"} src="/wordmark-light.png" alt="你的来信" />
            <span>DEAR YOU</span>
          </div>


          <div className={"v4-spacer"} />

          <div className={"v4-account"}>
            <span className={"v4-email"}>{email || '未登录'}</span>
            <Link href="/me/notifications" className={"v4-accBtn"} title="通知" aria-label="通知">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 9a6 6 0 0 1 12 0c0 5 1.8 6 1.8 6H4.2S6 14 6 9Z" />
                <path d="M10 20a2.2 2.2 0 0 0 4 0" />
              </svg>
            </Link>
            <Link href="/search" className={"v4-accBtn"} title="搜索" aria-label="搜索">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                <circle cx="11" cy="11" r="6.6" />
                <path d="m19.6 19.6-3.4-3.4" />
              </svg>
            </Link>
            {email ? (
              <button className={"v4-logout"} type="button" onClick={() => void handleLogout()}>
                退出登录
              </button>
            ) : (
              <Link href="/login" className={"v4-logout"}>
                登录
              </Link>
            )}
          </div>
        </div>

        <div className={"v4-cols"}>
          {/* 深色窄栏（烟熏玻璃）*/}
          <nav className={`${"v4-darkGlass"} ${"v4-railbar"}`}>
            <div className={"v4-logo"}>你</div>
            <Link
              href="/world"
              className={`${"v4-railItem"} ${"v4-railOn"}`}
              title="院子"
              onClick={() => markModuleSeen('world')}
            >
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
              <span className={"v4-railLabel"}>院子</span>
              <RailBadge badge={badges.world} />
            </Link>
            <Link
              href="/friends"
              className={"v4-railItem"}
              title="小屋"
              onClick={() => markModuleSeen('friends')}
            >
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20h5v-6h4v6h5V9.5"/></svg>
              <span className={"v4-railLabel"}>小屋</span>
              <RailBadge badge={badges.friends} />
            </Link>
            <Link href="/me" className={"v4-railItem"} title="我的">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="8.5" r="3.4"/><path d="M4.6 20.4c0-3.6 3.3-5.9 7.4-5.9s7.4 2.3 7.4 5.9"/></svg>
              <span className={"v4-railLabel"}>我的</span>
            </Link>
            <div className={"v4-sep"} />
            <Link
              href="/play"
              className={"v4-railItem"}
              title="聚会"
              onClick={() => markModuleSeen('play')}
            >
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="2.6"/><path d="M8 3v4M16 3v4M3.5 10.2h17"/></svg>
              <span className={"v4-railLabel"}>聚会</span>
              <RailBadge badge={badges.play} />
            </Link>
            <Link href="/functions" className={"v4-railItem"} title="功能 · 日历 / 计划书 / 储物箱">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/></svg>
              <span className={"v4-railLabel"}>功能</span>
            </Link>
            <Link href="/mailbox" className={"v4-railItem"} title="信箱">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="5.5" width="18" height="13" rx="2.4"/><path d="m3.8 7.2 8.2 5.6 8.2-5.6"/></svg>
              <span className={"v4-railLabel"}>信箱</span>
            </Link>
            <div className={"v4-railSpacer"} />
            <Link href="/me/settings" className={"v4-railItem"} title="设置">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /><circle cx="9" cy="7" r="2.3" fill="currentColor" stroke="none" /><circle cx="15.5" cy="12" r="2.3" fill="currentColor" stroke="none" /><circle cx="7.5" cy="17" r="2.3" fill="currentColor" stroke="none" /></svg>
            </Link>
          </nav>

          {/* 左栏：分区 */}
          <aside className={`${"v4-glass"} ${"v4-side"}`}>
            <div className={"v4-lbl"}>院子的分区</div>
            {cats.map((sec) => (
              <button
                key={sec.id}
                type="button"
                onClick={() => setActiveCat(sec.id)}
                className={"v4-sideItem" + (sec.id === activeCat ? " v4-sideOn" : "")}
              >
                {sec.name}
                <span className={"v4-sideN"}>{sec.n}</span>
              </button>
            ))}
            <div className={"v4-lbl"}>其他</div>
            <Link href="/world" className={"v4-sideItem"} title="去院子里建一个新分区">
              ＋ 新建分区
            </Link>
          </aside>

          {/* 中间 */}
          <section className={"v4-main"}>
            <div className={`${"v4-glass"} ${"v4-hero"}`}>
              <div className={"v4-meta"}>
                <span>院子 · 写给睡不着的人</span>
                <span className={"v4-heroWeather"}>{weatherText}</span>
              </div>
              <h1 className={"v4-heroTitle"}>
                {/* 字体浏览器不认，改成图片渲染（同一份 ttf 用 PIL 画的）*/}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={'/wg-' + heroKeyOf(weather) + '.png'}
                  alt="天气问候"
                  className={"v4-heroImg"}
                />
              </h1>
              <p className={"v4-heroSub"}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/hand-sub.png" alt="你那边呢？" width={160} height={52} />
              </p>

              {/* 今日一句话：接原来的 getQuoteByTime（2 小时一个时间片）*/}
              <div className={"v4-heroQuote"}>
                {quote && (
                  <>
                    <p className={"v4-heroQuoteP"}>「{quote}」</p>
                    <p className={"v4-heroQuoteBy"}>来自陌生人的问候 · 睡觉的猪</p>
                  </>
                )}
              </div>
            </div>

            <div className={"v4-feed"}>
              {shown.map((p) => (
                <article
                  key={p.id}
                  className={p.image_urls && p.image_urls.length ? "v4-post v4-postWithImg" : "v4-post"}
                >
                  <div className={"v4-postH"}>
                    <div
                      className={"v4-av"}
                      style={{ background: avatarBg(p.author_id) }}
                    >
                      {(p.author_id === me?.id ? me?.nickname || '我' : '有').slice(0, 1)}
                    </div>
                    <span className={"v4-who"}>
                      {p.author_id === me?.id ? me?.nickname || '我' : '有人'}
                    </span>
                    <span className={"v4-when"}>{rel(p.created_at)}</span>
                  </div>
                  <p className={"v4-postP"}>{(p.content || '').trim() || '（这条只有图片）'}</p>
                  {/* 帖子图片（最多 4 张）*/}
                  {Array.isArray(p.image_urls) && p.image_urls.length > 0 && (
                    <div
                      className={"v4-postImgs"}
                      data-n={Math.min(4, p.image_urls.length)}
                    >
                      {p.image_urls.slice(0, 4).map((u: string, k: number) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={k} src={u} alt="" loading="lazy" />
                      ))}
                    </div>
                  )}
                  <div className={"v4-acts"}>
                    <span><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20s-7.4-4.5-7.4-9.3A4 4 0 0 1 12 8a4 4 0 0 1 7.4 2.7C19.4 15.5 12 20 12 20Z"/></svg></span>
                    <span>◌</span>
                    <span>⋯</span>
                  </div>
                </article>
              ))}
            </div>
            {/* 发帖入口：钉在中间栏最底部，不随内容滚（原站的写帖在院子里，链过去）*/}
            <Link href="/world" className={"v4-sayLine"} title="说一句 · 去院子里写">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/say-line.png" alt="说一句" />
              <span className={"v4-sayLineHint"}>写下来，就有人接住</span>
            </Link>
          </section>

          {/* 右栏 */}
          <aside className={"v4-rail"}>

            <div className={`${"v4-glass"} ${"v4-card"}`}>
              <div className={"v4-daysHead"}>
                <svg
                  className={"v4-flame"}
                  viewBox="0 0 24 24"
                  width="18"
                  height="18"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M12 21c3.6 0 6.2-2.3 6.2-5.6 0-3.9-3.4-5.7-4.6-9.4-.2-.7-1.1-.8-1.5-.2-1.2 1.7-1.5 3.6-1.4 5.1-1-.5-1.6-1.5-1.8-2.6-.1-.6-.9-.8-1.3-.4-1.2 1.2-1.8 2.9-1.8 4.7C5.8 18.6 8.4 21 12 21Z" />
                </svg>
                <span className={"v4-daysLabel"}>已经陪你走过</span>
              </div>
              <div className={"v4-daysNum"}>
                <b>{(days || 1).toString()}</b>
                <span>天</span>
              </div>
              <div className={"v4-daysNote"}>
                {days > 1 && sinceText ? '从 ' + sinceText + ' 那天开始' : '今天是重逢的第一天'}
              </div>
              <div className={"v4-daysSub"}>
                收到 <b>{repliesToMe}</b> 条回复 · 写下 <b>{myPosts}</b> 句话
              </div>
              <div className={"v4-todaySong"}>
                <span className={"v4-songN"}>♪</span>
                <span className={"v4-todaySongTitle"}>今天在听《{todaySong}》</span>
              </div>
              <div className={"v4-todaySongNote"}>不用配得上谁，才被允许留下。</div>
            </div>


            {/* 冬日信箱：链到 /mailbox（里面就是首页那个信箱本体）*/}
            <Link href="/mailbox" className={"v4-mailbox"} title="冬日信箱 · 写给站长">
              <span className={"v4-mailboxIcon"}>
                <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3" y="6.2" width="18" height="12.6" rx="2.4" />
                  <path d="M3.7 7.7 10.9 12.6a2 2 0 0 0 2.2 0l7.2-4.9" />
                  <circle cx="12" cy="16.6" r="1.5" fill="currentColor" stroke="none" opacity="0.9" />
                </svg>
              </span>
              <span className={"v4-mailboxText"}>
                <span className={"v4-mailboxTitle"}>冬日信箱</span>
                <span className={"v4-mailboxSub"}>写给站长</span>
              </span>
              <span className={"v4-mailboxSeal"} aria-hidden="true" />
            </Link>
          </aside>
        </div>
      </div>
    </div>
  )
}

/* 也作为默认导出，方便直接当页面用 */
export default HomeDesktop
