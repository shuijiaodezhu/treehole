'use client'

import { useEffect, useState } from 'react'
import { createClient } from '../app/lib/supabase'

/**
 * 站点页面（公约 / 隐私 / 协议 / 关于…）
 *
 * 正文存在 public.site_pages，站主在后台直接改，不用重新部署。
 * 见 supabase-site-pages.sql
 */

const supabase = createClient()

export type SitePage = {
  slug: string
  title: string
  summary: string | null
  body: string
  sort_order: number
  updated_at: string
}

/** 兜底目录：数据库还没建表时也能给出入口 */
export const PAGE_FALLBACK: { slug: string; title: string; summary: string }[] = [
  { slug: 'community', title: '社区公约', summary: '成文的「什么能做、什么不能做」' },
  { slug: 'moderation', title: '内容审核指引', summary: '站主判罚的尺度' },
  { slug: 'reporting', title: '举报处理流程', summary: '多久处理、怎么回复举报人' },
  { slug: 'appeal', title: '申诉机制', summary: '被封的人怎么申诉' },
  { slug: 'privacy', title: '隐私政策', summary: '收集什么数据、怎么用' },
  { slug: 'terms', title: '用户协议', summary: '注册时勾选的条款' },
  { slug: 'about', title: '关于', summary: '这个站、站主、联系方式' },
]

/** 取目录（不含正文，省流量） */
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
        if (!cancelled) {
          const rows = (data ?? []) as { slug: string; title: string; summary: string | null }[]
          setPages(
            rows.map((p) => ({
              slug: p.slug,
              title: p.title,
              summary: p.summary ?? null,
            })),
          )
        }
      } catch (err) {
        console.error('读取站点页面目录失败:', err)
        if (!cancelled) setPages([])
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

/** 取单页正文 */
export function useSitePage(slug: string | null) {
  const [page, setPage] = useState<SitePage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!slug) return
    let cancelled = false
    void (async () => {
      setLoading(true)
      try {
        const { data, error: queryError } = await supabase
          .from('site_pages')
          .select('slug, title, summary, body, sort_order, updated_at')
          .eq('slug', slug)
          .maybeSingle()

        if (queryError) throw queryError
        if (!cancelled) {
          setPage((data as unknown as SitePage) ?? null)
          setError('')
        }
      } catch (err) {
        console.error('读取站点页面失败:', err)
        if (!cancelled) setError('正文加载失败（可能还没跑 supabase-site-pages.sql）')
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
