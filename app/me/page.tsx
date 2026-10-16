'use client'
/* eslint-disable @next/next/no-img-element -- 头像/背景图用原生 img 即可，尺寸固定 */

import { useEffect, useState } from 'react'
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
      setEmail(userData.user.email || '')
      setIsAdmin(userData.user.id === ADMIN_UUID)

      const { data: profileData } = await supabase.from('profiles').select('*').eq('id', userData.user.id).single()
      if (profileData) setProfile(profileData as Profile)
    if (profileData) save('me-profile-full', profileData)

      const { count } = await supabase.from('world_posts').select('*', { count: 'exact', head: true }).eq('author_id', userData.user.id)
      setPostCount(count || 0)
    save('me-post-count', count ?? 0)
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
    <div className="min-h-screen relative overflow-hidden" style={pageAccentVars('me')}>

      <div className="relative max-w-xl lg:max-w-3xl mx-auto px-6 py-10">
        <header className="mb-6">
          <Link href="/" className="text-sm text-base-content/60 hover:text-primary transition">← 返回</Link>
          <h1 className="text-3xl font-bold text-base-content mt-2">我的</h1>
          <p className="text-sm text-base-content/60 mt-1">我的口袋有糖，你吃吗？</p>
        </header>

        <main className="space-y-4">
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

          {/* 状态：选一个现成的，或者自己写三个字。设好只在小屋聊天抬头显示 */}
          <StatusPicker userId={profile?.id ?? null} />

          {/* 展示页：别人点你头像进来的地方 */}
          <ShowcaseSettingsSection userId={profile?.id ?? null} />

          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-box border border-base-300 bg-base-content/5 p-5 text-center relative overflow-hidden">
              <div className="absolute -top-4 -right-4 w-16 h-16 bg-accent opacity-[0.15] rounded-full blur-xl pointer-events-none"></div>
              <p className="relative text-3xl font-bold text-primary">{postCount}</p>
              <p className="relative text-[11px] text-base-content/60 mt-1.5 tracking-wide">已发帖</p>
            </div>
            <div className="card rounded-box border border-base-300 bg-base-100 p-5 text-center">
              <p className="text-3xl font-bold text-[var(--accent-line)]">—</p>
              <p className="text-[11px] text-base-content/60 mt-1.5 tracking-wide">收到的赞</p>
            </div>
          </div>

          <div className="card rounded-box border border-base-300 bg-base-100 overflow-hidden">
            <Link href="/me/posts" className="flex items-center justify-between p-4 hover:bg-base-content/5 transition group">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-base-content/5 flex items-center justify-center"><IconDoc className="w-4 h-4 text-primary" /></div>
                <span className="text-sm text-base-content">我的帖子</span>
              </div>
              <IconArrow className="w-4 h-4 text-accent group-hover:translate-x-0.5 transition-transform" />
            </Link>

            <div className="border-t border-base-300"></div>

            <Link href="/me/favorites" className="flex items-center justify-between p-4 hover:bg-base-content/5 transition group">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-base-content/5 flex items-center justify-center"><IconStar className="w-4 h-4 text-primary" /></div>
                <span className="text-sm text-base-content">我的收藏</span>
              </div>
              <IconArrow className="w-4 h-4 text-accent group-hover:translate-x-0.5 transition-transform" />
            </Link>

            <div className="border-t border-base-300"></div>

            <Link href="/me/notifications" className="flex items-center justify-between p-4 hover:bg-base-content/5 transition group">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-base-content/5 flex items-center justify-center"><IconBell className="w-4 h-4 text-primary" /></div>
                <span className="text-sm text-base-content">通知</span>
              </div>
              <IconArrow className="w-4 h-4 text-accent group-hover:translate-x-0.5 transition-transform" />
            </Link>

            <div className="border-t border-base-300"></div>

            <Link href="/me/settings" className="flex items-center justify-between p-4 hover:bg-base-content/5 transition group">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-base-content/5 flex items-center justify-center"><IconGear className="w-4 h-4 text-primary" /></div>
                <span className="text-sm text-base-content">设置</span>
              </div>
              <IconArrow className="w-4 h-4 text-accent group-hover:translate-x-0.5 transition-transform" />
            </Link>

            {isAdmin && (
              <>
                <div className="border-t border-base-300"></div>
                <Link href="/admin" className="flex items-center justify-between p-4 hover:bg-base-content/5 transition group">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
                      <IconShield className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-sm text-base-content font-medium">站主后台</span>
                  </div>
                  <IconArrow className="w-4 h-4 text-accent group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </>
            )}
          </div>

          <button onClick={handleLogout} className="btn btn-primary w-full border hover: /5 transition">
            退出登录
          </button>
        </main>
      </div>
    </div>
  )
}