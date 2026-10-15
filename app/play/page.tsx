'use client'
/* eslint-disable @next/next/no-img-element -- 头像用原生 img 即可，尺寸固定 */
/* eslint-disable react-hooks/set-state-in-effect -- 规则未识别 async 取数（init/loadActivities），此处是纯客户端页面 */

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '../lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { writeSeenAt } from '../../components/module-badges'
import { useFocusQuery } from '../../components/use-focus-query'
import { useFavorites } from '../../components/favorites'
import { useDeleteContent } from '../../components/delete-content'
import { useBlocks } from '../../components/blocks'
import { pageAccentVars } from '../../components/theme'
import { SkeletonList } from '../../components/skeleton'
import { EmptyState } from '../../components/empty-state'
import { EmojiPicker, useEmojiInsert } from '../../components/emoji-picker'
import { MiniTools } from '../../components/mini-tools'
import { MusicRoom } from '../../components/music-room'

// 客户端提到模块级，保证引用稳定
const supabase = createClient()

// ⚠️ 换成你自己的站主 UUID
const ADMIN_UUID = 'b59a31c7-60f8-4b57-924a-b408cbfd910c'

type PlayType = { id: string; name: string; icon: string | null; sort_order: number; created_by: string | null }
type Signup = { user_id: string; user_name: string; user_avatar: string | null }
type Activity = {
  id: string
  author_id: string
  type_id: string | null
  title: string
  content: string | null
  activity_time: string | null
  max_people: number
  created_at: string
  author_name: string
  author_avatar: string | null
  type_name: string | null
  type_icon: string | null
  signups: Signup[]
}

function Icon({ name, className = '' }: { name: string; className?: string }) {
  const c = { className, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  switch (name) {
    case 'back': return <svg {...c}><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>
    case 'plus': return <svg {...c} strokeWidth={2}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
    case 'clock': return <svg {...c}><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15 15" /></svg>
    case 'users': return <svg {...c}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
    case 'dice': return <svg {...c}><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="8" cy="8" r="1" fill="currentColor" /><circle cx="16" cy="8" r="1" fill="currentColor" /><circle cx="8" cy="16" r="1" fill="currentColor" /><circle cx="16" cy="16" r="1" fill="currentColor" /><circle cx="12" cy="12" r="1" fill="currentColor" /></svg>
    case 'coin': return <svg {...c}><circle cx="12" cy="12" r="9" /><path d="M12 7v10M9 9h4.5a2 2 0 0 1 0 4H9M9 13h4.5a2 2 0 0 1 0 4H9" /></svg>
    case 'target': return <svg {...c}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" fill="currentColor" /></svg>
    case 'sparkle': return <svg {...c}><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" /><circle cx="12" cy="12" r="3" /></svg>
    case 'alert': return <svg {...c}><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
    case 'x': return <svg {...c}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
    default: return null
  }
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export default function PlayPage() {
  const [tab, setTab] = useState<'activities' | 'minigames'>('activities')
  const [types, setTypes] = useState<PlayType[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [meId, setMeId] = useState<string | null>(null)
  const [currentType, setCurrentType] = useState<PlayType | null>(null)

  const [showPostModal, setShowPostModal] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newContent, setNewContent] = useState('')
  /** 活动描述的表情插入（插到光标处） */
  const { ref: activityRef, insert: insertActivityEmoji } = useEmojiInsert<HTMLTextAreaElement>(newContent, setNewContent)
  const [newTime, setNewTime] = useState('')
  const [newMaxPeople, setNewMaxPeople] = useState(5)
  const [newTypeId, setNewTypeId] = useState('')
  const [posting, setPosting] = useState(false)

  const [showNewTypeModal, setShowNewTypeModal] = useState(false)
  const [newTypeName, setNewTypeName] = useState('')
  const [creatingType, setCreatingType] = useState(false)
  const [createTypeMessage, setCreateTypeMessage] = useState('')

  const [detailActivity, setDetailActivity] = useState<Activity | null>(null)

  const [showReportModal, setShowReportModal] = useState(false)
  const [reportReason, setReportReason] = useState('')
  const [reporting, setReporting] = useState(false)
  const [reportMessage, setReportMessage] = useState('')

  const [signingUp, setSigningUp] = useState<string | null>(null)

  const router = useRouter()

  // 先声明 init，再让 useEffect 调用（修复 "accessed before it is declared"）
  const init = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) { router.push('/login'); return }
    setMeId(userData.user.id)

    const { data: typeData } = await supabase
      .from('play_types')
      .select('id, name, icon, sort_order, created_by')
      .eq('status', 'approved')
      .order('sort_order', { ascending: true })

    setTypes((typeData || []) as PlayType[])
    setLoading(false)
  }, [router])

  const loadActivities = useCallback(async (typeId: string | null) => {
    let query = supabase
      .from('play_activities')
      .select('id, author_id, type_id, title, content, activity_time, max_people, created_at')
      .eq('status', 'published')
      .order('created_at', { ascending: false })
      .limit(50)

    if (typeId) query = query.eq('type_id', typeId)

    const { data: actData } = await query
    if (!actData || actData.length === 0) { setActivities([]); return }

    const actIds = actData.map((a) => a.id)
    const authorIds = [...new Set(actData.map((a) => a.author_id))]

    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, nickname, username, avatar_url')
      .in('id', authorIds)

    const { data: signupData } = await supabase
      .from('play_signups')
      .select('activity_id, user_id, created_at')
      .in('activity_id', actIds)
      .order('created_at', { ascending: true })

    const signupUserIds = signupData ? [...new Set(signupData.map((s) => s.user_id))] : []
    const { data: signupProfiles } = await supabase
      .from('profiles')
      .select('id, nickname, username, avatar_url')
      .in('id', signupUserIds.length > 0 ? signupUserIds : ['00000000-0000-0000-0000-000000000000'])

    const list: Activity[] = actData.map((a) => {
      const prof = profilesData?.find((x) => x.id === a.author_id)
      const type = types.find((t) => t.id === a.type_id)
      const activitySignups: Signup[] = (signupData || [])
        .filter((s) => s.activity_id === a.id)
        .map((s) => {
          const p = signupProfiles?.find((x) => x.id === s.user_id)
          return {
            user_id: s.user_id,
            user_name: p?.nickname || p?.username || '某人',
            user_avatar: p?.avatar_url || null,
          }
        })

      return {
        id: a.id,
        author_id: a.author_id,
        type_id: a.type_id,
        title: a.title,
        content: a.content,
        activity_time: a.activity_time,
        max_people: a.max_people,
        created_at: a.created_at,
        author_name: prof?.nickname || prof?.username || '某人',
        author_avatar: prof?.avatar_url || null,
        type_name: type?.name || null,
        type_icon: type?.icon || null,
        signups: activitySignups,
      }
    })

    setActivities(list)
  }, [types])

  useEffect(() => { init() }, [init])

  // 进页面就算看过：主页聚会卡片上的点随即消失
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => writeSeenAt('play', new Date().toISOString()))
    return () => window.cancelAnimationFrame(frame)
  }, [])

  useEffect(() => {
    if (meId) loadActivities(currentType?.id || null)
  }, [currentType, meId, loadActivities])

  /* ---------- 从搜索页精确跳转：/play?activity=<id> ---------- */
  const focusActivityId = useFocusQuery('activity')
  const [focusMissing, setFocusMissing] = useState(false)

  // 收藏
  const favorites = useFavorites(meId)

  // 删除自己发起的活动（两步确认）
  const deleter = useDeleteContent(meId)

  // 拉黑：被拉黑（含拉黑我的）发起的活动不显示
  const blocks = useBlocks(meId)
  const [confirmDeleteActivity, setConfirmDeleteActivity] = useState<string | null>(null)

  async function handleDeleteActivity(activityId: string, authorId: string) {
    const result = await deleter.deleteActivity(activityId, authorId)
    setConfirmDeleteActivity(null)
    if (!result.ok) {
      alert('删除失败：' + (result.message ?? '未知错误'))
      return
    }
    if (detailActivity?.id === activityId) setDetailActivity(null)
  }

  useEffect(() => {
    if (!focusActivityId) return
    let cancelled = false

    const run = async () => {
      try {
        const { data, error } = await supabase
          .from('play_activities')
          .select('id, author_id, type_id, title, content, activity_time, max_people, created_at')
          .eq('id', focusActivityId)
          .eq('status', 'published')
          .maybeSingle()

        if (error) throw error
        if (cancelled) return

        if (!data) {
          setFocusMissing(true)
          return
        }

        const [authorRes, typeRes, signupRes] = await Promise.all([
          supabase.from('profiles').select('id, nickname, username, avatar_url').eq('id', data.author_id).maybeSingle(),
          data.type_id
            ? supabase.from('play_types').select('id, name, icon').eq('id', data.type_id).maybeSingle()
            : Promise.resolve({ data: null }),
          supabase
            .from('play_signups')
            .select('activity_id, user_id, created_at')
            .eq('activity_id', data.id)
            .order('created_at', { ascending: true }),
        ])

        if (cancelled) return

        const signupRows = signupRes.data ?? []
        const signupUserIds = [...new Set(signupRows.map((s) => s.user_id))]
        const { data: signupProfiles } = signupUserIds.length
          ? await supabase.from('profiles').select('id, nickname, username, avatar_url').in('id', signupUserIds)
          : { data: [] as { id: string; nickname: string | null; username: string | null; avatar_url: string | null }[] }

        if (cancelled) return

        const profileOf = (uid: string) =>
          (signupProfiles ?? []).find((p) => p.id === uid) ??
          (authorRes.data && authorRes.data.id === uid ? authorRes.data : null)

        const signups: Signup[] = signupRows.map((s) => {
          const p = profileOf(s.user_id)
          return {
            user_id: s.user_id,
            user_name: p?.nickname || p?.username || '某人',
            user_avatar: p?.avatar_url || null,
          }
        })

        const author = authorRes.data
        setFocusMissing(false)
        setDetailActivity({
          id: data.id,
          author_id: data.author_id,
          type_id: data.type_id,
          title: data.title,
          content: data.content,
          activity_time: data.activity_time,
          max_people: data.max_people,
          created_at: data.created_at,
          author_name: author?.nickname || author?.username || '某人',
          author_avatar: author?.avatar_url || null,
          type_name: typeRes.data?.name || null,
          type_icon: typeRes.data?.icon || null,
          signups,
        })
      } catch (err) {
        console.error('定位活动失败:', err)
        if (!cancelled) setFocusMissing(true)
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [focusActivityId])

  async function handleSignup(activity: Activity) {
    if (!meId) return
    setSigningUp(activity.id)

    const alreadySigned = activity.signups.some((s) => s.user_id === meId)

    if (alreadySigned) {
      await supabase.from('play_signups').delete().eq('activity_id', activity.id).eq('user_id', meId)
    } else {
      if (activity.signups.length >= activity.max_people) {
        alert('人满了')
        setSigningUp(null)
        return
      }
      await supabase.from('play_signups').insert({ activity_id: activity.id, user_id: meId })
    }

    await loadActivities(currentType?.id || null)
    setSigningUp(null)
    if (detailActivity && detailActivity.id === activity.id) setDetailActivity(null)
  }

  async function handlePost(e: React.FormEvent) {
    e.preventDefault()
    if (!newTitle.trim() || !meId) return
    setPosting(true)

    const { error } = await supabase.from('play_activities').insert({
      author_id: meId,
      type_id: newTypeId || null,
      title: newTitle.trim(),
      content: newContent.trim() || null,
      activity_time: newTime || null,
      max_people: newMaxPeople,
      status: 'published',
    })

    if (error) { alert('发布失败：' + error.message) }
    else {
      setNewTitle('')
      setNewContent('')
      setNewTime('')
      setNewMaxPeople(5)
      setNewTypeId('')
      setShowPostModal(false)
      await loadActivities(currentType?.id || null)
    }
    setPosting(false)
  }

  async function handleCreateType(e: React.FormEvent) {
    e.preventDefault()
    if (!newTypeName.trim() || !meId) return
    setCreatingType(true)
    setCreateTypeMessage('')

    const { error } = await supabase.from('play_types').insert({
      name: newTypeName.trim(),
      status: 'approved',
      created_by: meId,
    })

    if (error) { setCreateTypeMessage('提交失败：' + error.message) }
    else {
      setCreateTypeMessage('已添加')
      setNewTypeName('')
      await init()
      setTimeout(() => { setShowNewTypeModal(false); setCreateTypeMessage('') }, 1000)
    }
    setCreatingType(false)
  }

  async function handleDeleteType(typeId: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm('确定要删除这个类型吗？')) return
    const { error } = await supabase.from('play_types').delete().eq('id', typeId)
    if (error) { alert('删除失败：' + error.message) }
    else {
      await init()
      if (currentType?.id === typeId) setCurrentType(null)
    }
  }

  async function handleReport(e: React.FormEvent) {
    e.preventDefault()
    if (!reportReason.trim() || !detailActivity || !meId) return
    setReporting(true)
    setReportMessage('')

    const { data, error } = await supabase
      .from('reports')
      .insert({
        reporter_id: meId,
        target_type: 'play_activity',
        target_id: detailActivity.id,
        reason: reportReason.trim(),
        status: 'pending',
      })
      .select('id')
      .single()

    if (error) { setReportMessage('举报失败：' + error.message) }
    else {
      setMyReportId(data?.id ?? null)
      setReportMessage('已收到，谢谢你的反馈。误报可以随时撤回。')
      setReportReason('')
      setTimeout(() => { setShowReportModal(false); setReportMessage('') }, 1400)
    }
    setReporting(false)
  }

  /* ---------- 我的举报：打开详情时查一次，可撤回 ---------- */
  const [myReportId, setMyReportId] = useState<string | null>(null)
  const [withdrawing, setWithdrawing] = useState(false)
  const detailActivityId = detailActivity?.id ?? null

  useEffect(() => {
    if (!detailActivityId || !meId) {
      setMyReportId(null)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const { data, error } = await supabase
          .from('reports')
          .select('id')
          .eq('reporter_id', meId)
          .eq('target_type', 'play_activity')
          .eq('target_id', detailActivityId)
          .eq('status', 'pending')
          .maybeSingle()
        if (error) throw error
        if (!cancelled) setMyReportId(data?.id ?? null)
      } catch (err) {
        console.error('查询我的举报失败:', err)
        if (!cancelled) setMyReportId(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [detailActivityId, meId])

  async function handleWithdrawReport() {
    if (!myReportId || !meId) return
    setWithdrawing(true)
    try {
      const { error } = await supabase
        .from('reports')
        .delete()
        .eq('id', myReportId)
        .eq('reporter_id', meId) // 双保险：只删自己那条
      if (error) throw error
      setMyReportId(null)
      setReportMessage('已撤回举报')
      setTimeout(() => setReportMessage(''), 1500)
    } catch (err) {
      const msg =
        err && typeof err === 'object' && 'message' in err ? String((err as { message: unknown }).message) : String(err)
      alert('撤回失败：' + msg)
    } finally {
      setWithdrawing(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--accent-soft)]" style={pageAccentVars('play')}>
        <div className="mx-auto max-w-6xl px-6 pt-24 pb-8">
          <SkeletonList count={3} lines={2} />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--accent-soft)] relative overflow-hidden" style={pageAccentVars('play')}>

      <div className="relative max-w-6xl mx-auto px-6 pt-24 pb-8">
        <header className="mb-6">
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-[var(--accent-muted)] hover:text-[var(--accent-ink)] transition">
            <Icon name="back" className="w-4 h-4" />返回
          </Link>
          <h1 className="text-3xl font-bold text-[var(--accent-ink)] mt-4">聚会</h1>
          <p className="text-sm text-[var(--accent-muted)] mt-1">找搭子，一起玩</p>

          {focusActivityId && focusMissing && (
            <div className="mt-4 flex items-center justify-between rounded-2xl border border-[var(--accent-line)] bg-[var(--accent-soft)] px-4 py-2.5">
              <span className="text-xs text-[var(--accent)]">这条活动不见了（可能已被删除或下架）</span>
              <Link href="/play" className="text-xs text-[var(--accent)] hover:underline">
                ← 回到列表
              </Link>
            </div>
          )}

          <div className="flex gap-6 mt-5 border-b border-[var(--accent-line)]">
            <button
              onClick={() => setTab('activities')}
              className={`pb-2.5 text-sm transition ${tab === 'activities' ? 'border-b-2 border-[var(--accent)] text-[var(--accent)] font-medium' : 'text-[var(--accent-muted)] hover:text-[var(--accent-ink)]'}`}
            >
              活动
            </button>
            <button
              onClick={() => setTab('minigames')}
              className={`pb-2.5 text-sm transition ${tab === 'minigames' ? 'border-b-2 border-[var(--accent)] text-[var(--accent)] font-medium' : 'text-[var(--accent-muted)] hover:text-[var(--accent-ink)]'}`}
            >
              小程序
            </button>
          </div>
        </header>

        {tab === 'activities' && (
          <>
            <div className="flex items-center justify-between gap-4 mb-5 flex-wrap">
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => setCurrentType(null)}
                  className={`px-4 py-1.5 rounded-full text-xs transition ${!currentType ? 'bg-[var(--accent)] text-white' : 'bg-white text-[var(--accent-muted)] hover:bg-[var(--accent-soft)] border border-[var(--accent-line)]'}`}
                >
                  全部
                </button>

                {types.map((t) => {
                  const canDelete = t.created_by === meId || meId === ADMIN_UUID
                  return (
                    <div key={t.id} className="relative group">
                      <button
                        onClick={() => setCurrentType(t)}
                        className={`px-4 py-1.5 rounded-full text-xs transition flex items-center gap-1.5 ${canDelete ? 'pr-7' : ''} ${currentType?.id === t.id ? 'bg-[var(--accent)] text-white' : 'bg-white text-[var(--accent-muted)] hover:bg-[var(--accent-soft)] border border-[var(--accent-line)]'}`}
                      >
                        {t.icon && <span>{t.icon}</span>}
                        {t.name}
                      </button>

                      {canDelete && (
                        <button
                          onClick={(e) => handleDeleteType(t.id, e)}
                          className={`absolute right-1.5 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full flex items-center justify-center text-[11px] opacity-0 group-hover:opacity-100 transition ${currentType?.id === t.id ? 'text-white/70 hover:text-white hover:bg-white/20' : 'text-[var(--accent-muted)] hover:text-red-500 hover:bg-red-50'}`}
                          title="删除"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  )
                })}

                <button
                  onClick={() => setShowNewTypeModal(true)}
                  className="px-4 py-1.5 rounded-full text-xs text-[var(--accent-muted)] hover:bg-[var(--accent-soft)] transition border border-dashed border-[var(--accent-line)] flex items-center gap-1"
                >
                  <Icon name="plus" className="w-3 h-3" />新建类型
                </button>
              </div>

              <button
                onClick={() => setShowPostModal(true)}
                className="px-5 py-2 rounded-full bg-[var(--accent)] text-white text-sm font-medium hover:shadow-sm transition-all flex items-center gap-1.5 flex-shrink-0"
              >
                <Icon name="plus" className="w-4 h-4" />发活动
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activities.length === 0 ? (
                <div className="md:col-span-2 rounded-2xl border border-[var(--accent-line)] bg-white/60 backdrop-blur">
                  <EmptyState art="friends" title="还没有活动" hint="点右上角「发活动」，攒个局吧" />
                </div>
              ) : (
                activities
                  .filter((act) => deleter.activityVisible(act))
                  .filter((act) => !blocks.hiddenIds.has(act.author_id))
                  .map((act) => {
                  const isMine = act.author_id === meId
                  const alreadySigned = act.signups.some((s) => s.user_id === meId)
                  const isFull = act.signups.length >= act.max_people
                  const isFav = favorites.isFavorited('play_activity', act.id)

                  return (
                    <div
                      key={act.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setDetailActivity(act)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          setDetailActivity(act)
                        }
                      }}
                      className="relative cursor-pointer rounded-2xl border border-[var(--accent-line)] bg-white p-5 shadow-sm hover:shadow-sm hover:-translate-y-0.5 transition-all text-left flex flex-col focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
                    >
                      {/* 收藏（放在卡片右上角，与"打开详情"的点击区分开） */}
                      <button
                        type="button"
                        aria-label={isFav ? '取消收藏' : '收藏'}
                        disabled={favorites.busyKey === `play_activity:${act.id}`}
                        onClick={() =>
                          void favorites.toggle({
                            kind: 'play_activity',
                            targetId: act.id,
                            title: act.title,
                            content: act.content,
                            authorName: act.author_name,
                          })
                        }
                        className={`absolute top-3 right-3 z-10 rounded-full p-1 transition disabled:opacity-50 ${
                          isFav ? 'text-[#d97757]' : 'text-[var(--accent-muted)] hover:text-[#d97757]'
                        }`}
                      >
                        <Icon name={isFav ? 'heartfill' : 'heart'} className="w-4 h-4" />
                      </button>

                      <div className="flex flex-col flex-1">
                      <div className="flex items-start gap-2 mb-3">
                        {act.type_icon && (
                          <div className="w-9 h-9 rounded-xl bg-[var(--accent-soft)] flex items-center justify-center text-base flex-shrink-0">
                            {act.type_icon}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          {act.type_name && <p className="text-[11px] text-[var(--accent-muted)] tracking-wide">{act.type_name}</p>}
                          <h3 className="text-base font-semibold text-[var(--accent-ink)] mt-0.5 break-words">{act.title}</h3>
                        </div>
                      </div>

                      {act.content && (
                        <p className="text-sm text-[var(--accent-ink)] whitespace-pre-wrap break-words leading-relaxed mb-3 line-clamp-2">
                          {act.content}
                        </p>
                      )}

                      <div className="flex flex-wrap gap-3 text-[11px] text-[var(--accent-muted)] mb-3">
                        {act.activity_time && (
                          <span className="flex items-center gap-1"><Icon name="clock" className="w-3 h-3" />{formatTime(act.activity_time)}</span>
                        )}
                        <span className="flex items-center gap-1"><Icon name="users" className="w-3 h-3" />{act.signups.length}/{act.max_people} 人</span>
                      </div>

                      <div className="mt-auto pt-3 border-t border-[var(--accent-soft)] flex items-center justify-between gap-3">
                        <span className="text-[11px] text-[var(--accent-muted)] truncate">{act.author_name} 发起</span>
                        {isMine ? (
                          confirmDeleteActivity === act.id ? (
                            <button
                              type="button"
                              disabled={deleter.busyId === act.id}
                              onClick={(e) => {
                                e.stopPropagation()
                                void handleDeleteActivity(act.id, act.author_id)
                              }}
                              className="text-[11px] text-red-500 hover:underline disabled:opacity-50"
                            >
                              {deleter.busyId === act.id ? '删除中…' : '确认删除'}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setConfirmDeleteActivity(act.id)
                                window.setTimeout(
                                  () => setConfirmDeleteActivity((cur) => (cur === act.id ? null : cur)),
                                  4000,
                                )
                              }}
                              className="flex items-center gap-1 text-[11px] text-[var(--accent-muted)] hover:text-red-500 transition"
                            >
                              <Icon name="trash" className="w-3 h-3" />
                              删除
                            </button>
                          )
                        ) : alreadySigned ? (
                          <span className="text-[11px] text-[var(--accent)] font-medium">已参加</span>
                        ) : isFull ? (
                          <span className="text-[11px] text-[var(--accent-muted)]">已满</span>
                        ) : (
                          <span className="text-[11px] text-[var(--accent)] font-medium">点击查看 →</span>
                        )}
                      </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </>
        )}

        {tab === 'minigames' && (
          <>
            <MiniTools />
            <MusicRoom />
          </>
        )}
      </div>

      {detailActivity && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center px-4" onClick={() => setDetailActivity(null)}>          <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                {detailActivity.type_icon && (
                  <div className="w-10 h-10 rounded-xl bg-[var(--accent-soft)] flex items-center justify-center text-lg flex-shrink-0">
                    {detailActivity.type_icon}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  {detailActivity.type_name && <p className="text-[11px] text-[var(--accent-muted)] tracking-wide">{detailActivity.type_name}</p>}
                  <h2 className="text-lg font-semibold text-[var(--accent-ink)] mt-0.5 break-words">{detailActivity.title}</h2>
                </div>
              </div>
              <button onClick={() => setDetailActivity(null)} className="text-[var(--accent-muted)] hover:text-[var(--accent-ink)] p-1">
                <Icon name="x" className="w-5 h-5" />
              </button>
            </div>

            {detailActivity.content && (
              <p className="text-sm text-[var(--accent-ink)] whitespace-pre-wrap break-words leading-relaxed mb-4">{detailActivity.content}</p>
            )}

            <div className="flex flex-wrap gap-3 text-xs text-[var(--accent-muted)] mb-5">
              {detailActivity.activity_time && (
                <span className="flex items-center gap-1"><Icon name="clock" className="w-3.5 h-3.5" />{formatTime(detailActivity.activity_time)}</span>
              )}
              <span className="flex items-center gap-1"><Icon name="users" className="w-3.5 h-3.5" />{detailActivity.signups.length}/{detailActivity.max_people} 人</span>
            </div>

            <div className="mb-5">
              <p className="text-xs text-[var(--accent-muted)] mb-2">发起人</p>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[var(--accent-soft)] flex items-center justify-center overflow-hidden flex-shrink-0">
                  {detailActivity.author_avatar ? <img src={detailActivity.author_avatar} alt="" className="w-full h-full object-cover" /> : <span className="text-xs text-[var(--accent)]">{detailActivity.author_name[0]}</span>}
                </div>
                <span className="text-sm text-[var(--accent-ink)]">{detailActivity.author_name}</span>
              </div>
            </div>

            <div className="mb-5">
              <p className="text-xs text-[var(--accent-muted)] mb-2">已报名（{detailActivity.signups.length}/{detailActivity.max_people}）</p>
              {detailActivity.signups.length === 0 ? (
                <p className="text-xs text-[var(--accent-muted)]">还没有人报名</p>
              ) : (
                <div className="space-y-2">
                  {detailActivity.signups.map((s) => (
                    <div key={s.user_id} className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-[var(--accent-soft)] flex items-center justify-center overflow-hidden flex-shrink-0">
                        {s.user_avatar ? <img src={s.user_avatar} alt="" className="w-full h-full object-cover" /> : <span className="text-[11px] text-[var(--accent)]">{s.user_name[0]}</span>}
                      </div>
                      <span className="text-xs text-[var(--accent-ink)]">
                        {s.user_name}
                        {s.user_id === detailActivity.author_id && <span className="text-[11px] text-[var(--accent-muted)] ml-1">（发起人）</span>}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-2">
              {detailActivity.author_id === meId ? (
                confirmDeleteActivity === detailActivity.id ? (
                  <button
                    type="button"
                    disabled={deleter.busyId === detailActivity.id}
                    onClick={() => void handleDeleteActivity(detailActivity.id, detailActivity.author_id)}
                    className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition disabled:opacity-50"
                  >
                    {deleter.busyId === detailActivity.id ? '删除中…' : '确认删除'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmDeleteActivity(detailActivity.id)
                      window.setTimeout(
                        () => setConfirmDeleteActivity((cur) => (cur === detailActivity.id ? null : cur)),
                        4000,
                      )
                    }}
                    className="flex-1 py-2.5 rounded-xl border border-red-200 text-red-500 text-sm font-medium hover:bg-red-50 transition flex items-center justify-center gap-1.5"
                  >
                    <Icon name="trash" className="w-3.5 h-3.5" />
                    删除活动
                  </button>
                )
              ) : detailActivity.signups.some((s) => s.user_id === meId) ? (
                <button
                  onClick={() => handleSignup(detailActivity)}
                  disabled={signingUp === detailActivity.id}
                  className="flex-1 py-2.5 rounded-xl border border-[var(--accent)] text-[var(--accent)] text-sm font-medium hover:bg-[var(--accent-soft)] transition"
                >
                  {signingUp === detailActivity.id ? '...' : '取消报名'}
                </button>
              ) : detailActivity.signups.length >= detailActivity.max_people ? (
                <div className="flex-1 text-center py-2.5 rounded-xl bg-[var(--accent-soft)] text-xs text-[var(--accent-muted)]">已满</div>
              ) : (
                <button
                  onClick={() => handleSignup(detailActivity)}
                  disabled={signingUp === detailActivity.id}
                  className="flex-1 py-2.5 rounded-xl bg-[var(--accent)] text-white text-sm font-medium hover:shadow-sm transition"
                >
                  {signingUp === detailActivity.id ? '...' : '我要参加'}
                </button>
              )}

              {myReportId ? (
                <button
                  type="button"
                  disabled={withdrawing}
                  onClick={() => void handleWithdrawReport()}
                  className="px-4 py-2.5 rounded-xl border border-[var(--accent-line)] text-[var(--accent-muted)] text-sm hover:bg-[var(--accent-soft)] transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Icon name="x" className="w-3.5 h-3.5" />
                  {withdrawing ? '撤回中…' : '撤回举报'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowReportModal(true)}
                  className="px-4 py-2.5 rounded-xl border border-[var(--accent-line)] text-[var(--accent-muted)] text-sm hover:bg-[var(--accent-soft)] transition flex items-center gap-1.5"
                >
                  <Icon name="alert" className="w-3.5 h-3.5" />举报
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {showReportModal && detailActivity && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] flex items-center justify-center px-4" onClick={() => setShowReportModal(false)}>
          <form onSubmit={handleReport} className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-[var(--accent-ink)] mb-1">举报这个活动</h2>
            <p className="text-xs text-[var(--accent-muted)] mb-4">告诉我们原因，站主会看</p>

            <textarea
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              placeholder="比如：内容不合适、跟活动无关、广告…"
              rows={3}
              maxLength={200}
              autoFocus
              className="w-full px-4 py-3 rounded-xl border border-[var(--accent-line)] bg-[var(--accent-soft)] text-sm resize-none focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/10 transition mb-4"
            />

            {reportMessage && (
              <p className={`text-xs mb-3 ${reportMessage.includes('失败') ? 'text-red-500' : 'text-green-600'}`}>{reportMessage}</p>
            )}

            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => { setShowReportModal(false); setReportReason(''); setReportMessage('') }} className="px-5 py-2 rounded-xl text-sm text-[var(--accent-muted)] hover:bg-[var(--accent-soft)] transition">取消</button>
              <button type="submit" disabled={reporting || !reportReason.trim()} className="px-5 py-2 rounded-xl bg-[var(--accent)] text-white text-sm font-medium hover:shadow-sm transition-all disabled:opacity-50">
                {reporting ? '提交中...' : '提交'}
              </button>
            </div>
          </form>
        </div>
      )}

      {showPostModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center px-4" onClick={() => setShowPostModal(false)}>
          <form onSubmit={handlePost} className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-[var(--accent-ink)] mb-4">发活动</h2>

            <div className="mb-3">
              <label className="block text-xs text-[var(--accent-muted)] mb-1.5 tracking-wide">活动标题</label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="比如：今晚打 CS"
                maxLength={30}
                autoFocus
                className="w-full px-4 py-2.5 rounded-xl border border-[var(--accent-line)] bg-[var(--accent-soft)] text-sm focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/10 transition"
              />
            </div>

            <div className="mb-3">
              <label className="block text-xs text-[var(--accent-muted)] mb-1.5 tracking-wide">描述</label>
              <textarea
                ref={activityRef}
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                placeholder="说清楚要做什么，缺几个人，也可以发个表情"
                rows={3}
                maxLength={200}
                className="w-full px-4 py-2.5 rounded-xl border border-[var(--accent-line)] bg-[var(--accent-soft)] text-sm resize-none focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/10 transition"
              />
              <div className="mt-1.5 flex items-center justify-between">
                <EmojiPicker onPick={insertActivityEmoji} />
                <span className="text-[11px] text-[var(--accent-muted)]">{newContent.length}/200</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs text-[var(--accent-muted)] mb-1.5 tracking-wide">时间</label>
                <input type="datetime-local" value={newTime} onChange={(e) => setNewTime(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-[var(--accent-line)] bg-[var(--accent-soft)] text-sm focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/10 transition" />
              </div>
              <div>
                <label className="block text-xs text-[var(--accent-muted)] mb-1.5 tracking-wide">人数上限</label>
                <input type="number" value={newMaxPeople} onChange={(e) => setNewMaxPeople(parseInt(e.target.value) || 5)} min={2} max={50} className="w-full px-4 py-2.5 rounded-xl border border-[var(--accent-line)] bg-[var(--accent-soft)] text-sm focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/10 transition" />
              </div>
            </div>

            <div className="mb-5">
              <label className="block text-xs text-[var(--accent-muted)] mb-1.5 tracking-wide">类型（可不选）</label>
              <select value={newTypeId} onChange={(e) => setNewTypeId(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-[var(--accent-line)] bg-[var(--accent-soft)] text-sm focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/10 transition">
                <option value="">无</option>
                {types.map((t) => (<option key={t.id} value={t.id}>{t.icon} {t.name}</option>))}
              </select>
            </div>

            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setShowPostModal(false)} className="px-5 py-2 rounded-xl text-sm text-[var(--accent-muted)] hover:bg-[var(--accent-soft)] transition">取消</button>
              <button type="submit" disabled={posting || !newTitle.trim()} className="px-5 py-2 rounded-xl bg-[var(--accent)] text-white text-sm font-medium hover:shadow-sm transition-all disabled:opacity-50">
                {posting ? '发布中...' : '发布'}
              </button>
            </div>
          </form>
        </div>
      )}

      {showNewTypeModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center px-4" onClick={() => setShowNewTypeModal(false)}>
          <form onSubmit={handleCreateType} className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-[var(--accent-ink)] mb-1">新建类型</h2>
            <p className="text-xs text-[var(--accent-muted)] mb-4">建好后直接生效</p>

            <input
              type="text"
              value={newTypeName}
              onChange={(e) => setNewTypeName(e.target.value)}
              placeholder="类型名字"
              maxLength={10}
              autoFocus
              className="w-full px-4 py-2.5 rounded-xl border border-[var(--accent-line)] bg-[var(--accent-soft)] text-sm focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/10 transition mb-4"
            />

            {createTypeMessage && (
              <p className={`text-xs mb-3 ${createTypeMessage.includes('失败') ? 'text-red-500' : 'text-green-600'}`}>{createTypeMessage}</p>
            )}

            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => { setShowNewTypeModal(false); setNewTypeName(''); setCreateTypeMessage('') }} className="px-5 py-2 rounded-xl text-sm text-[var(--accent-muted)] hover:bg-[var(--accent-soft)] transition">取消</button>
              <button type="submit" disabled={creatingType || !newTypeName.trim()} className="px-5 py-2 rounded-xl bg-[var(--accent)] text-white text-sm font-medium hover:shadow-sm transition-all disabled:opacity-50">
                {creatingType ? '提交中...' : '添加'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}