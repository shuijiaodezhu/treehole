'use client'

import { useEffect, useState } from 'react'
import { createClient } from '../app/lib/supabase'
import { DEFAULT_PAGES, findDefaultPage } from './site-page-defaults'

/**
 * 站点页面（公约 / 隐私 / 协议 / 关于…）
 *
 * 正文存在 public.site_pages，站主在后台直接改，不用重新部署。
 * 数据库还没写数据时，用内置初稿（components/site-page-defaults.ts）兜底，
 * 所以这些页面永远不会是空的。
 */

const supabase = createClient()

export type SitePage = {
  slug: string
  title: string
  summary: string | null
  body: string
  sort_order: number
  updated_at: string
  /** true = 数据库里还没有这一条，正文来自内置初稿 */
  isDefault: boolean
}

/** 兜底目录：数据库还没数据时也能给出全部入口 */
export const PAGE_FALLBACK: { slug: string; title: string; summary: string }[] = DEFAULT_PAGES.map((p) => ({
  slug: p.slug,
  title: p.title,
  summary: p.summary,
}))

/** 取目录（不含正文，省流量）；数据库缺哪条就用内置初稿补上 */
export function useSitePageList() {
  const [pages, setPages] = useState<{ slug: string; title: string; summary: string | null }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const { data, error } = await supabase
          .from('site_pages')
          .select('slug, title, summary, sort_order')
          .order('sort_order', { ascending: true })

        if (error) throw error
        if (cancelled) return

        const rows = (data ?? []) as { slug: string; title: string; summary: string | null }[]
        const seen = new Set(rows.map((r) => r.slug))
        const merged = [
          ...rows.map((p) => ({ slug: p.slug, title: p.title, summary: p.summary ?? null })),
          // 数据库里没有的，用内置初稿补位（保持原来的顺序感）
          ...DEFAULT_PAGES.filter((p) => !seen.has(p.slug)).map((p) => ({
            slug: p.slug,
            title: p.title,
            summary: p.summary,
          })),
        ]
        setPages(merged)
      } catch (err) {
        console.error('读取站点页面目录失败，改用内置初稿:', err)
        if (!cancelled) setPages(PAGE_FALLBACK)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return { pages, loading }
}

/** 取单页正文：数据库优先，缺了就用内置初稿 */
export function useSitePage(slug: string | null) {
  const [page, setPage] = useState<SitePage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!slug) return
    let cancelled = false
    void (async () => {
      setLoading(true)
      const fallback = findDefaultPage(slug)
      try {
        const { data, error: queryError } = await supabase
          .from('site_pages')
          .select('slug, title, summary, body, sort_order, updated_at')
          .eq('slug', slug)
          .maybeSingle()

        if (queryError) throw queryError
        if (cancelled) return

        if (data) {
          setPage({ ...(data as unknown as Omit<SitePage, 'isDefault'>), isDefault: false })
        } else if (fallback) {
          setPage({ ...fallback, sort_order: 0, updated_at: '', isDefault: true })
        } else {
          setPage(null)
        }
        setError('')
      } catch (err) {
        console.error('读取站点页面失败，改用内置初稿:', err)
        if (cancelled) return
        if (fallback) {
          setPage({ ...fallback, sort_order: 0, updated_at: '', isDefault: true })
          setError('')
        } else {
          setError('正文加载失败（可能还没跑 supabase-site-pages.sql）')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [slug])

  return { page, loading, error }
}

/** 把正文按段落渲染用的切分（空行分段，行首 · / 数字 保持原样） */
export function splitParagraphs(body: string): string[] {
  return body
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
}

export function formatUpdated(iso: string | null | undefined): string {
  if (!iso) return ''
  try {
    return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }).format(
      new Date(iso),
    )
  } catch {
    return ''
  }
}
