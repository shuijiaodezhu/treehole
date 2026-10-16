'use client'
/* eslint-disable react-hooks/set-state-in-effect -- 规则未识别 async 取数（init/loadAll），此处是纯客户端页面 */

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '../lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AdminStats } from '../../components/admin-stats'
import { AdminSitePages } from '../../components/admin-site-pages'
import { AdminMailbox } from '../../components/admin-mailbox'
import { DeletionRequestsSection } from '../../components/account-tools'
import { MomentReportsSection } from '../../components/admin-moment-reports'
import { CommentReportsSection } from '../../components/admin-comment-reports'
import { UserBanSection } from '../../components/admin-ban'

// 客户端提到模块级，保证引用稳定
const supabase = createClient()

const ADMIN_UUID = 'b59a31c7-60f8-4b57-924a-b408cbfd910c'

type Category = {
  id: string
  name: string
  parent_id: string | null
  status: string
  created_by: string | null
  created_at: string
  creator_name?: string
  parent_name?: string
}

type Report = {
  id: string
  target_type: string
  target_id: string
  reason: string | null
  status: string
  created_at: string
  reporter_name?: string
  target_content?: string
}

type ActivityReport = {
  activity_id: string
  title: string
  content: string | null
  author_name: string
  report_count: number
  reports: { id: string; reason: string | null; reporter_name: string; created_at: string }[]
}

function Icon({ name, className = '' }: { name: string; className?: string }) {
  const c = { className, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  switch (name) {
    case 'back': return <svg {...c}><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>
    case 'check': return <svg {...c}><polyline points="20 6 9 17 4 12" /></svg>
    case 'x': return <svg {...c}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
    case 'trash': return <svg {...c}><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
    case 'alert': return <svg {...c}><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
    case 'shield': return <svg {...c}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
    default: return null
  }
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export default function AdminPage() {
  const [tab, setTab] = useState<'categories' | 'reports' | 'mailbox' | 'pages'>('categories')
  const [categories, setCategories] = useState<Category[]>([])
  const [reports, setReports] = useState<Report[]>([])
  const [activityReports, setActivityReports] = useState<ActivityReport[]>([])
  const [loading, setLoading] = useState(true)
  const [authorized, setAuthorized] = useState(false)
  const [expandedActivity, setExpandedActivity] = useState<string | null>(null)

  const router = useRouter()

  const loadAll = useCallback(async () => {
    // 1. 待审核分区
    const { data: catData } = await supabase
      .from('categories')
      .select('id, name, parent_id, status, created_by, created_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })

    if (catData && catData.length > 0) {
      const userIds = [...new Set(catData.map((c) => c.created_by).filter(Boolean))]
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, nickname, username')
        .in('id', userIds.length > 0 ? userIds : ['00000000-0000-0000-0000-000000000000'])

      const parentIds = [...new Set(catData.map((c) => c.parent_id).filter(Boolean))]
      const { data: parents } = await supabase
        .from('categories')
        .select('id, name')
        .in('id', parentIds.length > 0 ? parentIds : ['00000000-0000-0000-0000-000000000000'])

      const list: Category[] = catData.map((c) => {
        const p = profiles?.find((x) => x.id === c.created_by)
        const parent = parents?.find((x) => x.id === c.parent_id)
        return { ...c, creator_name: p?.nickname || p?.username || '某人', parent_name: parent?.name || null }
      })
      setCategories(list)
    } else {
      setCategories([])
    }

    // 2. 帖子举报（world_post）
    const { data: repData } = await supabase
      .from('reports')
      .select('id, target_type, target_id, reason, status, created_at, reporter_id')
      .eq('status', 'pending')
      .eq('target_type', 'world_post')
      .order('created_at', { ascending: false })

    if (repData && repData.length > 0) {
      const reporterIds = [...new Set(repData.map((r) => r.reporter_id).filter(Boolean))]
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, nickname, username')
        .in('id', reporterIds.length > 0 ? reporterIds : ['00000000-0000-0000-0000-000000000000'])

      const postIds = repData.map((r) => r.target_id)
      const { data: postData } = await supabase
        .from('world_posts')
        .select('id, content')
        .in('id', postIds.length > 0 ? postIds : ['00000000-0000-0000-0000-000000000000'])

      const list: Report[] = repData.map((r) => {
        const p = profiles?.find((x) => x.id === r.reporter_id)
        const post = postData?.find((x) => x.id === r.target_id)
        return { ...r, reporter_name: p?.nickname || p?.username || '某人', target_content: post?.content || '（内容已删除）' }
      })
      setReports(list)
    } else {
      setReports([])
    }

    // 3. 聚会活动举报（play_activity）
    const { data: playRepData } = await supabase
      .from('reports')
      .select('id, target_id, reason, status, created_at, reporter_id')
      .eq('status', 'pending')
      .eq('target_type', 'play_activity')
      .order('created_at', { ascending: true })

    if (playRepData && playRepData.length > 0) {
      // 统计每个活动被举报几次
      const countMap: { [key: string]: number } = {}
      playRepData.forEach((r) => {
        countMap[r.target_id] = (countMap[r.target_id] || 0) + 1
      })

      // 只保留 ≥ 3 次的
      const targetIds = Object.entries(countMap)
        .filter((pair) => pair[1] >= 3)
        .map(([id]) => id)

      if (targetIds.length > 0) {
        // 查活动内容
        const { data: actData } = await supabase
          .from('play_activities')
          .select('id, title, content, author_id')
          .in('id', targetIds)

        const authorIds = actData ? [...new Set(actData.map((a) => a.author_id))] : []
        const { data: authorProfiles } = await supabase
          .from('profiles')
          .select('id, nickname, username')
          .in('id', authorIds.length > 0 ? authorIds : ['00000000-0000-0000-0000-000000000000'])

        const reporterIds = [...new Set(playRepData.map((r) => r.reporter_id).filter(Boolean))]
        const { data: reporterProfiles } = await supabase
          .from('profiles')
          .select('id, nickname, username')
          .in('id', reporterIds.length > 0 ? reporterIds : ['00000000-0000-0000-0000-000000000000'])

        const list: ActivityReport[] = targetIds.map((aid) => {
          const act = actData?.find((a) => a.id === aid)
          const author = authorProfiles?.find((x) => x.id === act?.author_id)
          const relatedReports = playRepData.filter((r) => r.target_id === aid)

          return {
            activity_id: aid,
            title: act?.title || '（活动已删除）',
            content: act?.content || null,
            author_name: author?.nickname || author?.username || '某人',
            report_count: countMap[aid],
            reports: relatedReports.map((r) => {
              const rp = reporterProfiles?.find((x) => x.id === r.reporter_id)
              return {
                id: r.id,
                reason: r.reason,
                reporter_name: rp?.nickname || rp?.username || '某人',
                created_at: r.created_at,
              }
            }),
          }
        })

        setActivityReports(list)
      } else {
        setActivityReports([])
      }
    } else {
      setActivityReports([])
    }
  }, [])

  const init = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) { router.push('/login'); return }
    if (userData.user.id !== ADMIN_UUID) {
      setAuthorized(false)
      setLoading(false)
      return
    }
    setAuthorized(true)
    await loadAll()
    setLoading(false)
  }, [router, loadAll])

  useEffect(() => {
    init()
  }, [init])

  /**
   * 后台所有写操作的统一处理
   *
   * 重要：PostgREST 在 RLS 把行过滤掉时**不报错**（返回 204 / 空数组），
   * 所以只看 error 会「界面以为成功了、数据库没动」——刷新后又冒出来。
   * 因此每个写操作都带 select() 拿回真正被改动的行，0 行就明确报错，
   * 并以数据库为准重新拉取列表（不做乐观本地删除）。
   */
  const NO_ROWS_HINT =
    '数据库没有更新任何一行。\n\n常见原因：该表的 RLS 策略不允许这次操作（比如只允许作者本人改动）。\n页面已按数据库的真实状态刷新。'

  async function handleCategoryApprove(id: string) {
    const { data, error } = await supabase
      .from('categories')
      .update({ status: 'approved' })
      .eq('id', id)
      .select('id')

    if (error) alert('操作失败：' + error.message)
    else if (!data || data.length === 0) alert('没能通过这条申请。\n\n' + NO_ROWS_HINT)

    await loadAll()
  }

  async function handleCategoryReject(id: string) {
    if (!confirm('确定要删除这个分区申请吗？')) return

    const { data, error } = await supabase.from('categories').delete().eq('id', id).select('id')

    if (error) alert('操作失败：' + error.message)
    else if (!data || data.length === 0) alert('没能删掉这条申请。\n\n' + NO_ROWS_HINT)

    await loadAll()
  }

  async function handleReportAction(reportId: string, action: 'dismiss' | 'delete_post') {
    const report = reports.find((r) => r.id === reportId)
    if (!report) return

    if (action === 'dismiss') {
      const { data, error } = await supabase
        .from('reports')
        .update({ status: 'dismissed' })
        .eq('id', reportId)
        .select('id')
      if (error) alert('操作失败：' + error.message)
      else if (!data || data.length === 0) alert('没能忽略这条举报。\n\n' + NO_ROWS_HINT)

      await supabase.from('world_posts').update({ is_hidden: false, report_count: 0 }).eq('id', report.target_id)
    } else if (action === 'delete_post') {
      const postRes = await supabase
        .from('world_posts')
        .update({ status: 'removed' })
        .eq('id', report.target_id)
        .select('id')
      if (postRes.error) alert('删除帖子失败：' + postRes.error.message)
      else if (!postRes.data || postRes.data.length === 0) {
        alert('没能删除这条帖子。\n\n' + NO_ROWS_HINT)
      }

      const reportRes = await supabase
        .from('reports')
        .update({ status: 'resolved' })
        .eq('id', reportId)
        .select('id')
      if (reportRes.error) alert('更新举报状态失败：' + reportRes.error.message)
    }

    await loadAll()
  }

  async function handleActivityReportDismiss(activityId: string) {
    if (!confirm('确定要忽略这些举报吗？')) return

    const { data, error } = await supabase
      .from('reports')
      .update({ status: 'dismissed' })
      .eq('target_type', 'play_activity')
      .eq('target_id', activityId)
      .eq('status', 'pending')
      .select('id')

    if (error) alert('操作失败：' + error.message)
    else if (!data || data.length === 0) alert('没能忽略这些举报。\n\n' + NO_ROWS_HINT)

    await loadAll()
  }

  async function handleActivityDelete(activityId: string) {
    if (!confirm('确定要删除这个活动吗？')) return

    const { data, error } = await supabase
      .from('play_activities')
      .update({ status: 'removed' })
      .eq('id', activityId)
      .select('id')

    if (error) alert('操作失败：' + error.message)
    else if (!data || data.length === 0) {
      alert('没能删除这个活动。\n\n' + NO_ROWS_HINT)
    } else {
      const reportRes = await supabase
        .from('reports')
        .update({ status: 'resolved' })
        .eq('target_type', 'play_activity')
        .eq('target_id', activityId)
        .eq('status', 'pending')
      if (reportRes.error) alert('更新举报状态失败：' + reportRes.error.message)
    }

    await loadAll()
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center"><p>加载中...</p></div>

  if (!authorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base-100">
        <div className="text-center">
          <p className="text-lg font-semibold text-base-content">这里不是你能来的地方</p>
          <Link href="/" className="text-sm text-base-content/60 mt-4 inline-block hover:underline">← 回首页</Link>
        </div>
      </div>
    )
  }

  const totalReports = reports.length + activityReports.length

  return (
    <div className="min-h-screen bg-base-100 relative overflow-hidden">

      <div className="relative max-w-4xl mx-auto px-6 pt-24 pb-8">
        <header className="mb-6">
          <Link href="/me" className="inline-flex items-center gap-1.5 text-sm text-base-content/60 hover:text-base-content/60 transition">
            <Icon name="back" className="w-4 h-4" />返回我的
          </Link>
          <div className="flex items-center gap-3 mt-4">
            <div className="w-10 h-10 rounded-box bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
              <Icon name="shield" className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-base-content">站主后台</h1>
              <p className="text-xs text-base-content/60 mt-0.5">审核分区 · 处理举报</p>
            </div>
          </div>
        </header>

        {/* 规模与活跃统计 */}
        <AdminStats />

        {/* 注销申请：放在页签之前，确保一定看得见（这种申请不该被漏掉） */}
        <DeletionRequestsSection adminId={ADMIN_UUID} />

        {/* 朋友圈举报：入口（朋友圈页）+ 权限（supabase-admin-moments.sql）+ 这一块，
            三样齐了，《举报处理流程》里那句承诺才算数 */}
        <MomentReportsSection adminId={ADMIN_UUID} />

        {/* 评论举报：入口 + 权限（supabase-admin-comments.sql）+ 处理台 */}
        <CommentReportsSection adminId={ADMIN_UUID} />

        {/* 停用账号：调 admin_set_ban（supabase-admin-ban.sql），真封禁，不用去后台手动 Ban */}
        <UserBanSection adminId={ADMIN_UUID} />

        <div className="flex gap-6 mb-6 ">
          <button
            onClick={() => setTab('categories')}
            className={`pb-2.5 text-sm transition ${tab === 'categories' ? 'border-b-2 border-primary/40 text-base-content/60 font-medium' : 'text-base-content/60 hover:text-base-content'}`}
          >
            分区审核 {categories.length > 0 && `(${categories.length})`}
          </button>
          <button
            onClick={() => setTab('reports')}
            className={`pb-2.5 text-sm transition ${tab === 'reports' ? 'border-b-2 border-primary/40 text-base-content/60 font-medium' : 'text-base-content/60 hover:text-base-content'}`}
          >
            举报处理 {totalReports > 0 && `(${totalReports})`}
          </button>
          <button
            onClick={() => setTab('mailbox')}
            className={`pb-2.5 text-sm transition ${tab === 'mailbox' ? 'border-b-2 border-primary/40 text-base-content/60 font-medium' : 'text-base-content/60 hover:text-base-content'}`}
          >
            冬日信箱
          </button>
          <button
            onClick={() => setTab('pages')}
            className={`pb-2.5 text-sm transition ${tab === 'pages' ? 'border-b-2 border-primary/40 text-base-content/60 font-medium' : 'text-base-content/60 hover:text-base-content'}`}
          >
            站点页面
          </button>
        </div>

        {tab === 'categories' && (
          <div className="space-y-3">
            {categories.length === 0 ? (
              <div className="card rounded-box border border-base-300 bg-base-100/60 backdrop-blur p-12 text-center">
                <p className="text-sm text-base-content/60">没有待审核的分区</p>
              </div>
            ) : (
              categories.map((cat) => (
                <div key={cat.id} className="card rounded-box border border-base-300 bg-base-100 p-5 shadow-sm">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-base font-semibold text-base-content">
                        {cat.parent_name ? `${cat.parent_name} · ` : ''}{cat.name}
                      </p>
                      <p className="text-xs text-base-content/60 mt-1">
                        由 <span className="text-base-content/60">{cat.creator_name}</span> 申请
                        <span className="ml-3">{formatTime(cat.created_at)}</span>
                      </p>
                    </div>

                    <div className="flex gap-2 flex-shrink-0">
                      <button onClick={() => handleCategoryApprove(cat.id)} className="bg-primary flex items-center gap-1.5 px-4 py-2 rounded-box text-primary-content text-xs font-medium hover:shadow-sm transition">
                        <Icon name="check" className="w-3.5 h-3.5" />通过
                      </button>
                      <button onClick={() => handleCategoryReject(cat.id)} className="card flex items-center gap-1.5 px-4 py-2 rounded-box border border-base-300 text-base-content/60 text-xs hover:bg-base-100 transition">
                        <Icon name="x" className="w-3.5 h-3.5" />拒绝
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {tab === 'reports' && (
          <div className="space-y-6">
            {/* 帖子举报 */}
            <div>
              <h2 className="text-xs text-base-content/60 tracking-wider mb-3 px-1">帖子举报 · {reports.length}</h2>
              <div className="space-y-3">
                {reports.length === 0 ? (
                  <div className="card rounded-box border border-base-300 bg-base-100/60 backdrop-blur p-8 text-center">
                    <p className="text-sm text-base-content/60">没有待处理的帖子举报</p>
                  </div>
                ) : (
                  reports.map((report) => (
                    <div key={report.id} className="card rounded-box border border-base-300 bg-base-100 p-5 shadow-sm">
                      <div className="flex items-start gap-3 mb-3">
                        <Icon name="alert" className="w-4 h-4 text-base-content/70 flex-shrink-0 mt-1" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-base-content/60">
                            由 <span className="text-base-content/60">{report.reporter_name}</span> 举报
                            <span className="ml-3">{formatTime(report.created_at)}</span>
                          </p>
                          {report.reason && (<p className="text-sm text-base-content mt-2">理由：{report.reason}</p>)}
                        </div>
                      </div>

                      <div className="rounded-box bg-base-content/5 p-4 mb-4">
                        <p className="text-[11px] text-base-content/60 mb-1.5">被举报内容</p>
                        <p className="text-sm text-base-content whitespace-pre-wrap break-words">{report.target_content}</p>
                      </div>

                      <div className="flex gap-2 justify-end">
                        <button onClick={() => handleReportAction(report.id, 'dismiss')} className="card flex items-center gap-1.5 px-4 py-2 rounded-box border border-base-300 text-base-content/60 text-xs hover:bg-base-100 transition">
                          <Icon name="x" className="w-3.5 h-3.5" />忽略举报
                        </button>
                        <button onClick={() => { if (confirm('确定要删除这条内容吗？')) { handleReportAction(report.id, 'delete_post') } }} className="flex items-center gap-1.5 px-4 py-2 rounded-box bg-red-500 text-white text-xs font-medium hover:bg-red-600 transition">
                          <Icon name="trash" className="w-3.5 h-3.5" />删除内容
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* 活动举报（≥3 次才显示） */}
            <div>
              <h2 className="text-xs text-base-content/60 tracking-wider mb-3 px-1">
                活动举报（≥3 次）· {activityReports.length}
              </h2>
              <div className="space-y-3">
                {activityReports.length === 0 ? (
                  <div className="card rounded-box border border-base-300 bg-base-100/60 backdrop-blur p-8 text-center">
                    <p className="text-sm text-base-content/60">没有被举报 3 次以上的活动</p>
                  </div>
                ) : (
                  activityReports.map((a) => (
                    <div key={a.activity_id} className="card rounded-box border border-base-300 bg-base-100 p-5 shadow-sm">
                      <div className="flex items-start gap-3 mb-3">
                        <Icon name="alert" className="w-4 h-4 text-base-content/70 flex-shrink-0 mt-1" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-base font-semibold text-base-content">{a.title}</h3>
                            <span className="text-[11px] bg-base-content/5 text-base-content/60 px-2 py-0.5 rounded-full font-medium">
                              被举报 {a.report_count} 次
                            </span>
                          </div>
                          <p className="text-xs text-base-content/60 mt-1">
                            发起人：<span className="text-base-content/60">{a.author_name}</span>
                          </p>
                        </div>
                      </div>

                      {a.content && (
                        <div className="rounded-box bg-base-content/5 p-4 mb-3">
                          <p className="text-[11px] text-base-content/60 mb-1.5">活动内容</p>
                          <p className="text-sm text-base-content whitespace-pre-wrap break-words">{a.content}</p>
                        </div>
                      )}

                      <div className="mb-4">
                        <button
                          onClick={() => setExpandedActivity(expandedActivity === a.activity_id ? null : a.activity_id)}
                          className="text-[11px] text-base-content/60 hover:underline"
                        >
                          {expandedActivity === a.activity_id ? '收起' : '查看'}举报理由（{a.reports.length}）
                        </button>

                        {expandedActivity === a.activity_id && (
                          <div className="mt-2 space-y-1.5 pl-2 border-l-2 border-base-300">
                            {a.reports.map((r) => (
                              <div key={r.id} className="text-xs">
                                <span className="text-base-content/60 font-medium">{r.reporter_name}</span>
                                <span className="text-base-content/70 ml-2">{formatTime(r.created_at)}</span>
                                {r.reason && (
                                  <p className="text-base-content mt-0.5 pl-2">「{r.reason}」</p>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2 justify-end">
                        <button onClick={() => handleActivityReportDismiss(a.activity_id)} className="card flex items-center gap-1.5 px-4 py-2 rounded-box border border-base-300 text-base-content/60 text-xs hover:bg-base-100 transition">
                          <Icon name="x" className="w-3.5 h-3.5" />忽略举报
                        </button>
                        <button onClick={() => handleActivityDelete(a.activity_id)} className="flex items-center gap-1.5 px-4 py-2 rounded-box bg-red-500 text-white text-xs font-medium hover:bg-red-600 transition">
                          <Icon name="trash" className="w-3.5 h-3.5" />删除活动
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {tab === 'mailbox' && <AdminMailbox adminId={ADMIN_UUID} />}

        {tab === 'pages' && <AdminSitePages />}
      </div>
    </div>
  )
}