'use client'

import Link from 'next/link'
import { Icon } from '../../components/icons'
import { pageAccentVars } from '../../components/theme'
import { PAGE_FALLBACK, useSitePageList } from '../../components/site-pages'

/** 条款与说明的目录页：/p */

export default function SitePageIndex() {
  const { pages, loading } = useSitePageList()
  const list = pages.length > 0 ? pages : PAGE_FALLBACK

  return (
    <div className="min-h-screen bg-[var(--paper)]" style={pageAccentVars('home')}>
      <div className="mx-auto max-w-2xl px-6 py-10">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-base-content/60 transition hover:text-primary"
        >
          <Icon name="back" className="h-4 w-4" />
          回首页
        </Link>

        <header className="mt-5 mb-5">
          <h1 className="font-serif-cn text-2xl font-semibold tracking-wide text-base-content">
            条款与说明
          </h1>
          <p className="mt-1.5 font-serif-cn text-xs text-base-content/60">
            这个站怎么运转、你的东西怎么被对待，都写在这里
          </p>
        </header>

        {loading && pages.length === 0 ? (
          <p className="py-12 text-center font-serif-cn text-sm text-base-content/60">翻页中…</p>
        ) : (
          <div className="space-y-2.5">
            {list.map((p) => (
              <Link
                key={p.slug}
                href={`/p/${p.slug}`}
                className="flex items-center gap-3 rounded-box border border-base-300 bg-base-100/85 px-5 py-4 transition hover:border-primary/40 hover:shadow-sm"
              >
                <span className="min-w-0 flex-1">
                  <span className="block font-serif-cn text-sm font-medium text-base-content">{p.title}</span>
                  {p.summary && (
                    <span className="mt-0.5 block font-serif-cn text-[11px] text-base-content/60">
                      {p.summary}
                    </span>
                  )}
                </span>
                <Icon name="arrow" className="h-4 w-4 flex-shrink-0 text-accent" />
              </Link>
            ))}
          </div>
        )}

        <p className="mt-6 text-center font-serif-cn text-[11px] text-base-content/60">
          内容由站主随时修订，以本页最新版本为准
        </p>
      </div>
    </div>
  )
}
