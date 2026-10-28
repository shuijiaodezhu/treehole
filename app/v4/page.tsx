'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { peek } from '../../components/local-store'
import { createClient } from '../lib/supabase'

/**
 * /v4 —— 电脑版首页（液态玻璃 + 深色窄栏）
 *
 * 只在宽屏（≥1100px）生效；窄屏显示一句提示（手机版另做 ✗）
 * 数据全部只读 boot-sync 写好的本地缓存 ✓ 不额外打请求
 *
 * 设计要点（都是前几轮踩出来的）：
 *   · 玻璃 = 模糊 + 边缘光 + 斜向镜面（三层，缺一层就假）
 *   · 背景必须有细节（大字 / 网格），否则看不出玻璃 ✗
 *   · 深色窄栏用**烟熏玻璃**（不是实色 ✗ 否则和右边不是一种材料）
 *   · 大字 41px/300、数字 34px/300（大字号配细字重才高级）
 */

type Post = {
  id: string
  author_id?: string | null
  content?: string | null
  created_at?: string | null
  image_urls?: string[] | null
}
type Me = { id: string; nickname?: string | null; username?: string | null }

const SECTIONS = [
  { name: '全部', n: 12 },
  { name: '游戏', n: 4 },
  { name: '音乐', n: 3 },
  { name: '吃喝', n: 2 },
  { name: '压抑', n: 2 },
  { name: '旅游', n: 1 },
  { name: '感情', n: 1 },
  { name: '抽象', n: 1 },
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

export default function V4Page() {
  const [posts, setPosts] = useState<Post[]>([])
  const [me, setMe] = useState<Me | null>(null)
  const [email, setEmail] = useState('')
  const [days, setDays] = useState(0)
  const [weatherText, setWeatherText] = useState('杭州')
  const [heroKey, setHeroKey] = useState('unknown')

  useEffect(() => {
    const t = window.setTimeout(() => {

      // 读当前登录邮箱（Supabase 客户端从本地会话拿，不发网络请求）
      try {
        void createClient()
          .auth.getUser()
          .then((res) => {
            const u = (res.data as { user?: { email?: string } } | null)?.user
            if (u?.email) setEmail(u.email)
          })
      } catch {
        /* 忽略 */
      }


      // 真实天气：open-meteo 免费接口，杭州坐标
      fetch(
        'https://api.open-meteo.com/v1/forecast?latitude=30.2741&longitude=120.1551&current=temperature_2m,weather_code&timezone=Asia%2FShanghai',
      )
        .then((r) => r.json())
        .then((j) => {
          const cur = (j as { current?: { temperature_2m?: number; weather_code?: number } }).current
          if (!cur || typeof cur.temperature_2m !== 'number') return
          const code = cur.weather_code ?? 0
          const t = Math.round(cur.temperature_2m)
          // WMO 天气代码 → 中文说法
          const word =
            code === 0 ? '晴'
              : code === 1 || code === 2 ? '多云'
              : code === 3 ? '阴'
              : code === 45 || code === 48 ? '雾'
              : code >= 51 && code <= 57 ? '毛毛雨'
              : code >= 61 && code <= 67 ? '雨'
              : code >= 71 && code <= 77 ? '雪'
              : code >= 80 && code <= 82 ? '雨'
              : code >= 85 && code <= 86 ? '雪'
              : code >= 95 ? '雷阵雨'
              : ''
          setHeroKey(
            !word
              ? 'unknown'
              : code >= 95
                ? 'storm'
                : code >= 71 && code <= 86
                  ? 'snow'
                  : (code >= 51 && code <= 67) || (code >= 80 && code <= 82)
                    ? 'rain'
                    : code === 45 || code === 48
                      ? 'fog'
                      : code === 0
                        ? t >= 30 ? 'clear-hot' : t <= 5 ? 'clear-cold' : t <= 15 ? 'clear-cool' : 'clear-mild'
                        : t >= 30 ? 'cloud-hot' : t <= 15 ? 'cloud-cool' : 'cloud-mild',
          )
          setWeatherText('杭州 · ' + (word || '天气') + ' · ' + t + '°')
        })
        .catch(() => {
          /* 失败就保持"杭州" */
        })

      // 陪伴天数：从第一次来的那天算
      try {
        const first = window.localStorage.getItem('treehole:first-visit')
        const t0 = first ? Date.parse(first) : NaN
        if (Number.isFinite(t0)) {
          const d = Math.floor((Date.now() - t0) / 86400000) + 1
          setDays(d > 0 ? d : 1)
        } else {
          window.localStorage.setItem('treehole:first-visit', new Date().toISOString())
          setDays(1)
        }
      } catch {
        /* 忽略 */
      }

      const profile = peek<Me>('me-profile')
      if (profile) setMe(profile)

      const cached = peek<Post[]>('world-posts-hall', 24 * 60 * 60 * 1000)
      if (Array.isArray(cached) && cached.length) {
        setPosts(cached.slice(0, 6))
      }
    }, 0)
    return () => window.clearTimeout(t)
  }, [])

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
            <button className={"v4-accBtn"} title="通知" aria-label="通知">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 9a6 6 0 0 1 12 0c0 5 1.8 6 1.8 6H4.2S6 14 6 9Z" />
                <path d="M10 20a2.2 2.2 0 0 0 4 0" />
              </svg>
            </button>
            <button className={"v4-accBtn"} title="搜索" aria-label="搜索">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                <circle cx="11" cy="11" r="6.6" />
                <path d="m19.6 19.6-3.4-3.4" />
              </svg>
            </button>
            <Link href="/login" className={"v4-logout"}>
              退出登录
            </Link>
          </div>
        </div>

        <div className={"v4-cols"}>
          {/* 深色窄栏（烟熏玻璃）*/}
          <nav className={`${"v4-darkGlass"} ${"v4-railbar"}`}>
            <div className={"v4-logo"}>你</div>
            <button className={`${"v4-railItem"} ${"v4-railOn"}`} title="院子">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
              <span className={"v4-railLabel"}>院子</span>
            </button>
            <Link href="/friends" className={"v4-railItem"} title="小屋">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20h5v-6h4v6h5V9.5"/></svg>
              <span className={"v4-railLabel"}>小屋</span>
            </Link>
            <Link href="/me" className={"v4-railItem"} title="我的">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="8.5" r="3.4"/><path d="M4.6 20.4c0-3.6 3.3-5.9 7.4-5.9s7.4 2.3 7.4 5.9"/></svg>
              <span className={"v4-railLabel"}>我的</span>
            </Link>
            <div className={"v4-sep"} />
            <button className={"v4-railItem"} title="聚会">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="2.6"/><path d="M8 3v4M16 3v4M3.5 10.2h17"/></svg>
              <span className={"v4-railLabel"}>聚会</span>
              <span className={"v4-badge"}>3</span>
            </button>
            <button
              className={`${"v4-railItem"} ${"v4-railSoon"}`}
              title="功能 · 即将推出的新模式"
              aria-disabled="true"
            >
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/></svg>
              <span className={"v4-railLabel"}>功能</span>
              <span className={"v4-badge v4-badgeSoon"}>即将</span>
            </button>
            <button className={"v4-railItem"} title="信箱">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="5.5" width="18" height="13" rx="2.4"/><path d="m3.8 7.2 8.2 5.6 8.2-5.6"/></svg>
              <span className={"v4-railLabel"}>信箱</span>
              <span className={"v4-badge"}>12</span>
            </button>
            <div className={"v4-railSpacer"} />
            <button className={"v4-railItem"} title="设置">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /><circle cx="9" cy="7" r="2.3" fill="currentColor" stroke="none" /><circle cx="15.5" cy="12" r="2.3" fill="currentColor" stroke="none" /><circle cx="7.5" cy="17" r="2.3" fill="currentColor" stroke="none" /></svg>
            </button>
          </nav>

          {/* 左栏：分区 */}
          <aside className={`${"v4-glass"} ${"v4-side"}`}>
            <div className={"v4-lbl"}>院子的分区</div>
            {SECTIONS.map((sec, i) => (
              <button key={sec.name} className={`${"v4-sideItem"} ${i === 0 ? "v4-sideOn" : ''}`}>
                {sec.name}
                <span className={"v4-sideN"}>{sec.n}</span>
              </button>
            ))}
            <div className={"v4-lbl"}>其他</div>
            <button className={"v4-sideItem"}>＋ 新建分区</button>
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
                  src={'/wg-' + heroKey + '.png'}
                  alt="天气问候"
                  className={"v4-heroImg"}
                />
              </h1>
              <p className={"v4-heroSub"}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/hand-sub.png" alt="你那边呢？" width={160} height={52} />
              </p>

              {/* 这里先空着 —— 等设计 */}
              <div className={"v4-heroBlank"} />

              {/* 底部也先空着 —— 等设计 */}
            </div>

            <div className={"v4-feed"}>
              {posts.map((p) => (
                <article key={p.id} className={`${"v4-glass"} ${"v4-post"}`}>
                  <div className={"v4-postH"}>
                    <div className={"v4-av"}>
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
            {/* 发帖入口：钉在中间栏最底部，不随内容滚 */}
            <button className={"v4-sayLine"} type="button" title="说一句">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/say-line.png" alt="说一句…" />
              <span className={"v4-sayLineHint"}>写下来，就有人接住</span>
            </button>
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
              <div className={"v4-daysNote"}>今天是重逢的第一天</div>
              <div className={"v4-daysSub"}>
                收到 <b>18</b> 条回复 · 写下 <b>7</b> 句话
              </div>
              <div className={"v4-todaySong"}>
                <span className={"v4-songN"}>♪</span>
                <span className={"v4-todaySongTitle"}>今天在听《我不配》</span>
              </div>
              <div className={"v4-todaySongNote"}>不用配得上谁，才被允许留下。</div>
            </div>


            {/* 冬日信箱 */}
            <button className={"v4-mailbox"} type="button" title="冬日信箱 · 写给站长">
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
            </button>
          </aside>
        </div>
      </div>
    </div>
  )
}
