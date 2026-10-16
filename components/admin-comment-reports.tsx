'use client'

import { useEffect, useState } from 'react'
import { createClient } from '../app/lib/supabase'
import { Icon } from './icons'
import { ADMIN_UUID } from './utils'

/**
 * 后台：评论举报
 *
 * 和「朋友圈举报」同一套路：入口（院子里的评论旁边）+ 权限
 * （supabase-admin-comments.sql）+ 这一块，三样齐了才算数。
 *
 * 评论可以**软处理**：world_comments 有 is_hidden，所以「隐藏」是可撤销的，
 * 比朋友圈那个只能硬删的待遇好一点。
 */

const supabase = createClient()

type CommentReport = {
  id: string
  target_id: string
  reason: string | null
  created_at: string
  reporter_name: string
  author_name: string
  content: string
}

const NO_ROWS_HINT =
  '多半是数据库策略没配好：请确认已在 Supabase 里执行 supabase-admin-comments.sql\n' +
  '（这条策略让站主能读、能改、能删评论；没跑的话看得到举报也处理不了）'

export function CommentReportsSection({ adminId }: { adminId: string }) {
  const [reports, setReports] = useState<CommentReport[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [hint, setHint] = useState('')

  /*
   * 同样注意：第一次 setState 必须在 await 之后（react-hooks/set-state-in-effect
   * 只看函数体，推断不出这一点）。loading 初始就是 true，读完自然变 false。
   */
  async function load() {
    const { data: repData, error } = await supabase
      .from('reports')
      .select('id, target_id, reason, created_at, reporter_id')
      .eq('status', 'pending')
      .eq('target_type', 'world_comment')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('读评论举报失败:', error)
      setReports([])
      setLoading(false)
      return
    }

    const rows = repData ?? []
    if (rows.length === 0) {
      setReports([])
      setLoading(false)
      return
    }

    const { data: comments } = await supabase
      .from('world_comments')
      .select('id, author_id, content')
      .in('id', rows.map((r) => r.target_id))

    const peopleIds = [
      ...new Set([
        ...rows.map((r) => r.reporter_id).filter(Boolean),
        ...(comments ?? []).map((c) => c.author_id).filter(Boolean),
      ]),
    ] as string[]
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, nickname, username')
      .in('id', peopleIds.length > 0 ? peopleIds : ['00000000-0000-0000-0000-000000000000'])

    const nameOf = (id: string | null | undefined) => {
      const p = profiles?.find((x) => x.id === id)
      return p?.nickname || p?.username || '某人'
    }

    setReports(
      rows.map((r) => {
        const c = comments?.find((x) => x.id === r.target_id)
        return {
          id: r.id,
          target_id: r.target_id,
          reason: r.reason,
          created_at: r.created_at,
          reporter_name: nameOf(r.reporter_id),
          author_name: c ? nameOf(c.author_id) : '（作者未知）',
          content: c?.content || '（评论已删除）',
        }
      }),
    )
    setLoading(false)
  }

  useEffect(() => {
    if (adminId !== ADMIN_UUID) return
    /*
     * 这个 disable 不是掩盖问题：规则拦的是"effect 里同步 setState"，
     * 它看的是被调用函数体里有没有 setState，**推断不出 load 里的 setState
     * 全都在 await 之后**，所以这里是误报。实际行为是先显示"读取中…"再替换成列表。
     */
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [adminId])

  async function dismiss(reportId: string) {
    setBusy(reportId)
    setHint('')
    const { data, error } = await supabase
      .from('reports')
      .update({ status: 'dismissed' })
      .eq('id', reportId)
      .select('id')
    setBusy(null)
    if (error) setHint('操作失败：' + error.message)
    else if (!data || data.length === 0) setHint('没能忽略这条举报。' + NO_ROWS_HINT)
    else setHint('已忽略')
    await load()
  }

  async function hideComment(report: CommentReport, hidden: boolean) {
    if (!hidden && !confirm(`确定删除 ${report.author_name} 的这条评论吗？\n\n「删除」是标记为隐藏，内容不再显示。`)) {
      return
    }
    setBusy(report.id)
    setHint('')

    const res = await supabase
      .from('world_comments')
      .update({ is_hidden: hidden })
      .eq('id', report.target_id)
      .select('id')

    if (res.error) {
      setHint('处理失败：' + res.error.message)
      setBusy(null)
      return
    }
    if (!res.data || res.data.length === 0) {
      setHint('没能处理这条评论。' + NO_ROWS_HINT)
      setBusy(null)
      await load()
      return
    }

    if (hidden) {
      await supabase
        .from('reports')
        .update({ status: 'resolved' })
        .eq('target_type', 'world_comment')
        .eq('target_id', report.target_id)
        .eq('status', 'pending')
    }

    setBusy(null)
    setHint(hidden ? '已隐藏这条评论，并把相关举报标为已处理' : '已恢复显示')
    await load()
  }

  // 非管理员：整块不渲染（后台页本身也有守卫，这里是第二道）
  if (adminId !== ADMIN_UUID) return null

  return (
    <section className="card rounded-box border border-base-300 bg-base-100/80 p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xs tracking-wider text-base-content/60">
          评论举报 · {loading ? '…' : reports.length}
        </h2>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-lg border border-base-300 px-2.5 py-1 text-[11px] text-base-content/60 transition hover:text-primary"
        >
          刷新
        </button>
      </div>

      {loading ? (
        <p className="mt-3 text-xs text-base-content/60">读取中…</p>
      ) : reports.length === 0 ? (
        <p className="mt-3 text-xs text-base-content/60">没有待处理的评论举报</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {reports.map((report) => (
            <li key={report.id} className="card rounded-box border border-base-300 bg-base-100 p-3">
              <p className="text-[11px] text-base-content/60">
                由 <span className="text-base-content/60">{report.reporter_name}</span> 举报 ·{' '}
                {new Date(report.created_at).toLocaleString('zh-CN')}
              </p>
              <p className="mt-2 text-[11px] text-base-content/60">被举报的评论（{report.author_name} 写的）</p>
              <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-base-content">
                {report.content}
              </p>
              {report.reason && (
                <p className="mt-2 text-[11px] text-base-content/60">
                  理由：<span className="text-base-content">{report.reason}</span>
                </p>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={busy === report.id}
                  onClick={() => void dismiss(report.id)}
                  className="flex items-center gap-1.5 text-xs text-base-content/60 transition hover:text-primary disabled:opacity-50"
                >
                  <Icon name="x" className="h-3.5 w-3.5" />
                  忽略举报
                </button>
                <button
                  type="button"
                  disabled={busy === report.id}
                  onClick={() => void hideComment(report, true)}
                  className="flex items-center gap-1.5 text-xs text-red-500 transition hover:underline disabled:opacity-50"
                >
                  <Icon name="trash" className="h-3.5 w-3.5" />
                  {busy === report.id ? '处理中…' : '隐藏这条评论'}
                </button>
                <button
                  type="button"
                  disabled={busy === report.id}
                  onClick={() => void hideComment(report, false)}
                  className="flex items-center gap-1.5 text-xs text-base-content/60 transition hover:text-base-content disabled:opacity-50"
                >
                  <Icon name="check" className="h-3.5 w-3.5" />
                  恢复显示
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {hint && <p className="mt-3 whitespace-pre-line text-[11px] text-base-content/60">{hint}</p>}
    </section>
  )
}
