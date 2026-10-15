'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '../app/lib/supabase'
import { Icon } from './icons'
import { formatUpdated } from './site-pages'

/**
 * 后台：站点页面编辑
 *
 * 公约 / 审核指引 / 举报流程 / 申诉 / 隐私 / 协议 / 关于，正文存在
 * public.site_pages。改完点保存即生效，不用重新部署。
 *
 * 依赖 supabase-site-pages.sql（建表 + 7 份初稿 + 只有站主能改的策略）
 */

const supabase = createClient()

type Row = {
  slug: string
  title: string
  summary: string | null
  body: string
  sort_order: number
  updated_at: string
}

export function AdminSitePages() {
  const [rows, setRows] = useState<Row[]>([])
  const [activeSlug, setActiveSlug] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error: queryError } = await supabase
        .from('site_pages')
        .select('slug, title, summary, body, sort_order, updated_at')
        .order('sort_order', { ascending: true })

      if (queryError) throw queryError
      const list = (data ?? []) as unknown as Row[]
      setRows(list)
      setActiveSlug((cur) => cur ?? list[0]?.slug ?? null)
      setError('')
    } catch (err) {
      console.error('加载站点页面失败:', err)
      setError('加载失败（可能还没跑 supabase-site-pages.sql）')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // load 是 async 函数，setState 都在 await 之后；规则无法识别
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  const active = rows.find((r) => r.slug === activeSlug) ?? null

  // 切换页面时把草稿同步成那一页的正文
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft(active?.body ?? '')
  }, [active?.slug, active?.body])

  const dirty = active ? draft !== active.body : false

  async function handleSave() {
    if (!active) return
    setSaving(true)
    setMessage('')
    try {
      const { data: userData } = await supabase.auth.getUser()
      const { data, error: updateError } = await supabase
        .from('site_pages')
        .update({
          body: draft,
          updated_at: new Date().toISOString(),
          updated_by: userData.user?.id ?? null,
        })
        .eq('slug', active.slug)
        .select('slug, title, summary, body, sort_order, updated_at')

      if (updateError) throw updateError
      if (!data || data.length === 0) {
        setMessage('没能保存：数据库没有更新任何一行（可能是权限策略没生效）。')
        await load()
        return
      }

      const updated = data[0] as unknown as Row
      setRows((prev) => prev.map((r) => (r.slug === updated.slug ? updated : r)))
      setMessage('已保存')
      window.setTimeout(() => setMessage(''), 2500)
    } catch (err) {
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: unknown }).message)
          : String(err)
      setMessage('保存失败：' + msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="rounded-3xl border border-[#e0d4e8] bg-white/80 p-6 backdrop-blur shadow-[0_2px_12px_rgba(168,138,184,0.06)]">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f0e6f8]">
          <Icon name="file" className="h-4 w-4 text-[#8a7aaa]" />
        </div>
        <div className="flex-1">
          <h2 className="text-sm font-semibold text-[#2b2430]">站点页面</h2>
          <p className="mt-0.5 text-[10px] text-[#b8a8c8]">
            公约、隐私、协议这些，改完点保存就生效，不用重新部署
          </p>
        </div>
        {message && <span className="text-[11px] text-[#7a5a9a]">{message}</span>}
      </div>

      {error && (
        <p className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-xs text-red-600">{error}</p>
      )}

      {loading && rows.length === 0 ? (
        <p className="py-10 text-center text-xs text-[#b8a8c8]">加载中…</p>
      ) : rows.length === 0 ? (
        <p className="py-10 text-center text-xs text-[#b8a8c8]">
          还没有内容，先跑一次 supabase-site-pages.sql
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-[200px_1fr]">
          {/* 左侧目录 */}
          <nav className="flex flex-wrap gap-1.5 md:flex-col md:flex-nowrap">
            {rows.map((r) => (
              <button
                key={r.slug}
                type="button"
                onClick={() => {
                  if (dirty && !window.confirm('这一页还没保存，切走会丢掉改动。继续？')) return
                  setActiveSlug(r.slug)
                }}
                className={`rounded-xl px-3 py-2 text-left text-xs transition ${
                  r.slug === activeSlug
                    ? 'bg-[#f0e6f8] font-medium text-[#7a5a9a]'
                    : 'text-[#8a7a9a] hover:bg-[#faf5ff]'
                }`}
              >
                {r.title}
              </button>
            ))}
          </nav>

          {/* 右侧编辑 */}
          {active && (
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-[#2b2430]">{active.title}</span>
                <a
                  href={`/p/${active.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-[#8a7aaa] underline"
                >
                  看前台效果 ↗
                </a>
                <span className="ml-auto text-[10px] text-[#b8a8c8]">
                  更新于 {formatUpdated(active.updated_at)} · {draft.length} 字
                </span>
              </div>

              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={18}
                spellCheck={false}
                className="w-full rounded-2xl border border-[#e0d4e8] bg-[#fcf8ff] px-4 py-3 font-mono text-[12px] leading-relaxed text-[#2b2430] focus:outline-none focus:border-[#a88ab8] focus:ring-2 focus:ring-[#a88ab8]/10 transition"
              />

              <div className="mt-3 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={saving || !dirty}
                  onClick={() => void handleSave()}
                  className="rounded-xl bg-gradient-to-r from-[#b89ac8] to-[#a88ab8] px-5 py-2 text-sm text-white transition hover:shadow-[0_6px_20px_rgba(168,138,184,0.3)] disabled:opacity-50"
                >
                  {saving ? '保存中…' : dirty ? '保存' : '没有改动'}
                </button>
                <button
                  type="button"
                  disabled={!dirty}
                  onClick={() => setDraft(active.body)}
                  className="rounded-xl border border-[#e0d4e8] px-4 py-2 text-xs text-[#8a7a9a] transition hover:bg-[#faf5ff] disabled:opacity-40"
                >
                  放弃改动
                </button>
                <span className="text-[10px] text-[#b8a8c8]">
                  空行分段；一行一条的列表用 · 或 1. 开头即可
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
