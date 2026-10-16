'use client'

import { useEffect, useState } from 'react'
import { createClient } from '../../lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useFocusQuery } from '../../../components/use-focus-query'
import { useFavorites } from '../../../components/favorites'
import { useDeleteContent } from '../../../components/delete-content'
import { useBlocks } from '../../../components/blocks'
import { useEditContent } from '../../../components/edit-content'
import { HashtagList } from '../../../components/hashtags'
import { ImageGrid, ImagePicker } from '../../../components/media'
import { Icon } from '../../../components/icons'
import { EmojiPicker, useEmojiInsert } from '../../../components/emoji-picker'
import { SkeletonList } from '../../../components/skeleton'
import { EmptyState } from '../../../components/empty-state'
import {
  VISIBILITY_HINT,
  VISIBILITY_LABEL,
  VISIBILITY_ORDER,
  VISIBILITY_SHORT,
  canViewPost,
  expandGroupMembers,
  fetchAudienceMap,
  useFriendGroups,
  useFriendList,
  type Visibility,
} from '../../../components/visibility'
import { useTableRealtime } from '../../../components/realtime-table'

type Post = {
  id: string
  author_id: string
  content: string
  created_at: string
  author_name: string
  author_avatar: string | null
  visibility: string
  image_urls: string[] | null
}

export default function MomentsPage() {
  const [posts, setPosts] = useState<Post[]>([])
  const [content, setContent] = useState('')

  /** 发布框的表情插入（插到光标处） */
  const { ref: composerRef, insert: insertEmoji } = useEmojiInsert<HTMLTextAreaElement>(content, setContent)
  const [loading, setLoading] = useState(true)
  const [posting, setPosting] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  // 从搜索页精确跳转：/friends/moments?post=<id> → 高亮并滚到那条
  const focusPostId = useFocusQuery('post')

  // 收藏
  const favorites = useFavorites(userId)

  // 删除自己发的朋友圈（两步确认）
  const deleter = useDeleteContent(userId)

  // 拉黑：被拉黑（含拉黑我的）的动态不显示
  const blocks = useBlocks(userId)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  /* ---------- 举报朋友圈：可举报、可撤回 ---------- */
  const [reportedMoments, setReportedMoments] = useState<Set<string>>(new Set())

  /*
   * 实时：好友发了新动态，当场出现在这里。
   * 不写 filter —— postgres_changes 会按 RLS 过滤，收得到的都是我能看的。
   * 重载之后页面自己还会按可见性/分组再过一遍，所以不会露不该露的。
   */
  useTableRealtime(
    'moments-page',
    'friend_posts',
    () => {
      if (userId) void loadPosts(userId)
    },
    { enabled: Boolean(userId) },
  )

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    void (async () => {
      const { data, error } = await supabase
        .from('reports')
        .select('target_id')
        .eq('reporter_id', userId)
        .eq('target_type', 'friend_post')
        .eq('status', 'pending')
      if (cancelled) return
      if (error) {
        console.error('查询我的朋友圈举报失败:', error)
        return
      }
      setReportedMoments(new Set((data ?? []).map((r) => r.target_id)))
    })()
    return () => {
      cancelled = true
    }
    // supabase 是模块级单例，不必进依赖
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  async function handleReportMoment(momentId: string) {
    if (!userId) return
    const reason = window.prompt('举报这条动态的原因？（会发给站主看）')
    if (reason === null) return
    const text = reason.trim() || '未填写原因'
    const { error } = await supabase.from('reports').insert({
      reporter_id: userId,
      target_type: 'friend_post',
      target_id: momentId,
      reason: text,
      status: 'pending',
    })
    if (error) {
      alert('举报失败：' + error.message)
      return
    }
    setReportedMoments((prev) => new Set(prev).add(momentId))
    alert('已收到，谢谢你的反馈。误报可以在同一条动态上点「撤回举报」。')
  }

  async function handleWithdrawMomentReport(momentId: string) {
    if (!userId) return
    const { error } = await supabase
      .from('reports')
      .delete()
      .eq('reporter_id', userId)
      .eq('target_type', 'friend_post')
      .eq('target_id', momentId)
    if (error) {
      alert('撤回失败：' + error.message)
      return
    }
    setReportedMoments((prev) => {
      const next = new Set(prev)
      next.delete(momentId)
      return next
    })
  }

  /* ---------- 可见范围 ---------- */
  const [visibility, setVisibility] = useState<Visibility>('public')
  const [selectedFriends, setSelectedFriends] = useState<string[]>([])
  const [selectedGroups, setSelectedGroups] = useState<string[]>([])
  const [showPicker, setShowPicker] = useState(false)
  const [audienceMap, setAudienceMap] = useState<Map<string, Set<string>>>(new Map())
  const [imageUrls, setImageUrls] = useState<string[]>([])

  const { friends } = useFriendList(userId)
  const { groups } = useFriendGroups(userId)

  /* ---------- 编辑已发的动态 ---------- */
  const editor = useEditContent(userId)

  async function handleSaveMoment(postId: string) {
    const text = editor.draft.trim()
    const result = await editor.save('moment', postId, text)
    if (!result.ok) {
      alert('保存失败：' + (result.message ?? '未知错误'))
      return
    }
    setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, content: text } : p)))
  }

  async function handleDeleteMoment(momentId: string, authorId: string) {
    const result = await deleter.deleteMoment(momentId, authorId)
    setConfirmDelete(null)
    if (!result.ok) alert('删除失败：' + (result.message ?? '未知错误'))
  }

  useEffect(() => {
    if (!focusPostId) return
    const frame = window.requestAnimationFrame(() => {
      const el = document.querySelector(`[data-moment-id="${focusPostId}"]`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [focusPostId, posts])

  useEffect(() => {
    // 同 chat 页：init 定义在组件内，加进依赖会变成每次渲染都重取；
    // 这里只在挂载时拉一次。
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function init() {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      router.push('/login')
      return
    }
    setUserId(userData.user.id)
    await loadPosts(userData.user.id)
    setLoading(false)
  }

  async function loadPosts(uid: string) {
    const { data: friendships } = await supabase
      .from('friendships')
      .select('requester_id, addressee_id')
      .or(`requester_id.eq.${uid},addressee_id.eq.${uid}`)
      .eq('status', 'accepted')

    const friendIds: string[] = []
    if (friendships) {
      friendships.forEach((f) => {
        friendIds.push(f.requester_id === uid ? f.addressee_id : f.requester_id)
      })
    }

    const allowedIds = [uid, ...friendIds]

    const { data: postsData } = await supabase
      .from('friend_posts')
      .select('id, author_id, content, created_at, visibility, image_urls')
      .in('author_id', allowedIds)
      .order('created_at', { ascending: false })
      .limit(50)

    if (!postsData) {
      setPosts([])
      return
    }

    // 拉取"部分好友/分组可见"的名单，用于过滤别人的动态
    const audience = await fetchAudienceMap(
      postsData.filter((p) => p.author_id !== uid).map((p) => p.id),
    )
    setAudienceMap(audience)

    const authorIds = [...new Set(postsData.map((p) => p.author_id))]
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, username, nickname, avatar_url')
      .in('id', authorIds)

    const list: Post[] = postsData.map((p) => {
      const prof = profilesData?.find((x) => x.id === p.author_id)
      return {
        id: p.id,
        author_id: p.author_id,
        content: p.content,
        created_at: p.created_at,
        author_name: prof?.nickname || prof?.username || '某人',
        author_avatar: prof?.avatar_url || null,
        visibility: p.visibility ?? 'public',
        image_urls: (p.image_urls as string[] | null) ?? null,
      }
    })

    setPosts(list)
  }

  async function handlePost(e: React.FormEvent) {
    e.preventDefault()
    if (!content.trim() || !userId) return

    // 分组可见 → 把组内成员展开成具体名单（发布时快照）
    const audienceIds =
      visibility === 'friends'
        ? selectedFriends
        : visibility === 'groups'
          ? expandGroupMembers(groups, selectedGroups)
          : []

    if ((visibility === 'friends' || visibility === 'groups') && audienceIds.length === 0) {
      alert('还没选人，这条动态谁都看不到。先选好友或分组，或者改成其他可见范围。')
      return
    }

    setPosting(true)
    try {
      const { data: created, error } = await supabase
        .from('friend_posts')
        .insert({
          author_id: userId,
          content: content.trim(),
          visibility,
          image_urls: imageUrls.length > 0 ? imageUrls : null,
        })
        .select('id')
        .single()

      if (error) throw error

      if (created && audienceIds.length > 0) {
        const { error: audienceError } = await supabase
          .from('friend_post_audience')
          .insert(audienceIds.map((friend_id) => ({ post_id: created.id, friend_id })))
        if (audienceError) throw audienceError
      }

      setContent('')
      setVisibility('public')
      setSelectedFriends([])
      setSelectedGroups([])
      setShowPicker(false)
      setImageUrls([])
      await loadPosts(userId)
    } catch (err) {
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: unknown }).message)
          : String(err)
      alert('发布失败：' + msg)
    } finally {
      setPosting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-base-100 px-6 pt-24">
        <div className="mx-auto max-w-2xl">
          <SkeletonList count={2} lines={3} />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* 背景光晕 */}

      <div className="relative max-w-xl mx-auto px-6 py-10">
        <header className="mb-6">
          <Link href="/friends" className="text-sm text-base-content/60 hover:text-primary transition">
            ← 返回小屋
          </Link>
          <h1 className="text-3xl font-bold text-base-content mt-2">朋友圈</h1>
          <p className="text-sm text-base-content/60 mt-1">只有好友看得到</p>

          {/* 标签切换 */}
          <div className="flex gap-6 mt-5 ">
            <Link
              href="/friends"
              className="pb-2.5 text-base-content/60 hover:text-base-content text-sm transition"
            >
              好友
            </Link>
            <span className="pb-2.5 border-b-2 border-primary text-primary font-medium text-sm">
              朋友圈
            </span>
          </div>
        </header>

        <main className="space-y-5">
          {/* 发布区 */}
          <form
            onSubmit={handlePost}
            className="card rounded-box border border-base-300 bg-base-100 p-5 shadow-sm relative overflow-hidden"
          >

            <div className="relative">
              <textarea
                ref={composerRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="说点什么… 用 #话题# 加标签，也可以发个表情"
                rows={3}
                className="card w-full px-4 py-3 rounded-box border border-base-300 bg-base-100 text-sm text-base-content resize-none focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition placeholder:text-base-content/40"
                maxLength={500}
              />
              {/* 图片：本地上传或粘贴链接 */}
              <ImagePicker
                userId={userId}
                urls={imageUrls}
                onChange={setImageUrls}
                disabled={posting}
              />

              {/* 谁可以看 */}
              <div className="mt-3">
                <div className="flex flex-wrap gap-2">
                  {VISIBILITY_ORDER.map((v) => {
                    const active = visibility === v
                    return (
                      <button
                        key={v}
                        type="button"
                        onClick={() => {
                          setVisibility(v)
                          setShowPicker(v === 'friends' || v === 'groups')
                        }}
                        className={`rounded-full px-3 py-1 text-[11px] transition ${
                          active
                            ? 'bg-primary text-primary-content'
                            : 'border border-base-300 bg-base-100 text-base-content/60 hover:border-base-300'
                        }`}
                      >
                        {VISIBILITY_LABEL[v]}
                      </button>
                    )
                  })}
                </div>

                <p className="text-[11px] text-base-content/40 mt-2">{VISIBILITY_HINT[visibility]}</p>

                {showPicker && visibility === 'friends' && (
                  <div data-lenis-prevent className="card mt-2 max-h-40 overflow-y-auto rounded-box border border-base-300 bg-base-100 p-3">
                    {friends.length === 0 ? (
                      <p className="text-[11px] text-base-content/40">还没有好友，先去加几个吧。</p>
                    ) : (
                      friends.map((f) => (
                        <label
                          key={f.id}
                          className="flex cursor-pointer items-center gap-2 py-1 text-xs text-base-content"
                        >
                          <input
                            type="checkbox"
                            checked={selectedFriends.includes(f.id)}
                            onChange={(e) =>
                              setSelectedFriends((prev) =>
                                e.target.checked ? [...prev, f.id] : prev.filter((id) => id !== f.id),
                              )
                            }
                            className="accent-[#d97757]"
                          />
                          <span className="truncate">{f.name}</span>
                        </label>
                      ))
                    )}
                  </div>
                )}

                {showPicker && visibility === 'groups' && (
                  <div className="card mt-2 rounded-box border border-base-300 bg-base-100 p-3">
                    {groups.length === 0 ? (
                      <p className="text-[11px] leading-relaxed text-base-content/40">
                        还没有分组。去{' '}
                        <Link href="/me/settings" className="text-primary underline">
                          设置
                        </Link>{' '}
                        里建一个，再把好友放进去。
                      </p>
                    ) : (
                      groups.map((g) => (
                        <label
                          key={g.id}
                          className="flex cursor-pointer items-center gap-2 py-1 text-xs text-base-content"
                        >
                          <input
                            type="checkbox"
                            checked={selectedGroups.includes(g.id)}
                            onChange={(e) =>
                              setSelectedGroups((prev) =>
                                e.target.checked ? [...prev, g.id] : prev.filter((id) => id !== g.id),
                              )
                            }
                            className="accent-[#d97757]"
                          />
                          <span className="truncate">{g.name}</span>
                          <span className="text-[11px] text-base-content/40">{g.memberIds.length} 人</span>
                        </label>
                      ))
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 mt-3">
                <EmojiPicker onPick={insertEmoji} align="right" />
                <button
                  type="submit"
                  disabled={posting || !content.trim()}
                  className="bg-primary px-6 py-2 rounded-box text-primary-content text-sm font-medium hover:shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {posting ? '发布中...' : '发布'}
                </button>
              </div>
            </div>
          </form>

          {/* 帖子列表 */}
          <div className="space-y-3">
            {posts.length === 0 ? (
              <div className="card rounded-box border border-base-300 bg-base-100/60 backdrop-blur">
                <EmptyState art="heart" title="还没有内容" hint="写第一条吧。" />
              </div>
            ) : (
              posts
                .filter((p) => deleter.momentVisible(p))
                .filter((p) => !blocks.hiddenIds.has(p.author_id))
                .filter((p) => canViewPost(p, userId, audienceMap))
                .map((post) => (
                <div
                  key={post.id}
                  data-moment-id={post.id}
                  className={`card rounded-box border bg-base-100 p-5 shadow-sm relative overflow-hidden transition ${
                    focusPostId === post.id
                      ? 'border-primary ring-2 ring-primary/25'
                      : 'border-base-300'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-box bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center overflow-hidden flex-shrink-0 shadow-sm">
                      {post.author_avatar ? (
                        // 头像尺寸固定、来自 Supabase 存储，不值得为它引 next/image 的远程域名配置
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={post.author_avatar} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-sm text-primary font-semibold">
                          {post.author_name[0]}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-base-content">{post.author_name}</p>
                      <p className="text-[11px] text-base-content/40 mt-0.5">
                        {new Date(post.created_at).toLocaleString('zh-CN', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                        {/* 自己的动态标出可见范围 */}
                        {post.author_id === userId && post.visibility !== 'public' && (
                          <span className="ml-2 rounded-full bg-base-200 px-1.5 py-0.5 text-[11px] text-primary">
                            {VISIBILITY_SHORT[(post.visibility ?? 'public') as Visibility]}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  {editor.isEditing('moment', post.id) ? (
                    <div className="pl-1">
                      <textarea
                        value={editor.draft}
                        onChange={(e) => editor.setDraft(e.target.value)}
                        rows={3}
                        maxLength={editor.maxLength.moment}
                        autoFocus
                        className="card w-full rounded-box border border-base-300 bg-base-100 px-3 py-2 text-sm text-base-content resize-none focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition"
                      />
                      <div className="mt-2 flex items-center gap-3">
                        <button
                          type="button"
                          disabled={editor.isBusy('moment', post.id)}
                          onClick={() => void handleSaveMoment(post.id)}
                          className="rounded-lg bg-primary px-3 py-1 text-xs text-primary-content hover:bg-primary transition disabled:opacity-50"
                        >
                          {editor.isBusy('moment', post.id) ? '保存中…' : '保存'}
                        </button>
                        <button
                          type="button"
                          onClick={() => editor.cancel()}
                          className="rounded-lg border border-base-300 px-3 py-1 text-xs text-base-content/60 transition"
                        >
                          取消
                        </button>
                        <span className="ml-auto text-[11px] text-base-content/40">
                          {editor.draft.length}/{editor.maxLength.moment}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-base-content whitespace-pre-wrap break-words leading-relaxed pl-1">
                      {post.content}
                      {editor.wasSaved('moment', post.id) && (
                        <span className="ml-2 text-[11px] text-base-content/60">已保存</span>
                      )}
                    </p>
                  )}

                  <HashtagList
                    content={post.content}
                    className="mt-2 pl-1"
                    chipClassName="rounded-full bg-base-100 px-2 py-0.5 text-[11px] text-primary hover:bg-base-200 transition"
                  />

                  {/* 图片墙 */}
                  <ImageGrid urls={post.image_urls} className="mt-3 pl-1" />

                  {/* 收藏 / 删除自己发的 */}
                  <div className="mt-3 pt-3  flex items-center justify-end gap-4">
                    {editor.canEdit(post.author_id) && !editor.isEditing('moment', post.id) && (
                      <button
                        type="button"
                        onClick={() => editor.start('moment', post.id, post.content)}
                        className="flex items-center gap-1.5 text-xs text-base-content/40 hover:text-primary transition"
                      >
                        <Icon name="pen" className="w-3.5 h-3.5" />
                        编辑
                      </button>
                    )}
                    {deleter.canDelete(post.author_id) && (
                      confirmDelete === post.id ? (
                        <button
                          type="button"
                          disabled={deleter.busyId === post.id}
                          onClick={() => void handleDeleteMoment(post.id, post.author_id)}
                          className="flex items-center gap-1.5 text-xs text-red-500 hover:underline disabled:opacity-50"
                        >
                          <Icon name="trash" className="w-3.5 h-3.5" />
                          {deleter.busyId === post.id ? '删除中…' : '确认删除'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setConfirmDelete(post.id)
                            window.setTimeout(
                              () => setConfirmDelete((cur) => (cur === post.id ? null : cur)),
                              4000,
                            )
                          }}
                          className="flex items-center gap-1.5 text-xs text-base-content/40 hover:text-red-500 transition"
                        >
                          <Icon name="trash" className="w-3.5 h-3.5" />
                          删除
                        </button>
                      )
                    )}
                    {post.author_id !== userId && (
                      <button
                        type="button"
                        onClick={() =>
                          reportedMoments.has(post.id)
                            ? void handleWithdrawMomentReport(post.id)
                            : void handleReportMoment(post.id)
                        }
                        className="flex items-center gap-1.5 text-xs text-base-content/40 transition hover:text-primary"
                        title={reportedMoments.has(post.id) ? '撤回举报' : '举报'}
                      >
                        <Icon name="shield" className="w-3.5 h-3.5" />
                        {reportedMoments.has(post.id) ? '已举报' : '举报'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        void favorites.toggle({
                          kind: 'moment',
                          targetId: post.id,
                          content: post.content,
                          authorName: post.author_name,
                        })
                      }
                      disabled={favorites.busyKey === `moment:${post.id}`}
                      className={`flex items-center gap-1.5 text-xs transition disabled:opacity-50 ${
                        favorites.isFavorited('moment', post.id)
                          ? 'text-primary'
                          : 'text-base-content/40 hover:text-primary'
                      }`}
                    >
                      <Icon name={favorites.isFavorited('moment', post.id) ? 'heartfill' : 'heart'} className="w-3.5 h-3.5" />
                      {favorites.isFavorited('moment', post.id) ? '已收藏' : '收藏'}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </main>
      </div>
    </div>
  )
}