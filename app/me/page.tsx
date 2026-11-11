'use client'
/* eslint-disable @next/next/no-img-element -- 头像/背景图用原生 img 即可，尺寸固定 */

import { useEffect, useState } from 'react'
import '../v4-skin.css'
import { VersionInfo } from '../../components/version-info'
import { BackLink } from '../../components/back-link'
import { peek, save } from '../../components/local-store'
import { createClient } from '../lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { pageAccentVars } from '../../components/theme'
import { SkeletonCard } from '../../components/skeleton'
import { StatusPicker } from '../../components/status'
import { ShowcaseSettingsSection } from '../../components/profile-showcase'

const ADMIN_UUID = 'b59a31c7-60f8-4b57-924a-b408cbfd910c'

function IconArrow({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}

function IconDoc({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  )
}

function IconStar({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  )
}

function IconGear({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

function IconBell({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </svg>
  )
}

function IconPin({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  )
}

function IconShield({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  )
}

type Profile = {
  id: string
  username: string
  nickname: string | null
  avatar_url: string | null
  bio: string | null
  signature: string | null
  location: string | null
  birthday: string | null
  created_at: string
}

export default function MePage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [email, setEmail] = useState('')
  const [postCount, setPostCount] = useState(0)
  /* 收到的赞：我的帖子被点赞的总数（原来是写死的一个「—」）*/
  const [likeCount, setLikeCount] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)

  /*
   * 先读本机（/me 也像 App）
   *
   * 资料和发帖数都是慢变的，却每次进页面都要等两次网络请求
   * → 本机存过就直接画出来，再去服务器对齐
   * 本机没有 → 照旧等网络（行为完全不变）
   *
   * 再配一个 1.2 秒兜底：不管上面成没成，等待页一定撤掉
   * （和首页、欢迎信同一套思路：不让首屏干等网络）
   */
  useEffect(() => {
    // 用一个 0 延迟把"读本机 + 铺数据"挪到下一拍
    // （effect 里同步 setState 会触发连锁渲染，lint 也会拦）
    const paint = window.setTimeout(() => {
      const cachedProfile = peek<Profile>('me-profile-full', 30 * 60 * 1000)
      const cachedCount = peek<number>('me-post-count', 5 * 60 * 1000)
      if (cachedProfile) setProfile(cachedProfile)
      if (typeof cachedCount === 'number') setPostCount(cachedCount)
      if (cachedProfile || typeof cachedCount === 'number') setLoading(false)
    }, 0)

    // 兜底：最多 1.2 秒一定撤掉等待页（和首页同一套思路）
    const bail = window.setTimeout(() => setLoading(false), 700)

    return () => {
      window.clearTimeout(paint)
      window.clearTimeout(bail)
    }
  }, [])
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) { router.push('/login'); return }
      const me = userData.user
      setEmail(me.email || '')
      setIsAdmin(me.id === ADMIN_UUID)

      const { data: profileData } = await supabase.from('profiles').select('*').eq('id', me.id).single()
      if (profileData) setProfile(profileData as Profile)
    if (profileData) save('me-profile-full', profileData)

      const { count } = await supabase.from('world_posts').select('*', { count: 'exact', head: true }).eq('author_id', me.id)
      setPostCount(count || 0)
    save('me-post-count', count ?? 0)

      /* 收到的赞：先拿我自己的帖子 id，再数这些帖子被点过多少赞 */
      const { data: mine } = await supabase
        .from('world_posts')
        .select('id')
        .eq('author_id', me.id)
        .limit(500)
      const ids = (mine ?? []).map((r: { id: string }) => r.id)
      if (ids.length) {
        const { count: likes } = await supabase
          .from('world_likes')
          .select('id', { count: 'exact', head: true })
          .in('post_id', ids)
        setLikeCount(likes ?? 0)
      } else {
        setLikeCount(0)
      }

      setLoading(false)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-xl px-6 pt-24">
        <SkeletonCard lines={3} />
      </div>
    )
  }

  const displayName = profile?.nickname || profile?.username || '未命名'

  return (
    <div className="min-h-screen relative overflow-hidden th-v4skin" style={pageAccentVars('me')}>
      {/* v4 皮肤：冬日视频 + 呼吸光 */}
      <div className={"v4-bg"}>
        <video className={"v4-video"} autoPlay muted loop playsInline preload="auto">
          <source src="/bg-winter.mp4" type="video/mp4" />
        </video>
        <div className={"v4-scrim"} />
        <div className={"v4-glow v4-glow1"} />
        <div className={"v4-glow v4-glow2"} />
        <div className={"v4-glow v4-glow3"} />
      </div>


      <div className="relative max-w-2xl lg:max-w-5xl mx-auto px-6 py-10">
        <header className="mb-6">
          <BackLink fallback="/" />
          <h1 className="text-3xl font-bold text-base-content mt-2">我的</h1>
          <p className="text-sm text-base-content/60 mt-1">我的口袋有糖，你吃吗？</p>
        </header>

        {/* 桌面上分两栏：左边是"我这个人"（资料 / 统计 / 入口），右边是"我的设置"（状态 / 展示页） */}
        <main className="grid gap-4 lg:grid-cols-2 lg:items-start">
          <div className="space-y-4">
          <div className="card rounded-box border border-base-300 bg-base-100 p-6 shadow-sm relative overflow-hidden">

            <div className="relative flex items-start gap-4">
              <div className="w-16 h-16 rounded-box bg-base-content/5 flex items-center justify-center text-2xl overflow-hidden flex-shrink-0 shadow-sm">
                {profile?.avatar_url ? (
                  <img loading="lazy" decoding="async" src={profile.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-primary font-semibold">{displayName[0]}</span>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-semibold text-base-content">{displayName}</h2>
                <p className="text-xs text-base-content/60 mt-0.5">{email}</p>

                {profile?.signature && (
                  <p className="text-sm text-base-content mt-3 font-art italic">「{profile.signature}」</p>
                )}

                <div className="flex flex-wrap gap-3 text-[11px] text-base-content/60 mt-3">
                  {profile?.location && (
                    <span className="flex items-center gap-1"><IconPin className="w-3 h-3" />{profile.location}</span>
                  )}
                  {profile?.birthday && <span>🎂 {profile.birthday}</span>}
                  {profile?.created_at && <span>加入于 {new Date(profile.created_at).toLocaleDateString('zh-CN')}</span>}
                </div>
              </div>
            </div>

            <Link
              href="/me/edit"
              className="relative mt-5 inline-block self-start px-5 py-2 rounded-box bg-primary text-primary-content text-sm font-medium transition-colors"
            >
              编辑资料
            </Link>
          </div>

          {/* 状态 / 展示页放到右栏（见文件末尾的右栏）*/}

          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-box border border-base-300 bg-base-content/5 p-5 text-center relative overflow-hidden">
              <div className="absolute -top-4 -right-4 w-16 h-16 bg-accent opacity-[0.15] rounded-full blur-xl pointer-events-none"></div>
              <p className="relative text-3xl font-bold text-primary">{postCount}</p>
              <p className="relative text-[11px] text-base-content/60 mt-1.5 tracking-wide">已发帖</p>
            </div>
            <div className="card rounded-box border border-base-300 bg-base-100 p-5 text-center">
              <p className="text-3xl font-bold text-[var(--accent-line)]">
                {likeCount === null ? '—' : likeCount}
              </p>
              <p className="text-[11px] text-base-content/60 mt-1.5 tracking-wide">收到的赞</p>
            </div>
          </div>

          {/* 入口：桌面上排成方块（2×2），不再是竖着一条长列表 */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { href: '/me/posts', label: '我的帖子', Icon: IconDoc },
              { href: '/me/favorites', label: '我的收藏', Icon: IconStar },
              { href: '/me/notifications', label: '通知', Icon: IconBell },
              { href: '/me/settings', label: '设置', Icon: IconGear },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-box border border-base-300 bg-base-100 px-3.5 py-3 flex items-center gap-2.5 transition hover:-translate-y-0.5 hover:shadow-sm"
              >
                <span className="w-7 h-7 rounded-full bg-base-content/5 flex items-center justify-center flex-shrink-0">
                  <item.Icon className="w-3.5 h-3.5 text-primary" />
                </span>
                <span className="text-[13px] text-base-content">{item.label}</span>
                <IconArrow className="w-3.5 h-3.5 text-accent ml-auto" />
              </Link>
            ))}

            {isAdmin && (
              <Link
                href="/admin"
                className="rounded-box border border-base-300 bg-base-100 px-3.5 py-3 flex items-center gap-2.5 col-span-2 transition hover:-translate-y-0.5 hover:shadow-sm"
              >
                <span className="w-7 h-7 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center flex-shrink-0">
                  <IconShield className="w-3.5 h-3.5 text-white" />
                </span>
                <span className="text-[13px] text-base-content font-medium">站主后台</span>
                <IconArrow className="w-3.5 h-3.5 text-accent ml-auto" />
              </Link>
            )}
          </div>

          <button
            onClick={handleLogout}
            className="w-full rounded-box border border-base-content/15 bg-base-100/60 py-2.5 text-[13px] text-base-content/70 backdrop-blur-sm transition hover:bg-base-100/85 hover:text-primary"
          >
            退出登录
          </button>

          {/* 版本信息：报问题时截这一块就行（含内核版本，用来判断是不是内核太旧） */}
          <VersionInfo />
          </div>

          {/* 右栏：状态 + 展示页 */}
          <div className="space-y-4">
            {/* 状态：选一个现成的，或者自己写三个字。设好只在小屋聊天抬头显示 */}
            <StatusPicker userId={profile?.id ?? null} />

            {/* 展示页：别人点你头像进来的地方 */}
            <ShowcaseSettingsSection userId={profile?.id ?? null} />
          </div>
        </main>
      </div>
    </div>
  )
}