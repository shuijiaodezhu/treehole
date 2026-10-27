'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { peek, save } from '../../components/local-store'
import songs from '../../content/songs.json'
import moods from '../../content/song-moods.json'

/**
 * /v2 —— 新首页（实验版）
 *
 * 目的：**先长出一个新页面**，首页一个字节都不动 ✓
 *   · 只用手机版（大屏显示提示，等第二版再做电脑版）
 *   · 数据全部只读本地缓存（boot-sync 已经写好）→ 不额外打请求 ✓
 *   · 任何一块拿不到数据就**不显示**✓（不给空框 ✗ 不卡 bug）
 *
 * 配色（和 v8 那版设计一致）：
 *   底 #fdf7f0 · 卡 #ffffff · 墨 #2b211c · 线 #f0e6da · 朱红 #d95b3f · 琥珀 #e8a55a
 */

const C = {
  bg: '#fdf7f0',
  card: '#ffffff',
  ink: '#2b211c',
  ink2: '#6b5a4e',
  ink3: '#a1907f',
  line: '#f0e6da',
  wax: '#d95b3f',
  amber: '#e8a55a',
  deep: '#2b211c',
}

type Post = {
  id: string
  author_id?: string | null
  content?: string | null
  created_at?: string | null
  image_urls?: string[] | null
}

type Me = { id: string; nickname?: string | null; username?: string | null }

/** 本地缓存的第一次访问时间（用来算"陪伴第几天"） */
const FIRST_KEY = 'treehole:first-visit'

const MOODS = moods as Record<string, string>
/** 演示数据（访问 ?demo=1 时才用；真实用户永远看不到 ✓） */
const DEMO_QUOTE: Post = {
  id: 'demo-quote',
  content: '写到这里突然不想写了。但想到会有人看到，就还是发出去了。',
  created_at: new Date(Date.now() - 23 * 60000).toISOString(),
}
const DEMO_FEED: Post[] = [
  {
    id: 'demo-1',
    content: '写到这里突然不想写了。但想到会有人看到，就还是发出去了。',
    created_at: new Date(Date.now() - 23 * 60000).toISOString(),
  },
  {
    id: 'demo-2',
    content: '楼下那棵树今天开花了，没人在意，我替它记一下。',
    created_at: new Date(Date.now() - 2 * 3600000).toISOString(),
  },
  {
    id: 'demo-3',
    content: '今天也有好好活着吗？不用回答，看到就行。',
    created_at: new Date(Date.now() - 26 * 3600000).toISOString(),
  },
]


function relTime(iso?: string | null): string {
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

export default function V2Page() {
  const [days, setDays] = useState(0)
  const [myPosts, setMyPosts] = useState(0)
  const [quote, setQuote] = useState<Post | null>(null)
  const [feed, setFeed] = useState<Post[]>([])
  const [me, setMe] = useState<Me | null>(null)
  const [ready, setReady] = useState(false)
  const [demo, setDemo] = useState(false)

  // 每日一首：索引在 mount 时算一次（render 里不能调 Date.now ✗）
  const [songIdx, setSongIdx] = useState(0)
  const list = songs as string[]
  const song = list[songIdx % list.length]
  const mood = MOODS[song] || ''

  useEffect(() => {
    const t = window.setTimeout(() => {
      // 每日一首：按"当年第几天"取模
      const now = new Date()
      const idx = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000)
      setSongIdx(idx)

      // ⓪ 演示模式：?demo=1（只影响显示，不写任何东西 ✓）
      const isDemo = new URLSearchParams(window.location.search).get('demo') === '1'
      setDemo(isDemo)
      if (isDemo) {
        setDays(42)
        setMyPosts(7)
        setQuote(DEMO_QUOTE)
        setFeed(DEMO_FEED)
        setReady(true)
        return
      }

      // ① 陪伴天数：第一次访问存下来，之后每天 +1
      let first = peek<number>(FIRST_KEY, 365 * 24 * 60 * 60 * 1000)
      if (!first) {
        first = Date.now()
        save(FIRST_KEY, first)
      }
      setDays(Math.max(1, Math.floor((Date.now() - first) / 86400000) + 1))

      // ② 我的资料 + 帖子（都来自 boot-sync 的本地缓存 ✓ 不发请求）
      const profile = peek<Me>('me-profile')
      if (profile) setMe(profile)

      const posts = peek<Post[]>('world-posts-hall', 24 * 60 * 60 * 1000)
      if (Array.isArray(posts) && posts.length) {
        const mine = profile ? posts.filter((p) => p.author_id === profile.id) : []
        setMyPosts(mine.length)

        // ③ 大厅引用：跳过带图的（会撑成破图 ✗）
        const textOnly = posts.filter(
          (p) => !(Array.isArray(p.image_urls) && p.image_urls.length > 0) && (p.content || '').trim().length > 12,
        )
        if (textOnly.length) setQuote(textOnly[0])

        // ④ 帖子流：最新的 3 条（带图的也显示，但用文字代替图）
        setFeed(posts.slice(0, 3))
      }
      setReady(true)
    }, 0)
    return () => window.clearTimeout(t)
  }, [])

  return (
    <div style={{ backgroundColor: C.bg, minHeight: '100vh', color: C.ink }}>
      {/* 三团暖光（很淡，不抢字）*/}
      <div
        aria-hidden
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 0,
          pointerEvents: 'none',
          background:
            'radial-gradient(300px 240px at 12% 0%, rgba(232,165,90,.14), transparent 70%),' +
            'radial-gradient(280px 230px at 95% 8%, rgba(217,91,63,.08), transparent 72%),' +
            'radial-gradient(360px 300px at 60% 52%, rgba(240,220,190,.28), transparent 74%)',
        }}
      />

      <div style={{ position: 'relative', zIndex: 1 }} className="mx-auto w-full max-w-[400px] px-6 pb-24 pt-5">
        {/* 顶部 */}
        <header className="flex items-start justify-between pb-5">
          <div>
            <div className="font-serif-cn text-[17px] font-semibold leading-none" style={{ color: C.ink }}>
              你的来信
            </div>
            <div className="mt-1 font-mono text-[8px] uppercase tracking-[0.14em]" style={{ color: C.ink3 }}>
              Dear You
            </div>
          </div>
          <nav className="flex items-end gap-5 text-[13px] tracking-[0.02em]">
            <span
              className="border-b-2 pb-0.5 font-semibold"
              style={{ color: C.wax, borderColor: C.wax }}
            >
              大厅
            </span>
            <Link href="/friends" className="pb-[3px]" style={{ color: C.ink3 }}>
              小屋
            </Link>
            <Link href="/me" className="pb-[3px]" style={{ color: C.ink3 }}>
              我的
            </Link>
          </nav>
        </header>

        {/* 大厅块 */}
        <section
          className="relative overflow-hidden rounded-[26px] px-5 pb-6 pt-5"
          style={{ backgroundColor: C.deep, boxShadow: '0 10px 28px rgba(43,33,28,.18)' }}
        >
          <div
            aria-hidden
            className="absolute bottom-3 right-3 top-3 w-[7px] rounded"
            style={{ background: `linear-gradient(180deg, ${C.amber}, #d98f4a)` }}
          />

          <div className="font-mono text-[8px] uppercase tracking-[0.14em]" style={{ color: 'rgba(253,247,240,.5)' }}>
            <WeatherLine />
          </div>

          <h1 className="mt-3 max-w-[90%] font-serif-cn text-[22px] font-semibold leading-[1.35]" style={{ color: '#fdf7f0' }}>
            <WeatherTitle />
          </h1>

          {/* 引用：只放纯文字帖 ✓ 没有就不显示 ✓ */}
          {quote && (
            <div className="mt-4 border-l-[1.5px] pl-3" style={{ borderColor: 'rgba(232,165,90,.55)' }}>
              <p className="font-serif-cn text-[11.5px] leading-[1.75]" style={{ color: 'rgba(253,247,240,.78)' }}>
                {(quote.content || '').trim()}
              </p>
              <div className="mt-2 flex gap-3 font-mono text-[8px]" style={{ color: 'rgba(253,247,240,.35)' }}>
                <span>{relTime(quote.created_at)}</span>
              </div>
            </div>
          )}

          <div className="mt-5 flex items-center justify-between">
            <Link
              href="/world"
              className="rounded-full px-4 py-2 font-serif-cn text-[11px] font-semibold"
              style={{ backgroundColor: '#fdf7f0', color: C.deep }}
            >
              进大厅 →
            </Link>
            <span className="font-mono text-[8px] tracking-[0.08em]" style={{ color: 'rgba(253,247,240,.35)' }}>
              {ready && feed.length ? '实时更新' : '等你开口'}
            </span>
          </div>
        </section>

        {/* 三个数字（大字居中）*/}
        <section className="grid grid-cols-2 gap-3 px-1 pb-1 pt-6 text-center">
          <Stat n={days} label={`陪伴你的第 ${days} 天`} />
          <Stat n={myPosts} label={`写下过 ${myPosts} 句话`} />
        </section>

        {/* 今天在听 */}
        <section className="flex flex-col items-center pb-6 pt-5">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px]" style={{ color: C.wax, opacity: 0.8 }}>
              ♪
            </span>
            <span className="font-sans text-[10px] font-medium" style={{ color: C.ink2 }}>
              今天有人在听《{song}》
            </span>
          </div>
          {mood && (
            <p className="mt-0.5 text-center font-sans text-[9px]" style={{ color: C.ink3 }}>
              {mood}
            </p>
          )}
        </section>

        {/* 两张入口卡 */}
        <div className="flex flex-col gap-3">
          <Card icon="✧" title="聚会" desc="活动、小工具、一起听歌" badge="3" href="/play" />
          <Card icon="☰" title="分类" desc="游戏 / 音乐 / 吃喝 / 压抑 / 旅游…" href="/world/categories" />
        </div>

        {/* 帖子流 */}
        {ready && feed.length > 0 && (
          <section className="mt-4 flex flex-col gap-3">
            {feed.map((p) => (
              <article
                key={p.id}
                className="rounded-[20px] px-4 py-3.5"
                style={{ backgroundColor: C.card, boxShadow: '0 2px 12px rgba(120,80,50,.08)' }}
              >
                <div className="flex items-center gap-2">
                  <div
                    className="grid h-7 w-7 place-items-center rounded-[10px] font-serif-cn text-[10px] font-semibold"
                    style={{ background: 'linear-gradient(135deg,#f6d9cb,#edc3ae)', color: '#8a5340' }}
                  >
                    {(me?.nickname || me?.username || '我').slice(0, 1)}
                  </div>
                  <span className="text-[11px] font-medium" style={{ color: C.ink }}>
                    {p.author_id === me?.id ? me?.nickname || me?.username || '' : '有人'}
                  </span>
                  <span className="ml-auto font-mono text-[8px]" style={{ color: C.ink3 }}>
                    {relTime(p.created_at)}
                  </span>
                </div>
                <p className="mt-2 text-[11.5px] leading-[1.65]" style={{ color: C.ink2 }}>
                  {(p.content || '').trim() || '（这条只有图片）'}
                </p>
              </article>
            ))}
          </section>
        )}

        <p className="mt-6 text-center font-serif-cn text-[9.5px]" style={{ color: C.ink3 }}>
          {demo ? '演示模式（?demo=1）· 数据是假的，只给你看版面' : '这是新版首页的试验页 /v2，正式首页还没变。'}
        </p>
      </div>
    </div>
  )
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div>
      <div className="font-serif-cn text-[26px] font-semibold leading-none" style={{ color: C.ink }}>
        {n}
      </div>
      <div className="mx-auto my-2 h-px w-[62%]" style={{ backgroundColor: C.line }} />
      <div className="text-[9px]" style={{ color: C.ink3 }}>
        {label}
      </div>
    </div>
  )
}

function Card({ icon, title, desc, badge, href }: { icon: string; title: string; desc: string; badge?: string; href: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3.5 rounded-[22px] px-4 py-4 transition active:scale-[0.995]"
      style={{ backgroundColor: C.card, boxShadow: '0 2px 12px rgba(120,80,50,.08)' }}
    >
      <div
        className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-[14px] text-[15px]"
        style={{ backgroundColor: C.bg, color: C.wax, border: `1px solid ${C.line}` }}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[12px] font-semibold" style={{ color: C.ink }}>
          {title}
        </div>
        <div className="mt-0.5 truncate text-[9.5px]" style={{ color: C.ink3 }}>
          {desc}
        </div>
      </div>
      {badge && (
        <span className="flex-shrink-0 rounded-full px-2.5 py-1 text-[9px] font-semibold text-white" style={{ backgroundColor: C.wax }}>
          {badge}
        </span>
      )}
    </Link>
  )
}

/** 天气行（先用时间+占位；接入 open-meteo 后替换）*/
function WeatherLine() {
  const h = new Date().getHours()
  const t = `${String(h).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`
  return <span>此刻 · {t}</span>
}

/** 天气标题（先按时段；接入天气后按天气）*/
function WeatherTitle() {
  const h = new Date().getHours()
  if (h >= 23 || h < 5) return <>还没睡？</>
  if (h >= 5 && h < 9) return <>早。今天也慢慢来。</>
  if (h >= 9 && h < 12) return <>上午好。</>
  if (h >= 12 && h < 17) return <>下午了，撑得住吗？</>
  if (h >= 17 && h < 20) return <>天快黑了。</>
  return <>今晚有人在这里。</>
}
