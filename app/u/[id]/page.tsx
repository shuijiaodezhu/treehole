'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase'
import { pageAccentVars } from '../../../components/theme'
import { Icon } from '../../../components/icons'
import { useAffinity } from '../../../components/affinity'
import { StatusLabel, useStatusText } from '../../../components/status'
import { SkeletonCard } from '../../../components/skeleton'

/**
 * 展示页：每个人一个，别人点你的头像进来看
 *
 * 三条规则（都不是随手定的）：
 *   1. **匿名帖绝不出现** —— 院子里匿名说的话，不能在这里被对上号
 *   2. 好感度那一行是「**看的人**对 TA 的好感度」—— 各看各的，
 *      不摊开对方的隐私（数据层也只放行自己那一侧）
 *   3. 只显示公开、已发布、未被隐藏的帖子
 *
 * 内容开关在「我的」里改（show_posts_on_profile）。
 */

const supabase = createClient()

type ShowcaseProfile = {
  id: string
  nickname: string | null
  username: string | null
  avatar_url: string | null
  signature: string | null
  location: string | null
  birthday: string | null
  created_at: string | null
}

type ShowcasePost = {
  id: string
  content: string
  created_at: string
  image_urls: string[] | null
}

function UserShowcase() {
  const params = useParams()
  const router = useRouter()
  const targetId = (params?.id as string) ?? ''

  const [meId, setMeId] = useState<string | null>(null)
  const [profile, setProfile] = useState<ShowcaseProfile | null>(null)
  const [posts, setPosts] = useState<ShowcasePost[]>([])
  const [isFriend, setIsFriend] = useState(false)
  const [loading, setLoading] = useState(true)
  const [missing, setMissing] = useState(false)

  const affinity = useAffinity(meId, targetId || null)
  const status = useStatusText(targetId || null)

  useEffect(() => {
    if (!targetId) return
    let cancelled = false

    void (async () => {
      const { data: userData } = await supabase.auth.getUser()
      if (cancelled) return
      if (!userData.user) {
        router.push('/login')
        return
      }
      setMeId(userData.user.id)

      // 带开关字段查一次；字段不存在就退回不带它的查询（SQL 还没跑也不该白屏）
      type ProfileRow = ShowcaseProfile & { show_posts_on_profile?: boolean | null }
      let profileRow: ProfileRow | null = null
      let profileError: { message: string } | null = null

      const withFlag = await supabase
        .from('profiles')
        .select('id, nickname, username, avatar_url, signature, location, birthday, created_at, show_posts_on_profile')
        .eq('id', targetId)
        .maybeSingle()

      if (withFlag.error && /show_posts_on_profile|column/i.test(withFlag.error.message)) {
        setMissing(true)
        const fallback = await supabase
          .from('profiles')
          .select('id, nickname, username, avatar_url, signature, location, birthday, created_at')
          .eq('id', targetId)
          .maybeSingle()
        profileRow = (fallback.data ?? null) as ProfileRow | null
        profileError = fallback.error
      } else {
        profileRow = (withFlag.data ?? null) as ProfileRow | null
        profileError = withFlag.error
      }

      if (cancelled) return
      if (profileError) console.error('读展示页失败:', profileError)
      setProfile(profileRow)

      const showPosts = profileRow?.show_posts_on_profile !== false

      if (showPosts) {
        // 匿名帖明确排除；只取公开、已发布、未隐藏的
        const { data: postData, error: postError } = await supabase
          .from('world_posts')
          .select('id, content, created_at, image_urls')
          .eq('author_id', targetId)
          .eq('status', 'published')
          .eq('is_hidden', false)
          .eq('is_anonymous', false)
          .order('created_at', { ascending: false })
          .limit(5)
        if (cancelled) return
        if (postError) console.error('读展示页帖子失败:', postError)
        setPosts((postData as ShowcasePost[] | null) ?? [])
      }

      // 是不是好友：决定给不给「去小屋聊聊」这个入口
      const { data: ship } = await supabase
        .from('friendships')
        .select('id')
        .or(
          `and(requester_id.eq.${userData.user.id},addressee_id.eq.${targetId}),and(requester_id.eq.${targetId},addressee_id.eq.${userData.user.id})`,
        )
        .eq('status', 'accepted')
        .limit(1)
      if (cancelled) return
      setIsFriend(Boolean(ship && ship.length > 0))

      setLoading(false)
    })()

    return () => {
      cancelled = true
    }
  }, [targetId, router])

  if (loading) {
    return (
      <div className="mx-auto max-w-xl px-6 pt-24">
        <SkeletonCard lines={4} />
      </div>
    )
  }

  const name = profile?.nickname || profile?.username || '这个人'
  const isMe = Boolean(meId && meId === targetId)

  return (
    <div className="min-h-screen relative overflow-hidden" style={pageAccentVars('friends')}>

      <div className="relative max-w-xl mx-auto px-6 py-10">
        <header className="mb-6 flex items-center justify-between">
          <button
            type="button"
            onClick={() => router.back()}
            className="text-sm text-base-content/60 transition hover:text-[var(--accent-deep)]"
          >
            ← 返回
          </button>
          {isMe && (
            <Link
              href="/me"
              className="text-xs text-base-content/60 transition hover:text-[var(--accent-deep)]"
            >
              这是我 · 去改资料
            </Link>
          )}
        </header>

        <main className="space-y-4">
          {/* 资料 */}
          <section className="rounded-box border border-base-300 bg-base-100/80 p-6 backdrop-blur shadow-sm">
            <div className="flex items-start gap-4">
              <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-box bg-primary/5 text-2xl shadow-sm">
                {profile?.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="font-semibold text-[var(--accent-deep)]">{name[0]}</span>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-2">
                  <h1 className="min-w-0 truncate text-xl font-semibold text-base-content">{name}</h1>
                  <StatusLabel text={status} />
                </div>

                {profile?.signature && (
                  <p className="mt-1 font-art text-sm italic text-[#5a4a6a]">「{profile.signature}」</p>
                )}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-3 text-[11px] text-base-content/60">
              {profile?.location && <span>{profile.location}</span>}
              {profile?.birthday && <span>生日 {profile.birthday}</span>}
              {profile?.created_at && (
                <span>加入于 {new Date(profile.created_at).toLocaleDateString('zh-CN')}</span>
              )}
            </div>

            {/* 好感度：显示的是「看的人对 TA 的」，每个人看都是自己那一份 */}
            {!isMe && affinity.mine !== null && affinity.mine > 0 && (
              <p className="mt-4 flex items-center gap-1.5 font-serif-cn text-[11px] text-[var(--accent-light)]">
                <Icon name="heart" className="h-3 w-3" />
                你对 TA 的来往 · {affinity.mine}
              </p>
            )}

            <div className="mt-5 flex items-center gap-3">
              {isFriend ? (
                <Link
                  href={`/friends/chat/${targetId}`}
                  className="rounded-box bg-primary px-5 py-2 text-sm font-medium text-white transition-all hover:shadow-sm"
                >
                  去小屋聊聊
                </Link>
              ) : (
                <span className="rounded-box border border-base-300 px-5 py-2 text-sm text-base-content/60">
                  还不是好友
                </span>
              )}
              {!isMe && (
                <Link
                  href="/friends"
                  className="text-xs text-base-content/60 transition hover:text-[var(--accent-deep)]"
                >
                  去小屋
                </Link>
              )}
            </div>
          </section>

          {/* 公开的帖子 */}
          <section className="rounded-box border border-base-300 bg-base-100/80 p-6 backdrop-blur">
            <h2 className="text-sm font-semibold text-base-content">
              {isMe ? '我在院子里说过的' : `TA 在院子里说过的`}
            </h2>

            {posts.length === 0 ? (
              <p className="mt-3 text-[11px] leading-relaxed text-base-content/60">
                {missing
                  ? '展示页还没开通：先在 Supabase 里执行 supabase-profile-page.sql。'
                  : isMe
                    ? '你还没在院子里说过话；说了就会出现在这里（匿名的不会）。'
                    : '还没在院子里说过话。'}
              </p>
            ) : (
              <ul className="mt-3 space-y-3">
                {posts.map((post) => (
                  <li key={post.id} className="border-b border-[var(--accent-soft)] pb-3 last:border-b-0 last:pb-0">
                    <p className="line-clamp-3 whitespace-pre-wrap text-xs leading-relaxed text-[#4a3f38]">
                      {post.content}
                    </p>
                    <div className="mt-1.5 flex items-center gap-3 text-[11px] text-[var(--accent-light)]">
                      <span>{new Date(post.created_at).toLocaleDateString('zh-CN')}</span>
                      {post.image_urls && post.image_urls.length > 0 && (
                        <span className="flex items-center gap-1">
                          <Icon name="image" className="h-3 w-3" />
                          {post.image_urls.length}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <p className="mt-4 text-[11px] leading-relaxed text-[var(--accent-light)]">
              只显示公开的帖子。<span className="text-base-content/60">匿名说的不会出现在这里。</span>
            </p>
          </section>
        </main>
      </div>
    </div>
  )
}

export default function UserShowcasePage() {
  // useParams 需要包一层 Suspense（构建时会预渲染这个路由）
  return (
    <Suspense fallback={<div className="min-h-screen bg-primary/5" />}>
      <UserShowcase />
    </Suspense>
  )
}
