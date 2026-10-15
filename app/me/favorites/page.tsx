'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase'
import { Icon } from '../../../components/icons'
import {
  FAVORITE_KIND_LABEL,
  favoriteHref,
  useFavorites,
  type FavoriteKind,
} from '../../../components/favorites'

const supabase = createClient()

type Tab = 'all' | FavoriteKind

/** 页签顺序：全部 / 帖子 / 活动 / 朋友圈 / 视频 / 图片 */
const TABS: Tab[] = ['all', 'world_post', 'play_activity', 'moment', 'video', 'image']

/** 目前站内还没有视频/图片内容，这两个页签先给明确说明而不是空白 */
const MEDIA_HINT: Partial<Record<FavoriteKind, string>> = {
  video: '站内目前还没有视频内容。等院子支持发视频后，收藏的视频会出现在这里。',
  image: '站内目前还没有图片内容。等帖子/朋友圈支持配图后，收藏的图片会出现在这里。',
}

function formatTime(iso: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

export default function FavoritesPage() {
  const router = useRouter()
  const [meId, setMeId] = useState<string | null>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [tab, setTab] = useState<Tab>('all')

  const favorites = useFavorites(meId)
  const { items, reload } = favorites

  /* ---------- 登录校验 ---------- */
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const { data, error } = await supabase.auth.getUser()
        if (error) throw error
        if (cancelled) return
        if (!data.user) {
          router.replace('/login')
          return
        }
        setMeId(data.user.id)
      } catch (err) {
        console.error('收藏页登录校验失败:', err)
        if (!cancelled) router.replace('/login')
      } finally {
        if (!cancelled) setAuthChecked(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [router])

  const counts = useMemo(() => {
    const result: Record<Tab, number> = {
      all: items.length,
      world_post: 0,
      play_activity: 0,
      moment: 0,
      video: 0,
      image: 0,
    }
    for (const item of items) result[item.kind] += 1
    return result
  }, [items])

  const visible = useMemo(
    () => (tab === 'all' ? items : items.filter((f) => f.kind === tab)),
    [items, tab],
  )

  const loading = !authChecked || favorites.loading

  return (
    <div className="min-h-screen bg-[#faf7fd]">
      <div className="relative max-w-3xl mx-auto px-6 pt-10 pb-16">
        <Link
          href="/me"
          className="inline-flex items-center gap-1.5 text-sm text-[#8a7aaa] hover:text-[#7a5a9a] transition"
        >
          <Icon name="back" className="w-4 h-4" />
          返回我的
        </Link>

        <div className="mt-4 flex items-end justify-between">
          <div>
            <h1 className="text-3xl font-bold text-[#2b2430]">我的收藏</h1>
            <p className="text-sm text-[#8a7aaa] mt-1">
              {counts.all > 0 ? `一共收藏了 ${counts.all} 条` : '把心跳的瞬间藏进口袋里'}
            </p>
          </div>

          <button
            type="button"
            onClick={() => meId && void reload(meId)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#e4d9ef] bg-white px-3 py-1.5 text-xs text-[#8a7aaa] hover:text-[#7a5a9a] transition"
          >
            <Icon name="refresh" className="w-3.5 h-3.5" />
            刷新
          </button>
        </div>

        {/* 分类页签 */}
        <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 border-b border-[#ece4f4]">
          {TABS.map((t) => {
            const label = t === 'all' ? '全部' : FAVORITE_KIND_LABEL[t]
            const active = tab === t
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`pb-2.5 text-sm transition flex items-center gap-1.5 ${
                  active
                    ? 'border-b-2 border-[#a88ab8] text-[#7a5a9a] font-medium'
                    : 'text-[#8a7aaa] hover:text-[#2b2430]'
                }`}
              >
                {label}
                <span className="text-[10px] text-[#b0a4c0]">{counts[t]}</span>
              </button>
            )
          })}
        </div>

        {favorites.error && (
          <div className="mt-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
            {favorites.error}
          </div>
        )}

        {/* 视频 / 图片：站内暂无这类内容 */}
        {tab !== 'all' && MEDIA_HINT[tab] && (
          <p className="py-12 text-center text-xs leading-relaxed text-[#b0a4c0]">{MEDIA_HINT[tab]}</p>
        )}

        {loading && (
          <p className="py-12 text-center text-xs text-[#b0a4c0]">加载中…</p>
        )}

        {!loading && !MEDIA_HINT[tab as FavoriteKind] && visible.length === 0 && !favorites.error && (
          <div className="py-14 text-center">
            <p className="text-sm text-[#8a7aaa]">
              {tab === 'all' ? '口袋里还空着' : `还没有收藏的${FAVORITE_KIND_LABEL[tab as FavoriteKind]}`}
            </p>
            <p className="mt-2 text-xs text-[#b0a4c0]">
              在院子里遇到心动的帖子，收进来就好。
            </p>
            <Link
              href="/world"
              className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#b89ac8] to-[#a88ab8] px-4 py-2 text-sm text-white hover:shadow-[0_6px_20px_rgba(168,138,184,0.3)] transition-all"
            >
              去院子逛逛
            </Link>
          </div>
        )}

        {!loading && visible.length > 0 && (
          <div className="mt-4 space-y-3">
            {visible.map((f) => (
              <div
                key={f.id}
                className="rounded-2xl border border-[#ece4f4] bg-white/85 backdrop-blur p-4 shadow-[0_2px_12px_rgba(168,138,184,0.05)]"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="rounded-full bg-[#f3edf9] px-2 py-0.5 text-[10px] text-[#7a5a9a]">
                    {FAVORITE_KIND_LABEL[f.kind]}
                  </span>
                  {f.author_name && (
                    <span className="text-[10px] text-[#9a8aaa] truncate">{f.author_name}</span>
                  )}
                  <span className="ml-auto flex-shrink-0 text-[10px] text-[#b0a4c0]">
                    收藏于 {formatTime(f.created_at)}
                  </span>
                </div>

                {f.title && (
                  <p className="text-sm font-medium text-[#2b2430] mb-1 break-words">{f.title}</p>
                )}
                {f.content && (
                  <p className="text-xs text-[#4a3a5a] leading-relaxed whitespace-pre-wrap break-words">
                    {f.content.slice(0, 160)}
                    {f.content.length > 160 ? '…' : ''}
                  </p>
                )}

                <div className="mt-3 flex items-center gap-3">
                  <Link
                    href={favoriteHref(f.kind, f.target_id)}
                    className="text-xs text-[#7a5a9a] hover:underline"
                  >
                    查看原内容 →
                  </Link>
                  <button
                    type="button"
                    onClick={() =>
                      void favorites.toggle({
                        kind: f.kind,
                        targetId: f.target_id,
                        title: f.title,
                        content: f.content,
                        authorName: f.author_name,
                      })
                    }
                    disabled={favorites.busyKey === `${f.kind}:${f.target_id}`}
                    className="ml-auto text-xs text-[#b0a4c0] hover:text-red-500 transition disabled:opacity-50"
                  >
                    取消收藏
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
