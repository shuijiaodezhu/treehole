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
  const [quote, setQuote] = useState<Post | null>(null)
  const [me, setMe] = useState<Me | null>(null)
  const [ready, setReady] = useState(false)
  const [clock, setClock] = useState('')
  const [email, setEmail] = useState('')

  useEffect(() => {
    const t = window.setTimeout(() => {
      const now = new Date()
      setClock(
        String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0'),
      )

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

      const profile = peek<Me>('me-profile')
      if (profile) setMe(profile)

      const cached = peek<Post[]>('world-posts-hall', 24 * 60 * 60 * 1000)
      if (Array.isArray(cached) && cached.length) {
        setPosts(cached.slice(0, 6))
        // 引用：跳过带图的 ✓ 没有就不显示
        const textOnly = cached.filter(
          (p) => !(Array.isArray(p.image_urls) && p.image_urls.length > 0) && (p.content || '').trim().length > 12,
        )
        if (textOnly.length) setQuote(textOnly[0])
      }
      setReady(true)
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
            <button className={`${"v4-railItem"} ${"v4-railOn"}`} title="大厅">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
              <span className={"v4-railLabel"}>大厅</span>
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
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3v4.5M12 16.5V21M4.5 12H9M15 12h4.5"/><path d="M6.9 6.9l3 3M14.1 14.1l3 3M17.1 6.9l-3 3M9.9 14.1l-3 3"/></svg>
              <span className={"v4-railLabel"}>聚会</span>
              <span className={"v4-badge"}>3</span>
            </button>
            <button className={"v4-railItem"} title="信箱">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="5.5" width="18" height="13" rx="2.4"/><path d="m3.8 7.2 8.2 5.6 8.2-5.6"/></svg>
              <span className={"v4-railLabel"}>信箱</span>
              <span className={"v4-badge"}>12</span>
            </button>
            <button className={"v4-railItem"} title="收藏">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20s-7.4-4.5-7.4-9.3A4 4 0 0 1 12 8a4 4 0 0 1 7.4 2.7C19.4 15.5 12 20 12 20Z"/></svg>
              <span className={"v4-railLabel"}>收藏</span>
            </button>
            <div className={"v4-railSpacer"} />
            <button className={"v4-railItem"} title="设置">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 3v2.4M12 18.6V21M4.3 7.6l2.1 1.2M17.6 15.2l2.1 1.2M4.3 16.4l2.1-1.2M17.6 8.8l2.1-1.2"/></svg>
            </button>
          </nav>

          {/* 左栏：分区 */}
          <aside className={`${"v4-glass"} ${"v4-side"}`}>
            <div className={"v4-lbl"}>大厅的分区</div>
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
                大厅 · 写给睡不着的人
                <span className={"v4-heroWeather"}>
                  杭州 {clock || '--:--'} · 18° 小雨
                </span>
              </div>
              <h1>外面在下小雨。</h1>
              <p className={"v4-heroSub"}>你那边呢？</p>

              {quote && (
                <div className={"v4-quote"}>
                  <p className={"v4-quoteP"}>{(quote.content || '').trim()}</p>
                  <div className={"v4-quoteM"}>{rel(quote.created_at)}</div>
                </div>
              )}

              <div className={"v4-heroRow"}>
                <Link href="/world" className={"v4-btn"}>
                  进大厅 →
                </Link>
                <span className={"v4-cnt"}>{ready && posts.length ? '实时更新' : '等你开口'}</span>
              </div>
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
                  <div className={"v4-acts"}>
                    <span><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20s-7.4-4.5-7.4-9.3A4 4 0 0 1 12 8a4 4 0 0 1 7.4 2.7C19.4 15.5 12 20 12 20Z"/></svg></span>
                    <span>◌</span>
                    <span>⋯</span>
                  </div>
                </article>
              ))}
            </div>
          </section>

          {/* 右栏 */}
          <aside className={"v4-rail"}>

            <div className={`${"v4-glass"} ${"v4-card"}`}>
              <div className={"v4-k"}>我在这里</div>
              <div className={"v4-nums"}>
                <div className={"v4-num"}>
                  <b>42</b>
                  <span>天，你在这里</span>
                </div>
                <div className={"v4-num"}>
                  <b>18</b>
                  <span>条回复，给过你</span>
                </div>
                <div className={"v4-num"}>
                  <b>7</b>
                  <span>句话，说出口了</span>
                </div>
              </div>
            </div>

            <div className={`${"v4-glass"} ${"v4-card"}`}>
              <div className={"v4-k"}>今天在听</div>
              <div className={"v4-song"}>
                <span className={"v4-songN"}>♪</span> 《我不配》
                <span className={"v4-songNote"}>不用配得上谁，才被允许留下。</span>
              </div>
            </div>

            <div className={`${"v4-glass"} ${"v4-foot"}`}>
              <div className={"v4-input"}>说点什么…</div>
              <div className={"v4-send"}>↗</div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
