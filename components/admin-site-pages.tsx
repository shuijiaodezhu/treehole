'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '../app/lib/supabase'
import { Icon } from './icons'
import { DEFAULT_PAGES } from './site-page-defaults'
import { formatUpdated } from './site-pages'

/**
 * 后台：站点页面编辑
 *
 * 公约 / 审核指引 / 举报流程 / 申诉 / 隐私 / 协议 / 关于，正文存在
 * public.site_pages。改完点保存即生效，不用重新部署。
 *
 * 数据库里还没有的那几条，用内置初稿（components/site-page-defaults.ts）垫着，
 * 所以这里永远能看到全部 7 页；编辑后保存会自动插入。
 *
 * 依赖 supabase-site-pages.sql（建表 + 只有站主能写的策略）
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
  const [activeSlug, setActiveSlug] = useState<string>(DEFAULT_PAGES[0].slug)
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [seeding, setSeeding] = useState(false)
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
      setRows((data ?? []) as unknown as Row[])
      setError('')
    } catch (err) {
      console.error('加载站点页面失败:', err)
      setError('读取数据库失败，下面显示的是内置初稿（可能还没跑 supabase-site-pages.sql）')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // load 是 async 函数，setState 都在 await 之后；规则无法识别
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  /** 目录：数据库优先，缺的用内置初稿补位 */
  const catalog = useMemo(() => {
    const byslug = new Map(rows.map((r) => [r.slug, r]))
    const list = DEFAULT_PAGES.map((d) => {
      const row = byslug.get(d.slug)
      return {
        slug: d.slug,
        title: row?.title ?? d.title,
        summary: row?.summary ?? d.summary,
        body: row?.body ?? d.body,
        updated_at: row?.updated_at ?? '',
        inDb: Boolean(row),
      }
    })
    // 数据库里可能有自定义的额外条目，也列出来
    for (const r of rows) {
      if (!DEFAULT_PAGES.some((d) => d.slug === r.slug)) {
        list.push({
          slug: r.slug,
          title: r.title,
          summary: r.summary ?? '',
          body: r.body,
          updated_at: r.updated_at,
          inDb: true,
        })
      }
    }
    return list
  }, [rows])

  const active = catalog.find((c) => c.slug === activeSlug) ?? catalog[0] ?? null
  const originalBody = active?.body ?? ''

  // 切换页面时同步草稿（原正文变了也要跟上，例如刚保存或刚写入）
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft(originalBody)
  }, [activeSlug, originalBody])

  const dirty = draft !== originalBody
  const missingCount = catalog.filter((c) => !c.inDb).length

  async function handleSave() {
    if (!active) return
    setSaving(true)
    setMessage('')
    try {
      const { data: userData } = await supabase.auth.getUser()
      const payload = {
        slug: active.slug,
        title: active.title,
        summary: active.summary || null,
        body: draft,
        sort_order: DEFAULT_PAGES.findIndex((d) => d.slug === active.slug) + 1 || 99,
        updated_at: new Date().toISOString(),
        updated_by: userData.user?.id ?? null,
      }

      // upsert：数据库里没有这条就插入，有就更新
      const { data, error: writeError } = await supabase
        .from('site_pages')
        .upsert(payload, { onConflict: 'slug' })
        .select('slug, title, summary, body, sort_order, updated_at')

      if (writeError) throw writeError
      if (!data || data.length === 0) {
        setMessage('没能保存：数据库没有写入任何一行（可能是权限策略没生效）。')
        await load()
        return
      }

      const updated = data[0] as unknown as Row
      setRows((prev) => {
        const others = prev.filter((r) => r.slug !== updated.slug)
        return [...others, updated]
      })
      setMessage('已保存，前台已生效')
      window.setTimeout(() => setMessage(''), 2500)
    } catch (err) {
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: unknown }).message)
          : String(err)
      // RLS 报错最常见的原因是「策略没建」或「策略里的 uid 跟当前账号不一致」，
      // 所以把当前登录 uid 一起显示出来，方便直接对照 SQL
      if (/row-level security/i.test(msg)) {
        const { data: userData } = await supabase.auth.getUser()
        setMessage(
          `保存失败：${msg}\n\n当前登录账号 uid：${userData.user?.id ?? '(未登录)'}\n` +
            '请确认数据库里 site_pages 的写入策略已建好，且策略中的 uid 与上面这个一致。\n' +
            '（跑一次 supabase-site-pages-fix.sql 即可）',
        )
      } else {
        setMessage('保存失败：' + msg)
      }
    } finally {
      setSaving(false)
    }
  }

  /** 把数据库里还没有的那几页一次性写入（不动已有的） */
  async function handleSeed() {
    setSeeding(true)
    setMessage('')
    try {
      const missing = catalog.filter((c) => !c.inDb)
      if (missing.length === 0) {
        setMessage('数据库里已经有了，不需要写入')
        return
      }
      const { data: userData } = await supabase.auth.getUser()
      const payload = missing.map((c) => ({
        slug: c.slug,
        title: c.title,
        summary: c.summary || null,
        body: c.body,
        sort_order: DEFAULT_PAGES.findIndex((d) => d.slug === c.slug) + 1 || 99,
        updated_by: userData.user?.id ?? null,
      }))

      const { data, error: insertError } = await supabase
        .from('site_pages')
        .insert(payload)
        .select('slug, title, summary, body, sort_order, updated_at')

      if (insertError) throw insertError
      if (!data || data.length === 0) {
        setMessage('没能写入：数据库没有插入任何一行（检查一下权限策略）。')
        return
      }
      setMessage(`已写入 ${data.length} 页`)
      await load()
    } catch (err) {
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: unknown }).message)
          : String(err)
      setMessage('写入失败：' + msg)
    } finally {
      setSeeding(false)
    }
  }

  return (
    <section className="card rounded-box border border-base-300 bg-base-100/80 p-6 backdrop-blur shadow-sm">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/5">
          <Icon name="file" className="h-4 w-4 text-base-content/60" />
        </div>
        <div className="flex-1">
          <h2 className="text-sm font-semibold text-base-content">站点页面</h2>
          <p className="mt-0.5 text-[11px] text-base-content/40">
            公约、隐私、协议这些，改完点保存就生效，不用重新部署
          </p>
        </div>
        {message && <span className="text-[11px] text-primary">{message}</span>}
      </div>

      {message && message.includes('\n') && (
        <p className="mb-4 whitespace-pre-line rounded-box border border-red-100 bg-red-50 px-4 py-3 text-[11px] leading-relaxed text-red-600">
          {message}
        </p>
      )}

      {error && (
        <p className="mb-4 rounded-box border border-amber-100 bg-amber-50 px-4 py-3 text-xs text-amber-700">
          {error}
        </p>
      )}

      {missingCount > 0 && !error && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-box border border-base-300 bg-primary/5 px-4 py-3">
          <p className="flex-1 text-[11px] text-primary">
            有 {missingCount} 页还没存进数据库，前台现在显示的是内置初稿。
            写入之后就能在这里随意改。
          </p>
          <button
            type="button"
            disabled={seeding}
            onClick={() => void handleSeed()}
            className="rounded-box bg-gradient-to-r from-primary/20 to-primary/10 px-4 py-1.5 text-xs text-white transition hover:shadow-sm disabled:opacity-50"
          >
            {seeding ? '写入中…' : '写入初稿'}
          </button>
        </div>
      )}

      {loading && rows.length === 0 && catalog.length === 0 ? (
        <p className="py-10 text-center text-xs text-base-content/40">加载中…</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-[200px_1fr]">
          {/* 左侧目录 */}
          <nav className="flex flex-wrap gap-1.5 md:flex-col md:flex-nowrap">
            {catalog.map((r) => (
              <button
                key={r.slug}
                type="button"
                onClick={() => {
                  if (dirty && !window.confirm('这一页还没保存，切走会丢掉改动。继续？')) return
                  setActiveSlug(r.slug)
                }}
                className={`flex items-center gap-1.5 rounded-box px-3 py-2 text-left text-xs transition ${
                  r.slug === active?.slug
                    ? 'bg-primary/5 font-medium text-primary'
                    : 'text-base-content/60 hover:bg-primary/5'
                }`}
              >
                <span className="min-w-0 flex-1 truncate">{r.title}</span>
                {!r.inDb && <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-amber-400" title="还没存进数据库" />}
              </button>
            ))}
          </nav>

          {/* 右侧编辑 */}
          {active && (
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-base-content">{active.title}</span>
                <a
                  href={`/p/${active.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-base-content/60 underline"
                >
                  看前台效果 ↗
                </a>
                <span className="text-[11px] text-base-content/40">
                  更新于 {formatUpdated(active.updated_at)} · {draft.length} 字
                </span>
              </div>

              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={18}
                spellCheck={false}
                className="card w-full rounded-box border border-base-300 bg-base-100 px-4 py-3 font-mono text-[12px] leading-relaxed text-base-content focus:outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition"
              />

              <div className="mt-3 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={saving || !dirty}
                  onClick={() => void handleSave()}
                  className="rounded-box bg-gradient-to-r from-primary/20 to-primary/10 px-5 py-2 text-sm text-white transition hover:shadow-sm disabled:opacity-50"
                >
                  {saving ? '保存中…' : dirty ? '保存' : '没有改动'}
                </button>
                <button
                  type="button"
                  disabled={!dirty}
                  onClick={() => setDraft(originalBody)}
                  className="rounded-box border border-base-300 px-4 py-2 text-xs text-base-content/60 transition hover:bg-primary/5 disabled:opacity-40"
                >
                  放弃改动
                </button>
                <span className="text-[11px] text-base-content/40">
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
