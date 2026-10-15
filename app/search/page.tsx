'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '../lib/supabase'
import { Icon } from '../../components/icons'
import { avatarFallback } from '../../components/utils'
import { useBlocks } from '../../components/blocks'
import { useFocusQuery } from '../../components/use-focus-query'
import { SkeletonList } from '../../components/skeleton'
import { EmptyState } from '../../components/empty-state'
import { pageAccentVars } from '../../components/theme'

/** 客户端单例 */
const supabase = createClient()

type ProfileHit = {
  id: string
  username: string | null
  nickname: string | null
  avatar_url: string | null
  signature: string | null
}

type PostHit = {
  id: string
  author_id: string
  content: string | null
  created_at: string
  is_anonymous: boolean
  anonymous_id: string | null
  category_id: string | null
}

type PostResult = PostHit & {
  authorName: string
  authorAvatar: string | null
}

type ActivityHit = {
  id: string
  author_id: string
  title: string
  content: string | null
  activity_time: string | null
  created_at: string
}

type MomentHit = {
  id: string
  author_id: string
  content: string
  created_at: string
}

type Tab = 'posts' | 'activities' | 'moments' | 'users'

/** PostgREST 的 or() 过滤器里逗号/括号是语法字符，去掉避免解析失败 */
function sanitize(keyword: string): string {
  return keyword.replace(/[,()*%\\]/g, ' ').trim()
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const minute = Math.floor(diff / 60000)
  if (minute < 1) return '刚刚'
  if (minute < 60) return `${minute} 分钟前`
  const hour = Math.floor(minute / 60)
  if (hour < 24) return `${hour} 小时前`
  const day = Math.floor(hour / 24)
  if (day < 30) return `${day} 天前`
  return new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric' }).format(new Date(iso))
}

const RESULT_LIMIT = 20

export default function SearchPage() {
  const router = useRouter()
  const [keyword, setKeyword] = useState('')
  const [debounced, setDebounced] = useState('')
  const [tab, setTab] = useState<Tab>('posts')
  const [posts, setPosts] = useState<PostResult[]>([])
  const [activities, setActivities] = useState<ActivityHit[]>([])
  const [moments, setMoments] = useState<MomentHit[]>([])
  const [users, setUsers] = useState<ProfileHit[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [meId, setMeId] = useState<string | null>(null)

  const mountedRef = useRef(true)

  // 拉黑：搜索结果里排除被拉黑（含拉黑我的）的人及其内容
  const blocks = useBlocks(meId)

  // 从话题标签点进来：/search?q=%23音乐%23 直接带出关键词
  const queryFromUrl = useFocusQuery('q')
  useEffect(() => {
    if (!queryFromUrl) return
    // rAF 推迟，避开「effect 内同步 setState」
    const frame = window.requestAnimationFrame(() => setKeyword(queryFromUrl))
    return () => window.cancelAnimationFrame(frame)
  }, [queryFromUrl])

  /* ---------- 登录校验 ---------- */
  useEffect(() => {
    mountedRef.current = true
    void (async () => {
      try {
        const { data, error: authError } = await supabase.auth.getUser()
        if (authError) throw authError
        if (!mountedRef.current) return
        if (!data.user) {
          router.replace('/login')
          return
        }
        setMeId(data.user.id)
      } catch (err) {
        console.error('搜索页登录校验失败:', err)
        if (mountedRef.current) router.replace('/login')
      }
    })()
    return () => {
      mountedRef.current = false
    }
  }, [router])

  /* ---------- 输入防抖 ---------- */
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(keyword.trim()), 350)
    return () => window.clearTimeout(id)
  }, [keyword])

  /* ---------- 查询 ---------- */
  const runSearch = useCallback(async (raw: string) => {
    const q = sanitize(raw)
    if (q.length === 0) {
      setPosts([])
      setActivities([])
      setMoments([])
      setUsers([])
      setError('')
      return
    }

    setLoading(true)
    setError('')

    try {
      const pattern = `%${q}%`

      const [postsRes, activitiesRes, momentsRes, usersRes] = await Promise.all([
        supabase
          .from('world_posts')
          .select('id, author_id, content, created_at, is_anonymous, anonymous_id, category_id')
          .eq('status', 'published')
          .eq('is_hidden', false)
          .ilike('content', pattern)
          .order('created_at', { ascending: false })
          .limit(RESULT_LIMIT),
        supabase
          .from('play_activities')
          .select('id, author_id, title, content, activity_time, created_at')
          .eq('status', 'published')
          .or(`title.ilike.${pattern},content.ilike.${pattern}`)
          .order('created_at', { ascending: false })
          .limit(RESULT_LIMIT),
        supabase
          .from('friend_posts')
          .select('id, author_id, content, created_at')
          .ilike('content', pattern)
          .order('created_at', { ascending: false })
          .limit(RESULT_LIMIT),
        supabase
          .from('profiles')
          .select('id, username, nickname, avatar_url, signature')
          .or(`username.ilike.${pattern},nickname.ilike.${pattern}`)
          .limit(RESULT_LIMIT),
      ])

      if (postsRes.error) throw postsRes.error
      if (usersRes.error) throw usersRes.error
      if (!mountedRef.current) return

      // 活动 / 朋友圈查询失败（例如 RLS 限制）不影响其他页签
      if (activitiesRes.error) console.error('活动搜索失败:', activitiesRes.error)
      if (momentsRes.error) console.error('朋友圈搜索失败:', momentsRes.error)

      const rawPosts = (postsRes.data ?? []) as unknown as PostHit[]

      // 拼作者昵称（匿名帖不暴露作者）
      const authorIds = [...new Set(rawPosts.filter((p) => !p.is_anonymous).map((p) => p.author_id))]
      let profileMap = new Map<string, ProfileHit>()
      if (authorIds.length > 0) {
        const { data: profiles, error: profileError } = await supabase
          .from('profiles')
          .select('id, username, nickname, avatar_url, signature')
          .in('id', authorIds)
        if (profileError) throw profileError
        profileMap = new Map(((profiles ?? []) as unknown as ProfileHit[]).map((p) => [p.id, p]))
      }

      if (!mountedRef.current) return

      setPosts(
        rawPosts.map((p) => {
          const profile = profileMap.get(p.author_id) ?? null
          return {
            ...p,
            authorName: p.is_anonymous
              ? `匿名用户${p.anonymous_id ?? '****'}`
              : profile?.nickname?.trim() || profile?.username?.trim() || '某人',
            authorAvatar: p.is_anonymous ? null : profile?.avatar_url ?? null,
          }
        }),
      )
      setActivities((activitiesRes.data ?? []) as unknown as ActivityHit[])
      setMoments((momentsRes.data ?? []) as unknown as MomentHit[])
      setUsers((usersRes.data ?? []) as unknown as ProfileHit[])
    } catch (err) {
      console.error('搜索失败:', err)
      if (mountedRef.current) setError('搜索失败，请稍后重试')
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    // runSearch 是 async 函数，setState 都在 await 之后；规则无法识别
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void runSearch(debounced)
  }, [debounced, runSearch])

  const hasQuery = debounced.length > 0

  // 过滤掉被拉黑（含拉黑我的）的人及其内容
  const hidden = blocks.hiddenIds
  const shownPosts = useMemo(() => posts.filter((p) => !hidden.has(p.author_id)), [posts, hidden])
  const shownActivities = useMemo(
    () => activities.filter((a) => !hidden.has(a.author_id)),
    [activities, hidden],
  )
  const shownMoments = useMemo(
    () => moments.filter((m) => !hidden.has(m.author_id)),
    [moments, hidden],
  )
  const shownUsers = useMemo(() => users.filter((u) => !hidden.has(u.id)), [users, hidden])

  const empty =
    !loading &&
    hasQuery &&
    shownPosts.length === 0 &&
    shownActivities.length === 0 &&
    shownMoments.length === 0 &&
    shownUsers.length === 0

  function renderContent(text: string | null): string {
    return (text ?? '').slice(0, 120) || '（无内容）'
  }

  return (
    <div className="min-h-screen bg-[#fdf7f0]" style={pageAccentVars('home')}>
      <div className="relative max-w-3xl mx-auto px-6 pt-10 pb-16">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-[var(--accent-muted)] hover:text-[var(--accent-deep)] transition"
        >
          <Icon name="back" className="w-4 h-4" />
          返回
        </Link>

        <h1 className="text-3xl font-bold text-[#2b2620] mt-4">搜索</h1>
        <p className="text-sm text-[var(--accent-muted)] mt-1">站内搜帖子、活动、朋友圈、用户</p>

        {/* 搜索框 */}
        <div className="mt-6 relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--accent-muted)]">
            <Icon name="search" className="w-4 h-4" />
          </span>
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="输入关键词，比如：奶龙 / user_ / 今天"
            autoFocus
            maxLength={50}
            className="w-full pl-11 pr-10 py-3 rounded-2xl border border-[var(--accent-line)] bg-white text-sm text-[#2b2620] placeholder:text-[var(--accent-muted)] focus:outline-none focus:border-[var(--accent-light)] focus:ring-2 focus:ring-[var(--accent)]/10 transition"
          />
          {keyword && (
            <button
              type="button"
              onClick={() => setKeyword('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--accent-muted)] hover:text-[var(--accent-deep)] transition"
              aria-label="清空"
            >
              <Icon name="x" className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* 页签 */}
        <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 border-b border-[var(--accent-line)]">
          <button
            type="button"
            onClick={() => setTab('posts')}
            className={`pb-2.5 text-sm transition flex items-center gap-1.5 ${
              tab === 'posts'
                ? 'border-b-2 border-[var(--accent)] text-[var(--accent)] font-medium'
                : 'text-[var(--accent-muted)] hover:text-[#2b2620]'
            }`}
          >
            帖子
            {hasQuery && <span className="text-[11px] text-[#b0a89e]">{shownPosts.length}</span>}
          </button>
          <button
            type="button"
            onClick={() => setTab('activities')}
            className={`pb-2.5 text-sm transition flex items-center gap-1.5 ${
              tab === 'activities'
                ? 'border-b-2 border-[var(--accent)] text-[var(--accent)] font-medium'
                : 'text-[var(--accent-muted)] hover:text-[#2b2620]'
            }`}
          >
            活动
            {hasQuery && <span className="text-[11px] text-[#b0a89e]">{shownActivities.length}</span>}
          </button>
          <button
            type="button"
            onClick={() => setTab('moments')}
            className={`pb-2.5 text-sm transition flex items-center gap-1.5 ${
              tab === 'moments'
                ? 'border-b-2 border-[var(--accent)] text-[var(--accent)] font-medium'
                : 'text-[var(--accent-muted)] hover:text-[#2b2620]'
            }`}
          >
            朋友圈
            {hasQuery && <span className="text-[11px] text-[#b0a89e]">{shownMoments.length}</span>}
          </button>
          <button
            type="button"
            onClick={() => setTab('users')}
            className={`pb-2.5 text-sm transition flex items-center gap-1.5 ${
              tab === 'users'
                ? 'border-b-2 border-[var(--accent)] text-[var(--accent)] font-medium'
                : 'text-[var(--accent-muted)] hover:text-[#2b2620]'
            }`}
          >
            用户
            {hasQuery && <span className="text-[11px] text-[#b0a89e]">{shownUsers.length}</span>}
          </button>
        </div>

        {/* 状态区 */}
        <div className="mt-4">
          {error && (
            <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          {!hasQuery && !error && (
            <p className="py-12 text-center text-xs text-[#b0a89e]">
              输入关键词开始搜索。可以搜帖子内容，也可以搜用户名 / 昵称。
            </p>
          )}

          {loading && hasQuery && <SkeletonList count={2} lines={2} />}

          {empty && !loading && (
            <EmptyState art="search" title={`没找到和「${debounced}」有关的内容`} hint="换个词试试，或者少写几个字" />
          )}

          {/* 帖子结果 */}
          {hasQuery && !loading && tab === 'posts' && shownPosts.length > 0 && (
            <div className="space-y-3">
              {shownPosts.map((p) => (
                <Link
                  key={p.id}
                  href={`/world?post=${p.id}`}
                  className="block rounded-2xl border border-[var(--accent-line)] bg-white p-4 hover:shadow-sm hover:-translate-y-0.5 transition"
                >
                  <div className="flex items-center gap-2.5 mb-2">
                    <span className="w-7 h-7 rounded-full bg-[#f3e2d3] flex items-center justify-center overflow-hidden flex-shrink-0 text-[11px] text-[var(--accent-deep)]">
                      {p.authorAvatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.authorAvatar} alt="" className="w-full h-full object-cover" />
                      ) : (
                        avatarFallback({ username: p.authorName, nickname: null, avatar_url: null }, '友')
                      )}
                    </span>
                    <span className="text-xs text-[#5a4a3a] truncate">{p.authorName}</span>
                    <span className="text-[11px] text-[#b0a89e] ml-auto flex-shrink-0">
                      {relativeTime(p.created_at)}
                    </span>
                  </div>
                  <p className="text-sm text-[#3a4a2a] leading-relaxed whitespace-pre-wrap break-words">
                    {renderContent(p.content)}
                  </p>
                </Link>
              ))}
            </div>
          )}

          {/* 活动结果 */}
          {hasQuery && !loading && tab === 'activities' && shownActivities.length > 0 && (
            <div className="space-y-3">
              {shownActivities.map((a) => (
                <Link
                  key={a.id}
                  href={`/play?activity=${a.id}`}
                  className="block rounded-2xl border border-[#d8e0e8] bg-white p-4 hover:shadow-sm hover:-translate-y-0.5 transition"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-medium text-[#2b3a4a] truncate">{a.title}</span>
                    <span className="text-[11px] text-[#9aa8b4] ml-auto flex-shrink-0">
                      {relativeTime(a.created_at)}
                    </span>
                  </div>
                  {a.content && (
                    <p className="text-xs text-[#4a5a6a] leading-relaxed whitespace-pre-wrap break-words">
                      {renderContent(a.content)}
                    </p>
                  )}
                  {a.activity_time && (
                    <p className="text-[11px] text-[#7a8a9a] mt-2">
                      活动时间：
                      {new Intl.DateTimeFormat('zh-CN', {
                        month: 'numeric',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      }).format(new Date(a.activity_time))}
                    </p>
                  )}
                </Link>
              ))}
            </div>
          )}

          {/* 朋友圈结果 */}
          {hasQuery && !loading && tab === 'moments' && shownMoments.length > 0 && (
            <div className="space-y-3">
              {shownMoments.map((m) => (
                <Link
                  key={m.id}
                  href={`/friends/moments?post=${m.id}`}
                  className="block rounded-2xl border border-[var(--accent-line)] bg-white p-4 hover:shadow-sm hover:-translate-y-0.5 transition"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[11px] text-[#b0a89e]">朋友圈</span>
                    <span className="text-[11px] text-[#b0a89e] ml-auto flex-shrink-0">
                      {relativeTime(m.created_at)}
                    </span>
                  </div>
                  <p className="text-sm text-[#4a423c] leading-relaxed whitespace-pre-wrap break-words">
                    {renderContent(m.content)}
                  </p>
                </Link>
              ))}
            </div>
          )}

          {/* 用户结果 */}
          {hasQuery && !loading && tab === 'users' && shownUsers.length > 0 && (
            <div className="space-y-3">
              {shownUsers.map((u) => {
                const name = u.nickname?.trim() || u.username?.trim() || '某人'
                const isMe = u.id === meId
                return (
                  <div
                    key={u.id}
                    className="flex items-center gap-3 rounded-2xl border border-[var(--accent-line)] bg-white p-4"
                  >
                    <span className="w-10 h-10 rounded-full bg-gradient-to-br from-[#fae0cc] to-[#f9d5ba] flex items-center justify-center overflow-hidden flex-shrink-0 text-sm text-[var(--accent-deep)] font-semibold">
                      {u.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={u.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        name.slice(0, 1)
                      )}
                    </span>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#2b2620] truncate">
                        {name}
                        {isMe && <span className="ml-1.5 text-[11px] text-[var(--accent-deep)]">（我）</span>}
                      </p>
                      {u.username && (
                        <p className="text-[11px] text-[#b0a89e] truncate">@{u.username}</p>
                      )}
                      {u.signature && (
                        <p className="text-[11px] text-[#a88868] truncate mt-0.5">{u.signature}</p>
                      )}
                    </div>

                    {!isMe && (
                      <Link
                        href="/friends"
                        className="flex-shrink-0 rounded-full bg-[var(--accent)] px-3 py-1 text-[11px] text-white hover:bg-[var(--accent-deep)] transition"
                      >
                        去小屋加好友
                      </Link>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
