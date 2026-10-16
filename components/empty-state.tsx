'use client'

import Link from 'next/link'

/**
 * 空状态：一张小插画 + 一句话 + 可选的去处
 *
 * 颜色全部走 treehole 主题（不写死任何色值）：
 *   · 插画用 text-accent（主题的蜜金）
 *   · 标题 text-base-content、说明 text-base-content/60
 *   · 去处用 btn btn-sm btn-primary
 *
 * 居中**自己写**（flex + items-center + text-center），不用 daisyUI 的 empty 布局类：
 * 上一版图省事直接套 `empty`，结果插画与文字变成左对齐 —— 储物箱那一屏就是"歪的"。
 * 我看不到渲染，所以布局只用确定性的类，不赌别人组件的默认值。
 * 所以这里也没有任何写死色值；换主题时它自己会跟着变。
 *
 * 对外 API 没变（art / title / hint / action / compact），
 * 所以十几处调用点一行都不用改。
 */

export type EmptyArt = 'mail' | 'leaf' | 'search' | 'box' | 'list' | 'friends' | 'heart'

function Art({ art, className = '' }: { art: EmptyArt; className?: string }) {
  const common = {
    className,
    viewBox: '0 0 64 64',
    fill: 'none' as const,
    stroke: 'currentColor',
    strokeWidth: 1.6,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }

  switch (art) {
    case 'leaf':
      return (
        <svg {...common}>
          <path d="M32 54V24" />
          <path d="M32 36c-11 0-17-6-18-16 11-1 17 5 18 16z" fill="currentColor" opacity="0.22" stroke="none" />
          <path d="M32 34c10-1 16-7 17-17-11-1-16 5-17 17z" fill="currentColor" opacity="0.38" stroke="none" />
          <path d="M32 36c-11 0-17-6-18-16 11-1 17 5 18 16z" />
          <path d="M32 34c10-1 16-7 17-17-11-1-16 5-17 17z" />
          <path d="M24 54h16" opacity="0.5" />
        </svg>
      )
    case 'search':
      return (
        <svg {...common}>
          <circle cx="28" cy="28" r="13" />
          <path d="M38 38l13 13" />
          <path d="M22 25h12M22 31h8" opacity="0.45" />
        </svg>
      )
    case 'box':
      return (
        <svg {...common}>
          <path d="M14 26h36v20a4 4 0 0 1-4 4H18a4 4 0 0 1-4-4V26z" />
          <path d="M10 17h44v9H10z" />
          <path d="M32 17v33" opacity="0.35" />
          <path d="M26 17h12" opacity="0.35" />
        </svg>
      )
    case 'list':
      return (
        <svg {...common}>
          <rect x="15" y="9" width="34" height="46" rx="5" />
          <path d="M23 21h18M23 29h18" opacity="0.45" />
          <path d="M23 39l3.5 3.5L34 35" />
          <path d="M38 45h4" opacity="0.45" />
        </svg>
      )
    case 'friends':
      return (
        <svg {...common}>
          <circle cx="24" cy="24" r="8" />
          <path d="M10 50c0-8 6-13 14-13s14 5 14 13" />
          <circle cx="44" cy="26" r="6" opacity="0.55" />
          <path d="M36 50c0-6 4-10 9-10s9 4 9 10" opacity="0.55" />
        </svg>
      )
    case 'heart':
      return (
        <svg {...common}>
          <path d="M32 50S12 38 12 26a10 10 0 0 1 20-4 10 10 0 0 1 20 4c0 12-20 24-20 24z" />
          <path d="M48 12v5M45.5 14.5h5" opacity="0.5" />
        </svg>
      )
    case 'mail':
    default:
      return (
        <svg {...common}>
          <rect x="10" y="20" width="44" height="30" rx="5" />
          <path d="M11 24l21 15 21-15" />
          <path
            d="M32 12s-4-2.4-4-5.4a2.4 2.4 0 0 1 4-1.4 2.4 2.4 0 0 1 4 1.4c0 3-4 5.4-4 5.4z"
            fill="currentColor"
            opacity="0.45"
            stroke="none"
          />
        </svg>
      )
  }
}

export function EmptyState({
  art = 'mail',
  title,
  hint,
  action,
  className = '',
  compact = false,
}: {
  art?: EmptyArt
  title: string
  hint?: string
  /** 给一个去处：{ href, label } */
  action?: { href: string; label: string }
  className?: string
  /** 紧凑版：卡片内嵌时用，插画更小 */
  compact?: boolean
}) {
  return (
    /*
     * 居中**自己写死**（flex + items-center + text-center），不用 daisyUI 的 empty 布局类：
     * 上一版图省事直接套 `empty`，结果插画和文字变成左对齐 —— 储物箱那一屏就是"歪的"。
     * empty 的布局不是我能肉眼验证的（我看不到渲染），所以这里只用确定性的类。
     */
    <div
      className={`flex flex-col items-center justify-center text-center ${
        compact ? 'py-8' : 'py-14'
      } ${className}`}
    >
      <Art
        art={art}
        className={`${compact ? 'h-12 w-12' : 'h-16 w-16'} animate-float text-accent`}
      />
      <p className={`font-serif-cn mt-4 ${compact ? 'text-xs' : 'text-sm'} text-base-content`}>
        {title}
      </p>
      {hint && (
        <p className="font-serif-cn mt-1.5 max-w-xs text-[11px] leading-relaxed text-base-content/60">
          {hint}
        </p>
      )}
      {action && (
        <Link href={action.href} className="btn btn-sm btn-primary mt-4">
          {action.label}
        </Link>
      )}
    </div>
  )
}
