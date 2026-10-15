import type { MetadataRoute } from 'next'

/**
 * robots.txt
 *
 * 这是个给朋友用的小站，里面全是私人的东西（动态、私信、冬日信箱）。
 * 所以默认**不让搜索引擎抓任何页面**，只放开三个中性的：
 *   · /login、/register —— 入口页，被抓到也无所谓（登录后才有内容）
 *   · /p/……            —— 公约、隐私、协议这些治理页面，本来就该让外面看得到
 *
 * 注意：robots.txt 只是**请求**，规矩的爬虫会遵守，不规矩的不会。
 * 要更硬的保证得给页面加 noindex —— 但那会把上面这三个也挡掉，
 * 所以这里不用。真要"整站别被抓"，跟我说一声，我给根 layout 加全局 noindex。
 */
export default function robots(): MetadataRoute.Robots {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '')

  return {
    rules: [
      {
        userAgent: '*',
        // 先全部关掉，再逐个放开
        disallow: '/',
        allow: ['/login', '/register', '/p/'],
      },
    ],
    // sitemap 只列上面放开的那几个（见 app/sitemap.ts）
    sitemap: `${base}/sitemap.xml`,
  }
}
