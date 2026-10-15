'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '../app/lib/supabase'

/**
 * 收藏（我的收藏）
 *
 * 表：public.user_favorites（见项目根目录 supabase-favorites.sql）
 *   kind: world_post | play_activity | moment | video | image
 *   同一用户 + 同一对象只能收藏一次；收藏时存下内容快照，
 *   这样原内容被删除后收藏页仍然显示得出来。
 */

const supabase = createClient()

export type FavoriteKind = 'world_post' | 'play_activity' | 'moment' | 'video' | 'image'

export type FavoriteItem = {
  id: string
  kind: FavoriteKind
  target_id: string
  title: string | null
  content: string | null
  author_name: string | null
  created_at: string
}

export type FavoriteInput = {
  kind: FavoriteKind
  targetId: string
  title?: string | null
  content?: string | null
  authorName?: string | null
}

export const FAVORITE_KIND_LABEL: Record<FavoriteKind, string> = {
  world_post: '帖子',
  play_activity: '活动',
  moment: '朋友圈',
  video: '视频',
  image: '图片',
}

const keyOf = (kind: FavoriteKind, targetId: string) => `${kind}:${targetId}`

/** 每个收藏对应的跳转地址 */
export function favoriteHref(kind: FavoriteKind, targetId: string): string {
  if (kind === 'world_post') return `/world?post=${targetId}`
  if (kind === 'play_activity') return `/play?activity=${targetId}`
  if (kind === 'moment') return `/friends/moments?post=${targetId}`
  return '/me/favorites'
}

export function useFavorites(userId: string | null) {
  const [items, setItems] = useState<FavoriteItem[]>([])
  const [keys, setKeys] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [busyKey, setBusyKey] = useState<string | null>(null)

  const load = useCallback(async (uid: string) => {
    setLoading(true)
    try {
      const { data, error: queryError } = await supabase
        .from('user_favorites')
        .select('id, kind, target_id, title, content, author_name, created_at')
        .eq('user_id', uid)
        .order('created_at', { ascending: false })

      if (queryError) throw queryError

      const list = (data ?? []) as unknown as FavoriteItem[]
      setItems(list)
      setKeys(new Set(list.map((f) => keyOf(f.kind, f.target_id))))
      setError('')
    } catch (err) {
      console.error('加载收藏失败:', err)
      setError('收藏加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!userId) {
      const frame = window.requestAnimationFrame(() => {
        setItems([])
        setKeys(new Set())
      })
      return () => window.cancelAnimationFrame(frame)
    }
    const frame = window.requestAnimationFrame(() => void load(userId))
    return () => window.cancelAnimationFrame(frame)
  }, [userId, load])

  const isFavorited = useCallback(
    (kind: FavoriteKind, targetId: string) => keys.has(keyOf(kind, targetId)),
    [keys],
  )

  /** 已收藏则取消，未收藏则添加；返回操作后的状态 */
  const toggle = useCallback(
    async (input: FavoriteInput): Promise<boolean> => {
      if (!userId) return false
      const key = keyOf(input.kind, input.targetId)
      const wasFavorited = keys.has(key)

      setBusyKey(key)
      // 乐观更新
      setKeys((prev) => {
        const next = new Set(prev)
        if (wasFavorited) next.delete(key)
        else next.add(key)
        return next
      })

      try {
        if (wasFavorited) {
          const { error: delError } = await supabase
            .from('user_favorites')
            .delete()
            .eq('user_id', userId)
            .eq('kind', input.kind)
            .eq('target_id', input.targetId)
          if (delError) throw delError
          setItems((prev) => prev.filter((f) => keyOf(f.kind, f.target_id) !== key))
        } else {
          const { data, error: insError } = await supabase
            .from('user_favorites')
            .insert({
              user_id: userId,
              kind: input.kind,
              target_id: input.targetId,
              title: input.title ?? null,
              content: input.content ?? null,
              author_name: input.authorName ?? null,
            })
            .select('id, kind, target_id, title, content, author_name, created_at')
            .single()
          if (insError) throw insError
          setItems((prev) => [data as unknown as FavoriteItem, ...prev])
        }
        return !wasFavorited
      } catch (err) {
        console.error('收藏操作失败:', err)
        // 回滚
        setKeys((prev) => {
          const next = new Set(prev)
          if (wasFavorited) next.add(key)
          else next.delete(key)
          return next
        })
        setError('收藏操作失败，请稍后重试')
        return wasFavorited
      } finally {
        setBusyKey(null)
      }
    },
    [userId, keys],
  )

  return { items, loading, error, busyKey, isFavorited, toggle, reload: load }
}
