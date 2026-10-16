'use client'

import { useEffect, useState } from 'react'
import { createClient } from '../app/lib/supabase'
import { Icon } from './icons'
import { ADMIN_UUID } from './utils'

/**
 * 后台：朋友圈举报
 *
 * 为什么单独一块：举报机制原本只覆盖院子帖子与聚会活动，
 * 而《举报处理流程》里写着"朋友圈也可以举报"——**承诺了做不到的事**。
 * 这次把入口（朋友圈页的举报按钮）、权限（supabase-admin-moments.sql）、
 * 处理台（这一块）三样都补齐，承诺才算数。
 *
 * 想清楚了才动：朋友圈**没有** is_hidden 那种软隐藏字段，
 * 所以这里只有「忽略」和「删除」两个结果 —— 删除是不可撤销的，
 * 按钮会先要一次确认。
 */

const supabase = createClient()

type MomentReport = {
  id: string
  target_id: string
  reason: string | null
  created_at: string
  reporter_name: string
  author_name: string
  content: string
  hasImage: boolean
}

/** 表还没建/策略没配时，说清该跑哪份 SQL，而不是只报一个错 */
const NO_ROWS_HINT =
  '多半是数据库策略没配好：请确认已在 Supabase 里执行 supabase-admin-moments.sql\n' +
  '（这条策略让站主能读、能删朋友圈；没跑的话看得到举报也处理不了）'

export function MomentReportsSection({ adminId }: { adminId: string }) {
  const [reports, setReports] = useState<MomentReport[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [hint, setHint] = useState('')

  /*
   * 注意：这个函数**第一次 setState 必须在 await 之后**。
   * react-hooks/set-state-in-effect 拦的是"effect 里同步 setState"，
   * 而它只看函数体里有没有同步的 setState 调用，推断不出运行时的 if 守卫 ——
   * 所以开头不能写 `if (show) setLoading(true)` 这种。
   * loading 初始就是 true，读完自然变 false；刷新时不再切转圈。
   */
  async function load() {
    const { data: repData, error } = await supabase
      .from('reports')
      .select('id, target_id, reason, created_at, reporter_id')
      .eq('status', 'pending')
      .eq('target_type', 'friend_post')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('读朋友圈举报失败:', error)
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

    const momentIds = rows.map((r) => r.target_id)
    const { data: moments } = await supabase
      .from('friend_posts')
      .select('id, author_id, content, image_urls')
      .in('id', momentIds)

    const peopleIds = [
      ...new Set([
        ...rows.map((r) => r.reporter_id).filter(Boolean),
        ...(moments ?? []).map((m) => m.author_id).filter(Boolean),
      ]),
    ] as string[]
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, nickname, username')
      .in('id', peopleIds.length > 0 ? peopleIds : ['00000000-0000-0000-0000-000000000000'])

    const nameOf = (id: string | null) => {
      const p = profiles?.find((x) => x.id === id)
      return p?.nickname || p?.username || '某人'
    }

    setReports(
      rows.map((r) => {
        const m = moments?.find((x) => x.id === r.target_id)
        return {
          id: r.id,
          target_id: r.target_id,
          reason: r.reason,
          created_at: r.created_at,
          reporter_name: nameOf(r.reporter_id),
          author_name: m ? nameOf(m.author_id) : '（作者未知）',
          content: m?.content || '（内容已删除）',
          hasImage: Boolean(m?.image_urls && m.image_urls.length > 0),
        }
      }),
    )
    setLoading(false)
  }

  useEffect(() => {
    // 不是管理员就什么都不做（下面直接不渲染，避免"读取中…"卡住）
    if (adminId !== ADMIN_UUID) return
    /*
     * 这个 disable 不是用来掩盖问题的：
     * react-hooks/set-state-in-effect 拦的是"effect 里同步 setState"，
     * 但它的判断方式是看被调用函数体里有没有 setState，**推断不出 load 里
     * 那些 setState 全都在 await 之后**，所以这里是误报。
     * 实际行为：进页面先显示"读取中…"，网络回来后换成列表，没有级联渲染。
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

  async function removeMoment(report: MomentReport) {
    if (
      !confirm(
        `确定删除 ${report.author_name} 的这条朋友圈吗？\n\n` +
          `内容：${report.content.slice(0, 60)}${report.content.length > 60 ? '…' : ''}\n\n` +
          '朋友圈没有"隐藏"这种可撤销的处理，删除之后收不回来（配图会变成孤儿文件，' +
          '可以用 supabase-storage-cleanup.sql 清）。',
      )
    ) {
      return
    }

    setBusy(report.id)
    setHint('')

    const momentRes = await supabase.from('friend_posts').delete().eq('id', report.target_id).select('id')
    if (momentRes.error) {
      setHint('删除失败：' + momentRes.error.message)
      setBusy(null)
      return
    }
    if (!momentRes.data || momentRes.data.length === 0) {
      setHint('没能删除这条朋友圈。' + NO_ROWS_HINT)
      setBusy(null)
      await load()
      return
    }

    // 同一条内容可能被多个人举报，一起标为已处理
    await supabase
      .from('reports')
      .update({ status: 'resolved' })
      .eq('target_type', 'friend_post')
      .eq('target_id', report.target_id)
      .eq('status', 'pending')

    setBusy(null)
    setHint('已删除，并把相关举报标记为已处理')
    await load()
  }

  // 非管理员：整块不渲染（后台页本身也有守卫，这里是第二道）
  if (adminId !== ADMIN_UUID) return null

  return (
    <section className="rounded-box border border-[#f0e6dc] bg-base-100/80 p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xs tracking-wider text-[#8a7a9a]">
          朋友圈举报 · {loading ? '…' : reports.length}
        </h2>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-lg border border-[#f0e6dc] px-2.5 py-1 text-[11px] text-[#8a7a9a] transition hover:text-[#c96447]"
        >
          刷新
        </button>
      </div>

      {loading ? (
        <p className="mt-3 text-xs text-[#8a7a9a]">读取中…</p>
      ) : reports.length === 0 ? (
        <p className="mt-3 text-xs text-[#8a7a9a]">没有待处理的朋友圈举报</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {reports.map((report) => (
            <li key={report.id} className="rounded-box border border-[#f4ece4] bg-[#fffdfb] p-3">
              <p className="text-[11px] text-[#8a7a9a]">
                由 <span className="text-[#8a7aaa]">{report.reporter_name}</span> 举报 ·{' '}
                {new Date(report.created_at).toLocaleString('zh-CN')}
              </p>
              <p className="mt-2 text-[11px] text-[#8a7a9a]">
                被举报内容（{report.author_name} 发的{report.hasImage ? '，含配图' : ''}）
              </p>
              <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-[#3a3229]">
                {report.content}
              </p>
              {report.reason && (
                <p className="mt-2 text-[11px] text-[#8a7a9a]">
                  理由：<span className="text-[#3a3229]">{report.reason}</span>
                </p>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={busy === report.id}
                  onClick={() => void dismiss(report.id)}
                  className="flex items-center gap-1.5 text-xs text-[#8a7a9a] transition hover:text-[#c96447] disabled:opacity-50"
                >
                  <Icon name="x" className="h-3.5 w-3.5" />
                  忽略举报
                </button>
                <button
                  type="button"
                  disabled={busy === report.id}
                  onClick={() => void removeMoment(report)}
                  className="flex items-center gap-1.5 text-xs text-red-500 transition hover:underline disabled:opacity-50"
                >
                  <Icon name="trash" className="h-3.5 w-3.5" />
                  {busy === report.id ? '处理中…' : '删除这条动态'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {hint && <p className="mt-3 whitespace-pre-line text-[11px] text-[#8a7a9a]">{hint}</p>}
    </section>
  )
}
