'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase'
import { Icon } from '../../../components/icons'
import { SkeletonList } from '../../../components/skeleton'
import { EmptyState } from '../../../components/empty-state'
import { pageAccentVars } from '../../../components/theme'
import {
  FAVORITE_KIND_LABEL,
  favoriteHref,
  isMediaFavorite,
  useFavorites,
  type FavoriteKind,
} from '../../../components/favorites'

const supabase = createClient()

type Tab = 'all' | FavoriteKind

/** 页签顺序：全部 / 帖子 / 活动 / 朋友圈 / 视频 / 图片 */
const TABS: Tab[] = ['all', 'world_post', 'play_activity', 'moment', 'video', 'image']

/** 站内目前还没有视频内容，这个页签先给明确说明而不是空白 */
const MEDIA_HINT: Partial<Record<FavoriteKind, string>> = {
  video: '站内目前还没有视频内容。等院子支持发视频后，收藏的视频会出现在这里。',
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
    <div className="min-h-screen bg-primary/5" style={pageAccentVars('me')}>
      <div className="relative max-w-3xl mx-auto px-6 pt-10 pb-16">
        <Link
          href="/me"
          className="inline-flex items-center gap-1.5 text-sm text-[var(--accent-deep)] hover:text-[var(--accent-deep)] transition"
        >
          <Icon name="back" className="w-4 h-4" />
          返回我的
        </Link>

        <div className="mt-4 flex items-end justify-between">
          <div>
            <h1 className="text-3xl font-bold text-base-content">我的收藏</h1>
            <p className="text-sm text-[var(--accent-deep)] mt-1">
              {counts.all > 0 ? `一共收藏了 ${counts.all} 条` : '把心跳的瞬间藏进口袋里'}
            </p>
          </div>

          <button
            type="button"
            onClick={() => meId && void reload(meId)}
            className="inline-flex items-center gap-1.5 rounded-box border border-[var(--accent-soft)] bg-base-100 px-3 py-1.5 text-xs text-[var(--accent-deep)] hover:text-[var(--accent-deep)] transition"
          >
            <Icon name="refresh" className="w-3.5 h-3.5" />
            刷新
          </button>
        </div>

        {/* 分类页签 */}
        <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 border-b border-base-300">
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
                    ? 'border-b-2 border-primary text-[var(--accent-deep)] font-medium'
                    : 'text-[var(--accent-deep)] hover:text-base-content'
                }`}
              >
                {label}
                <span className="text-[11px] text-base-content/60">{counts[t]}</span>
              </button>
            )
          })}
        </div>

        {favorites.error && (
          <div className="mt-4 rounded-box border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
            {favorites.error}
          </div>
        )}

        {/* 视频 / 图片：站内暂无这类内容 */}
        {tab !== 'all' && MEDIA_HINT[tab] && (
          <p className="py-12 text-center text-xs leading-relaxed text-base-content/60">{MEDIA_HINT[tab]}</p>
        )}

        {loading && <SkeletonList count={2} lines={2} />}

        {!loading && !MEDIA_HINT[tab as FavoriteKind] && visible.length === 0 && !favorites.error && (
          <div>
            <EmptyState
              art="heart"
              title={tab === 'all' ? '口袋里还空着' : `还没有收藏的${FAVORITE_KIND_LABEL[tab as FavoriteKind]}`}
              hint="在院子里遇到心动的帖子，收进来就好。"
            />
            <Link
              href="/world"
              className="mt-5 inline-flex items-center gap-1.5 rounded-box bg-primary px-4 py-2 text-sm text-white hover:shadow-sm transition-all"
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
                className="rounded-box border border-base-300 bg-base-100 p-4 shadow-sm"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="rounded-full bg-primary/5 px-2 py-0.5 text-[11px] text-[var(--accent-deep)]">
                    {FAVORITE_KIND_LABEL[f.kind]}
                  </span>
                  {f.author_name && (
                    <span className="text-[11px] text-base-content/60 truncate">{f.author_name}</span>
                  )}
                  <span className="ml-auto flex-shrink-0 text-[11px] text-base-content/60">
                    收藏于 {formatTime(f.created_at)}
                  </span>
                </div>

                {/* 图片收藏：直接把图显示出来（target_id 就是图片地址） */}
                {isMediaFavorite(f.kind) && (
                  <a
                    href={f.target_id}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 mb-3 block overflow-hidden rounded-box border border-base-300"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={f.target_id} alt="" className="max-h-64 w-full object-cover" />
                  </a>
                )}

                {f.title && (
                  <p className="text-sm font-medium text-base-content mb-1 break-words">{f.title}</p>
                )}
                {f.content && (
                  <p className="text-xs text-base-content leading-relaxed whitespace-pre-wrap break-words">
                    {f.content.slice(0, 160)}
                    {f.content.length > 160 ? '…' : ''}
                  </p>
                )}

                <div className="mt-3 flex items-center gap-3">
                  {isMediaFavorite(f.kind) ? (
                    <a
                      href={f.target_id}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-[var(--accent-deep)] hover:underline"
                    >
                      打开原图 →
                    </a>
                  ) : (
                    <Link
                      href={favoriteHref(f.kind, f.target_id)}
                      className="text-xs text-[var(--accent-deep)] hover:underline"
                    >
                      查看原内容 →
                    </Link>
                  )}
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
                    className="ml-auto text-xs text-base-content/60 hover:text-red-500 transition disabled:opacity-50"
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
