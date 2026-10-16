'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Icon } from '../../../components/icons'
import { pageAccentVars } from '../../../components/theme'
import {
  PAGE_FALLBACK,
  formatUpdated,
  splitParagraphs,
  useSitePage,
  useSitePageList,
} from '../../../components/site-pages'

/**
 * 单张站点页面：/p/community、/p/privacy …
 *
 * 正文从数据库读，站主在后台改；这里只负责排版。
 *
 * 注意：useParams 在预渲染时需要 Suspense 边界，所以外面包一层。
 */
export default function SitePageView() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[var(--paper)]" style={pageAccentVars('home')}>
          <p className="py-24 text-center font-serif-cn text-sm text-base-content/60">翻页中…</p>
        </div>
      }
    >
      <SitePageInner />
    </Suspense>
  )
}

function SitePageInner() {
  const params = useParams()
  const slug = typeof params?.slug === 'string' ? params.slug : Array.isArray(params?.slug) ? params.slug[0] : null

  const { page, loading, error } = useSitePage(slug)
  const { pages } = useSitePageList()

  const fallback = PAGE_FALLBACK.find((p) => p.slug === slug) ?? null
  const title = page?.title ?? fallback?.title ?? '没找到这一页'
  const others = (pages.length > 0 ? pages : PAGE_FALLBACK).filter((p) => p.slug !== slug)

  return (
    <div className="min-h-screen bg-[var(--paper)]" style={pageAccentVars('home')}>
      <div className="mx-auto max-w-2xl px-6 py-10">
        <Link
          href="/p"
          className="inline-flex items-center gap-1.5 text-sm text-base-content/60 transition hover:text-[var(--accent-deep)]"
        >
          <Icon name="back" className="h-4 w-4" />
          全部条款与说明
        </Link>

        <article className="mt-5 rounded-box border border-base-300 bg-base-100/85 p-7 shadow-sm backdrop-blur">
          <header className="border-b border-dashed border-base-300 pb-4">
            <h1 className="font-serif-cn text-2xl font-semibold tracking-wide text-base-content">{title}</h1>
            {page?.summary && (
              <p className="mt-1.5 font-serif-cn text-xs text-base-content/60">{page.summary}</p>
            )}
            {page?.updated_at && (
              <p className="mt-2 text-[11px] text-base-content/60">
                最后更新：{formatUpdated(page.updated_at)}
              </p>
            )}
          </header>

          {loading ? (
            <p className="py-12 text-center font-serif-cn text-sm text-base-content/60">翻页中…</p>
          ) : error ? (
            <p className="py-10 text-center text-sm text-red-500">{error}</p>
          ) : !page ? (
            <div className="py-10 text-center">
              <p className="font-serif-cn text-sm text-base-content/60">
                这一页还没有内容{fallback ? '，或者还没建表' : ''}。
              </p>
              <Link
                href="/p"
                className="mt-4 inline-block rounded-box bg-primary px-4 py-2 text-xs text-white transition hover:bg-[var(--accent-deep)]"
              >
                回去看看有哪些页
              </Link>
            </div>
          ) : (
            <div className="mt-5 space-y-4">
              {splitParagraphs(page.body).map((block, i) => {
                const lines = block.split('\n').map((l) => l.trim()).filter(Boolean)
                const isList = lines.length > 1 && lines.every((l) => /^[·•\-]|^\d+[.、]/.test(l))
                return isList ? (
                  <ul key={i} className="space-y-1.5">
                    {lines.map((line, j) => (
                      <li
                        key={j}
                        className="font-serif-cn text-[13px] leading-relaxed text-[#3a3229] before:mr-1.5 before:text-[var(--accent-light)] before:content-['']"
                      >
                        {line}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p
                    key={i}
                    className="whitespace-pre-line font-serif-cn text-[13px] leading-[1.9] text-[#3a3229]"
                  >
                    {block}
                  </p>
                )
              })}
            </div>
          )}
        </article>

        {others.length > 0 && (
          <nav className="mt-6">
            <p className="mb-2 font-serif-cn text-[11px] text-base-content/60">其他</p>
            <div className="flex flex-wrap gap-2">
              {others.map((p) => (
                <Link
                  key={p.slug}
                  href={`/p/${p.slug}`}
                  className="rounded-full border border-base-300 bg-base-100/70 px-3 py-1.5 text-[11px] text-[var(--accent-deep)] transition hover:bg-primary/5"
                >
                  {p.title}
                </Link>
              ))}
            </div>
          </nav>
        )}
      </div>
    </div>
  )
}
