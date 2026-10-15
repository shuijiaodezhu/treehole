import type { MetadataRoute } from 'next'
import { DEFAULT_PAGES } from '../components/site-page-defaults'

/**
 * sitemap.xml
 *
 * **只列 robots.txt 里放开的那几个页面**，别的都不写——
 * 一份"列了却被 disallow"的 sitemap 是自相矛盾的，
 * 而且会主动告诉爬虫这里有东西。
 *
 * slug 直接从内置页面清单里取，所以以后增删治理页面不用改这里。
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '')

  // 不写 lastModified：那个字段要真实反映内容修改时间，
  // 而我们这里没有可靠的来源，填构建时间等于骗爬虫，不如不填。
  return [
    { url: `${base}/login`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/register`, changeFrequency: 'yearly', priority: 0.3 },
    ...DEFAULT_PAGES.map((page) => ({
      url: `${base}/p/${page.slug}`,
      changeFrequency: 'monthly' as const,
      priority: 0.5,
    })),
  ]
}
