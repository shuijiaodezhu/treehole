'use client'

import { usePathname } from 'next/navigation'
import { pageAccentVars, type PageKey } from './theme'

/**
 * 整站边缘装饰（信纸边 + 两个小图案）
 *
 * 两个「匹配」：
 *   1. 颜色跟着页面主色走 —— 用 var(--accent-line) / var(--accent-light)，
 *      主色是绿（院子）、蓝（聚会）、紫（我的）时自动换色，不会撞色。
 *      用户在「设置 → 页面配色」里改过主色，这里也跟着变。
 *   2. 图案跟着页面换 —— 院子放叶子、聚会放靶心、小屋放房子、我的放方块、
 *      首页放信封（和后台上每个模块的图标一致）。
 *
 * 几个刻意的取舍：
 *   · 只画线，不填色，只用主色系里最淡的两档 → 不抢内容
 *   · absolute + body 定位祖先 = **整页铺满**：虚线框只在页面最外沿，
 *     不会横穿内容；竖线锚在首屏 34% 处，小点在页面右下角。
 *   · z-0 压在最底层，只画线、极淡，不影响阅读
 *   · lg 以下不显示，手机上留白本来就少
 *
 * 路径用 window.location 在挂载后读，不用 usePathname：
 * 后者在预渲染动态路由时需要 Suspense 边界，挂在根 layout 上容易踩坑。
 */

function pageKeyFor(pathname: string): PageKey {
  if (pathname.startsWith('/world')) return 'world'
  if (pathname.startsWith('/play')) return 'play'
  if (pathname.startsWith('/friends')) return 'friends'
  if (pathname.startsWith('/me') || pathname.startsWith('/admin')) return 'me'
  return 'home'
}

/** 每个页面角落的小图案（线稿，32×32） */
function Motif({ page, className = '' }: { page: PageKey; className?: string }): React.ReactElement | null {
  const base = {
    className,
    viewBox: '0 0 32 32',
    fill: 'none' as const,
    stroke: 'currentColor',
    strokeWidth: 1.4,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }

  switch (page) {
    case 'world': // 院子：一株小叶子
      return (
        <svg {...base}>
          <path d="M16 28V13" />
          <path d="M16 19c-6 0-9.5-3.4-10-9 6-.6 9.6 2.8 10 9z" />
          <path d="M16 17c5.6-.6 9-4 9.5-9.4-6-.6-9 2.8-9.5 9.4z" />
        </svg>
      )
    case 'play': // 聚会：靶心
      return (
        <svg {...base}>
          <circle cx="16" cy="16" r="11" />
          <circle cx="16" cy="16" r="6.5" opacity="0.75" />
          <circle cx="16" cy="16" r="1.6" fill="currentColor" stroke="none" />
        </svg>
      )
    case 'friends': // 小屋：一座房子
      return (
        <svg {...base}>
          <path d="M5 15 16 6l11 9" />
          <path d="M7.5 13.5V26h17V13.5" />
          <path d="M13.5 26v-6h5v6" />
        </svg>
      )
    case 'me': // 我的：一个方块
      return (
        <svg {...base}>
          <path d="M16 4l10 5.6v12.8L16 28 6 22.4V9.6z" />
          <path d="M6 9.6 16 15l10-5.4M16 15v13" opacity="0.7" />
        </svg>
      )
    case 'home':
    default:
      // 首页不放角落图案：那一块有 hero 的大字与卡片，再加一个记号反而杂。
      // （原来这里画的是"一封信"，一直钉在左下角，滚到哪都看得见。）
      return null
  }
}

/** 右下角三颗小点，所有页面通用 */
function Dots({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="8" cy="24" r="1.8" fill="currentColor" />
      <circle cx="16" cy="16" r="1.4" fill="currentColor" opacity="0.75" />
      <circle cx="24" cy="8" r="1" fill="currentColor" opacity="0.5" />
    </svg>
  )
}

export function PageDecor() {
  // 用 usePathname 而不是 window.location：
  // layout 在客户端导航时不会重新挂载，读一次 window.location 会永远停在第一个页面。
  const pathname = usePathname() ?? '/'
  const page = pageKeyFor(pathname)

  return (
    <div
      aria-hidden="true"
      style={pageAccentVars(page)}
      className="pointer-events-none absolute inset-0 z-0 hidden select-none lg:block"
    >
      {/* 纸边：离屏幕边一点点的一圈细虚线 */}
      <div className="absolute inset-4 rounded-[30px] border border-dashed border-[var(--accent-line)]" />

      {/* 两条竖向虚线：像信纸的边线 */}
      <span className="absolute left-4 top-[34vh] h-32 w-px border-l border-dashed border-[var(--accent-line)]" />
      <span className="absolute right-4 top-[34vh] h-32 w-px border-l border-dashed border-[var(--accent-line)]" />

      {/* 左下：当前页面的图案（首页没有） */}
      {page !== 'home' && (
        <Motif page={page} className="absolute bottom-9 left-10 h-10 w-10 text-[var(--accent-light)]" />
      )}

      {/* 右下：三颗小点 */}
      <Dots className="absolute bottom-9 right-10 h-9 w-9 text-[var(--accent-light)]" />
    </div>
  )
}
