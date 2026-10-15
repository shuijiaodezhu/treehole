'use client'
/* eslint-disable @next/next/no-img-element -- 头像/背景图用原生 img 即可，尺寸固定 */

import { useEffect, useState } from 'react'
import { createClient } from '../lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

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
  cover_url: string | null
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

      const { count } = await supabase.from('world_posts').select('*', { count: 'exact', head: true }).eq('author_id', userData.user.id)
      setPostCount(count || 0)
      setLoading(false)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center"><p>加载中...</p></div>

  const displayName = profile?.nickname || profile?.username || '未命名'

  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="absolute -top-20 -right-20 w-96 h-96 bg-[#c8b8d8] opacity-20 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-20 -left-20 w-96 h-96 bg-[#a88ab8] opacity-10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="relative max-w-xl mx-auto px-6 py-10">
        <header className="mb-6">
          <Link href="/" className="text-sm text-[#8a7a9a] hover:text-[#8a7aaa] transition">← 返回</Link>
          <h1 className="text-3xl font-bold text-[#2b2430] mt-2">我的</h1>
          <p className="text-sm text-[#8a7a9a] mt-1">我的口袋有糖，你吃吗？</p>
        </header>

        <main className="space-y-4">
          <div className="rounded-3xl border border-[#e0d4e8] bg-white/80 backdrop-blur-lg p-6 shadow-[0_8px_40px_rgba(168,138,184,0.06)] relative overflow-hidden">
            <div className="absolute -top-8 -right-8 w-32 h-32 bg-[#c8b8d8] opacity-[0.15] rounded-full blur-2xl pointer-events-none"></div>

            {/* 主页背景图（没设置就用渐变兜底） */}
            <div className="relative -mx-6 -mt-6 mb-4 h-32 overflow-hidden">
              {profile?.cover_url ? (
                <>
                  <img src={profile.cover_url} alt="" className="h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-white/80 via-transparent to-transparent" />
                </>
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#efe3f7] via-[#e6d8f2] to-[#d8c4ea]">
                  <Link
                    href="/me/edit"
                    className="rounded-full bg-white/70 px-3 py-1 text-[11px] text-[#7a5a9a] backdrop-blur transition hover:bg-white"
                  >
                    ＋ 加一张背景图
                  </Link>
                </div>
              )}
            </div>

            <div className="relative flex items-start gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#e0d4e8] to-[#d0b8e0] flex items-center justify-center text-2xl overflow-hidden flex-shrink-0 shadow-sm">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-[#8a7aaa] font-semibold">{displayName[0]}</span>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-semibold text-[#2b2430]">{displayName}</h2>
                <p className="text-xs text-[#9a8aaa] mt-0.5">{email}</p>

                {profile?.signature && (
                  <p className="text-sm text-[#5a4a6a] mt-3 font-art italic">「{profile.signature}」</p>
                )}

                <div className="flex flex-wrap gap-3 text-[11px] text-[#9a8aaa] mt-3">
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
              className="relative mt-5 inline-block px-5 py-2 rounded-xl bg-gradient-to-r from-[#b89ac8] to-[#a88ab8] text-white text-sm font-medium hover:shadow-[0_6px_20px_rgba(168,138,184,0.3)] transition-all"
            >
              编辑资料
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-2xl border border-[#e0d4e8] bg-gradient-to-br from-[#f8f2fc] to-[#f0e6f8] p-5 text-center relative overflow-hidden">
              <div className="absolute -top-4 -right-4 w-16 h-16 bg-[#c8b8d8] opacity-[0.15] rounded-full blur-xl pointer-events-none"></div>
              <p className="relative text-3xl font-bold text-[#8a7aaa]">{postCount}</p>
              <p className="relative text-[11px] text-[#9a8aaa] mt-1.5 tracking-wide">已发帖</p>
            </div>
            <div className="rounded-2xl border border-[#e0d4e8] bg-white p-5 text-center">
              <p className="text-3xl font-bold text-[#d4c8e0]">—</p>
              <p className="text-[11px] text-[#9a8aaa] mt-1.5 tracking-wide">收到的赞</p>
            </div>
          </div>

          <div className="rounded-2xl border border-[#e0d4e8] bg-white overflow-hidden">
            <Link href="/me/posts" className="flex items-center justify-between p-4 hover:bg-[#faf5ff] transition group">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[#f0e6f8] flex items-center justify-center"><IconDoc className="w-4 h-4 text-[#8a7aaa]" /></div>
                <span className="text-sm text-[#2b2430]">我的帖子</span>
              </div>
              <IconArrow className="w-4 h-4 text-[#b8a8c8] group-hover:translate-x-0.5 transition-transform" />
            </Link>

            <div className="border-t border-[#e0d4e8]"></div>

            <Link href="/me/favorites" className="flex items-center justify-between p-4 hover:bg-[#faf5ff] transition group">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[#f0e6f8] flex items-center justify-center"><IconStar className="w-4 h-4 text-[#8a7aaa]" /></div>
                <span className="text-sm text-[#2b2430]">我的收藏</span>
              </div>
              <IconArrow className="w-4 h-4 text-[#b8a8c8] group-hover:translate-x-0.5 transition-transform" />
            </Link>

            <div className="border-t border-[#e0d4e8]"></div>

            <Link href="/me/settings" className="flex items-center justify-between p-4 hover:bg-[#faf5ff] transition group">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[#f0e6f8] flex items-center justify-center"><IconGear className="w-4 h-4 text-[#8a7aaa]" /></div>
                <span className="text-sm text-[#2b2430]">设置</span>
              </div>
              <IconArrow className="w-4 h-4 text-[#b8a8c8] group-hover:translate-x-0.5 transition-transform" />
            </Link>

            {isAdmin && (
              <>
                <div className="border-t border-[#e0d4e8]"></div>
                <Link href="/admin" className="flex items-center justify-between p-4 hover:bg-[#faf5ff] transition group">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#b89ac8] to-[#a88ab8] flex items-center justify-center">
                      <IconShield className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-sm text-[#2b2430] font-medium">站主后台</span>
                  </div>
                  <IconArrow className="w-4 h-4 text-[#b8a8c8] group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </>
            )}
          </div>

          <button onClick={handleLogout} className="w-full text-center py-3 rounded-2xl border border-[#e0d4e8] bg-white text-sm text-[#8a7aaa] hover:bg-[#f8f2fc] transition">
            退出登录
          </button>
        </main>
      </div>
    </div>
  )
}