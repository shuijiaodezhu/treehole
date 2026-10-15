'use client'

import { useCallback, useMemo, useState } from 'react'
import { createClient } from '../app/lib/supabase'

/**
 * 「自己发的，现在能删」
 *
 * 删除策略按表结构决定（探明结果）：
 *   世界帖子 world_posts        → 有 status 列，软删（status = 'removed'）
 *   世界评论 world_comments     → 没有 status 列；评论树是内存里拼的，
 *                                 所以「软删」= 只记在本地集合里、页面立刻不显示；
 *                                 同时可选硬删，删之前先把它的子回复一起删掉（避免外键挡住）
 *   朋友圈 friend_posts         → 没有 status 列，硬删
 *   聚会活动 play_activities    → 硬删；先清 play_signups 与 reports 再删主表
 *
 * 另外：只有「我发的」才渲染删除按钮（由调用方用 canDelete 判断）。
 */

const supabase = createClient()

export type DeleteResult = { ok: boolean; message?: string }

/** 取错误对象里的可读信息 */
function errText(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err) {
    const m = (err as { message?: unknown }).message
    if (typeof m === 'string') return m
  }
  return String(err)
}

export function useDeleteContent(meId: string | null) {
  /** 本地已删除的集合：立刻从界面上拿掉，不等重新拉取 */
  const [deletedPosts, setDeletedPosts] = useState<Set<string>>(new Set())
  const [deletedComments, setDeletedComments] = useState<Set<string>>(new Set())
  const [deletedMoments, setDeletedMoments] = useState<Set<string>>(new Set())
  const [deletedActivities, setDeletedActivities] = useState<Set<string>>(new Set())
  const [busyId, setBusyId] = useState<string | null>(null)

  const canDelete = useCallback(
    (authorId: string | null | undefined) => Boolean(meId && authorId && authorId === meId),
    [meId],
  )

  /* ---------- 世界帖子：软删 ---------- */
  const deletePost = useCallback(
    async (postId: string, authorId: string): Promise<DeleteResult> => {
      if (!meId || authorId !== meId) return { ok: false, message: '只能删自己发的' }
      setBusyId(postId)
      try {
        const { error } = await supabase
          .from('world_posts')
          .update({ status: 'removed' })
          .eq('id', postId)
          .eq('author_id', meId) // 双保险：即使策略宽松也不会误删别人的
        if (error) throw error
        setDeletedPosts((prev) => new Set(prev).add(postId))
        return { ok: true }
      } catch (err) {
        console.error('删除帖子失败:', err)
        return { ok: false, message: errText(err) }
      } finally {
        setBusyId(null)
      }
    },
    [meId],
  )

  /* ---------- 世界评论：先删子回复，再删自己 ---------- */
  const deleteComment = useCallback(
    async (commentId: string, authorId: string): Promise<DeleteResult> => {
      if (!meId || authorId !== meId) return { ok: false, message: '只能删自己发的' }
      setBusyId(commentId)
      try {
        // 找到所有以它为父的回复（可能不止一层），先删子再删父
        const { data: children, error: childQueryError } = await supabase
          .from('world_comments')
          .select('id')
          .eq('parent_id', commentId)
        if (childQueryError) throw childQueryError

        const childIds = (children ?? []).map((c) => c.id)
        if (childIds.length > 0) {
          const { error: childDeleteError } = await supabase
            .from('world_comments')
            .delete()
            .in('id', childIds)
          if (childDeleteError) throw childDeleteError
        }

        const { error } = await supabase
          .from('world_comments')
          .delete()
          .eq('id', commentId)
          .eq('author_id', meId)
        if (error) throw error

        setDeletedComments((prev) => {
          const next = new Set(prev)
          next.add(commentId)
          for (const id of childIds) next.add(id)
          return next
        })
        return { ok: true }
      } catch (err) {
        console.error('删除评论失败:', err)
        return { ok: false, message: errText(err) }
      } finally {
        setBusyId(null)
      }
    },
    [meId],
  )

  /* ---------- 朋友圈：硬删（连带点赞与评论） ---------- */
  const deleteMoment = useCallback(
    async (momentId: string, authorId: string): Promise<DeleteResult> => {
      if (!meId || authorId !== meId) return { ok: false, message: '只能删自己发的' }
      setBusyId(momentId)
      try {
        // 先清关联，避免外键挡住
        await supabase.from('friend_likes').delete().eq('post_id', momentId)
        await supabase.from('friend_comments').delete().eq('post_id', momentId)

        const { error } = await supabase
          .from('friend_posts')
          .delete()
          .eq('id', momentId)
          .eq('author_id', meId)
        if (error) throw error

        setDeletedMoments((prev) => new Set(prev).add(momentId))
        return { ok: true }
      } catch (err) {
        console.error('删除朋友圈失败:', err)
        return { ok: false, message: errText(err) }
      } finally {
        setBusyId(null)
      }
    },
    [meId],
  )

  /* ---------- 聚会活动：硬删（连带报名与举报） ---------- */
  const deleteActivity = useCallback(
    async (activityId: string, authorId: string): Promise<DeleteResult> => {
      if (!meId || authorId !== meId) return { ok: false, message: '只能删自己发的' }
      setBusyId(activityId)
      try {
        await supabase.from('play_signups').delete().eq('activity_id', activityId)
        await supabase.from('reports').delete().eq('target_type', 'play_activity').eq('target_id', activityId)

        const { error } = await supabase
          .from('play_activities')
          .delete()
          .eq('id', activityId)
          .eq('author_id', meId)
        if (error) throw error

        setDeletedActivities((prev) => new Set(prev).add(activityId))
        return { ok: true }
      } catch (err) {
        console.error('删除活动失败:', err)
        return { ok: false, message: errText(err) }
      } finally {
        setBusyId(null)
      }
    },
    [meId],
  )

  /* ---------- 过滤工具：立刻从列表里剔除已删的 ---------- */
  const postVisible = useCallback(
    <T extends { id: string }>(post: T) => !deletedPosts.has(post.id),
    [deletedPosts],
  )

  const commentVisible = useCallback(
    (commentId: string) => !deletedComments.has(commentId),
    [deletedComments],
  )

  const momentVisible = useCallback(
    <T extends { id: string }>(moment: T) => !deletedMoments.has(moment.id),
    [deletedMoments],
  )

  const activityVisible = useCallback(
    <T extends { id: string }>(activity: T) => !deletedActivities.has(activity.id),
    [deletedActivities],
  )

  return useMemo(
    () => ({
      busyId,
      canDelete,
      deletePost,
      deleteComment,
      deleteMoment,
      deleteActivity,
      postVisible,
      commentVisible,
      momentVisible,
      activityVisible,
      deletedComments,
    }),
    [
      busyId,
      canDelete,
      deletePost,
      deleteComment,
      deleteMoment,
      deleteActivity,
      postVisible,
      commentVisible,
      momentVisible,
      activityVisible,
      deletedComments,
    ],
  )
}
